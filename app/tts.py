"""Зареждане на гласовете на Piper и превръщане на текст в MP3."""

import json
import logging
import threading
from dataclasses import dataclass, field
from pathlib import Path

import lameenc
from piper import PiperVoice, SynthesisConfig

from . import config

logger = logging.getLogger("uvicorn.error")


@dataclass
class Voice:
    """Един глас: описание за потребителя + зареденият модел."""

    id: str
    name: str
    language: str
    gender: str | None
    model: PiperVoice
    # Ключалка: един глас чете само един текст наведнъж
    lock: threading.Lock = field(default_factory=threading.Lock)

    def info(self) -> dict:
        """Данните, които се изпращат към уеб страницата."""
        return {"id": self.id, "name": self.name, "language": self.language, "gender": self.gender}


def load_voices(voices_dir: Path = config.VOICES_DIR) -> dict[str, Voice]:
    """Намира всички .onnx файлове в папката и ги зарежда (веднъж, при стартиране)."""
    # Описанията от voices.json (име, език, пол)
    descriptions: dict = {}
    descriptions_file = voices_dir / "voices.json"
    if descriptions_file.exists():
        descriptions = json.loads(descriptions_file.read_text(encoding="utf-8"))

    found = {}
    for model_path in sorted(voices_dir.glob("*.onnx")):
        voice_id = model_path.stem
        if not Path(f"{model_path}.json").exists():
            logger.warning("Липсва файл %s.json, гласът се пропуска", model_path.name)
            continue
        model = PiperVoice.load(model_path)
        # Ако гласът го няма във voices.json, взимаме езика от файла на самия глас
        description = descriptions.get(voice_id, {})
        language = description.get("language") or _language_from_model(model_path)
        found[voice_id] = Voice(
            id=voice_id,
            name=description.get("name", voice_id),
            language=language,
            gender=description.get("gender"),
            model=model,
        )
        logger.info("Зареден глас: %s", voice_id)

    # Гласовете от voices.json са първи, в реда, в който са записани там
    order = list(descriptions) + sorted(set(found) - set(descriptions))
    return {voice_id: found[voice_id] for voice_id in order if voice_id in found}


def _language_from_model(model_path: Path) -> str:
    """Чете кода на езика (напр. „bg“) от .onnx.json файла на гласа."""
    data = json.loads(Path(f"{model_path}.json").read_text(encoding="utf-8"))
    return data.get("language", {}).get("family", "")


def synthesize_mp3(voice: Voice, text: str, speed: float) -> bytes:
    """Прочита текста с дадения глас и скорост и връща готов MP3 файл."""
    model = voice.model
    # По-голямо length_scale = по-бавно четене, затова делим на скоростта
    syn_config = SynthesisConfig(length_scale=model.config.length_scale / speed)

    encoder = lameenc.Encoder()
    encoder.set_bit_rate(config.MP3_BITRATE_KBPS)
    encoder.set_in_sample_rate(model.config.sample_rate)
    encoder.set_channels(1)
    encoder.set_quality(config.MP3_QUALITY)

    mp3 = bytearray()
    has_audio = False
    with voice.lock:
        # Piper връща звука изречение по изречение; кодираме всяко веднага
        for chunk in model.synthesize(text, syn_config):
            mp3 += encoder.encode(chunk.audio_int16_bytes)
            has_audio = True
    # Текст без нищо за произнасяне (напр. само „???“): няма звук
    if not has_audio:
        return b""
    mp3 += encoder.flush()
    return bytes(mp3)
