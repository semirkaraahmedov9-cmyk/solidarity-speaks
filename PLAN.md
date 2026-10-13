# Build plan — Solidarity Speaks!

Work one phase at a time. Each phase ends with something the owner can test in the browser.
At the end of each phase: tick the boxes, give the owner a "How to test this" list, commit, and **ask before pushing to GitHub**.

---

## Phase 0 — Project setup and GitHub
- [ ] Check that Python 3.11+ and Git are installed on this Windows computer. If not, give install steps (`winget`).
- [x] Create the folder structure: `app/` (backend), `static/` (HTML/CSS/JS, `i18n/`), `voices/`, `scripts/`, `tests/`, `data/` (temporary files, git-ignored).
- [ ] Create a Python virtual environment and `requirements.txt`.
- [x] Add `.gitignore` (venv, `data/`, `voices/*.onnx*`, `.env`, `__pycache__`).
- [x] Choose the licence (see CLAUDE.md), explain it to the owner, and add `LICENSE`.
- [x] Add a short README (English, plus a Bulgarian summary) with "how to run locally".
- [x] `git init`, first commit, create a **public** GitHub repo with the GitHub CLI (`gh repo create`), and push. Ask the owner for the repo name and whether it goes under his personal account or the organisation's account.

**Done when:** the empty project is on GitHub and the owner can see it in the browser.

## Phase 1 — Paste text → hear it
- [ ] `scripts/download_voices.py`: download the Bulgarian Piper voice(s) and one male + one female English voice into `voices/`. Create `voices/voices.json`.
- [ ] Backend: load the voices at startup; endpoint that takes text + voice + speed and returns an MP3.
- [ ] Simple accessible page: text box, voice dropdown, speed control (0.75×–1.5×), "Convert" button, audio player, download link.
- [ ] Bulgarian UI with the English toggle working from the start (translation files).
- [ ] One `run.ps1` (or clear command) so the owner can start the app with one line.

**Done when:** the owner pastes a Bulgarian paragraph and hears it in the browser, on his computer and on his phone (same Wi-Fi network).

## Phase 2 — Upload a file → see its chapters
- [ ] Upload form (button + drag-and-drop, but the button must work alone for keyboard/screen-reader users).
- [ ] Text extraction for TXT, DOCX, EPUB and PDF, as described in CLAUDE.md.
- [ ] Chapter splitting with the fallbacks described in CLAUDE.md.
- [ ] Detect scanned PDFs and show a friendly message.
- [ ] Show the list of detected chapters (title + approximate length/duration) before converting.
- [ ] `pytest` tests with one small sample file per format (create the samples yourself, with Bulgarian text).

**Done when:** the owner uploads one file of each type and sees sensible chapter lists.

## Phase 3 — Convert the whole book → download chapters
- [ ] Background conversion jobs with a job ID, in parallel across CPU cores.
- [ ] Progress bar + `aria-live` announcements ("Глава 3 от 12…").
- [ ] Result page: per-chapter play button + download link, and "Download all (ZIP)". Files named like `01 - Заглавие на главата.mp3`.
- [ ] Automatic cleanup of files older than 24 hours.
- [ ] Measure and report the conversion speed (e.g. "a 300-page book took X minutes on this computer"). If it is slow, suggest improvements.

**Done when:** the owner converts a real book, downloads chapters on his phone, and listens to them.

## Phase 4 — Polish: accessibility, mobile, errors
- [ ] Accessibility check against the CLAUDE.md list. Explain to the owner how to test with NVDA (free, Windows) and with his phone's screen reader.
- [ ] Mobile layout check at 360 px width. Large buttons, no horizontal scrolling.
- [ ] All error cases have friendly messages in both languages (too big, wrong type, scanned PDF, empty file, conversion failed).
- [ ] Upload size and job limits so one user can't overload the server.

**Done when:** the owner (and ideally a blind or dyslexic tester) can use the whole flow without help.

## Phase 5 — Better Bulgarian reading + "How to use" page
- [ ] Test how the voice reads numbers, dates, abbreviations ("г.", "т.е.", "др.", "ул.", "№") and Roman numerals. Add a small text-cleanup step that fixes the common problems.
- [ ] Remove page numbers, headers and footers that repeat on every PDF page.
- [ ] A "How to use Solidarity Speaks!" page (Bulgarian + English), simple and screen-reader friendly. This is a grant deliverable.
- [ ] An "About" page with the European Solidarity Corps funding notice and EU logo placement as required for EU-funded projects (ask the owner for the official logo file).

**Done when:** a Bulgarian book with numbers and abbreviations sounds natural, and the guide page exists.

## Phase 6 — Go online
- [ ] `Dockerfile` that downloads the voices during build.
- [ ] Explain the two hosting options to the owner in simple terms: a **Hugging Face Space** (free, may sleep when unused, slower CPU) vs a **cheap VPS** (about €4–6/month, always on, faster). Recommend one.
- [ ] Walk the owner through deploying step by step, with screenshots-level detail.
- [ ] Optional: deploy automatically whenever we push to GitHub.

**Done when:** the site works at a public web address and the owner's computer can be turned off.

---

## Not now (later phases — do not build yet)
- Public library page with the ~10 pilot audiobooks (grant deliverable, next after Phase 6).
- Our own volunteer-trained Bulgarian voices (they will just be dropped into `voices/`).
- OCR for scanned PDFs.
- User accounts, saved history, mobile app.
