from fastapi import APIRouter, UploadFile, File, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.models.record import RecordModel
from app.services.s3_service import S3Service
from app.db.database import get_database

router = APIRouter()

ALLOWED = (".nii", ".nii.gz", ".dcm")

@router.post("/")
async def upload_mri(
    file: UploadFile = File(...),
    current_user: dict = Depends(get_current_user)
):
    fname = file.filename or ""
    if not any(fname.endswith(ext) for ext in ALLOWED):
        raise HTTPException(400, "Invalid file type. Only .nii, .nii.gz, .dcm allowed.")

    record = RecordModel(
        user_id  = current_user["user_id"],
        filename = fname,
        scan_path= "",
    )

    # Read file bytes
    file_bytes = await file.read()
    if len(file_bytes) == 0:
        raise HTTPException(400, "Uploaded file is empty.")

    # Upload to S3 → scans/{user_id}/{record_id}/{filename}
    s3_key = f"scans/{current_user['user_id']}/{record.record_id}/{fname}"
    try:
        S3Service.upload_bytes(file_bytes, s3_key, "application/octet-stream")
    except Exception as e:
        raise HTTPException(500, f"File upload failed: {str(e)}")

    record.scan_path = s3_key   # store S3 key, not local path

    db = get_database()
    await db.records.insert_one(record.dict())

    return {
        "message"  : "File uploaded successfully",
        "record_id": record.record_id,
    }
