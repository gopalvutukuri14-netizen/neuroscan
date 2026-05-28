"""
Run this ONCE to create your first admin account.
Usage:  cd backend && python create_admin.py
"""
import asyncio, os, sys
sys.path.insert(0, os.path.dirname(__file__))

from app.db.database import connect_to_mongo, get_database
from app.core.security import get_password_hash
from app.models.user import UserModel

ADMIN_EMAIL    = "admin@neuroscan.ai"   # ← change this
ADMIN_USERNAME = "admin"                 # ← change this
ADMIN_PASSWORD = "Admin@1234"            # ← change this — use a strong password

async def create_admin():
    await connect_to_mongo()
    db = get_database()

    existing = await db.users.find_one({"email": ADMIN_EMAIL})
    if existing:
        if existing.get("role") == "admin":
            print(f"✅ Admin already exists: {ADMIN_EMAIL}")
        else:
            # Promote existing user to admin
            await db.users.update_one(
                {"email": ADMIN_EMAIL},
                {"$set": {"role": "admin", "is_verified": True}}
            )
            print(f"✅ Promoted {ADMIN_EMAIL} to admin")
        return

    admin = UserModel(
        username=ADMIN_USERNAME,
        email=ADMIN_EMAIL,
        password_hash=get_password_hash(ADMIN_PASSWORD),
        role="admin",
        is_verified=True,   # no OTP needed for seed admin
    )
    await db.users.insert_one(admin.dict())
    print(f"✅ Admin created: {ADMIN_EMAIL}")
    print(f"   Username : {ADMIN_USERNAME}")
    print(f"   Password : {ADMIN_PASSWORD}")
    print(f"\n⚠  Change the password after first login!")

asyncio.run(create_admin())
