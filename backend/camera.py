import os
import cv2 as cv
import numpy as np
import threading
import time
from datetime import datetime
from storage import handle_detection
from config import CAMERA_INDEX, CONFIDENCE_THRESHOLD, COOLDOWN_FRAMES


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_CONFIG = os.path.join(BASE_DIR, "models", "config.txt")
MODEL_WEIGHTS = os.path.join(BASE_DIR, "models", "mobilenet_iter_73000.caffemodel")
PERSON_CLASS_ID = 15
# About 5 seconds of failed reads before treating the camera as lost.
MAX_CONSECUTIVE_READ_FAILURES = 50
READ_RETRY_DELAY_SECONDS = 0.1
DEFAULT_RECORDING_FPS = 20.0


class Camera:
    net = cv.dnn.readNetFromCaffe(MODEL_CONFIG, MODEL_WEIGHTS)

    def __init__(self):
        self.armed = False
        self.camera_thread = None
        self.cap = None
        self.out = None
        self.state_lock = threading.Lock()
        self.video_dir = os.path.join(BASE_DIR, "videos")

        # Ensure the directory exists
        os.makedirs(self.video_dir, exist_ok=True)

    def arm(self):
        """Arm the system. Returns False if the camera device can't be opened."""
        with self.state_lock:
            if self.armed:
                print("Camera is already armed.")
                return True

            # A previous loop may still be winding down after a disarm; it
            # keeps its open device, so just flip the flag back on.
            if self.camera_thread is not None and self.camera_thread.is_alive():
                self.armed = True
                print("Camera armed.")
                return True

            # Open the device here rather than in the thread so callers learn
            # immediately whether monitoring actually started.
            cap = cv.VideoCapture(CAMERA_INDEX)
            if not cap.isOpened():
                cap.release()
                print("Failed to open camera device.")
                return False

            self.cap = cap
            self.armed = True
            self.camera_thread = threading.Thread(target=self.run, daemon=True)
            self.camera_thread.start()

        print("Camera armed.")
        return True

    def disarm(self):
        with self.state_lock:
            if not self.armed:
                print("Camera is already disarmed.")
                return

            self.armed = False
            camera_thread = self.camera_thread

        if camera_thread and camera_thread.is_alive():
            camera_thread.join(timeout=3)

        print("Camera disarmed.")

    def _is_armed(self):
        with self.state_lock:
            return self.armed

    def run(self):
        non_detected_counter = 0
        failed_reads = 0
        current_recording_name = None
        # Exponential moving average of the processing loop rate. Frames are
        # written once per loop iteration, so this is the real recording FPS.
        measured_fps = None
        last_frame_time = None

        if self.cap is None:
            self.cap = cv.VideoCapture(CAMERA_INDEX)
        if not self.cap.isOpened():
            print("Failed to open camera device.")
            with self.state_lock:
                self.armed = False
                self.camera_thread = None
            return

        print("Camera started...")
        try:
            while self._is_armed():
                success, frame = self.cap.read()
                if not success or frame is None:
                    failed_reads += 1
                    if failed_reads >= MAX_CONSECUTIVE_READ_FAILURES:
                        print("Camera stopped delivering frames; disarming.")
                        break
                    time.sleep(READ_RETRY_DELAY_SECONDS)
                    continue
                failed_reads = 0

                frame_time = time.monotonic()
                if last_frame_time is not None:
                    interval = frame_time - last_frame_time
                    if interval > 0:
                        instant_fps = 1.0 / interval
                        measured_fps = (
                            instant_fps if measured_fps is None
                            else 0.9 * measured_fps + 0.1 * instant_fps
                        )
                last_frame_time = frame_time

                blob = cv.dnn.blobFromImage(frame, 0.007843, (300, 300), 127.5)
                self.net.setInput(blob)
                detections = self.net.forward()
                person_detected = False

                for i in range(detections.shape[2]):
                    confidence = float(detections[0, 0, i, 2])
                    idx = int(detections[0, 0, i, 1])

                    if idx == PERSON_CLASS_ID and confidence > CONFIDENCE_THRESHOLD:
                        box = detections[0, 0, i, 3:7] * np.array(
                            [frame.shape[1], frame.shape[0], frame.shape[1], frame.shape[0]]
                        )
                        (start_x, start_y, end_x, end_y) = box.astype("int")
                        cv.rectangle(frame, (start_x, start_y), (end_x, end_y), (0, 255, 0), 2)
                        person_detected = True

                # If a person is detected, start/continue recording.
                if person_detected:
                    non_detected_counter = 0
                    if self.out is None:
                        now = datetime.now()
                        formatted_now = now.strftime("%d-%m-%y-%H-%M-%S")
                        print("Person motion detected at", formatted_now)
                        current_recording_name = os.path.join(self.video_dir, f"{formatted_now}.mp4")
                        fourcc = cv.VideoWriter_fourcc(*"mp4v")
                        self.out = cv.VideoWriter(
                            current_recording_name,
                            fourcc,
                            self._recording_fps(measured_fps),
                            (frame.shape[1], frame.shape[0]),
                        )

                    self.out.write(frame)
                elif self.out is not None:
                    # Keep recording through the cooldown so brief detection
                    # dropouts don't cut footage out of the clip.
                    self.out.write(frame)
                    non_detected_counter += 1
                    if non_detected_counter >= COOLDOWN_FRAMES:
                        self.out.release()
                        self.out = None
                        if current_recording_name:
                            handle_detection(current_recording_name)
                            current_recording_name = None
        finally:
            if self.out is not None:
                self.out.release()
                self.out = None
                if current_recording_name:
                    handle_detection(current_recording_name)

            if self.cap is not None:
                self.cap.release()
                self.cap = None

            with self.state_lock:
                self.armed = False
                self.camera_thread = None

            print("Camera released...")

    def _recording_fps(self, measured_fps):
        fps = measured_fps
        if not fps and self.cap is not None:
            fps = self.cap.get(cv.CAP_PROP_FPS)
        if not fps or fps <= 0:
            fps = DEFAULT_RECORDING_FPS
        return max(1.0, min(float(fps), 60.0))

    def __del__(self):
        try:
            self.disarm()
        except Exception:
            pass

        if self.cap is not None:
            self.cap.release()

        if self.out is not None:
            self.out.release()
