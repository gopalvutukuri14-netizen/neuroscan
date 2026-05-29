import os
from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    PROJECT_NAME : str = "NeuroScan AI"
    MONGO_URI    : str = os.getenv("MONGO_URI", "mongodb://localhost:27017")
    DATABASE_NAME: str = os.getenv("DATABASE_NAME", "neuroscan")

    JWT_SECRET                  : str = os.getenv("JWT_SECRET", "your_super_secret_key_here")
    JWT_ALGORITHM               : str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES : int = 30
    REFRESH_TOKEN_EXPIRE_DAYS   : int = 7

    EMAIL_HOST: str = os.getenv("EMAIL_HOST", "smtp.gmail.com")
    EMAIL_PORT: int = int(os.getenv("EMAIL_PORT", 587))
    EMAIL_USER: str = os.getenv("EMAIL_USER", "your_email@gmail.com")
    EMAIL_PASS: str = os.getenv("EMAIL_PASS", "your_app_password")

    ADMIN_SECRET_KEY: str = os.getenv("ADMIN_SECRET_KEY", "neuroscan_admin_2026")

    # AWS S3
    AWS_ACCESS_KEY_ID    : str = os.getenv("AWS_ACCESS_KEY_ID", "")
    AWS_SECRET_ACCESS_KEY: str = os.getenv("AWS_SECRET_ACCESS_KEY", "")
    AWS_BUCKET_NAME      : str = os.getenv("AWS_BUCKET_NAME", "neuroscan-uploads")
    AWS_REGION           : str = os.getenv("AWS_REGION", "ap-south-1")

    class Config:
        env_file = ".env"

settings = Settings()
