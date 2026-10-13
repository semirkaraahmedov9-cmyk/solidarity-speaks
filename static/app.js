// Логика на страницата: преводи, качване на файл и списък с глави, превръщане на текст в реч.
"use strict";

const SPEEDS = [0.75, 1, 1.25, 1.5];
const LANGUAGES = ["bg", "en"];

const state = {
  lang: "bg",
  texts: {},            // текущите преводи
  voices: [],           // гласовете от сървъра
  maxChars: 10000,
  maxUploadMb: 50,
  extensions: [".pdf", ".epub", ".docx", ".txt"],
  busy: { upload: false, paste: false },  // true, докато се чака сървърът
  audioUrl: null,       // адрес на последния MP3 в паметта на браузъра
  book: null,           // последният резултат за главите
  // Последните съобщения във всяка част на страницата (за смяна на езика)
  messages: {
    upload: { status: null, error: null },
    paste: { status: null, error: null },
  },
};

const $ = (id) => document.getElementById(id);

// Връща превод по ключ и замества {max}, {name} и др. със стойности
function t(key, values = {}) {
  let text = state.texts[key] ?? key;
  for (const [name, value] of Object.entries(values)) {
    text = text.replaceAll(`{${name}}`, value);
  }
  return text;
}

function formatNumber(number) {
  return new Intl.NumberFormat(state.lang).format(number);
}

// „около 2 440 думи“: големите числа се закръгляват до десетици
function formatWords(words) {
  return formatNumber(words >= 100 ? Math.round(words / 10) * 10 : words);
}

function formatDuration(minutes) {
  const total = Math.round(minutes);
  if (total < 1) return t("duration_under_minute");
  if (total < 60) return t("duration_minutes", { m: total });
  return t("duration_hours", { h: Math.floor(total / 60), m: total % 60 });
}

// --- Език ---

function savedLanguage() {
  try {
    const lang = localStorage.getItem("lang");
    return LANGUAGES.includes(lang) ? lang : "bg";
  } catch {
    return "bg";
  }
}

async function setLanguage(lang) {
  const response = await fetch(`i18n/${lang}.json`);
  state.texts = await response.json();
  state.lang = lang;
  try {
    localStorage.setItem("lang", lang);
  } catch {
    // Браузърът не позволява запазване; езикът просто няма да се запомни
  }
  applyTexts();
}

// Попълва всички текстове на страницата на текущия език
function applyTexts() {
  document.documentElement.lang = state.lang;
  document.querySelectorAll("[data-i18n]").forEach((element) => {
    element.textContent = t(element.dataset.i18n);
  });

  const toggle = $("lang-toggle");
  toggle.textContent = t("switch_language");
  toggle.lang = t("switch_language_lang");

  $("text-hint").textContent = t("hint_text", { max: formatNumber(state.maxChars) });
  $("file-hint").textContent = t("hint_file", { max: state.maxUploadMb });
  $("download").download = t("download_filename");

  fillVoiceOptions();
  fillSpeedOptions();
  renderMessages("upload");
  renderMessages("paste");
  if (state.book) renderChapters();
}

// --- Падащи менюта ---

function fillVoiceOptions() {
  const select = $("voice");
  const selected = select.value;
  select.replaceChildren();
  for (const voice of state.voices) {
    const details = [];
    if (voice.language) details.push(t(`language_${voice.language}`));
    if (voice.gender) details.push(t(`gender_${voice.gender}`));
    const label = details.length ? `${voice.name} – ${details.join(", ")}` : voice.name;
    select.add(new Option(label, voice.id));
  }
  // Запазваме избрания глас; иначе първият глас на езика на страницата
  const preferred = state.voices.find((voice) => voice.language === state.lang);
  select.value = selected || (preferred ? preferred.id : select.value);
}

function fillSpeedOptions() {
  const select = $("speed");
  const selected = select.value || "1";
  select.replaceChildren();
  for (const speed of SPEEDS) {
    let note = "speed_normal";
    if (speed < 1) note = "speed_slower";
    if (speed > 1) note = "speed_faster";
    select.add(new Option(`${formatNumber(speed)}× (${t(note)})`, String(speed)));
  }
  select.value = selected;
}

// --- Съобщения ---
// area е "upload" или "paste": всяка част на страницата има свои съобщения.
// Пазим ключа и стойностите, за да можем да ги преведем при смяна на езика.

function showStatus(area, key, values = {}) {
  state.messages[area].status = key ? { key, values } : null;
  renderMessages(area);
}

function showError(area, code) {
  state.messages[area].error = code;
  renderMessages(area);
}

function renderMessages(area) {
  const { status, error } = state.messages[area];
  $(`${area}-status`).textContent = status ? t(status.key, status.values) : "";

  // Грешките имат и думата „Грешка:“, не само червен цвят
  const box = $(`${area}-error`);
  box.replaceChildren();
  if (!error) return;
  const prefix = document.createElement("strong");
  prefix.textContent = t("error_prefix") + " ";
  const max = area === "upload" ? state.maxUploadMb : formatNumber(state.maxChars);
  box.append(prefix, t(`error_${error}`, { max }));
}

// Грешка без наш код означава, че сървърът не е отговорил
function errorCode(error) {
  const code = error && error.message;
  return code && state.texts[`error_${code}`] ? code : "network";
}

async function postAndCheck(url, options) {
  const response = await fetch(url, { method: "POST", ...options });
  if (!response.ok) {
    const data = await response.json().catch(() => ({}));
    throw new Error(data.error || "conversion_failed");
  }
  return response;
}

// aria-disabled вместо disabled, за да не се губи фокусът от бутона
function setBusy(area, busy) {
  state.busy[area] = busy;
  const button = area === "upload" ? $("analyze") : $("convert");
  button.setAttribute("aria-disabled", String(busy));
  $("main").setAttribute("aria-busy", String(state.busy.upload || state.busy.paste));
}

// --- Качване на файл и глави ---

function fileExtension(name) {
  const dot = name.lastIndexOf(".");
  return dot >= 0 ? name.slice(dot).toLowerCase() : "";
}

async function analyzeFile(event) {
  event.preventDefault();
  if (state.busy.upload) return;

  const file = $("file").files[0];
  showError("upload", null);
  // Проверки още в браузъра, за да не се чака излишно
  let problem = null;
  if (!file) problem = "no_file";
  else if (!state.extensions.includes(fileExtension(file.name))) problem = "unsupported_type";
  else if (file.size > state.maxUploadMb * 1024 * 1024) problem = "file_too_large";
  else if (file.size === 0) problem = "empty_file";
  if (problem) {
    showStatus("upload", null);
    showError("upload", problem);
    $("file").focus();
    return;
  }

  setBusy("upload", true);
  showStatus("upload", "status_reading_file");
  state.book = null;
  $("chapters").hidden = true;
  try {
    const form = new FormData();
    form.append("file", file);
    const response = await postAndCheck("api/chapters", { body: form });
    state.book = await response.json();
    renderChapters();
    showStatus("upload", "status_chapters_found", { count: state.book.chapters.length });
  } catch (error) {
    showStatus("upload", null);
    showError("upload", errorCode(error));
  } finally {
    setBusy("upload", false);
  }
}

function chapterTitle(chapter) {
  if (chapter.intro) return t("chapter_intro");
  return chapter.title || t("chapter_untitled", { n: chapter.number });
}

function renderChapters() {
  const book = state.book;
  $("chapters-heading").textContent = t("chapters_heading", { name: book.filename });
  $("chapters-summary").textContent = t("chapters_summary", {
    count: book.chapters.length,
    words: formatWords(book.total_words),
    duration: formatDuration(book.total_minutes),
  });
  $("chapters-note").textContent =
    book.source === "parts" ? t("chapters_note_parts", { words: formatNumber(book.part_words) }) : "";

  const list = $("chapter-list");
  list.replaceChildren();
  for (const chapter of book.chapters) {
    const item = document.createElement("li");
    const title = document.createElement("span");
    title.className = "chapter-title";
    title.textContent = chapterTitle(chapter);
    const details = document.createElement("span");
    details.className = "chapter-details";
    details.textContent = t("chapter_details", {
      words: formatWords(chapter.words),
      duration: formatDuration(chapter.minutes),
    });
    item.append(title, " ", details);
    list.append(item);
  }
  $("chapters").hidden = false;
}

// Провлачване на файл с мишката (допълнение към бутона, не замяна)
function setUpDropZone() {
  const zone = $("drop-zone");
  // Файл, пуснат извън рамката, не трябва да отваря нова страница в браузъра
  window.addEventListener("dragover", (event) => event.preventDefault());
  window.addEventListener("drop", (event) => event.preventDefault());

  zone.addEventListener("dragover", (event) => {
    event.preventDefault();
    zone.classList.add("dragging");
  });
  zone.addEventListener("dragleave", () => zone.classList.remove("dragging"));
  zone.addEventListener("drop", (event) => {
    event.preventDefault();
    zone.classList.remove("dragging");
    if (event.dataTransfer.files.length) {
      $("file").files = event.dataTransfer.files;
      fileSelected();
    }
  });
}

function fileSelected() {
  const file = $("file").files[0];
  showError("upload", null);
  showStatus("upload", file ? "status_file_selected" : null, { name: file ? file.name : "" });
}

// --- Превръщане на поставен текст в реч ---

async function convert(event) {
  event.preventDefault();
  if (state.busy.paste) return;

  const text = $("text").value.trim();
  showError("paste", null);
  if (!text || text.length > state.maxChars) {
    showError("paste", text ? "text_too_long" : "empty_text");
    $("text").focus();
    return;
  }

  setBusy("paste", true);
  showStatus("paste", "status_converting");
  try {
    const response = await postAndCheck("api/speak", {
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: $("voice").value,
        speed: Number($("speed").value),
      }),
    });
    showResult(await response.blob());
    showStatus("paste", "status_ready");
  } catch (error) {
    showStatus("paste", null);
    showError("paste", errorCode(error));
  } finally {
    setBusy("paste", false);
  }
}

function showResult(blob) {
  if (state.audioUrl) URL.revokeObjectURL(state.audioUrl);
  state.audioUrl = URL.createObjectURL(blob);
  $("player").src = state.audioUrl; // без автоматично пускане
  $("download").href = state.audioUrl;
  $("result").hidden = false;
}

// --- Стартиране ---

async function start() {
  await setLanguage(savedLanguage());
  showStatus("paste", "status_loading");

  try {
    const response = await fetch("api/voices");
    const data = await response.json();
    state.voices = data.voices;
    state.maxChars = data.max_text_chars;
    state.maxUploadMb = data.max_upload_mb;
    state.extensions = data.allowed_extensions;
  } catch {
    showStatus("paste", null);
    showError("paste", "network");
    return;
  }
  showStatus("paste", null);
  applyTexts();
  if (!state.voices.length) showError("paste", "no_voices");

  $("upload-form").addEventListener("submit", analyzeFile);
  $("file").addEventListener("change", fileSelected);
  setUpDropZone();
  $("speak-form").addEventListener("submit", convert);
  $("lang-toggle").addEventListener("click", () => {
    setLanguage(state.lang === "bg" ? "en" : "bg");
  });
}

start();
