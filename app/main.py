"""Уеб сървърът на „Солидарността говори!“.

Стартиране: .\\run.ps1  (или: .venv\\Scripts\\python.exe -m uvicorn app.main:app)
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from . import config
from .tts import Voice, load_voices, synthesize_mp3

logger = logging.getLogger("uvicorn.error")

# Всички заредени гласове: идентификатор -> глас
voices: dict[str, Voice] = {}


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Гласовете се зареждат веднъж при стартиране и после се преизползват
    voices.update(load_voices())
    if not voices:
        logger.warning("Няма гласове в папка voices/. Стартирайте scripts/download_voices.py")
    yield


app = FastAPI(title="Solidarity Speaks!", lifespan=lifespan)


def error(code: str, status: int) -> JSONResponse:
    """Грешка към страницата. Изпращаме само код; страницата показва
    разбираемо съобщение на избрания език (вж. static/i18n/)."""
    return JSONResponse({"error": code}, status_code=status)


@app.exception_handler(RequestValidationError)
async def bad_request(request: Request, exc: RequestValidationError):
    # Непълна или грешна заявка: не показваме техническите подробности
    return error("bad_request", 400)


@app.exception_handler(Exception)
async def unexpected_error(request: Request, exc: Exception):
    # Неочаквана грешка: записваме я в конзолата, а на потребителя казваме просто, че не се е получило
    logger.exception("Неочаквана грешка")
    return error("conversion_failed", 500)


class SpeakRequest(BaseModel):
    text: str
    voice: str
    speed: float = 1.0


@app.get("/api/voices")
def list_voices():
    """Списък с гласовете за падащото меню."""
    return {
        "voices": [voice.info() for voice in voices.values()],
        "max_text_chars": config.MAX_TEXT_CHARS,
        "min_speed": config.MIN_SPEED,
        "max_speed": config.MAX_SPEED,
    }


@app.post("/api/speak")
def speak(request: SpeakRequest):
    """Превръща текста в MP3 и го връща направо."""
    text = request.text.strip()
    if not text:
        return error("empty_text", 400)
    if len(text) > config.MAX_TEXT_CHARS:
        return error("text_too_long", 400)
    voice = voices.get(request.voice)
    if voice is None:
        return error("unknown_voice", 400)
    if not config.MIN_SPEED <= request.speed <= config.MAX_SPEED:
        return error("bad_speed", 400)

    mp3 = synthesize_mp3(voice, text, request.speed)
    return Response(content=mp3, media_type="audio/mpeg")


# Уеб страницата (HTML, CSS, JavaScript). Трябва да е последна, след адресите на /api.
app.mount("/", StaticFiles(directory=config.STATIC_DIR, html=True), name="static")
