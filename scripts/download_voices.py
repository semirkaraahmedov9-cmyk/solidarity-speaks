"""Изтегля гласовите модели на Piper от Hugging Face в папка voices/.

Стартиране (от главната папка на проекта):
    .venv\\Scripts\\python.exe scripts\\download_voices.py
"""

import sys
import urllib.request
from pathlib import Path

# Адрес на колекцията с гласове на Piper в Hugging Face
BASE_URL = "https://huggingface.co/rhasspy/piper-voices/resolve/main/"

# Гласове за изтегляне: идентификатор -> път в колекцията
VOICES = {
    "bg_BG-dimitar-medium": "bg/bg_BG/dimitar/medium/",
    "en_GB-alan-medium": "en/en_GB/alan/medium/",
    "en_GB-cori-medium": "en/en_GB/cori/medium/",
}

VOICES_DIR = Path(__file__).resolve().parent.parent / "voices"


def download(url: str, target: Path) -> None:
    """Изтегля един файл. Записва първо във временен файл, за да не остане недовършен файл при прекъсване."""
    temp = target.with_suffix(target.suffix + ".part")
    with urllib.request.urlopen(url, timeout=60) as response, open(temp, "wb") as out:
        total = int(response.headers.get("Content-Length", 0))
        done = 0
        while chunk := response.read(1024 * 1024):
            out.write(chunk)
            done += len(chunk)
            if total:
                print(f"\r  {target.name}: {done * 100 // total}%", end="", flush=True)
    print()
    temp.replace(target)


def main() -> int:
    VOICES_DIR.mkdir(exist_ok=True)
    for voice_id, folder in VOICES.items():
        for file_name in (f"{voice_id}.onnx", f"{voice_id}.onnx.json"):
            target = VOICES_DIR / file_name
            if target.exists():
                print(f"  {file_name}: вече е изтеглен")
                continue
            try:
                download(BASE_URL + folder + file_name, target)
            except OSError as error:
                print(f"\nГрешка при изтеглянето на {file_name}: {error}")
                print("Проверете интернет връзката и опитайте отново.")
                return 1
    print("Готово! Всички гласове са в папка voices/.")
    return 0


if __name__ == "__main__":
    sys.exit(main())
