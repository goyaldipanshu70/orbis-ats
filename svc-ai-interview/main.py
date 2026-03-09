from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import interview_analysis
from app.routers import conversation

app = FastAPI(
    title="Interview Analysis Service",
    description="Microservice for AI-powered interview transcript evaluation and live AI interviews",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(interview_analysis.router, prefix="/interview", tags=["Interview Evaluator"])
app.include_router(conversation.router, prefix="/conversation", tags=["AI Conversation"])

@app.get("/")
def read_root():
    return {"status": "Interview Analysis Service is running."}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "svc-ai-interview"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8012)
