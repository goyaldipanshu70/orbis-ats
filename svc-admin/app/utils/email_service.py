import smtplib
import sendgrid
import requests
from sendgrid.helpers.mail import Mail
from email.message import EmailMessage
from app.services.settings_service import get_email_settings

async def send_email(subject: str, body: str, to: str):
    config = await get_email_settings()
    if not config:
        raise Exception("Email config not set")

    if config["provider"] == "sendgrid":
        sg = sendgrid.SendGridAPIClient(api_key=config["api_key"])
        message = Mail(
            from_email=config["smtp_user"],
            to_emails=to,
            subject=subject,
            html_content=body
        )
        response = sg.send(message)
        return response.status_code

    elif config["provider"] == "mailgun":
        response = requests.post(
            f"https://api.mailgun.net/v3/{config['smtp_host']}/messages",
            auth=("api", config["api_key"]),
            data={
                "from": config["smtp_user"],
                "to": [to],
                "subject": subject,
                "html": body
            }
        )
        return response.status_code

    elif config["provider"] == "smtp":
        msg = EmailMessage()
        msg.set_content(body)
        msg["Subject"] = subject
        msg["From"] = config["smtp_user"]
        msg["To"] = to
        port = int(config.get("smtp_port", 587))
        # MailHog (port 1025) and dev SMTP servers don't need SSL/auth
        if port in (1025, 25):
            with smtplib.SMTP(config["smtp_host"], port) as server:
                server.send_message(msg)
        else:
            with smtplib.SMTP_SSL(config["smtp_host"], port) as server:
                server.login(config["smtp_user"], config["smtp_password"])
                server.send_message(msg)
        return 200

    else:
        raise Exception("Unsupported email provider")