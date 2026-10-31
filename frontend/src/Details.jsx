import ReactPlayer from 'react-player';
import { useEffect, useState } from 'react';
import { useNavigate, useLocation, useSearchParams } from 'react-router-dom';
import './Details.css';
import { API_BASE } from './config';


function Details() {
  const navigate = useNavigate();
  const location = useLocation();
  const [searchParams] = useSearchParams();

  // The recording is identified in the URL (?file=...), so the page works on
  // refresh and from shared links. The date may come from router state.
  const recordingFilename = searchParams.get('file') || '';
  const url = recordingFilename
    ? `${API_BASE}/local_videos/${encodeURIComponent(recordingFilename)}`
    : '';
  const [date, setDate] = useState(location.state?.date || null);

  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  // Opened directly (refresh or link): look up the recording's date.
  useEffect(() => {
    if (date || !recordingFilename) return undefined;

    let cancelled = false;
    const loadDate = async () => {
      try {
        const response = await fetch(`${API_BASE}/get-logs`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        const match = (data.logs || []).find((log) => log.filename === recordingFilename);
        if (!cancelled) setDate(match?.date || 'Unknown');
      } catch (error) {
        console.error('Failed to load recording date:', error);
        if (!cancelled) setDate('Unknown');
      }
    };

    loadDate();
    return () => {
      cancelled = true;
    };
  }, [date, recordingFilename]);

  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const handleProgress = (state) => {
    setProgress(state.playedSeconds);
  };

  // Duration is 0 until metadata loads; avoid a NaN width.
  const progressPercent = duration > 0 ? Math.min(100, (progress / duration) * 100) : 0;

  const formatDate = (dateString) => {
    if (!dateString) {
      return 'Loading...';
    }

    try {
      const date = new Date(dateString);
      if (Number.isNaN(date.getTime())) {
        return 'Unknown Date';
      }
      return date.toLocaleString(undefined, {
        weekday: 'long',
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        hour: '2-digit',
        minute: '2-digit',
        second: '2-digit'
      });
    } catch {
      return 'Unknown Date';
    }
  };

  const handleDownload = async () => {
    if (!recordingFilename) {
      const msg = 'No recording file available to download.';
      setActionError(msg);
      alert(msg);
      return;
    }

    setActionError('');
    setIsDownloading(true);
    const downloadUrl = `${API_BASE}/download-recording/${encodeURIComponent(recordingFilename)}`;
    try {
      // Check the file is there first; a failed link click would navigate
      // to the backend's JSON error instead of showing it here.
      const response = await fetch(downloadUrl, { method: 'HEAD' });
      if (!response.ok) {
        throw new Error(
          response.status === 404 ? 'Recording no longer exists.' : 'Download failed.'
        );
      }

      // The backend sends Content-Disposition: attachment, so the browser
      // streams the file to disk with its own download progress instead of
      // buffering the whole video in memory.
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = recordingFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
    } catch (error) {
      console.error('Download recording error:', error);
      const msg = error.message || 'Download failed.';
      setActionError(msg);
      alert(msg);
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    if (!recordingFilename) {
      const msg = 'No recording file available to delete.';
      setActionError(msg);
      alert(msg);
      return;
    }

    if (!window.confirm(`Delete recording "${recordingFilename}"?`)) {
      return;
    }

    setActionError('');
    setIsDeleting(true);
    try {
      const response = await fetch(
        `${API_BASE}/delete-recording/${encodeURIComponent(recordingFilename)}`,
        { method: 'DELETE' }
      );

      const payload = await response.json().catch(() => ({}));
      if (!response.ok) {
        throw new Error(payload.error || 'Delete failed.');
      }

      navigate('/recordings');
    } catch (error) {
      console.error('Delete recording error:', error);
      const msg = error.message || 'Delete failed.';
      setActionError(msg);
      alert(msg);
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className="video-details-page">
      <div className="details-header">
        <button 
          onClick={() => navigate('/recordings')} 
          className="back-button"
        >
          <span className="back-icon">←</span>
          Back to Recordings
        </button>
        
        <h2 className="details-title">Recording Details</h2>
      </div>
      
      <div className="video-details-container">
        <div className="video-player-card">
          <div className="player-container">
            {url ? (
              <ReactPlayer 
                url={url}
                playing={playing}
                controls={true}
                width="100%"
                height="100%"
                volume={volume}
                onProgress={handleProgress}
                onDuration={setDuration}
                // Keep the custom button in sync when the native controls are
                // used or the clip finishes.
                onPlay={() => setPlaying(true)}
                onPause={() => setPlaying(false)}
                onEnded={() => setPlaying(false)}
                config={{
                  file: {
                    attributes: {
                      crossOrigin: 'anonymous'
                    }
                  }
                }}
              />
            ) : (
              <div className="player-error">
                <div className="error-icon">!</div>
                <p>Video not available</p>
              </div>
            )}
          </div>
          
          <div className="custom-controls">
            <div className="play-controls">
              <button
                type="button"
                className="media-control-button"
                onClick={() => setPlaying(!playing)}
                disabled={!url}
                aria-label={playing ? 'Pause' : 'Play'}
              >
                <span className={`media-icon ${playing ? 'pause' : 'play'}`} aria-hidden="true"></span>
              </button>
              
              <div className="progress-container">
                <div 
                  className="progress-bar" 
                  style={{width: `${progressPercent}%`}}
                ></div>
              </div>
              
              <div className="time-display">
                {formatTime(progress)} / {formatTime(duration)}
              </div>
            </div>
            
            <div className="volume-controls">
              <span className="volume-icon-shape" aria-hidden="true"></span>
              <input 
                type="range" 
                min="0" 
                max="1" 
                step="0.1" 
                value={volume}
                onChange={(e) => setVolume(parseFloat(e.target.value))}
                className="volume-slider"
                aria-label="Volume"
              />
            </div>
          </div>
        </div>
        
        <div className="details-sidebar">
          <div className="details-card">
            <h3>Recording Information</h3>
            
            <div className="detail-item">
              <span className="detail-label">Recorded on:</span>
              <span className="detail-value">{formatDate(date)}</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Detection Type:</span>
              <span className="detail-value">Person Motion</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Camera:</span>
              <span className="detail-value">Main Security Camera</span>
            </div>
            
            <div className="detail-item">
              <span className="detail-label">Video File:</span>
              <span className="detail-value file-name">{recordingFilename || 'Unavailable'}</span>
            </div>
          </div>
          
          <div className="action-buttons">
            <button
              className="action-button download-button"
              onClick={handleDownload}
              disabled={isDownloading || !recordingFilename}
            >
              {isDownloading ? 'Downloading...' : 'Download Recording'}
            </button>
            <button
              className="action-button delete-button"
              onClick={handleDelete}
              disabled={isDeleting || !recordingFilename}
            >
              {isDeleting ? 'Deleting...' : 'Delete Recording'}
            </button>
            {actionError && <p className="action-error">{actionError}</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

export default Details;