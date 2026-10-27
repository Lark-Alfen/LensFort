import pytest

from conftest import make_recording

NAME = "01-10-25-22-58-10.mp4"


def test_serves_recording(client, video_dir):
    make_recording(video_dir, NAME)
    response = client.get(f"/local_videos/{NAME}")
    assert response.status_code == 200
    assert response.mimetype == "video/mp4"


def test_download_is_attachment(client, video_dir):
    make_recording(video_dir, NAME)
    response = client.get(f"/download-recording/{NAME}")
    assert response.status_code == 200
    assert "attachment" in response.headers["Content-Disposition"]


def test_delete_removes_file(client, video_dir):
    path = make_recording(video_dir, NAME)
    response = client.delete(f"/delete-recording/{NAME}")
    assert response.status_code == 200
    assert not path.exists()


def test_missing_recording_is_404(client):
    assert client.get("/local_videos/missing.mp4").status_code == 404
    assert client.get("/download-recording/missing.mp4").status_code == 404
    assert client.delete("/delete-recording/missing.mp4").status_code == 404


@pytest.mark.parametrize("name", ["notes.txt", "..%5Cmain.py", "..%2Fmain.py"])
def test_rejects_non_recording_names(client, video_dir, name):
    make_recording(video_dir, "notes.txt")
    assert client.get(f"/local_videos/{name}").status_code in (400, 404)
    assert client.get(f"/download-recording/{name}").status_code in (400, 404)
    assert client.delete(f"/delete-recording/{name}").status_code in (400, 404)
    assert (video_dir / "notes.txt").exists()
