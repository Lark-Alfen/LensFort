"""Recording filename format shared by the camera and the API.

A recording's filename encodes when the detection started, e.g.
``02-05-25-16-05-07.mp4`` for 2 May 2025 16:05:07 local time. The API relies
on this to date recordings, so always build and parse names through here.
"""
import os
from datetime import datetime

TIMESTAMP_FORMAT = "%d-%m-%y-%H-%M-%S"
EXTENSION = ".mp4"


def recording_filename(moment):
    """Return the filename for a recording that started at ``moment``."""
    return moment.strftime(TIMESTAMP_FORMAT) + EXTENSION


def parse_recording_time(filename):
    """Return the start time encoded in ``filename``.

    Raises ValueError if the name doesn't follow the recording format.
    """
    stem, _ = os.path.splitext(filename)
    return datetime.strptime(stem, TIMESTAMP_FORMAT)
