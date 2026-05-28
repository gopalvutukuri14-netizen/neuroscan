import random
from datetime import datetime, timedelta
from app.core.email import send_otp_email
from app.db.database import get_database

class OTPService:
    @staticmethod
    def generate_otp() -> str:
        return str(random.randint(100000, 999999))

    @staticmethod
    async def create_and_send_otp(email: str) -> bool:
        db = get_database()
        otp = OTPService.generate_otp()
        expiry = datetime.utcnow() + timedelta(minutes=5)
        
        await db.users.update_one(
            {"email": email},
            {"$set": {"otp": otp, "otp_expiry": expiry}}
        )
        
        # Send email
        return send_otp_email(email, otp)
