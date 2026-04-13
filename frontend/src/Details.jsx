import ReactPlayer from 'react-player';
import { useState } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import './Details.css';

const API_BASE = "http://127.0.0.1:5000";

function Details() {
  const navigate = useNavigate();
  const location = useLocation();
  const { state } = location;
  
  // Fallback to empty values if state is missing
  const url = state?.url || '';
  const date = state?.date || 'Unknown timestamp';
  
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [volume, setVolume] = useState(0.5);
  const [isDownloading, setIsDownloading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [actionError, setActionError] = useState('');

  const getFilenameFromUrl = (videoUrl) => {
    if (!videoUrl) {
      return '';
    }

    try {
      const parsed = new URL(videoUrl);
      return parsed.pathname.split('/').pop() || '';
    } catch {
      return (videoUrl.split('/').pop() || '').split('?')[0];
    }
  };

  const recordingFilename = getFilenameFromUrl(url);
  
  const formatTime = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
  };
  
  const handleProgress = (state) => {
    setProgress(state.playedSeconds);
  };

  const formatDate = (dateString) => {
    try {
      const date = new Date(dateString);
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
    try {
      const response = await fetch(
        `${API_BASE}/download-recording/${encodeURIComponent(recordingFilename)}`
      );
      if (!response.ok) {
        throw new Error('Download failed.');
      }

      const blob = await response.blob();
      const blobUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = recordingFilename;
      document.body.appendChild(link);
      link.click();
      link.remove();
      window.URL.revokeObjectURL(blobUrl);
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
                className="media-control-button"
                onClick={() => setPlaying(!playing)}
              >
                <span className={`media-icon ${playing ? 'pause' : 'play'}`} aria-hidden="true"></span>
              </button>
              
              <div className="progress-container">
                <div 
                  className="progress-bar" 
                  style={{width: `${(progress / duration) * 100}%`}}
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