from fastapi import APIRouter, Depends, HTTPException
from app.schemas.auth_schema import UserCreate, UserLogin, AdminLogin, OTPVerify, ResendOTP
from app.services.auth_service import AuthService
from app.services.otp_service import OTPService
from app.api.dependencies import get_current_user
from app.db.database import get_database

router = APIRouter()

@router.post("/register")
async def register(user: UserCreate):
    return await AuthService.register_user(user)

@router.post("/verify-otp")
async def verify_otp(otp_data: OTPVerify):
    return await AuthService.verify_otp(otp_data)

@router.post("/login")
async def login(user: UserLogin):
    return await AuthService.login_user(user)

@router.post("/admin-login")
async def admin_login(data: AdminLogin):
    return await AuthService.admin_login(data)

@router.post("/resend-otp")
async def resend_otp(data: ResendOTP):
    db   = get_database()
    user = await db.users.find_one({"email": data.email})
    if not user:
        raise HTTPException(404, "Email not found")
    if user.get("is_verified"):
        raise HTTPException(400, "Email already verified")
    await OTPService.create_and_send_otp(data.email)
    return {"message": "OTP resent successfully"}

@router.get("/me")
async def get_me(current_user: dict = Depends(get_current_user)):
    return {
        "user_id"   : current_user["user_id"],
        "username"  : current_user.get("username", current_user["email"].split("@")[0]),
        "email"     : current_user["email"],
        "role"      : current_user.get("role", "patient"),
        "is_verified": current_user["is_verified"],
    }
