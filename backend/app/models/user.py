from typing import Optional
from datetime import datetime
from pydantic import BaseModel, Field
import uuid

def generate_uuid():
    return str(uuid.uuid4())

class UserModel(BaseModel):
    user_id: str = Field(default_factory=generate_uuid)
    username: str
    email: str
    password_hash: str
    role: str = "patient"          # patient | clinician | researcher | admin
    is_verified: bool = False
    otp: Optional[str] = None
    otp_expiry: Optional[datetime] = None
    created_at: datetime = Field(default_factory=datetime.utcnow)

    def dict(self, *args, **kwargs):
        d = super().dict(*args, **kwargs)
        return d
