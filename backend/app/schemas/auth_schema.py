from pydantic import BaseModel, EmailStr, Field
from datetime import datetime
from typing import Optional

# Admin cannot self-register — only patient and clinician allowed on signup page
VALID_ROLES = {"patient", "clinician"}

class UserCreate(BaseModel):
    username: str = Field(..., min_length=3, max_length=30)
    email: EmailStr
    password: str
    role: str = "patient"

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class AdminLogin(BaseModel):
    email: EmailStr
    password: str
    secret_key: str          # must match ADMIN_SECRET_KEY env var

class OTPVerify(BaseModel):
    email: EmailStr
    otp: str

class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    token_type: str = "bearer"

class UserResponse(BaseModel):
    user_id: str
    username: str
    email: EmailStr
    role: str
    is_verified: bool
    created_at: datetime

class ResendOTP(BaseModel):
    email: EmailStr

# ── Forgot Password Schemas ──────────────────────────────────

class ForgotPasswordRequest(BaseModel):
    """Step 1 — user provides their email to receive a reset OTP."""
    email: EmailStr

class VerifyResetOTP(BaseModel):
    """Step 2 — user provides email + the OTP they received."""
    email: EmailStr
    otp: str

class ResetPassword(BaseModel):
    """Step 3 — user provides email + OTP + new password to complete reset."""
    email: EmailStr
    otp: str
    new_password: str = Field(..., min_length=6)
