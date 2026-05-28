import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME: str = "NeuroScan AI"
    MONGO_URI: str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DATABASE_NAME: str = "neuroscan"

    JWT_SECRET: str = os.getenv("JWT_SECRET", "your_super_secret_key_here")
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    EMAIL_HOST: str = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", 587))
    EMAIL_USER: str = os.getenv("EMAIL_USER", "your_email@gmail.com")
    EMAIL_PASS: str = os.getenv("EMAIL_PASS", "your_app_password")

    # Admin secret key — required for admin login
    ADMIN_SECRET_KEY: str = os.getenv("ADMIN_SECRET_KEY", "neuroscan_admin_2026")

    class Config:
        env_file = ".env"

settings = Settings()
