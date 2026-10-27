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
