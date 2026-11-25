from abc import ABC, abstractmethod
import json
import urllib.request
import urllib.error
from src.config import settings

class BaseEmailService(ABC):
    """Abstract Base Class for email delivery (Strategy Pattern)."""

    @abstractmethod
    def send_otp(self, to_email: str, otp: str) -> bool:
        """Send a 6-digit verification OTP to the recipient."""
        pass


class ConsoleEmailService(BaseEmailService):
    """Local development email service: Prints styled OTP directly to the terminal."""

    def send_otp(self, to_email: str, otp: str) -> bool:
        print("\n" + "=" * 60)
        print("[LOCAL DEVELOPMENT EMAIL DISPATCHER]")
        print(f"Recipient : {to_email}")
        print(f"OTP CODE  : {otp}")
        print(f"Validity  : {settings.OTP_EXPIRE_MINUTES} minutes")
        print("=" * 60 + "\n")
        return True


class BrevoEmailService(BaseEmailService):
    """Production email service: Delivers real emails via Brevo HTTPS REST API (Port 443)."""

    def send_otp(self, to_email: str, otp: str) -> bool:
        url = "https://api.brevo.com/v3/smtp/email"
        headers = {
            "api-key": settings.BREVO_API_KEY,
            "Content-Type": "application/json",
            "Accept": "application/json"
        }

        html_content = f"""
        <div style="font-family: Arial, sans-serif; max-width: 500px; margin: auto; padding: 25px; border: 1px solid #e0e0e0; border-radius: 10px; background-color: #ffffff;">
            <h2 style="color: #1a73e8; text-align: center; margin-bottom: 20px;">{settings.BREVO_FROM_NAME}</h2>
            <p style="font-size: 16px; color: #333;">Hello,</p>
            <p style="font-size: 15px; color: #555;">Use the following one-time code to verify your college email and create your account:</p>
            <div style="background-color: #f0f4f9; padding: 18px; text-align: center; font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #1a73e8; border-radius: 8px; margin: 25px 0;">
                {otp}
            </div>
            <p style="color: #666; font-size: 14px;">This code is valid for <strong>{settings.OTP_EXPIRE_MINUTES} minutes</strong>.</p>
            <hr style="border: none; border-top: 1px solid #eee; margin: 25px 0;" />
            <p style="color: #999; font-size: 12px; text-align: center;">If you did not request this verification, you can safely ignore this email.</p>
        </div>
        """

        payload = {
            "sender": {
                "name": settings.BREVO_FROM_NAME,
                "email": settings.BREVO_FROM_EMAIL
            },
            "to": [
                {
                    "email": to_email
                }
            ],
            "subject": f"Verification code for {settings.BREVO_FROM_NAME}",
            "htmlContent": html_content
        }

        try:
            req = urllib.request.Request(
                url,
                data=json.dumps(payload).encode("utf-8"),
                headers=headers,
                method="POST"
            )
            with urllib.request.urlopen(req, timeout=10) as response:
                response_data = json.loads(response.read().decode("utf-8"))
                print(f"[Brevo REST API] Email delivered successfully to {to_email}. MessageId: {response_data.get('messageId')}")
                return True

        except urllib.error.HTTPError as err:
            error_body = err.read().decode("utf-8")
            print(f"[Brevo REST API HTTP Error] Code: {err.code}, Details: {error_body}")
            return False
        except Exception as exc:
            print(f"[Brevo REST API Error] Connection failed: {exc}")
            return False


def get_email_service() -> BaseEmailService:
    """
    Factory method: 
    - If LOCAL is True: Use ConsoleEmailService (instant terminal output).
    - If LOCAL is False: Use BrevoEmailService (Brevo HTTPS REST API).
    """
    if not settings.LOCAL:
        return BrevoEmailService()
    return ConsoleEmailService()
