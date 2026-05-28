from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.db.database import get_database
from datetime import datetime

router = APIRouter(prefix="/notes", tags=["Notes"])

@router.post("/{record_id}")
async def add_note(record_id: str, body: dict, current_user: dict = Depends(get_current_user)):
    """Clinician/Admin can add a clinical note to a record."""
    role = current_user.get("role", "patient")
    if role not in {"clinician", "admin"}:
        raise HTTPException(403, "Only clinicians and admins can add notes")
    note_text = body.get("note", "").strip()
    if not note_text:
        raise HTTPException(400, "Note cannot be empty")
    db = get_database()
    note = {
        "text":       note_text,
        "author":     current_user.get("username", current_user["email"]),
        "created_at": datetime.utcnow().isoformat(),
    }
    result = await db.records.update_one(
        {"record_id": record_id},
        {"$push": {"clinical_notes": note}}
    )
    if result.matched_count == 0:
        raise HTTPException(404, "Record not found")
    return {"message": "Note added", "note": note}

@router.get("/{record_id}")
async def get_notes(record_id: str, current_user: dict = Depends(get_current_user)):
    role = current_user.get("role", "patient")
    if role not in {"clinician", "admin"}:
        raise HTTPException(403, "Access denied")
    db = get_database()
    record = await db.records.find_one({"record_id": record_id}, {"clinical_notes": 1, "_id": 0})
    if not record:
        raise HTTPException(404, "Record not found")
    return record.get("clinical_notes", [])
