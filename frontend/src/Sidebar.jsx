import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';
import { API_BASE } from './config';

const STATUS_POLL_MS = 10000;

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);
  // online: null until the first check completes.
  const [backend, setBackend] = useState({ online: null, armed: false });

  useEffect(() => {
    let cancelled = false;

    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/camera-status`);
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        if (!cancelled) setBackend({ online: true, armed: Boolean(data.active) });
      } catch {
        if (!cancelled) setBackend({ online: false, armed: false });
      }
    };

    checkStatus();
    const interval = setInterval(checkStatus, STATUS_POLL_MS);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  const statusLabel =
    backend.online === null
      ? 'Connecting...'
      : backend.online
        ? `Online · ${backend.armed ? 'Armed' : 'Standby'}`
        : 'Backend Offline';
  const dotState = backend.online === null ? 'pending' : backend.online ? '' : 'offline';

  return (
    <nav className={`sidebar ${collapsed ? 'collapsed' : ''}`}>
      <div className="sidebar-header">
        <h1 className="logo">LensFort</h1>
        <button 
          className="toggle-btn" 
          onClick={() => setCollapsed(!collapsed)}
          aria-label={collapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <span className="toggle-glyph" aria-hidden="true">{collapsed ? '>' : '<'}</span>
        </button>
      </div>
      
      <div className="menu-items">
        <Link to="/" className={`menu-item ${location.pathname === '/' ? 'active' : ''}`}>
          <span className="icon icon-lock" aria-hidden="true"></span>
          <span className="label">Security Control</span>
        </Link>
        <Link to="/recordings" className={`menu-item ${location.pathname === '/recordings' ? 'active' : ''}`}>
          <span className="icon icon-recordings" aria-hidden="true"></span>
          <span className="label">Recordings</span>
        </Link>
      </div>
      
      <div className="sidebar-footer">
        <p>© {new Date().getFullYear()} LensFort</p>
        <div className="system-status" role="status" title={statusLabel}>
          <span className={`status-dot ${dotState}`} aria-hidden="true"></span>
          <span>{statusLabel}</span>
        </div>
      </div>
    </nav>
  );
}