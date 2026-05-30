from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
import os, sys
from pathlib import Path

# ── Download model BEFORE importing prediction_service ────────
# This must happen at module level so the model exists before
# prediction_service.py tries to load it
_model_path = Path(__file__).resolve().parent.parent / "deployment_model.pt"
if not _model_path.exists():
    print(f"📥 Model not found at {_model_path} — downloading...")
    try:
        sys.path.insert(0, str(Path(__file__).resolve().parent.parent))
        from download_model import download_model
        download_model()
    except Exception as e:
        print(f"⚠️  Model download failed: {e}")
else:
    print(f"✅ Model found at {_model_path} ({_model_path.stat().st_size/1e6:.1f} MB)")

# ── Now safe to import routers ────────────────────────────────
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

@app.on_event("startup")
async def startup():
    await connect_to_mongo()

@app.on_event("shutdown")
async def shutdown():
    await close_mongo_connection()

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
