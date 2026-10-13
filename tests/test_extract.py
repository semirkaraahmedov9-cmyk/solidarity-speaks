"""Тестове за извличането на текст и разделянето на глави.

Стартиране: .venv\\Scripts\\python.exe -m pytest
"""

from pathlib import Path

import pytest

from app import config
from app.extract import ExtractError, extract_book, is_chapter_heading

SAMPLES = Path(__file__).resolve().parent / "samples"
EXPECTED_TITLES = ["Глава първа", "Глава втора", "Глава трета"]


def read_sample(name: str):
    return extract_book(name, (SAMPLES / name).read_bytes())


def chapter_titles(book):
    """Заглавията на главите (без „Начало“), без значение дали са с главни букви."""
    return [chapter.title.capitalize() for chapter in book.chapters if not chapter.intro]


# --- Всеки формат ---


@pytest.mark.parametrize("name", ["sample.txt", "sample_cp1251.txt"])
def test_txt_finds_chapter_headings(name):
    book = read_sample(name)
    assert book.source == "headings"
    assert chapter_titles(book) == EXPECTED_TITLES
    # Заглавието на книгата преди първата глава се пази като „Начало“
    assert book.chapters[0].intro
    assert "Малка книга" in book.chapters[0].text


def test_txt_windows_1251_is_decoded():
    book = read_sample("sample_cp1251.txt")
    assert "Учителката" in book.chapters[1].text


def test_docx_uses_heading_styles():
    book = read_sample("sample.docx")
    assert book.source == "structure"
    assert chapter_titles(book) == EXPECTED_TITLES
    # Текстът от таблицата е във втората глава
    assert "Ученик" in book.chapters[1].text


def test_epub_uses_table_of_contents():
    book = read_sample("sample.epub")
    assert book.source == "structure"
    assert chapter_titles(book) == EXPECTED_TITLES
    assert book.chapters[2].text.startswith("Глава трета")


def test_pdf_uses_bookmarks():
    book = read_sample("sample_bookmarks.pdf")
    assert book.source == "structure"
    assert chapter_titles(book) == EXPECTED_TITLES
    # Глави 2 и 3 са на една страница; трябва да са разделени правилно
    second, third = book.chapters[2], book.chapters[3]
    assert "Звънецът" in second.text and "Звънецът" not in third.text
    assert "Смелостта" in third.text and "Смелостта" not in second.text


def test_pdf_without_bookmarks_finds_headings():
    book = read_sample("sample_headings.pdf")
    assert book.source == "headings"
    assert chapter_titles(book) == EXPECTED_TITLES


def test_scanned_pdf_gives_friendly_error():
    with pytest.raises(ExtractError) as error:
        read_sample("sample_scanned.pdf")
    assert error.value.code == "scanned_pdf"


# --- Разпознаване на заглавия ---


@pytest.mark.parametrize(
    "line",
    ["Глава 1", "ГЛАВА ПЪРВА", "Глава двадесет и първа", "Chapter 12", "CHAPTER ONE",
     "Глава IV. Завръщането", "I", "XII", "IV.", "Пролог", "Част втора"],
)  # fmt: skip
def test_chapter_heading_is_recognised(line):
    assert is_chapter_heading(line)


@pytest.mark.parametrize(
    "line",
    ["Главата го болеше цял ден.", "Mix", "Глава", "Това е обикновено изречение за главата.",
     "Глава 1 " + "много дълъг текст " * 10],
)  # fmt: skip
def test_normal_text_is_not_a_heading(line):
    assert not is_chapter_heading(line)


# --- Разделяне на части, когато няма глави ---


def test_text_without_chapters_is_split_into_parts():
    paragraph = "Това е едно изречение от обикновен текст без никакви глави в него. " * 5
    text = "\n\n".join([paragraph] * 400)  # около 26 000 думи
    book = extract_book("book.txt", text.encode("utf-8"))
    assert book.source == "parts"
    assert len(book.chapters) > 1
    for chapter in book.chapters:
        assert chapter.title is None
        assert 0.8 * config.PART_TARGET_WORDS <= chapter.words <= 1.2 * config.PART_TARGET_WORDS


def test_one_huge_paragraph_is_split_too():
    text = "Дълго изречение без нов ред, което се повтаря много пъти. " * 2000  # 20 000 думи
    book = extract_book("book.txt", text.encode("utf-8"))
    assert len(book.chapters) > 1


def test_short_text_stays_one_part():
    book = extract_book("note.txt", "Кратка бележка с няколко думи.".encode("utf-8"))
    assert len(book.chapters) == 1


def test_heading_only_chapter_is_merged_with_next():
    text = "Част първа\n\nГлава 1\n\nТекст на първата глава.\n\nГлава 2\n\nТекст на втората глава."
    book = extract_book("book.txt", text.encode("utf-8"))
    assert [chapter.title for chapter in book.chapters] == ["Глава 1", "Глава 2"]
    # „Част първа“ не се губи: прочита се в началото на първата глава
    assert book.chapters[0].text.startswith("Част първа")


# --- Грешки ---


def test_unsupported_file_type():
    with pytest.raises(ExtractError) as error:
        extract_book("picture.jpg", b"not really a picture")
    assert error.value.code == "unsupported_type"


@pytest.mark.parametrize("name", ["empty.txt", "empty.pdf", "empty.docx", "empty.epub"])
def test_empty_file(name):
    with pytest.raises(ExtractError) as error:
        extract_book(name, b"   \n  ")
    assert error.value.code == "empty_file"


@pytest.mark.parametrize("name", ["broken.pdf", "broken.docx", "broken.epub"])
def test_broken_file(name):
    with pytest.raises(ExtractError) as error:
        extract_book(name, b"this is not a real document")
    assert error.value.code == "unreadable_file"
