from fastapi import APIRouter, Depends, HTTPException
from app.api.dependencies import get_current_user
from app.db.database import get_database

router = APIRouter(prefix="/admin", tags=["Admin"])

def require_admin(current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Admin access required")
    return current_user

@router.get("/users")
async def list_users(current_user: dict = Depends(require_admin)):
    """Return all registered users."""
    db = get_database()
    cursor = db.users.find({}, {"password_hash": 0, "otp": 0, "otp_expiry": 0, "_id": 0})
    users = await cursor.to_list(length=500)
    return users

@router.patch("/users/{user_id}/role")
async def change_role(user_id: str, body: dict, current_user: dict = Depends(require_admin)):
    """Change a user's role."""
    new_role = body.get("role")
    if new_role not in {"patient", "clinician", "admin"}:
        raise HTTPException(400, "Invalid role")
    db = get_database()
    result = await db.users.update_one({"user_id": user_id}, {"$set": {"role": new_role}})
    if result.matched_count == 0:
        raise HTTPException(404, "User not found")
    return {"message": f"Role updated to {new_role}"}

@router.get("/stats")
async def system_stats(current_user: dict = Depends(require_admin)):
    """System-wide stats for admin dashboard."""
    db = get_database()
    total_users   = await db.users.count_documents({})
    total_scans   = await db.records.count_documents({})
    completed     = await db.records.count_documents({"status": "Completed"})
    scz_detected  = await db.records.count_documents({"status": "Completed", "prediction": "SCZ"})
    normal        = completed - scz_detected
    patients      = await db.users.count_documents({"role": "patient"})
    clinicians    = await db.users.count_documents({"role": "clinician"})
    admins        = await db.users.count_documents({"role": "admin"})
    scz_rate      = round((scz_detected / completed * 100), 1) if completed else 0

    return {
        "total_users":   total_users,
        "total_scans":   total_scans,
        "completed":     completed,
        "scz_detected":  scz_detected,
        "normal":        normal,
        "scz_rate":      scz_rate,
        "by_role": {"patient": patients, "clinician": clinicians, "admin": admins},
    }
