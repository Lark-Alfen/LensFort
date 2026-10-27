from datetime import datetime

import pytest

import config
import storage
from conftest import make_recording


@pytest.fixture
def local_dir(tmp_path, monkeypatch):
    monkeypatch.setattr(storage, "LOCAL_DIRECTORY", str(tmp_path))
    return tmp_path


def test_purge_disabled_keeps_everything(local_dir):
    make_recording(local_dir, "01-01-20-00-00-00.mp4")
    assert storage.purge_old_recordings(0) == 0
    assert len(list(local_dir.iterdir())) == 1


def test_purge_deletes_only_expired_recordings(local_dir):
    now = datetime(2026, 10, 27, 12, 0)
    make_recording(local_dir, "01-10-26-10-00-00.mp4")
    make_recording(local_dir, "27-10-26-09-00-00.mp4")
    make_recording(local_dir, "notes.txt")

    assert storage.purge_old_recordings(7, now=now) == 1
    assert sorted(p.name for p in local_dir.iterdir()) == ["27-10-26-09-00-00.mp4", "notes.txt"]


def test_save_locally_keeps_clip_when_processing_fails(local_dir, tmp_path_factory, monkeypatch):
    temp_dir = tmp_path_factory.mktemp("videos")
    clip = make_recording(temp_dir, "01-02-25-10-00-00.mp4")

    def missing_ffmpeg(*args, **kwargs):
        raise FileNotFoundError("ffmpeg")

    monkeypatch.setattr(storage.ffmpeg, "input", missing_ffmpeg)

    saved = storage.save_locally(str(clip))

    assert saved.endswith("01-02-25-10-00-00.mp4")
    assert (local_dir / "01-02-25-10-00-00.mp4").exists()
    assert not clip.exists()


def test_config_number_validation(monkeypatch):
    monkeypatch.setenv("LENSFORT_TEST_VALUE", "0.7")
    assert config._read_number("LENSFORT_TEST_VALUE", 0.5, float, 0.0, 1.0) == 0.7

    monkeypatch.setenv("LENSFORT_TEST_VALUE", "5")
    with pytest.raises(ValueError):
        config._read_number("LENSFORT_TEST_VALUE", 0.5, float, 0.0, 1.0)

    monkeypatch.setenv("LENSFORT_TEST_VALUE", "abc")
    with pytest.raises(ValueError):
        config._read_number("LENSFORT_TEST_VALUE", 1, int)

    monkeypatch.delenv("LENSFORT_TEST_VALUE")
    assert config._read_number("LENSFORT_TEST_VALUE", 3, int) == 3
