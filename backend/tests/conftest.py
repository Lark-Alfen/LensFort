import os
import sys

import pytest

BACKEND_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
sys.path.insert(0, BACKEND_DIR)

import main  # noqa: E402


class FakeCapture:
    def __init__(self, opened=True):
        self.opened = opened

    def isOpened(self):
        return self.opened

    def read(self):
        return False, None

    def get(self, prop):
        return 0

    def release(self):
        pass


@pytest.fixture
def video_dir(tmp_path, monkeypatch):
    """Point the API at an empty temporary recordings directory."""
    monkeypatch.setattr(main, "VIDEO_DIR", str(tmp_path))
    return tmp_path


@pytest.fixture
def client(video_dir):
    main.app.config["TESTING"] = True
    with main.app.test_client() as client:
        yield client
    main.camera.disarm()


def make_recording(directory, name):
    path = directory / name
    path.write_bytes(b"\x00")
    return path
