import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings


def send_otp_email(to_email: str, otp: str) -> bool:
    """Send OTP email — uses Resend API if available, falls back to SMTP."""

    resend_api_key = os.getenv("RESEND_API_KEY", "")

    # ── Resend API (works on Railway) ────────────────────────
    if resend_api_key and resend_api_key.startswith("re_"):
        try:
            import urllib.request, json
            payload = json.dumps({
                "from"   : "NeuroScan AI <onboarding@resend.dev>",
                "to"     : [to_email],
                "subject": "NeuroScan AI — Your Verification Code",
                "html"   : f"""
                <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:32px;background:#F8FAFC;border-radius:12px;">
                  <div style="text-align:center;margin-bottom:24px;">
                    <h2 style="color:#0F172A;margin:0;">NeuroScan AI</h2>
                    <p style="color:#64748B;margin:4px 0 0;">Email Verification</p>
                  </div>
                  <div style="background:white;border-radius:10px;padding:24px;text-align:center;border:1px solid #E2E8F0;">
                    <p style="color:#374151;margin:0 0 16px;">Your verification code is:</p>
                    <div style="font-size:36px;font-weight:800;letter-spacing:8px;color:#2563EB;font-family:monospace;">
                      {otp}
                    </div>
                    <p style="color:#94A3B8;font-size:13px;margin:16px 0 0;">
                      This code expires in <strong>5 minutes</strong>.
                    </p>
                  </div>
                  <p style="color:#94A3B8;font-size:12px;text-align:center;margin-top:20px;">
                    If you didn't request this, please ignore this email.
                  </p>
                </div>
                """,
            }).encode("utf-8")

            req = urllib.request.Request(
                "https://api.resend.com/emails",
                data    = payload,
                headers = {
                    "Authorization": f"Bearer {resend_api_key}",
                    "Content-Type" : "application/json",
                },
                method  = "POST",
            )
            with urllib.request.urlopen(req, timeout=10) as resp:
                result = json.loads(resp.read().decode())
                print(f"✅ OTP email sent via Resend to {to_email} | id={result.get('id')}")
                return True

        except Exception as e:
            print(f"⚠️  Resend failed: {e} — falling back to SMTP")

    # ── SMTP fallback ─────────────────────────────────────────
    if settings.EMAIL_USER == "your_email@gmail.com":
        print(f"📧 [DEV] OTP for {to_email}: {otp}")
        return True

    try:
        msg = MIMEMultipart()
        msg["From"]    = settings.EMAIL_USER
        msg["To"]      = to_email
        msg["Subject"] = "NeuroScan AI — Your Verification Code"
        msg.attach(MIMEText(
            f"Your verification code is: {otp}\nThis code expires in 5 minutes.",
            "plain"
        ))
        server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT)
        server.starttls()
        server.login(settings.EMAIL_USER, settings.EMAIL_PASS)
        server.sendmail(settings.EMAIL_USER, to_email, msg.as_string())
        server.quit()
        print(f"✅ OTP email sent via SMTP to {to_email}")
        return True
    except Exception as e:
        print(f"❌ Failed to send email: {e}")
        # Print OTP to logs as last resort
        print(f"📧 [FALLBACK] OTP for {to_email}: {otp}")
        return False
