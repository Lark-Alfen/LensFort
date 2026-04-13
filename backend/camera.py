import os
import cv2 as cv
import numpy as np
import threading
from datetime import datetime
from storage import handle_detection


BASE_DIR = os.path.dirname(os.path.abspath(__file__))
MODEL_CONFIG = os.path.join(BASE_DIR, "models", "config.txt")
MODEL_WEIGHTS = os.path.join(BASE_DIR, "models", "mobilenet_iter_73000.caffemodel")
PERSON_CLASS_ID = 15
PERSON_CONFIDENCE_THRESHOLD = 0.5


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
        with self.state_lock:
            if self.armed:
                print("Camera is already armed.")
                return

            self.armed = True
            if self.camera_thread is None or not self.camera_thread.is_alive():
                self.camera_thread = threading.Thread(target=self.run, daemon=True)
                self.camera_thread.start()

        print("Camera armed.")

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
        current_recording_name = None

        self.cap = cv.VideoCapture(0)
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
                    continue

                blob = cv.dnn.blobFromImage(frame, 0.007843, (300, 300), 127.5)
                self.net.setInput(blob)
                detections = self.net.forward()
                person_detected = False

                for i in range(detections.shape[2]):
                    confidence = float(detections[0, 0, i, 2])
                    idx = int(detections[0, 0, i, 1])

                    if idx == PERSON_CLASS_ID and confidence > PERSON_CONFIDENCE_THRESHOLD:
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
                            20.0,
                            (frame.shape[1], frame.shape[0]),
                        )

                    self.out.write(frame)
                else:
                    non_detected_counter += 1
                    if non_detected_counter >= 50 and self.out is not None:
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

    def __del__(self):
        try:
            self.disarm()
        except Exception:
            pass

        if self.cap is not None:
            self.cap.release()

        if self.out is not None:
            self.out.release()
