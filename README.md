# Solidarity Speaks! (Солидарността говори!)

## На български

**Солидарността говори!** е безплатен уебсайт с отворен код, който превръща документи в аудиокниги.
Качвате PDF, EPUB, DOCX или TXT файл (или поставяте текст), а сайтът го прочита на глас, разделен на глави.
Можете да слушате в браузъра или да изтеглите MP3 файловете.

Сайтът е създаден специално за незрящи хора, хора с дислексия, ученици и учители.
Проектът се финансира от Европейския корпус за солидарност и се изпълнява от
младежка организация „Младежи за развитие и вдъхновение – МРВ“, с. Чепинци, България.

---

## In English

**Solidarity Speaks!** is a free, open-source website that turns documents into audiobooks.
Upload a PDF, EPUB, DOCX or TXT file (or paste text), and the site reads it aloud, split into chapters.
Listen in the browser or download the MP3 files.

It is built for blind people, people with dyslexia, students and teachers, so accessibility comes first.
Speech is generated with [Piper TTS](https://github.com/OHF-Voice/piper1-gpl), running on the server, with no external services.

Funded by the European Solidarity Corps. Run by the youth organisation
"Младежи за развитие и вдъхновение – МРВ", Chepintsi, Bulgaria.

> **Status:** early development. See [PLAN.md](PLAN.md) for progress.

## How to run locally (Windows)

You need **Python 3.11+** and **Git**.

```powershell
# 1. Download the project
git clone https://github.com/semirkaraahmedov9-cmyk/solidarity-speaks.git
cd solidarity-speaks

# 2. Create a virtual environment (a private Python space for this project)
python -m venv .venv

# 3. Activate it
.\.venv\Scripts\Activate.ps1

# 4. Install the required packages
pip install -r requirements.txt
```

Instructions for downloading the voices and starting the app will be added in the next phase.

## Project folders

| Folder     | Contents                                              |
|------------|-------------------------------------------------------|
| `app/`     | Backend (Python, FastAPI)                             |
| `static/`  | Web page: HTML, CSS, JavaScript, translations (`i18n/`) |
| `voices/`  | Piper voice models (downloaded, not stored in git)    |
| `scripts/` | Helper scripts                                        |
| `tests/`   | Automated tests and sample files                      |
| `data/`    | Temporary uploads and audio (deleted after 24 hours)  |

## Licence

[GNU Affero General Public License v3.0](LICENSE) (AGPL-3.0).
This licence is required because the project uses Piper TTS (GPL-3.0) and PyMuPDF (AGPL-3.0).
