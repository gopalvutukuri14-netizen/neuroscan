from fastapi import APIRouter, Depends, HTTPException
from typing import List
from app.api.dependencies import get_current_user
from app.schemas.record_schema import RecordResponse
from app.db.database import get_database

router = APIRouter()

@router.get("/", response_model=List[RecordResponse])
async def get_history(current_user: dict = Depends(get_current_user)):
    db   = get_database()
    role = current_user.get("role", "patient")

    if role == "admin":
        cursor = db.records.find({}).sort("created_at", -1)
    else:
        cursor = db.records.find({"user_id": current_user["user_id"]}).sort("created_at", -1)

    records = await cursor.to_list(length=500)

    # Admin: enrich each record with real uploader username
    if role == "admin" and records:
        user_ids   = list({r["user_id"] for r in records if r.get("user_id")})
        # Motor Motor Motor — find() returns cursor, to_list() is the async call
        users_list = await db.users.find(
            {"user_id": {"$in": user_ids}},
            {"user_id": 1, "username": 1, "email": 1, "_id": 0}
        ).to_list(length=500)

        uid_map = {
            u["user_id"]: u.get("username") or u.get("email", "Unknown")
            for u in users_list
        }
        for r in records:
            r["uploader_username"] = uid_map.get(r.get("user_id", ""), "Unknown")

    for r in records:
        r.pop("_id", None)
    return records


@router.delete("/{record_id}")
async def delete_record(record_id: str, current_user: dict = Depends(get_current_user)):
    if current_user.get("role") != "admin":
        raise HTTPException(403, "Only admins can delete records")
    db     = get_database()
    result = await db.records.delete_one({"record_id": record_id})
    if result.deleted_count == 0:
        raise HTTPException(404, "Record not found")
    return {"message": "Record deleted"}
