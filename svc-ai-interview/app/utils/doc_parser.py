import os
from app.utils.transcriber import transcribe_audio

def load_file_content(file_path: str) -> str:
    """
    Detects the file extension and returns parsed plain text or transcript from:
    - Text (.txt)
    - PDF (.pdf)
    - Word Document (.docx)
    - Audio (.mp3, .wav)

    Raises:
        FileNotFoundError or ValueError if file is invalid or unsupported.
    """
    if not os.path.exists(file_path):
        raise FileNotFoundError(f"File not found: {file_path}")

    _, ext = os.path.splitext(file_path.lower())

    if ext == ".txt":
        return _load_txt(file_path)
    elif ext == ".pdf":
        return _load_pdf(file_path)
    elif ext == ".docx":
        return _load_docx(file_path)
    elif ext in [".mp3", ".wav"]:
        return transcribe_audio(file_path)
    else:
        raise ValueError(f"Unsupported file format: {ext}")

def _load_txt(path: str) -> str:
    with open(path, 'r', encoding='utf-8') as f:
        return f.read()

def _load_pdf(path: str) -> str:
    try:
        import fitz
    except ImportError:
        raise ImportError("PyMuPDF not installed. Run `pip install pymupdf`.")

    doc = fitz.open(path)
    text = ""
    for page in doc:
        text += page.get_text()
    doc.close()
    return text

def _load_docx(path: str) -> str:
    try:
        import docx
    except ImportError:
        raise ImportError("python-docx not installed. Run `pip install python-docx`.")

    doc = docx.Document(path)
    return "\n".join([para.text for para in doc.paragraphs if para.text.strip()])
