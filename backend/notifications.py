from twilio.rest import Client
from twilio.base.exceptions import TwilioException
from datetime import datetime

from config import (
    TWILIO_ACCOUNT_SID as ACCOUNT_SID,
    TWILIO_AUTH_TOKEN as AUTH_TOKEN,
    TWILIO_RECEIVE_NUMBER as RECEIVER,
    TWILIO_SEND_NUMBER as SENDER,
)

_client = None


class NotificationError(Exception):
    """Raised when an SMS notification could not be delivered."""


def notifications_enabled():
    return all([ACCOUNT_SID, AUTH_TOKEN, SENDER, RECEIVER])


def _get_client():
    global _client
    if _client is None:
        _client = Client(ACCOUNT_SID, AUTH_TOKEN)
    return _client


def send_notification(url):
    """Send an SMS alert for a detection.

    Returns True if a message was sent, False if notifications are not
    configured. Raises NotificationError if Twilio rejects the request.
    """
    if not notifications_enabled():
        return False

    now = datetime.now()
    formatted_now = now.strftime("%d/%m/%y %H:%M:%S")
    try:
        _get_client().messages.create(
            body=f"Person motion detected @{formatted_now}: {url}",
            from_=SENDER,  # Your Twilio phone number
            to=RECEIVER     # Recipient phone number
        )
    except TwilioException as exc:
        raise NotificationError(str(exc)) from exc
    return True
