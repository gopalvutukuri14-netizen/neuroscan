import urllib.request
import json
from app.core.config import settings
import os

def send_otp_email(to_email: str, otp: str) -> bool:
    """Send OTP email via Brevo Transactional API (works on Railway)."""

    api_key = os.getenv("BREVO_API_KEY", "")

    # ── Brevo API ─────────────────────────────────────────────
    if api_key:
        try:
            payload = json.dumps({
                "sender":      {"name": "NeuroScan AI", "email": "gopalvutukuri14@gmail.com"},
                "to":          [{"email": to_email}],
                "subject":     "NeuroScan AI — Your Verification Code",
                "htmlContent": f"""
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;
                            padding:32px;background:#F8FAFC;border-radius:12px;">
                  <div style="text-align:center;margin-bottom:24px;">
                    <h2 style="color:#0F172A;margin:0;">NeuroScan AI</h2>
                    <p style="color:#64748B;margin:4px 0 0;">Email Verification</p>
                  </div>
                  <div style="background:white;border-radius:10px;padding:24px;
                              text-align:center;border:1px solid #E2E8F0;">
                    <p style="color:#374151;margin:0 0 16px;">Your verification code is:</p>
                    <div style="font-size:36px;font-weight:800;letter-spacing:8px;
                                color:#2563EB;font-family:monospace;">
                      {otp}
                    </div>
                    <p style="color:#94A3B8;font-size:13px;margin:16px 0 0;">
                      This code expires in <strong>5 minutes</strong>.
                    </p>
                  </div>
                  <p style="color:#94A3B8;font-size:12px;text-align:center;margin-top:20px;">
                    If you didn&#39;t request this, please ignore this email.
                  </p>
                </div>
                """,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.brevo.com/v3/smtp/email",
                data=payload,
                headers={
                    "api-key":      api_key,
                    "Content-Type": "application/json",
                    "Accept":       "application/json",
                },
                method="POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode())
                print(f"✅ OTP email sent via Brevo to {to_email} | messageId={result.get('messageId')}")
                return True

        except Exception as e:
            print(f"❌ Brevo API failed: {e}")
            print(f"📧 [FALLBACK] OTP for {to_email}: {otp}")
            return False

    # ── Dev fallback (no API key configured) ─────────────────
    print(f"📧 [DEV] No BREVO_API_KEY set. OTP for {to_email}: {otp}")
    return True