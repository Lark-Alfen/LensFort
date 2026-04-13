import os
import ffmpeg
import threading
from datetime import datetime

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

# Define a local directory where videos will be saved
LOCAL_DIRECTORY = os.path.join(BASE_DIR, 'local_videos')

# Ensure the directory exists
os.makedirs(LOCAL_DIRECTORY, exist_ok=True)

def save_locally(path_to_file):
    if not path_to_file or not os.path.exists(path_to_file):
        return None

    # Generate a local file name based on the current date and time
    now = datetime.now()
    formatted_now = now.strftime("%d-%m-%y-%H-%M-%S")  # to avoid overwriting
    local_filename = f"{formatted_now}.mp4"
    local_path = os.path.join(LOCAL_DIRECTORY, local_filename)
    
    # Process the video (resize, etc.) before saving.
    output_path = local_path.split(".mp4")[0] + "-out.mp4"
    try:
        ffmpeg.input(path_to_file).output(output_path, vf='scale=-1:720').overwrite_output().run(quiet=True)
        os.replace(output_path, local_path)
        os.remove(path_to_file)
    except ffmpeg.Error:
        # Fall back to preserving the original clip if processing fails.
        if os.path.exists(path_to_file):
            os.replace(path_to_file, local_path)
        if os.path.exists(output_path):
            os.remove(output_path)

    print(f"A new video was saved locally as {local_filename}")
    return local_path  # Return the path to the local video file

def handle_detection(path_to_file):
    if not path_to_file:
        return

    def action_thread(path_to_file):
        # Save the video locally
        local_video_path = save_locally(path_to_file)

        # You can call your local processing or notification functions here
        # For now, let's print the path to the saved video
        if local_video_path:
            print(f"Video saved locally: {local_video_path}")

    # Run the processing in a separate thread
    thread = threading.Thread(target=action_thread, args=(path_to_file,), daemon=True)
    thread.start()

# Function to list videos within a specific date range
def list_videos_in_date_range(start_date, end_date):
    videos = []
    # Make sure the directory exists
    if os.path.exists(LOCAL_DIRECTORY):
        for filename in os.listdir(LOCAL_DIRECTORY):
            if filename.endswith('.mp4'):
                try:
                    # Parse the filename into a datetime object
                    video_time = datetime.strptime(filename.split('.')[0], "%d-%m-%y-%H-%M-%S")
                    
                    # Check if the video is within the date range
                    if start_date <= video_time <= end_date:
                        videos.append({"filename": filename, "url": f"/local_videos/{filename}"})
                except ValueError:
                    # If the filename is not in the expected format, skip it
                    continue

    videos.sort(key=lambda item: item["filename"], reverse=True)
    return videos
