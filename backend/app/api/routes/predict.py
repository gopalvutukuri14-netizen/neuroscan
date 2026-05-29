import tempfile
import os
from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import RedirectResponse
from app.api.dependencies import get_current_user
from app.services.prediction_service import run_prediction
from app.services.s3_service import S3Service
from app.db.database import get_database
from pathlib import Path

router = APIRouter(prefix="/predict", tags=["Prediction"])

@router.post("/{record_id}")
async def predict_mri(
    record_id: str,
    current_user: dict = Depends(get_current_user)
):
    db   = get_database()
    role = current_user.get("role", "patient")

    if role == "admin":
        record = await db.records.find_one({"record_id": record_id})
    else:
        record = await db.records.find_one({
            "record_id": record_id,
            "user_id"  : current_user["user_id"],
        })

    if not record:
        raise HTTPException(404, "Record not found")

    # Already completed — return cached result
    if record.get("status") == "Completed":
        return {
            "message"    : "Already predicted",
            "prediction" : record["prediction"],
            "confidence_score": record["confidence_score"],
            "heatmap_url": f"/predict/heatmap/{record_id}",
        }

    # Download scan from S3 to a temp file
    s3_key = record.get("scan_path", "")
    if not s3_key:
        raise HTTPException(404, "Scan file not found")

    try:
        file_bytes = S3Service.download_bytes(s3_key)
    except Exception as e:
        raise HTTPException(404, f"Could not fetch scan from storage: {str(e)}")

    filename = record.get("filename") or Path(s3_key).name

    # Run prediction (saves heatmap locally in /tmp)
    try:
        result = run_prediction(file_bytes, filename, record_id)
    except Exception as e:
        await db.records.update_one(
            {"record_id": record_id},
            {"$set": {"status": "Failed"}},
        )
        raise HTTPException(500, f"Prediction failed: {str(e)}")

    # Upload heatmap PNG to S3
    heatmap_local = result.get("heatmap_path", "")
    heatmap_s3_key = f"heatmaps/{record_id}_heatmap.png"
    heatmap_url    = f"/predict/heatmap/{record_id}"

    if heatmap_local and Path(heatmap_local).exists():
        try:
            S3Service.upload_file(heatmap_local, heatmap_s3_key, "image/png")
            heatmap_url = S3Service.get_public_url(heatmap_s3_key)
        except Exception as e:
            print(f"⚠️  Heatmap S3 upload failed: {e}")

    await db.records.update_one(
        {"record_id": record_id},
        {"$set": {
            "prediction"      : result["prediction"],
            "confidence_score": result["confidence_score"],
            "heatmap_url"     : heatmap_url,
            "status"          : "Completed",
        }},
    )

    return {
        "message"         : "Prediction complete",
        "prediction"      : result["prediction"],
        "confidence_score": result["confidence_score"],
        "heatmap_url"     : heatmap_url,
    }


@router.get("/heatmap/{record_id}")
async def get_heatmap(record_id: str):
    """Redirect to S3 public URL for the heatmap."""
    s3_key = f"heatmaps/{record_id}_heatmap.png"
    if S3Service.key_exists(s3_key):
        url = S3Service.get_public_url(s3_key)
        return RedirectResponse(url)
    raise HTTPException(404, "Heatmap not found")
