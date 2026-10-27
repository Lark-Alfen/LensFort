import camera
import main
import notifications
from conftest import FakeCapture


def test_arm_and_disarm(client, monkeypatch):
    monkeypatch.setattr(camera.cv, "VideoCapture", lambda index: FakeCapture())

    assert client.post("/arm", json={}).status_code == 200
    assert client.get("/get-armed").get_json() == {"armed": True}
    assert client.post("/disarm", json={}).status_code == 200
    assert client.get("/get-armed").get_json() == {"armed": False}


def test_arm_reports_unavailable_camera(client, monkeypatch):
    monkeypatch.setattr(camera.cv, "VideoCapture", lambda index: FakeCapture(opened=False))

    response = client.post("/arm", json={})

    assert response.status_code == 503
    assert "error" in response.get_json()
    assert client.get("/get-armed").get_json() == {"armed": False}


def test_post_requires_json(client):
    assert client.post("/disarm", data={"a": "b"}).status_code == 415
    assert client.post("/disarm", data="x", content_type="text/plain").status_code == 415
    assert client.post("/disarm").status_code == 415


def test_cors_only_allows_frontend_origin(client):
    allowed = client.get("/get-armed", headers={"Origin": "http://localhost:3000"})
    foreign = client.get("/get-armed", headers={"Origin": "https://example.com"})

    assert allowed.headers.get("Access-Control-Allow-Origin") == "http://localhost:3000"
    assert "Access-Control-Allow-Origin" not in foreign.headers


def test_motion_detected_requires_url(client):
    assert client.post("/motion_detected", json={}).status_code == 400


def test_motion_detected_skips_when_unconfigured(client, monkeypatch):
    monkeypatch.setattr(notifications, "ACCOUNT_SID", None)

    response = client.post("/motion_detected", json={"url": "x"})

    assert response.status_code == 200


def test_motion_detected_reports_send_failure(client, monkeypatch):
    def fail(url):
        raise notifications.NotificationError("boom")

    monkeypatch.setattr(main, "send_notification", fail)

    assert client.post("/motion_detected", json={"url": "x"}).status_code == 502
