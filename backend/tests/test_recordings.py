from datetime import datetime

import pytest

from recordings import parse_recording_time, recording_filename


def test_round_trip():
    moment = datetime(2025, 5, 2, 16, 5, 7)
    name = recording_filename(moment)
    assert name == "02-05-25-16-05-07.mp4"
    assert parse_recording_time(name) == moment


@pytest.mark.parametrize("name", ["notes.txt", "2025-05-02.mp4", "02-05-25-16-05-07-out.mp4"])
def test_rejects_other_names(name):
    with pytest.raises(ValueError):
        parse_recording_time(name)
