import whisper

model = whisper.load_model("base")

def transcribe_audio(path: str) -> str:
    result = model.transcribe(path)
    return result["text"]
