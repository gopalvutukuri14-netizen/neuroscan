import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from app.core.config import settings

def send_otp_email(to_email: str, otp: str):
    if settings.EMAIL_USER == "your_email@gmail.com":
        print(f"SMTP not configured. Placeholder OTP for {to_email}: {otp}")
        return True
        
    try:
        msg = MIMEMultipart()
        msg['From'] = settings.EMAIL_USER
        msg['To'] = to_email
        msg['Subject'] = "NeuroScan AI - Your OTP Code"
        
        body = f"Your verification code is: {otp}\nThis code will expire in 5 minutes."
        msg.attach(MIMEText(body, 'plain'))
        
        server = smtplib.SMTP(settings.EMAIL_HOST, settings.EMAIL_PORT)
        server.starttls()
        server.login(settings.EMAIL_USER, settings.EMAIL_PASS)
        text = msg.as_string()
        server.sendmail(settings.EMAIL_USER, to_email, text)
        server.quit()
        return True
    except Exception as e:
        print(f"Failed to send email: {e}")
        return False
