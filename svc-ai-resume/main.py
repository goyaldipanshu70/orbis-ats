from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import resume_analysis

app = FastAPI(
    title="Resume Analysis Service",
    description="Microservice for AI-powered resume evaluation and scoring",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume_analysis.router, prefix="/resume", tags=["Resume Analyzer"])

@app.get("/")
def read_root():
    return {"status": "Resume Analysis Service is running."}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "svc-ai-resume"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8011)
