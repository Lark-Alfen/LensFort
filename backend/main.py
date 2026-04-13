from camera import Camera
from notifications import send_notification
from flask_cors import CORS
from flask import Flask, jsonify, request, send_from_directory
import os
import mimetypes
from datetime import datetime, timedelta

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
VIDEO_DIR = os.path.join(BASE_DIR, 'local_videos')

os.makedirs(VIDEO_DIR, exist_ok=True)


def _parse_video_datetime(filename):
    dt_str = filename.split('.')[0]
    return datetime.strptime(dt_str, "%d-%m-%y-%H-%M-%S")


def _parse_iso_datetime(value, is_end=False):
    parsed = datetime.fromisoformat(value)
    # Date-only end values are treated as exclusive next day.
    if is_end and len(value) <= 10:
        return parsed + timedelta(days=1)
    return parsed


def _sanitize_video_filename(filename):
    safe_name = os.path.basename(filename)
    if not safe_name or safe_name != filename:
        return None
    return safe_name

app = Flask(__name__)
CORS(app)

camera = Camera()

# Define a route for the root URL
@app.route('/')
def index():
    return "Welcome to the Python Security System!"

@app.route('/arm', methods=['POST'])
def arm():
    camera.arm()
    return jsonify(message="System armed."), 200

@app.route('/disarm', methods=['POST'])
def disarm():
    camera.disarm()
    return jsonify(message="System disarmed."), 200

@app.route('/get-armed', methods=['GET'])
def get_armed():
    return jsonify(armed=camera.armed), 200

@app.route('/camera-status', methods=['GET'])
def camera_status():
    """Get the current camera status"""
    return jsonify({
        "active": camera.armed,
        "status": "Active" if camera.armed else "Standby"
    }), 200

@app.route('/motion_detected', methods=['POST'])
def motion_detected():
    data = request.get_json() or {}

    if 'url' in data and data['url']:
        print("URL: ", data['url'])
        send_notification(data["url"])
    else:
        print("'url' not in incoming data")

    return jsonify({}), 201


@app.route("/get-logs")
def get_logs():
    start_date = request.args.get("startDate")
    end_date = request.args.get("endDate")
    days = request.args.get("days")

    start_dt = None
    end_dt = None

    # Support relative day query used by older UI variants.
    if days and not start_date and not end_date:
        try:
            day_offset = int(days)
            target_date = datetime.now().date() - timedelta(days=day_offset)
            start_dt = datetime.combine(target_date, datetime.min.time())
            end_dt = start_dt + timedelta(days=1)
        except ValueError:
            pass

    if start_date:
        try:
            start_dt = _parse_iso_datetime(start_date)
        except ValueError:
            return jsonify({"error": "Invalid startDate format"}), 400

    if end_date:
        try:
            end_dt = _parse_iso_datetime(end_date, is_end=True)
        except ValueError:
            return jsonify({"error": "Invalid endDate format"}), 400

    logs = []

    for filename in os.listdir(VIDEO_DIR):
        if filename.endswith('.mp4'):
            try:
                # Parse filename format: 02-05-25-16-05-07 -> DD-MM-YY-HH-MM-SS
                dt = _parse_video_datetime(filename)

                if start_dt and dt < start_dt:
                    continue
                if end_dt and dt >= end_dt:
                    continue

                date = dt.isoformat()
            except ValueError:
                if start_dt or end_dt:
                    continue
                date = "Unknown"

            logs.append({
                "url": f"/local_videos/{filename}",
                "date": date
            })

    logs.sort(
        key=lambda item: (item["date"] != "Unknown", item["date"]),
        reverse=True,
    )

    return jsonify({"logs": logs}), 200


# Serve video files from backend/local_videos directory
@app.route('/local_videos/<filename>')
def get_video(filename):
    file_path = os.path.join(VIDEO_DIR, filename)
    if not os.path.exists(file_path):
        return jsonify(error="File not found"), 404
    return send_from_directory(VIDEO_DIR, filename, mimetype='video/mp4')


@app.route('/download-recording/<path:filename>', methods=['GET'])
def download_recording(filename):
    safe_name = _sanitize_video_filename(filename)
    if not safe_name:
        return jsonify(error="Invalid filename"), 400

    file_path = os.path.join(VIDEO_DIR, safe_name)
    if not os.path.exists(file_path):
        return jsonify(error="File not found"), 404

    return send_from_directory(
        VIDEO_DIR,
        safe_name,
        mimetype='video/mp4',
        as_attachment=True,
        download_name=safe_name,
    )


@app.route('/delete-recording/<path:filename>', methods=['DELETE'])
def delete_recording(filename):
    safe_name = _sanitize_video_filename(filename)
    if not safe_name:
        return jsonify(error="Invalid filename"), 400

    file_path = os.path.join(VIDEO_DIR, safe_name)
    if not os.path.exists(file_path):
        return jsonify(error="File not found"), 404

    try:
        os.remove(file_path)
    except OSError as exc:
        return jsonify(error="Failed to delete file", details=str(exc)), 500

    return jsonify(message="Recording deleted", filename=safe_name), 200

if __name__ == "__main__":
    app.run(host='0.0.0.0', port=5000)
