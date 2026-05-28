from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import FileResponse
from app.api.dependencies import get_current_user
from app.services.prediction_service import run_prediction
from app.db.database import get_database
from pathlib import Path

router = APIRouter(prefix="/predict", tags=["Prediction"])

UPLOADS_DIR = Path(__file__).resolve().parent.parent.parent.parent / "uploads"


@router.post("/{record_id}")
async def predict_mri(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    db   = get_database()
    role = current_user.get("role", "patient")

    # Admin can view any record — others only their own
    if role == "admin":
        record = await db.records.find_one({"record_id": record_id})
    else:
        record = await db.records.find_one({
            "record_id": record_id,
            "user_id"  : current_user["user_id"],
        })

    if not record:
        raise HTTPException(404, "Record not found")

    # Already completed — return cached result immediately
    if record.get("status") == "Completed":
        return {
            "message"    : "Already predicted",
            "prediction" : record["prediction"],
            "confidence" : record["confidence_score"],
            "heatmap_url": f"/predict/heatmap/{record_id}",
        }

    scan_path = record.get("scan_path")
    if not scan_path or not Path(scan_path).exists():
        raise HTTPException(404, "Scan file not found")

    with open(scan_path, "rb") as f:
        file_bytes = f.read()

    filename = record.get("filename") or Path(scan_path).name

    try:
        result = run_prediction(file_bytes, filename, record_id)
    except Exception as e:
        await db.records.update_one(
            {"record_id": record_id},
            {"$set": {"status": "Failed"}},
        )
        raise HTTPException(500, f"Prediction failed: {str(e)}")

    await db.records.update_one(
        {"record_id": record_id},
        {"$set": {
            "prediction"      : result["prediction"],
            "confidence_score": result["confidence_score"],
            "heatmap_url"     : f"/predict/heatmap/{record_id}",
            "status"          : "Completed",
        }},
    )

    return {
        "message"    : "Prediction complete",
        "prediction" : result["prediction"],
        "confidence" : result["confidence_score"],
        "heatmap_url": f"/predict/heatmap/{record_id}",
    }


@router.get("/heatmap/{record_id}")
async def get_heatmap(record_id: str):
    path = UPLOADS_DIR / f"{record_id}_heatmap.png"
    if not path.exists():
        raise HTTPException(404, "Heatmap not found")
    return FileResponse(str(path), media_type="image/png")