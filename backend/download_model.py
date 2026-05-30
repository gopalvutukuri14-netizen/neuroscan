"""
Auto-downloads deployment_model.pt from Google Drive if not present.
Called from main.py startup event — runs before first prediction.
"""
import os, sys
from pathlib import Path

# backend/deployment_model.pt
MODEL_PATH = Path(__file__).resolve().parent / "deployment_model.pt"
FILE_ID    = "19qNbAohbBmkYFnw-7ZR3qqvfh0ozxamO"

def download_model():
    print(f"📍 Model path: {MODEL_PATH}")
    if MODEL_PATH.exists():
        size_mb = MODEL_PATH.stat().st_size / 1e6
        print(f"✅ Model already exists ({size_mb:.1f} MB) — skipping download")
        return

    print("📥 Downloading deployment_model.pt from Google Drive...")
    try:
        import gdown
        url = f"https://drive.google.com/uc?id={FILE_ID}"
        gdown.download(url, str(MODEL_PATH), quiet=False)
        if MODEL_PATH.exists():
            size_mb = MODEL_PATH.stat().st_size / 1e6
            print(f"✅ Model downloaded ({size_mb:.1f} MB)")
        else:
            print("❌ Download failed — file not found after download")
            sys.exit(1)
    except Exception as e:
        print(f"❌ Download error: {e}")
        sys.exit(1)

if __name__ == "__main__":
    download_model()