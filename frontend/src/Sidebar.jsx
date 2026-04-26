import { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import './Sidebar.css';

export default function Sidebar() {
  const location = useLocation();
  const [collapsed, setCollapsed] = useState(false);

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
        <p>© 2025 LensFort</p>
        <div className="system-status">
          <span className="status-dot"></span>
          <span>System Online</span>
        </div>
      </div>
    </nav>
  );
}