import json
from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from typing import Optional
from app.services.chat_service import complete_chat, complete_chat_stream

router = APIRouter()


class ChatMessage(BaseModel):
    role: str
    content: str


class ChatCompleteRequest(BaseModel):
    messages: list[ChatMessage]
    system_prompt: Optional[str] = None


class ChatCompleteResponse(BaseModel):
    reply: str


@router.post("/complete", response_model=ChatCompleteResponse)
def chat_complete(payload: ChatCompleteRequest):
    try:
        reply = complete_chat(
            messages=[m.model_dump() for m in payload.messages],
            system_prompt=payload.system_prompt,
        )
        return ChatCompleteResponse(reply=reply)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/complete/stream")
def chat_complete_stream(payload: ChatCompleteRequest):
    def event_generator():
        try:
            for token in complete_chat_stream(
                messages=[m.model_dump() for m in payload.messages],
                system_prompt=payload.system_prompt,
            ):
                yield f"data: {json.dumps({'token': token})}\n\n"
            yield f"data: {json.dumps({'done': True})}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'error': str(e)})}\n\n"

    return StreamingResponse(event_generator(), media_type="text/event-stream")
