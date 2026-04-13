import { useEffect, useState } from "react";
import "./Log.css";

export default function Log({ onClick, url, date }) {
  const [thumbnail, setThumbnail] = useState(null);
  const [loading, setLoading] = useState(true);
  const [hovered, setHovered] = useState(false);

  useEffect(() => {
    const generatePreview = async () => {
      try {
        if (!url) return;
        
        const video = document.createElement('video');
        video.src = url;
        video.crossOrigin = 'anonymous';
        video.muted = true;
        
        video.addEventListener('loadeddata', () => {
          video.currentTime = 1; // Get frame a bit into the video
          const canvas = document.createElement('canvas');
          canvas.width = video.videoWidth;
          canvas.height = video.videoHeight;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(video, 0, 0);
          setThumbnail(canvas.toDataURL());
          setLoading(false);
        });
        
        // Handle error
        video.addEventListener('error', () => {
          setLoading(false);
        });
        
      } catch (error) {
        console.error("Preview generation failed:", error);
        setLoading(false);
      }
    };

    generatePreview();
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