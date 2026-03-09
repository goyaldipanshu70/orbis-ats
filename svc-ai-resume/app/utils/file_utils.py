import requests
import tempfile
import os
import mimetypes
from urllib.parse import urlparse
from typing import Optional


def get_extension_from_content_type(content_type: str) -> str:
    """
    Guess extension from content type like 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
    """
    ext = mimetypes.guess_extension(content_type.split(";")[0].strip())
    return ext if ext else ".tmp"


def download_to_tempfile(file_url: str, fallback_suffix: str = ".txt") -> str:
    """
    Downloads a file from a URL to a temporary file.
    Tries to infer file extension from headers or URL.
    Ensures .docx files aren't misclassified as .zip.
    Returns path to downloaded file.
    """

    file_url = str(file_url)

    response = requests.get(file_url, allow_redirects=True)
    if response.status_code != 200:
        raise Exception(f"❌ Failed to download file from URL: {file_url}")

    content_type = response.headers.get("Content-Type", "").lower()
    content_disposition = response.headers.get("Content-Disposition", "")

    # Step 1: Try to get extension from Content-Disposition
    ext = ""
    if "filename=" in content_disposition:
        filename = content_disposition.split("filename=")[-1].strip('"; ')
        ext = os.path.splitext(filename)[1]

    # Step 2: Fallback to URL-based extension
    if not ext:
        parsed_url = urlparse(file_url)
        filename_from_url = os.path.basename(parsed_url.path)
        ext = os.path.splitext(filename_from_url)[1]

    # Step 3: Fallback to content-type
    if not ext:
        ext = get_extension_from_content_type(content_type)

    # Step 4: Edge case override – if .docx misclassified as .zip
    if content_type == "application/zip" and file_url.endswith(".docx"):
        ext = ".docx"

    # Step 5: Final fallback
    if not ext or len(ext) > 10:
        ext = fallback_suffix

    # Step 6: Save to a temporary file
    with tempfile.NamedTemporaryFile(delete=False, suffix=ext) as tmp_file:
        tmp_file.write(response.content)
        print(f"✅ Downloaded to: {tmp_file.name}")
        return tmp_file.name
