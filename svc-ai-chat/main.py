from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import general_chat

app = FastAPI(title="svc-ai-chat", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(general_chat.router, prefix="/chat", tags=["chat"])


@app.get("/health")
def health():
    return {"status": "ok", "service": "svc-ai-chat"}
