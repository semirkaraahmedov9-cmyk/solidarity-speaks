# Solidarity Speaks! (Солидарността говори!)

## What this project is
A free, open-source website that turns documents into audiobooks.
A user uploads a PDF, EPUB, DOCX or TXT file (or pastes text). The site converts it to speech, split into chapters, and the user listens in the browser or downloads the MP3s.

It is funded by the European Solidarity Corps (project run by the youth organisation "Младежи за развитие и вдъхновение – МРВ", Chepintsi, Bulgaria). Its main users are **blind people, people with dyslexia, students and teachers**. Accessibility is not a nice-to-have. It is the reason the project exists.

## Who you are working with
The project owner is **new to programming**. Therefore:
- Explain what you are doing in plain, simple language. No unexplained jargon.
- Before running any command that installs software, changes system settings, or pushes to GitHub, say in one sentence what it does.
- When something needs the owner to act (install a program, click something, test in the browser), give exact step-by-step instructions for **Windows**, with commands for **PowerShell**.
- At the end of each phase, give a short "How to test this" list the owner can follow without technical knowledge.
- If a choice has real trade-offs, explain the options briefly and ask. Don't silently pick something complicated.
- Prefer the simplest solution that works. No extra frameworks, no premature optimisation, no features that are not in PLAN.md.

## Tech stack (decided, don't change without asking)
- **Backend:** Python 3.11+ with **FastAPI**. Run locally with `uvicorn`.
- **Text-to-speech:** **Piper TTS** (the `piper-tts` pip package, current maintained version). Check its current Python API in its docs/source before writing code; it has changed between versions.
- **Voices:** Piper voice models from the `rhasspy/piper-voices` collection on Hugging Face. Use the Bulgarian voice(s) under `bg/bg_BG` and English voice(s) under `en/`. Check what exists; don't invent voice names.
  - Voices are plain files in a `voices/` folder (`.onnx` + `.onnx.json`). The app discovers them automatically, so new voices (e.g. our own trained volunteer voices later) can be added by just dropping files in. Keep a small `voices/voices.json` with a display name, language and gender for each voice.
  - Voice model files are **not committed to git** (too large). Provide a script `scripts/download_voices.py` that downloads them.
- **Frontend:** plain **HTML + CSS + vanilla JavaScript**, served by FastAPI. **No React, no build step, no npm.**
- **Text extraction:**
  - PDF: PyMuPDF (`pymupdf`). It can also read the PDF's bookmarks for chapters.
  - EPUB: `ebooklib` + `beautifulsoup4`.
  - DOCX: `python-docx`.
  - TXT: read directly (handle UTF-8 and Windows-1251 encodings, common for Bulgarian).
- **MP3 encoding:** `lameenc` (pip package, so no separate ffmpeg install is needed on Windows). Mono, Piper's native sample rate, about 64 kbps. Small files matter for mobile users.
- **Tests:** `pytest`, with small sample files in `tests/samples/`.
- **Deployment (later phase):** a `Dockerfile`, targeting a Hugging Face Space (Docker) or a cheap VPS.

## Licence
The project must be open source. Check the licences of the dependencies (Piper's current version and PyMuPDF are GPL/AGPL-family). Choose a licence compatible with all of them (likely **AGPL-3.0**). Explain the choice to the owner in two sentences before adding the LICENSE file.

## How the app works
1. The user uploads a file or pastes text, and chooses a voice and a reading speed (0.75×–1.5×).
2. The backend extracts the text and splits it into chapters:
   - EPUB: use the table of contents / spine.
   - DOCX: use Heading styles.
   - PDF: use bookmarks. If there are none, detect lines like "Глава 1", "ГЛАВА ПЪРВА", "Chapter 1", Roman numerals.
   - If no chapters are found: split into parts of roughly 4,000–5,000 words, at paragraph boundaries ("Част 1", "Част 2"…).
3. The user sees the list of chapters found before converting.
4. Conversion runs as a background job. The page shows a progress bar (chapter X of Y, %). The frontend polls a status endpoint every 2 seconds.
5. When done, each chapter has a play button and its own download link, plus a "Download all (ZIP)" button. Per-chapter downloads matter because ZIP files are awkward on phones, especially iPhone.
6. Uploaded files and generated audio are deleted automatically after **24 hours**. There are no accounts and no logins, and the app keeps no personal data.

## Speed (conversion should be fast)
- Load each voice model once and reuse it. Never reload it per sentence.
- Convert chapters in parallel across CPU cores (process pool, one voice instance per worker).
- Synthesise sentence by sentence and encode to MP3 as you go, so a whole book is never held in memory.
- Make the worker count and limits configurable in one config file (`app/config.py`).

## Limits and errors
- Maximum upload: 50 MB (configurable). Allowed types: .pdf, .epub, .docx, .txt.
- **Scanned PDFs** (images, no text layer): detect them (almost no extractable text) and show a clear, friendly message. No OCR in this version.
- Every error shown to the user must be in plain language, in the user's chosen UI language. Never show a raw Python error.

## Accessibility (required, WCAG 2.1 AA)
- Fully usable with keyboard only and with screen readers (NVDA on Windows, VoiceOver and TalkBack on phones).
- Real `<label>`s on every control, a correct `lang` attribute on the page, and logical heading order.
- Progress and status updates announced via an `aria-live` region.
- Visible focus outlines, high contrast, large touch targets (min 44×44 px), and text that can be resized to 200% without breaking.
- Works well on **mobile phones first**, then desktop. Test layouts at 360 px width.
- No time limits, no auto-playing audio, no information conveyed by colour alone.

## Languages
- The interface is in **Bulgarian by default**, with an **English toggle**. All UI text lives in two simple translation files (`static/i18n/bg.json`, `static/i18n/en.json`). Never hard-code UI strings in HTML/JS.
- **Code comments in Bulgarian.** Variable, function and file names stay in English.
- The README is in English, with a short Bulgarian section at the top.

## Git and GitHub
- The project lives in a **public GitHub repository**.
- Commit after each working step, with clear messages in English (e.g. "Add EPUB chapter extraction").
- Push to GitHub at the end of each phase, after the owner has tested it. Ask before pushing.
- Never commit: voice model files, uploaded/generated files, `.env` files, virtual environments, or any volunteer voice recordings (personal data).

## Working with PLAN.md
- Work **one phase at a time**, in order. Stop at the end of each phase and wait for the owner.
- Tick the checkboxes in PLAN.md as items are completed, so a new session knows where the project is.
- Don't start features from later phases or from the "Not now" list.
