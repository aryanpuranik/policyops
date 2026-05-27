from __future__ import annotations

import imaplib
import smtplib
from email import message_from_bytes
from email.message import EmailMessage
from email.utils import parseaddr
from html import unescape
import re

from app.core.config import settings


def send_execution_form_email(
    *,
    to_email: str,
    workflow_title: str,
    execution_id: str,
    recipient_type: str,
    recipient_email: str | None,
    values: dict,
) -> bool:
    """Send the submitted execution form to the provided recipient email via SMTP.

    Returns True when delivery was attempted successfully. Returns False when email
    delivery is not configured or fails.
    """
    if not settings.EMAIL_SMTP_HOST:
        return False

    from_address = settings.EMAIL_FROM_ADDRESS or settings.EMAIL_SMTP_USERNAME or "no-reply@policyops.local"
    from_name = settings.EMAIL_FROM_NAME or "PolicyOps"
    subject = f"PolicyOps workflow form: {workflow_title}"

    text_body = _build_text_body(
        workflow_title=workflow_title,
        execution_id=execution_id,
        recipient_type=recipient_type,
        recipient_email=recipient_email,
        values=values,
    )
    html_body = text_body.replace("\n", "<br>")

    message = EmailMessage()
    message["From"] = f"{from_name} <{from_address}>"
    message["To"] = to_email
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(f"<html><body style='font-family:Arial,sans-serif;font-size:14px;color:#0f172a'>{html_body}</body></html>", subtype="html")

    try:
        with smtplib.SMTP(settings.EMAIL_SMTP_HOST, settings.EMAIL_SMTP_PORT, timeout=20) as smtp:
            if settings.EMAIL_SMTP_USE_TLS:
                smtp.starttls()
            if settings.EMAIL_SMTP_USERNAME:
                smtp.login(settings.EMAIL_SMTP_USERNAME, settings.EMAIL_SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception:
        return False


def _build_text_body(
    *,
    workflow_title: str,
    execution_id: str,
    recipient_type: str,
    recipient_email: str | None,
    values: dict,
) -> str:
    lines = [
        f"Workflow: {workflow_title}",
        f"Execution ID: {execution_id}",
        f"Recipient Type: {recipient_type}",
        f"Recipient Email: {recipient_email or 'N/A'}",
        "",
        "Submitted Inputs:",
    ]
    if values:
        for key, value in values.items():
            lines.append(f"- {key}: {value}")
    else:
        lines.append("- None")
    lines.append("")
    lines.append("This form was submitted from PolicyOps execution.")
    return "\n".join(lines)


def send_execution_input_request_email(
    *,
    to_email: str,
    workflow_title: str,
    execution_id: str,
    fields: list[dict],
) -> bool:
    """Send an input request template email to the external recipient."""
    if not settings.EMAIL_SMTP_HOST:
        return False

    from_address = settings.EMAIL_FROM_ADDRESS or settings.EMAIL_SMTP_USERNAME or "no-reply@policyops.local"
    from_name = settings.EMAIL_FROM_NAME or "PolicyOps"
    subject = f"Action required: PolicyOps workflow form ({execution_id})"

    lines = [
        f"Workflow: {workflow_title}",
        f"Execution ID: {execution_id}",
        "",
        "Please reply to this email and fill the values below:",
    ]
    for field in fields:
        lines.append(f"- {field.get('key')}: ")
    lines.extend(
        [
            "",
            "Important:",
            "- Keep the 'Execution ID' line unchanged",
            "- Reply from this email thread",
            "- Use one key:value pair per line",
        ]
    )
    text_body = "\n".join(lines)
    html_body = text_body.replace("\n", "<br>")

    message = EmailMessage()
    message["From"] = f"{from_name} <{from_address}>"
    message["To"] = to_email
    message["Reply-To"] = from_address
    message["Subject"] = subject
    message.set_content(text_body)
    message.add_alternative(
        f"<html><body style='font-family:Arial,sans-serif;font-size:14px;color:#0f172a'>{html_body}</body></html>",
        subtype="html",
    )

    try:
        with smtplib.SMTP(settings.EMAIL_SMTP_HOST, settings.EMAIL_SMTP_PORT, timeout=20) as smtp:
            if settings.EMAIL_SMTP_USE_TLS:
                smtp.starttls()
            if settings.EMAIL_SMTP_USERNAME:
                smtp.login(settings.EMAIL_SMTP_USERNAME, settings.EMAIL_SMTP_PASSWORD)
            smtp.send_message(message)
        return True
    except Exception:
        return False


def fetch_execution_reply_email(*, execution_id: str, expected_sender_email: str | None = None) -> dict | None:
    """Fetch the latest reply email for a given execution id from inbox via IMAP."""
    imap_host = settings.EMAIL_IMAP_HOST
    imap_port = settings.EMAIL_IMAP_PORT
    imap_user = settings.EMAIL_IMAP_USERNAME or settings.EMAIL_SMTP_USERNAME
    imap_password = settings.EMAIL_IMAP_PASSWORD or settings.EMAIL_SMTP_PASSWORD
    mailbox = settings.EMAIL_IMAP_MAILBOX or "INBOX"

    if not imap_host or not imap_user or not imap_password:
        return None

    try:
        with imaplib.IMAP4_SSL(imap_host, imap_port) as mail:
            mail.login(imap_user, imap_password)
            mail.select(mailbox)
            status, data = mail.search(None, "ALL")
            if status != "OK" or not data or not data[0]:
                return None

            ids = data[0].split()
            for msg_id in reversed(ids[-80:]):
                fetch_status, fetched = mail.fetch(msg_id, "(RFC822)")
                if fetch_status != "OK" or not fetched:
                    continue
                raw_msg = fetched[0][1]
                msg = message_from_bytes(raw_msg)

                subject = str(msg.get("Subject") or "")
                body = _extract_message_body(msg)
                if execution_id not in subject and execution_id not in body:
                    continue

                from_email = parseaddr(msg.get("From") or "")[1]
                if expected_sender_email and from_email.lower() != expected_sender_email.lower():
                    continue

                return {
                    "from_email": from_email,
                    "subject": subject,
                    "body": body,
                    "date": str(msg.get("Date") or ""),
                    "message_id": str(msg.get("Message-ID") or ""),
                }
    except Exception:
        return None

    return None


def _extract_message_body(msg) -> str:
    if msg.is_multipart():
        for part in msg.walk():
            content_type = part.get_content_type()
            disposition = str(part.get("Content-Disposition") or "")
            if "attachment" in disposition.lower():
                continue
            payload = part.get_payload(decode=True)
            if payload is None:
                continue
            charset = part.get_content_charset() or "utf-8"
            text = payload.decode(charset, errors="ignore")
            if content_type == "text/plain":
                return text
            if content_type == "text/html":
                return _strip_html(text)
        return ""

    payload = msg.get_payload(decode=True)
    if payload is None:
        return ""
    charset = msg.get_content_charset() or "utf-8"
    text = payload.decode(charset, errors="ignore")
    if msg.get_content_type() == "text/html":
        return _strip_html(text)
    return text


def _strip_html(html_text: str) -> str:
    text = re.sub(r"<\s*br\s*/?>", "\n", html_text, flags=re.IGNORECASE)
    text = re.sub(r"</p\s*>", "\n", text, flags=re.IGNORECASE)
    text = re.sub(r"<[^>]+>", "", text)
    return unescape(text)