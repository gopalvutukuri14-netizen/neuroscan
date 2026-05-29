from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from pathlib import Path
import os

from app.core.config import settings
from app.db.database import connect_to_mongo, close_mongo_connection
from app.api.routes.auth    import router as auth_router
from app.api.routes.upload  import router as upload_router
from app.api.routes.predict import router as predict_router
from app.api.routes.history import router as history_router
from app.api.routes.report  import router as report_router
from app.api.routes.admin   import router as admin_router
from app.api.routes.notes   import router as notes_router

app = FastAPI(title="NeuroScan AI API")

# ── CORS ─────────────────────────────────────────────────────
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:5173")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:5173",
        "http://127.0.0.1:5173",
        FRONTEND_URL,
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Startup / Shutdown ────────────────────────────────────────
@app.on_event("startup")
async def startup():
    # Download model if not present (cloud deployment)
    try:
        from download_model import download_model
        download_model()
    except Exception as e:
        print(f"⚠️  Model download skipped: {e}")

    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()

# ── Routers ───────────────────────────────────────────────────
app.include_router(auth_router,    prefix="/auth",    tags=["Auth"])
app.include_router(upload_router,  prefix="/upload",  tags=["Upload"])
app.include_router(predict_router)
app.include_router(history_router, prefix="/history", tags=["History"])
app.include_router(report_router)
app.include_router(admin_router)
app.include_router(notes_router)

@app.get("/")
def root():
    return {"message": "NeuroScan AI Backend Running 🚀"}

@app.get("/health")
def health():
    return {"status": "ok"}
