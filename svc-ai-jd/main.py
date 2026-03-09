from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routers import jd_extraction

app = FastAPI(
    title="JD Extraction Service",
    description="Microservice for job description extraction and rubric parsing",
    version="1.0.0"
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(jd_extraction.router, prefix="/jd", tags=["JD Extraction"])

@app.get("/")
def read_root():
    return {"status": "JD Extraction Service is running."}

@app.get("/health")
def health_check():
    return {"status": "ok", "service": "svc-ai-jd"}

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8010)
