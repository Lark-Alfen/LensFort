import logging
import os
import ffmpeg
import threading

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

logger = logging.getLogger(__name__)

# Define a local directory where videos will be saved
LOCAL_DIRECTORY = os.path.join(BASE_DIR, 'local_videos')

# Ensure the directory exists
os.makedirs(LOCAL_DIRECTORY, exist_ok=True)

def save_locally(path_to_file):
    if not path_to_file or not os.path.exists(path_to_file):
        return None

    # Keep the temporary clip's name, which records when the detection started
    # (DD-MM-YY-HH-MM-SS.mp4), so the stored timestamp matches the event.
    local_filename = os.path.basename(path_to_file)
    local_path = os.path.join(LOCAL_DIRECTORY, local_filename)

    # Process the video (resize, etc.) before saving.
    output_path = os.path.splitext(local_path)[0] + "-out.mp4"
    try:
        ffmpeg.input(path_to_file).output(output_path, vf='scale=-1:720').overwrite_output().run(quiet=True)
        os.replace(output_path, local_path)
        os.remove(path_to_file)
    except (ffmpeg.Error, OSError) as exc:
        # Fall back to preserving the original clip if processing fails.
        # OSError covers a missing ffmpeg executable (FileNotFoundError).
        logger.warning("Video processing failed, keeping original clip: %s", exc)
        if os.path.exists(path_to_file):
            os.replace(path_to_file, local_path)
        if os.path.exists(output_path):
            os.remove(output_path)

    logger.info("Saved recording %s", local_filename)
    return local_path  # Return the path to the local video file

def handle_detection(path_to_file):
    if not path_to_file:
        return

    def action_thread(path_to_file):
        # Save the video locally
        local_video_path = save_locally(path_to_file)

        if not local_video_path:
            logger.warning("Clip %s no longer exists; nothing to save.", path_to_file)

    # Run the processing in a separate thread
    thread = threading.Thread(target=action_thread, args=(path_to_file,), daemon=True)
    thread.start()

def recover_pending_clips(temp_directory):
    """Finalize clips left in the temp directory by a previous run.

    Must only be called before the camera starts recording, otherwise an
    in-progress clip could be picked up.
    """
    if not os.path.isdir(temp_directory):
        return 0

    pending = [
        os.path.join(temp_directory, name)
        for name in os.listdir(temp_directory)
        if name.endswith('.mp4')
    ]
    for path in pending:
        logger.info("Recovering unfinished clip %s", os.path.basename(path))
        handle_detection(path)
    return len(pending)
