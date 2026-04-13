# EngageVision Security System

EngageVision is a local, camera-based security monitoring application with:

- A Python backend that handles camera control, person detection, and video lifecycle.
- A React frontend that provides system control, recordings browsing, playback, download, and deletion.

This document is a developer-focused guide that explains how the system works end-to-end, how to run it, and where to change behavior safely.

## 1. What This Project Does

At a high level, the system performs these operations:

1. User arms the system in the web UI.
2. Backend starts camera loop and runs person detection on live frames.
3. If a person is detected, frames are written to a temporary video file.
4. When detections stop for a configured frame window, recording closes.
5. Closed recording is post-processed with ffmpeg and saved into local storage.
6. Frontend fetches logs from backend and renders recordings by date.
7. User can view details, download, and delete recordings from the dashboard.

## 2. Architecture Overview

### Backend (Python + Flask)

- `backend/main.py` exposes REST APIs, serves video files, and controls the `Camera` singleton.
- `backend/camera.py` contains the camera worker thread, OpenCV DNN inference, and record-start/stop logic.
- `backend/storage.py` finalizes clips asynchronously and stores them in `backend/local_videos`.
- `backend/notifications.py` provides optional Twilio SMS notification helper.

### Frontend (React)

- `frontend/src/App.js` defines routes and application shell.
- `frontend/src/ArmControl.jsx` controls arm/disarm state and live stats.
- `frontend/src/RecordingsPage.jsx` handles logs retrieval, filtering, grouping, and calendar browsing.
- `frontend/src/Details.jsx` handles playback plus download/delete actions.
- `frontend/src/Log.jsx` renders recording cards and previews.

## 3. Core Runtime Flow

### 3.1 Arm/Disarm

- Frontend calls `POST /arm` and `POST /disarm`.
- Backend forwards those actions to `Camera.arm()` and `Camera.disarm()`.
- `Camera` thread lifecycle is protected with a lock (`state_lock`) to avoid duplicate starts/stops.

### 3.2 Detection and Recording

- OpenCV MobileNet SSD model files:
  - `backend/models/config.txt`
  - `backend/models/mobilenet_iter_73000.caffemodel`
- Person class filter:
  - Class ID `15`
  - Confidence threshold: `0.5`
- While armed:
  - Reads camera frame
  - Runs forward pass
  - Detects person boxes
  - Starts recording when first person appears
  - Keeps writing frames while detections continue
  - Stops recording after `50` consecutive non-detection frames

### 3.3 Clip Finalization and Storage

- Temporary clip path is created in `backend/videos/`.
- On clip close, `storage.handle_detection(path)` runs in a background daemon thread.
- `save_locally()` in `backend/storage.py`:
  - Scales clip to 720px height via ffmpeg
  - Writes final file to `backend/local_videos/`
  - Uses timestamp filename format: `DD-MM-YY-HH-MM-SS.mp4`

### 3.4 Log Retrieval

- `GET /get-logs` scans `backend/local_videos/`.
- Timestamp is parsed from filename and returned as ISO datetime (`date`).
- Supports filters:
  - `startDate` / `endDate` (ISO strings or date-only)
  - legacy `days` offset

## 4. Repository Structure

```text
Python-Security-System/
  backend/
    .sample.env
    __init__.py
    camera.py
    main.py
    notifications.py
    storage.py
    models/
      config.txt
      mobilenet_iter_73000.caffemodel
    local_videos/            # runtime-generated recordings
  frontend/
    package.json
    package-lock.json
    public/
    src/
      App.js
      ArmControl.jsx
      ArmControl.css
      Sidebar.jsx
      Sidebar.css
      RecordingsPage.jsx
      RecordingsPage.css
      Log.jsx
      Log.css
      Details.jsx
      Details.css
      index.js
      index.css
  design/
    Sequence Diagram.pdf
    System Diagram.pdf
    User Interface Design.pdf
  requirements.txt
  .gitignore
```

## 5. Backend API Reference

### Health and state

- `GET /`
  - Returns welcome text.

- `GET /get-armed`
  - Returns current armed state.
  - Response example:
    - `{"armed": false}`

- `GET /camera-status`
  - Returns camera summary status.
  - Response example:
    - `{"active": false, "status": "Standby"}`

### Control

- `POST /arm`
  - Arms the camera worker.

- `POST /disarm`
  - Disarms the camera worker.

### Logs and media

- `GET /get-logs`
  - Query params:
    - `startDate`
    - `endDate`
    - `days` (legacy)
  - Response:
    - `{"logs": [{"url": "/local_videos/<file>.mp4", "date": "<iso>"}]}`

- `GET /local_videos/<filename>`
  - Streams/serves video for playback.

- `GET /download-recording/<filename>`
  - Forces recording download as attachment.

- `DELETE /delete-recording/<filename>`
  - Deletes a recording file.
  - Response example:
    - `{"message": "Recording deleted", "filename": "..."}`

### Optional notification endpoint

- `POST /motion_detected`
  - Accepts body with `url` and forwards to `send_notification()`.
  - This endpoint is available for external integrations or future hooks.

## 6. Frontend Behavior

### Routes

- `/` -> `ArmControl`
- `/recordings` -> `RecordingsPage`
- `/details` -> `Details`

### ArmControl page

- Polls armed status every 10 seconds.
- Shows:
  - current armed/disarmed state
  - camera status
  - recordings count
  - last motion timestamp

### Recordings page

- Fetches all logs from backend.
- Supports:
  - daily view
  - all recordings view
  - calendar-based date selection
  - previous/next day navigation
  - date grouping and sorting

### Details page

- Plays selected recording via `react-player`.
- Shows metadata and file name.
- Supports:
  - download action (`GET /download-recording/...`)
  - delete action (`DELETE /delete-recording/...`)

## 7. Configuration

### Twilio (optional)

Copy `backend/.sample.env` to `backend/.env` and set values:

- `TWILIO_ACCOUNT_SID`
- `TWILIO_AUTH_TOKEN`
- `TWILIO_RECEIVE_NUMBER`
- `TWILIO_SEND_NUMBER`

`notifications.py` loads these values through `python-dotenv`.

## 8. Local Setup (Windows PowerShell)

### Prerequisites

- Python 3.11+
- Node.js and npm
- ffmpeg installed and available on PATH

### Install

From repository root:

```powershell
python -m venv .venv
.\.venv\Scripts\Activate.ps1
pip install -r requirements.txt
npm --prefix frontend install
```

### Run

Backend:

```powershell
.\.venv\Scripts\python.exe backend/main.py
```

Frontend:

```powershell
npm --prefix frontend start
```

URLs:

- Frontend: `http://localhost:3000`
- Backend: `http://127.0.0.1:5000`

## 9. Development Notes and Guardrails

- The backend camera loop is stateful and thread-backed. Prefer small, targeted changes in `camera.py`.
- The file naming convention in `local_videos` is part of the API contract for log timestamps.
- Keep `local_videos` and cache/artifact folders out of git (already handled in `.gitignore`).
- If you change frontend routes, update direct navigation assumptions in `Details.jsx` and `RecordingsPage.jsx`.

## 10. Troubleshooting

### Camera not opening

- Ensure no other app is holding camera device `0`.
- Verify camera permissions in OS privacy settings.

### Frontend command fails from root with `npm start`

- This project frontend is nested; use:
  - `npm --prefix frontend start`

### No recordings shown

- Confirm backend is running.
- Confirm files exist under `backend/local_videos`.
- Check `GET /get-logs` response in browser/network tab.

### Download/Delete failing

- Ensure `Details` receives a valid recording URL.
- Confirm backend route accessibility:
  - `/download-recording/<file>`
  - `/delete-recording/<file>`

## 11. Suggested Next Engineering Improvements

- Add automated backend tests for API routes and filename parsing.
- Add frontend component/integration tests for recordings filters and actions.
- Add configurable detection threshold via env var or settings API.
- Add structured logging and request correlation IDs.
- Add Docker support for reproducible local setup.
- Add GitHub Actions CI for lint, test, and build checks.
