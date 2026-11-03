# LensFort Security System

[![CI](https://github.com/Lark-Alfen/LensFort/actions/workflows/ci.yml/badge.svg)](https://github.com/Lark-Alfen/LensFort/actions/workflows/ci.yml)

LensFort is a local, camera-based security monitoring application with:

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
- `backend/storage.py` finalizes clips asynchronously, recovers unfinished clips on startup, and applies the retention policy.
- `backend/recordings.py` defines the recording filename format and parses timestamps from it.
- `backend/config.py` reads and validates detection and retention settings from the environment.
- `backend/notifications.py` provides an optional Twilio SMS notification helper.
- `backend/tests/` contains the pytest suite (uses a fake camera, no hardware needed).

### Frontend (React)

- `frontend/src/App.js` defines routes and application shell.
- `frontend/src/config.js` resolves the backend URL (`REACT_APP_API_URL`).
- `frontend/src/Sidebar.jsx` renders navigation and the live backend status.
- `frontend/src/ArmControl.jsx` controls arm/disarm state and live stats.
- `frontend/src/RecordingsPage.jsx` handles logs retrieval, filtering, grouping, and calendar browsing.
- `frontend/src/Details.jsx` handles playback plus download/delete actions.
- `frontend/src/Log.jsx` renders recording cards and thumbnail previews.

## 3. Core Runtime Flow

### 3.1 Arm/Disarm

- Frontend calls `POST /arm` and `POST /disarm`.
- Backend forwards those actions to `Camera.arm()` and `Camera.disarm()`.
- `Camera.arm()` opens the capture device synchronously, so `POST /arm` returns `503` if the camera can't be opened.
- `Camera` thread lifecycle is protected with a lock (`state_lock`) to avoid duplicate starts/stops.

### 3.2 Detection and Recording

- OpenCV MobileNet SSD model files:
  - `backend/models/config.txt`
  - `backend/models/mobilenet_iter_73000.caffemodel`
- Person class filter:
  - Class ID `15`
  - Confidence threshold: `LENSFORT_CONFIDENCE_THRESHOLD` (default `0.5`)
- While armed:
  - Reads camera frame (backs off on read failures and disarms after about 5 seconds of consecutive failures)
  - Runs forward pass
  - Detects person boxes
  - Starts recording when first person appears
  - Keeps writing every frame while detections continue and during the cooldown, so clips play back smoothly
  - Stops recording after `LENSFORT_COOLDOWN_FRAMES` (default `50`) consecutive frames without a person
- Clips are written at the measured capture frame rate, so playback runs at real-time speed.

### 3.3 Clip Finalization and Storage

- Temporary clip path is created in `backend/videos/`, named after the detection time.
- On clip close, `storage.handle_detection(path)` runs in a background daemon thread.
- `save_locally()` in `backend/storage.py`:
  - Scales clip to 720px height via ffmpeg
  - Writes final file to `backend/local_videos/`, keeping the detection-time filename `DD-MM-YY-HH-MM-SS.mp4`
  - If ffmpeg is missing or fails, keeps the original clip instead of losing it
- On startup, clips left in `backend/videos/` by a crash are finalized.
- If `LENSFORT_RETENTION_DAYS` is set, recordings older than that are deleted hourly.

### 3.4 Log Retrieval

- `GET /get-logs` scans `backend/local_videos/`.
- Timestamp is parsed from filename and returned as ISO datetime (`date`).
- Supports filters:
  - `startDate` / `endDate` (ISO strings or date-only; timezone-aware values are converted to local time)
  - legacy `days` offset

## 4. Repository Structure

```text
LensFort/
  .github/
    workflows/ci.yml           # backend tests + frontend build
  backend/
    .sample.env
    __init__.py
    camera.py
    config.py
    main.py
    notifications.py
    recordings.py
    storage.py
    models/
      config.txt
      mobilenet_iter_73000.caffemodel
    tests/                     # pytest suite
    videos/                    # runtime: clips being recorded
    local_videos/              # runtime: finished recordings
  frontend/
    .env.example
    package.json
    package-lock.json
    public/
    src/
      App.js
      config.js
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
  requirements.txt
  requirements-dev.txt
  .gitignore
```

## 5. Backend API Reference

All `POST` requests must send `Content-Type: application/json`; other POSTs get `415`. This forces a CORS preflight, so other websites can't arm or disarm the system. Errors are returned as `{"error": "..."}`.

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
  - `200` on success, `503` if the camera can't be opened.

- `POST /disarm`
  - Disarms the camera worker.

### Logs and media

- `GET /get-logs`
  - Query params:
    - `startDate`
    - `endDate`
    - `days` (legacy, non-negative integer)
  - Response:
    - `{"logs": [{"filename": "<file>.mp4", "url": "/local_videos/<file>.mp4", "date": "<iso>"}]}`
  - `400` for an invalid date, invalid `days`, or `startDate` after `endDate`.

- `GET /local_videos/<filename>`
  - Streams/serves video for playback.

- `GET /download-recording/<filename>`
  - Forces recording download as attachment. Also answers `HEAD`.

- `DELETE /delete-recording/<filename>`
  - Deletes a recording file.
  - Response example:
    - `{"message": "Recording deleted", "filename": "..."}`

The three file routes accept only `.mp4` names inside `local_videos` (`400` otherwise) and return `404` for missing files.

### Optional notification endpoint

- `POST /motion_detected`
  - Accepts body with `url` and forwards to `send_notification()`.
  - `201` when sent, `200` when Twilio isn't configured (skipped), `400` without `url`, `502` if Twilio fails.
  - This endpoint is available for external integrations or future hooks.

## 6. Frontend Behavior

### Routes

- `/` -> `ArmControl`
- `/recordings` -> `RecordingsPage`
- `/details?file=<filename>` -> `Details`

### Sidebar

- Polls `GET /camera-status` every 10 seconds and shows Online (Armed/Standby) or Backend Offline.

### ArmControl page

- Polls armed status and recordings every 10 seconds.
- Shows:
  - current armed/disarmed state
  - camera status
  - recordings count
  - last motion timestamp
- Shows the backend's error message if arming fails.

### Recordings page

- Fetches all logs from backend once (and on Retry); views are filtered locally.
- Supports:
  - daily view
  - all recordings view
  - calendar-based date selection (future dates disabled)
  - previous/next day navigation
  - date grouping and sorting
  - keyboard navigation for cards and the calendar
- Shows an error with a Retry button if the backend can't be reached.

### Details page

- The recording is identified by the `file` query parameter, so the page works on refresh and from shared links.
- Plays selected recording via `react-player`.
- Shows metadata and file name.
- Supports:
  - download action (`GET /download-recording/...`, streamed by the browser)
  - delete action (`DELETE /delete-recording/...`)

## 7. Configuration

### Backend

Copy `backend/.sample.env` to `backend/.env` and adjust as needed. All values are optional.

| Variable | Default | Description |
|---|---|---|
| `LENSFORT_HOST` | `127.0.0.1` | Address the API listens on. Use `0.0.0.0` to allow LAN access. |
| `LENSFORT_PORT` | `5000` | Port the API listens on. |
| `LENSFORT_CORS_ORIGINS` | `http://localhost:3000,http://127.0.0.1:3000` | Comma-separated browser origins allowed to call the API. |
| `LENSFORT_CAMERA_INDEX` | `0` | Capture device index passed to OpenCV. |
| `LENSFORT_CONFIDENCE_THRESHOLD` | `0.5` | Minimum detection confidence (0–1) to count as a person. |
| `LENSFORT_COOLDOWN_FRAMES` | `50` | Frames without a person before a recording closes. |
| `LENSFORT_RETENTION_DAYS` | `0` | Delete recordings older than this many days (`0` keeps them forever). |
| `LENSFORT_LOG_LEVEL` | `INFO` | Backend log level: `DEBUG`, `INFO`, `WARNING` or `ERROR`. |
| `TWILIO_ACCOUNT_SID` | – | Twilio credentials for SMS notifications. |
| `TWILIO_AUTH_TOKEN` | – | |
| `TWILIO_SEND_NUMBER` | – | |
| `TWILIO_RECEIVE_NUMBER` | – | |

Numeric settings are validated at startup; an invalid value stops the backend with a clear error. Notifications are skipped unless all four Twilio variables are set.

### Frontend

Copy `frontend/.env.example` to `frontend/.env` to point the dashboard at a different backend:

| Variable | Default | Description |
|---|---|---|
| `REACT_APP_API_URL` | `http://127.0.0.1:5000` | Base URL of the backend API. |

## 8. Local Setup (Windows PowerShell)

### Prerequisites

- Python 3.11+
- Node.js and npm
- ffmpeg installed and available on PATH (used by `ffmpeg-python` for clip post-processing; without it, clips are saved unscaled)

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

### Running tests

```powershell
pip install -r requirements-dev.txt
cd backend
..\.venv\Scripts\python.exe -m pytest -q
```

Frontend build and lint check:

```powershell
cd frontend
$env:CI = "true"; npm run build
```

GitHub Actions runs both on every push to `main` and every pull request.

## 9. Development Notes and Guardrails

- The backend camera loop is stateful and thread-backed. Prefer small, targeted changes in `camera.py`.
- The file naming convention in `local_videos` is part of the API contract for log timestamps; it lives in `recordings.py`.
- Keep `local_videos` and cache/artifact folders out of git (already handled in `.gitignore`).
- Links to a recording use `/details?file=<filename>`; keep `RecordingsPage.jsx` and `Details.jsx` in sync if that changes.

## 10. Troubleshooting

### Camera not opening

- `POST /arm` returns `503` and the dashboard shows the error.
- Ensure no other app is holding the camera device.
- Set `LENSFORT_CAMERA_INDEX` if the camera isn't device `0`.
- Verify camera permissions in OS privacy settings.

### Frontend command fails from root with `npm start`

- This project frontend is nested; use:
  - `npm --prefix frontend start`

### No recordings shown

- If the page shows "Recordings unavailable", confirm the backend is running and click Retry.
- Confirm files exist under `backend/local_videos`.
- Check `GET /get-logs` response in browser/network tab.

### Requests blocked by CORS

- Add the dashboard's origin to `LENSFORT_CORS_ORIGINS` (for example when opening it from another machine).

### Download/Delete failing

- Confirm the Details page URL has a `file` parameter.
- Confirm backend route accessibility:
  - `/download-recording/<file>`
  - `/delete-recording/<file>`

## 11. Suggested Next Engineering Improvements

- Add frontend component/integration tests for recordings filters and actions.
- Expose detection settings through a settings API instead of only environment variables.
- Add request correlation IDs to the logs.
- Add Docker support for reproducible local setup.
- Upgrade off react-scripts 5 to clear the remaining build-tool audit warnings.
