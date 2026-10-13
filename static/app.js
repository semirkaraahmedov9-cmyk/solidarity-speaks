// Логика на страницата: преводи, списък с гласове, превръщане на текст в реч.
"use strict";

const SPEEDS = [0.75, 1, 1.25, 1.5];
const LANGUAGES = ["bg", "en"];

const state = {
  lang: "bg",
  texts: {},          // текущите преводи
  voices: [],         // гласовете от сървъра
  maxChars: 10000,
  busy: false,        // true, докато тече превръщане
  audioUrl: null,     // адрес на последния MP3 в паметта на браузъра
  lastStatus: null,   // ключ на последното съобщение (за смяна на езика)
  lastError: null,
};

const $ = (id) => document.getElementById(id);

// Връща превод по ключ и замества {max} и др. със стойности
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
  $("download").download = t("download_filename");

  fillVoiceOptions();
  fillSpeedOptions();
  if (state.lastStatus) showStatus(state.lastStatus);
  if (state.lastError) showError(state.lastError);
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

function showStatus(key) {
  state.lastStatus = key;
  $("status").textContent = key ? t(key) : "";
}

// Грешките имат и думата „Грешка:“, не само червен цвят
function showError(error) {
  state.lastError = error;
  const box = $("error");
  box.replaceChildren();
  if (!error) return;
  const prefix = document.createElement("strong");
  prefix.textContent = t("error_prefix") + " ";
  box.append(prefix, t(`error_${error}`, { max: formatNumber(state.maxChars) }));
}

// --- Превръщане в реч ---

async function convert(event) {
  event.preventDefault();
  if (state.busy) return;

  const text = $("text").value.trim();
  showError(null);
  if (!text) {
    showError("empty_text");
    $("text").focus();
    return;
  }
  if (text.length > state.maxChars) {
    showError("text_too_long");
    $("text").focus();
    return;
  }

  setBusy(true);
  showStatus("status_converting");
  try {
    const response = await fetch("api/speak", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        text,
        voice: $("voice").value,
        speed: Number($("speed").value),
      }),
    });
    if (!response.ok) {
      const data = await response.json().catch(() => ({}));
      throw new Error(data.error || "conversion_failed");
    }
    showResult(await response.blob());
    showStatus("status_ready");
  } catch (error) {
    showStatus(null);
    // Грешка без наш код означава, че сървърът не е отговорил
    const known = error.message && state.texts[`error_${error.message}`];
    showError(known ? error.message : "network");
  } finally {
    setBusy(false);
  }
}

function setBusy(busy) {
  state.busy = busy;
  // aria-disabled вместо disabled, за да не се губи фокусът от бутона
  $("convert").setAttribute("aria-disabled", String(busy));
  $("main").setAttribute("aria-busy", String(busy));
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
  const lang = savedLanguage();
  await setLanguage(lang);
  showStatus("status_loading");

  try {
    const response = await fetch("api/voices");
    const data = await response.json();
    state.voices = data.voices;
    state.maxChars = data.max_text_chars;
  } catch {
    showStatus(null);
    showError("network");
    return;
  }
  showStatus(null);
  applyTexts();
  if (!state.voices.length) showError("no_voices");

  $("speak-form").addEventListener("submit", convert);
  $("lang-toggle").addEventListener("click", () => {
    setLanguage(state.lang === "bg" ? "en" : "bg");
  });
}

start();
