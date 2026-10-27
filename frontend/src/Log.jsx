import { useEffect, useState } from "react";
import "./Log.css";

export default function Log({ onClick, url, date }) {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    if (!url) return undefined;

    let cancelled = false;
    const video = document.createElement('video');
    // Only fetch metadata up front; seeking then loads just the frame we need.
    video.preload = 'metadata';
    video.crossOrigin = 'anonymous';
    video.muted = true;

    const onLoadedMetadata = () => {
      if (cancelled) return;
      // Get a frame a bit into the video, but stay inside short clips.
      // Seeking is asynchronous, so the frame is captured in 'seeked'.
      video.currentTime = Math.min(1, (video.duration || 0) / 2);
    };

    const onSeeked = () => {
      if (cancelled) return;
      try {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(video, 0, 0);
        setThumbnail(canvas.toDataURL());
      } catch (error) {
        console.error("Preview generation failed:", error);
      }
      setLoading(false);
    };

    const onError = () => {
      if (!cancelled) setLoading(false);
    };

    video.addEventListener('loadedmetadata', onLoadedMetadata);
    video.addEventListener('seeked', onSeeked, { once: true });
    video.addEventListener('error', onError);
    video.src = url;

    return () => {
      cancelled = true;
      video.removeEventListener('loadedmetadata', onLoadedMetadata);
      video.removeEventListener('seeked', onSeeked);
      video.removeEventListener('error', onError);
      // Clearing the source aborts any in-flight download and frees the decoder.
      video.removeAttribute('src');
      video.load();
    };
  }, [url]);

  const formatDate = (isoString) => {
    try {
      const date = new Date(isoString);
      return {
        time: date.toLocaleTimeString('en-US', {
          hour: '2-digit', 
          minute: '2-digit'
        }),
        date: date.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric',
          year: 'numeric'
        })
      };
    } catch {
      return { time: "Unknown", date: "Unknown" };
    }
  };

  const formattedDate = formatDate(date);
  return (
    <div 
      className="recording-card"
      onClick={() => onClick && onClick(url, date)}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
    >
      <div className="thumbnail-container">
        {loading ? (
          <div className="thumbnail-loading">
            <div className="loader-pulse"></div>
          </div>
        ) : thumbnail ? (
          <img 
            src={thumbnail} 
            alt="Video preview" 
            className="thumbnail-image"
          />
        ) : (
          <div className="thumbnail-fallback">
            <span className="fallback-icon" aria-hidden="true"></span>
          </div>
        )}
        
        <div className={`thumbnail-overlay ${hovered ? 'visible' : ''}`}>
          <div className="play-button">
            <span className="play-icon" aria-hidden="true"></span>
          </div>
        </div>
        
        <div className="recording-time">
          <span className="time-badge">{formattedDate.time}</span>
        </div>
      </div>
      
      <div className="recording-info">
        <div className="recording-title">Motion Detected</div>
        <div className="recording-date">{formattedDate.date}</div>
      </div>
    </div>  );
}