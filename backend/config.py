"""Runtime settings read from environment variables (and backend/.env)."""
import os
from dotenv import load_dotenv

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

load_dotenv(os.path.join(BASE_DIR, ".env"))


def _read_number(name, default, cast, minimum=None, maximum=None):
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default

    try:
        value = cast(raw)
    except ValueError:
        raise ValueError(f"{name} must be a number, got {raw!r}") from None

    if minimum is not None and value < minimum:
        raise ValueError(f"{name} must be at least {minimum}, got {value}")
    if maximum is not None and value > maximum:
        raise ValueError(f"{name} must be at most {maximum}, got {value}")
    return value


def _read_choice(name, default, choices):
    raw = os.getenv(name)
    if raw is None or raw.strip() == "":
        return default

    value = raw.strip().upper()
    if value not in choices:
        raise ValueError(f"{name} must be one of {', '.join(choices)}, got {raw!r}")
    return value


LOG_LEVEL = _read_choice(
    "LENSFORT_LOG_LEVEL", "INFO", ("DEBUG", "INFO", "WARNING", "ERROR", "CRITICAL")
)

# Bind to localhost by default; the API has no authentication. Set
# LENSFORT_HOST=0.0.0.0 to deliberately expose it on the local network.
HOST = os.getenv("LENSFORT_HOST", "").strip() or "127.0.0.1"
PORT = _read_number("LENSFORT_PORT", 5000, int, minimum=1, maximum=65535)

# Browser origins allowed to call the API (comma-separated).
DEFAULT_CORS_ORIGINS = "http://localhost:3000,http://127.0.0.1:3000"
CORS_ORIGINS = [
    origin.strip()
    for origin in os.getenv("LENSFORT_CORS_ORIGINS", DEFAULT_CORS_ORIGINS).split(",")
    if origin.strip()
]

# Index of the capture device passed to cv.VideoCapture.
CAMERA_INDEX = _read_number("LENSFORT_CAMERA_INDEX", 0, int, minimum=0)

# Minimum MobileNet SSD confidence for a detection to count as a person.
CONFIDENCE_THRESHOLD = _read_number(
    "LENSFORT_CONFIDENCE_THRESHOLD", 0.5, float, minimum=0.0, maximum=1.0
)

# Frames without a person before an open recording is closed.
COOLDOWN_FRAMES = _read_number("LENSFORT_COOLDOWN_FRAMES", 50, int, minimum=1)

# Delete recordings older than this many days. Unset or 0 keeps them forever.
RETENTION_DAYS = _read_number("LENSFORT_RETENTION_DAYS", 0, int, minimum=0)
