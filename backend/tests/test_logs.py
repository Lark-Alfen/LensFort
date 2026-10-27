from datetime import datetime, timedelta

from conftest import make_recording
from recordings import recording_filename


def names(response):
    return [log["filename"] for log in response.get_json()["logs"]]


def test_lists_recordings_newest_first(client, video_dir):
    make_recording(video_dir, "01-10-25-22-55-47.mp4")
    make_recording(video_dir, "01-10-25-22-58-10.mp4")
    make_recording(video_dir, "notes.txt")

    response = client.get("/get-logs")

    assert response.status_code == 200
    assert names(response) == ["01-10-25-22-58-10.mp4", "01-10-25-22-55-47.mp4"]
    first = response.get_json()["logs"][0]
    assert first["url"] == "/local_videos/01-10-25-22-58-10.mp4"
    assert first["date"] == "2025-10-01T22:58:10"


def test_unparseable_names_are_unknown_and_last(client, video_dir):
    make_recording(video_dir, "01-10-25-22-55-47.mp4")
    make_recording(video_dir, "clip.mp4")

    logs = client.get("/get-logs").get_json()["logs"]

    assert [log["date"] for log in logs] == ["2025-10-01T22:55:47", "Unknown"]


def test_date_only_end_is_inclusive(client, video_dir):
    make_recording(video_dir, "30-09-25-23-59-59.mp4")
    make_recording(video_dir, "01-10-25-12-00-00.mp4")
    make_recording(video_dir, "02-10-25-00-00-00.mp4")

    response = client.get("/get-logs?startDate=2025-10-01&endDate=2025-10-01")

    assert names(response) == ["01-10-25-12-00-00.mp4"]


def test_timezone_aware_dates_are_accepted(client, video_dir):
    local = datetime(2025, 10, 1, 12, 0, 0)
    make_recording(video_dir, recording_filename(local))
    start = (local - timedelta(minutes=1)).astimezone().isoformat()
    end = (local + timedelta(minutes=1)).astimezone().isoformat()

    response = client.get("/get-logs", query_string={"startDate": start, "endDate": end})

    assert response.status_code == 200
    assert names(response) == [recording_filename(local)]


def test_days_filter(client, video_dir):
    now = datetime.now().replace(microsecond=0)
    yesterday = now - timedelta(days=1)
    make_recording(video_dir, recording_filename(yesterday))
    make_recording(video_dir, recording_filename(now))

    response = client.get("/get-logs?days=1")

    assert names(response) == [recording_filename(yesterday)]


def test_rejects_invalid_params(client):
    assert client.get("/get-logs?days=abc").status_code == 400
    assert client.get("/get-logs?days=-1").status_code == 400
    assert client.get("/get-logs?startDate=nope").status_code == 400
    assert client.get("/get-logs?startDate=2025-03-01&endDate=2025-01-01").status_code == 400
