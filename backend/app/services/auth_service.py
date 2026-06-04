from fastapi import HTTPException
from app.db.database import get_database
from app.models.user import UserModel
from app.schemas.auth_schema import UserCreate, UserLogin, AdminLogin, OTPVerify, VALID_ROLES, ForgotPasswordRequest, VerifyResetOTP, ResetPassword
from app.core.security import get_password_hash, verify_password, create_access_token, create_refresh_token
from app.core.config import settings
from app.services.otp_service import OTPService
from datetime import datetime


def _build_login_response(user: dict) -> dict:
    access_token  = create_access_token(data={"sub": user["user_id"]})
    refresh_token = create_refresh_token(data={"sub": user["user_id"]})
    return {
        "access_token":  access_token,
        "refresh_token": refresh_token,
        "token_type":    "bearer",
        "user": {
            "user_id":     user["user_id"],
            "username":    user.get("username", user["email"].split("@")[0]),
            "email":       user["email"],
            "role":        user.get("role", "patient"),
            "is_verified": user["is_verified"],
        },
    }


class AuthService:

    # ── Register (patient / clinician only) ─────────────────
    @staticmethod
    async def register_user(user_data: UserCreate):
        db = get_database()

        if user_data.role not in VALID_ROLES:
            raise HTTPException(400, f"Invalid role. Allowed: {', '.join(VALID_ROLES)}")

        if user_data.role == "admin":
            raise HTTPException(400, "Admin accounts cannot be created via signup.")

        if await db.users.find_one({"email": user_data.email}):
            raise HTTPException(400, "Email already registered")

        if await db.users.find_one({"username": user_data.username}):
            raise HTTPException(400, "Username already taken")

        new_user = UserModel(
            username=user_data.username,
            email=user_data.email,
            password_hash=get_password_hash(user_data.password),
            role=user_data.role,
        )
        await db.users.insert_one(new_user.dict())
        await OTPService.create_and_send_otp(user_data.email)
        return {"message": "Registered successfully. Check your email for OTP."}

    # ── OTP verify ───────────────────────────────────────────
    @staticmethod
    async def verify_otp(otp_data: OTPVerify):
        db = get_database()
        user = await db.users.find_one({"email": otp_data.email})
        if not user:
            raise HTTPException(404, "User not found")
        if user.get("is_verified"):
            return {"message": "Already verified"}
        if user.get("otp") != otp_data.otp:
            raise HTTPException(400, "Invalid OTP")
        if user.get("otp_expiry") < datetime.utcnow():
            raise HTTPException(400, "OTP has expired")
        await db.users.update_one(
            {"email": otp_data.email},
            {"$set": {"is_verified": True, "otp": None, "otp_expiry": None}},
        )
        return {"message": "Email verified successfully"}

    # ── Normal login (patient / clinician) ───────────────────
    @staticmethod
    async def login_user(user_data: UserLogin):
        db = get_database()
        user = await db.users.find_one({"email": user_data.email})

        if not user or not verify_password(user_data.password, user["password_hash"]):
            raise HTTPException(401, "Invalid email or password")

        if user.get("role") == "admin":
            raise HTTPException(403, "Admin accounts must use the admin login.")

        if not user.get("is_verified"):
            raise HTTPException(403, "Please verify your email first")

        return _build_login_response(user)

    # ── Admin login (secret key required) ────────────────────
    @staticmethod
    async def admin_login(data: AdminLogin):
        if data.secret_key != settings.ADMIN_SECRET_KEY:
            raise HTTPException(401, "Invalid credentials")

        db = get_database()
        user = await db.users.find_one({"email": data.email})

        if not user or not verify_password(data.password, user["password_hash"]):
            raise HTTPException(401, "Invalid credentials")

        if user.get("role") != "admin":
            raise HTTPException(403, "Access denied — not an admin account")

        if not user.get("is_verified"):
            raise HTTPException(403, "Admin account is not verified")

        return _build_login_response(user)

    # ── Forgot Password ── Step 1: Send reset OTP ────────────
    @staticmethod
    async def forgot_password(data: ForgotPasswordRequest):
        db   = get_database()
        user = await db.users.find_one({"email": data.email})

        # Always return success — don't reveal whether email exists (security best practice)
        if not user:
            return {"message": "If this email is registered, a reset code has been sent."}

        await OTPService.create_and_send_otp(data.email)
        return {"message": "If this email is registered, a reset code has been sent."}

    # ── Forgot Password ── Step 2: Verify reset OTP ──────────
    @staticmethod
    async def verify_reset_otp(data: VerifyResetOTP):
        db   = get_database()
        user = await db.users.find_one({"email": data.email})

        if not user:
            raise HTTPException(404, "User not found")

        if user.get("otp") != data.otp:
            raise HTTPException(400, "Invalid OTP")

        if not user.get("otp_expiry") or user.get("otp_expiry") < datetime.utcnow():
            raise HTTPException(400, "OTP has expired. Please request a new one.")

        # Mark OTP as verified (but don't clear it yet — needed for step 3)
        await db.users.update_one(
            {"email": data.email},
            {"$set": {"reset_otp_verified": True}},
        )
        return {"message": "OTP verified. You can now reset your password."}

    # ── Forgot Password ── Step 3: Reset password ────────────
    @staticmethod
    async def reset_password(data: ResetPassword):
        db   = get_database()
        user = await db.users.find_one({"email": data.email})

        if not user:
            raise HTTPException(404, "User not found")

        # Re-verify OTP + expiry for security (prevents skipping step 2)
        if user.get("otp") != data.otp:
            raise HTTPException(400, "Invalid OTP")

        if not user.get("otp_expiry") or user.get("otp_expiry") < datetime.utcnow():
            raise HTTPException(400, "OTP has expired. Please restart the reset process.")

        if not user.get("reset_otp_verified"):
            raise HTTPException(400, "OTP not verified. Please complete step 2 first.")

        # Hash and save new password, clear OTP fields
        new_hash = get_password_hash(data.new_password)
        await db.users.update_one(
            {"email": data.email},
            {"$set": {
                "password_hash":       new_hash,
                "otp":                 None,
                "otp_expiry":          None,
                "reset_otp_verified":  False,
            }},
        )
        return {"message": "Password reset successfully. You can now log in."}
