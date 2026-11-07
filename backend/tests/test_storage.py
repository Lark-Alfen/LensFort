import os
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


class FakeFfmpegStream:
    outputs = []

    def output(self, path, **kwargs):
        self.outputs.append(path)
        self.path = path
        return self

    def overwrite_output(self):
        return self

    def run(self, quiet=False):
        with open(self.path, "wb") as f:
            f.write(b"\x01")


def test_save_locally_processes_outside_library(local_dir, tmp_path_factory, monkeypatch):
    temp_dir = tmp_path_factory.mktemp("videos")
    clip = make_recording(temp_dir, "01-02-25-10-00-00.mp4")
    FakeFfmpegStream.outputs = []
    monkeypatch.setattr(storage.ffmpeg, "input", lambda path: FakeFfmpegStream())

    storage.save_locally(str(clip))

    [output] = FakeFfmpegStream.outputs
    assert os.path.dirname(output) == str(temp_dir)
    assert [p.name for p in local_dir.iterdir()] == ["01-02-25-10-00-00.mp4"]
    assert (local_dir / "01-02-25-10-00-00.mp4").read_bytes() == b"\x01"
    assert list(temp_dir.iterdir()) == []


def test_recover_pending_clips_discards_incomplete_outputs(local_dir, tmp_path_factory, monkeypatch):
    temp_dir = tmp_path_factory.mktemp("videos")
    make_recording(temp_dir, "01-02-25-10-00-00.mp4")
    make_recording(temp_dir, "01-02-25-09-00-00-out.mp4")
    make_recording(local_dir, "01-02-25-08-00-00-out.mp4")
    make_recording(local_dir, "01-02-25-07-00-00.mp4")
    recovered = []
    monkeypatch.setattr(storage, "handle_detection", recovered.append)

    assert storage.recover_pending_clips(str(temp_dir)) == 1

    assert [os.path.basename(p) for p in recovered] == ["01-02-25-10-00-00.mp4"]
    assert [p.name for p in temp_dir.iterdir()] == ["01-02-25-10-00-00.mp4"]
    assert [p.name for p in local_dir.iterdir()] == ["01-02-25-07-00-00.mp4"]


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


def test_config_choice_validation(monkeypatch):
    levels = ("DEBUG", "INFO")
    monkeypatch.setenv("LENSFORT_TEST_VALUE", " debug ")
    assert config._read_choice("LENSFORT_TEST_VALUE", "INFO", levels) == "DEBUG"

    monkeypatch.setenv("LENSFORT_TEST_VALUE", "VERBOSE")
    with pytest.raises(ValueError, match="LENSFORT_TEST_VALUE must be one of DEBUG, INFO"):
        config._read_choice("LENSFORT_TEST_VALUE", "INFO", levels)

    monkeypatch.setenv("LENSFORT_TEST_VALUE", "")
    assert config._read_choice("LENSFORT_TEST_VALUE", "INFO", levels) == "INFO"


@pytest.mark.parametrize("raw", ["50o0", "0", "70000"])
def test_config_rejects_invalid_port(monkeypatch, raw):
    monkeypatch.setenv("LENSFORT_PORT", raw)
    with pytest.raises(ValueError, match="LENSFORT_PORT"):
        config._read_number("LENSFORT_PORT", 5000, int, minimum=1, maximum=65535)
