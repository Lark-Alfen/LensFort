import { useState, useEffect } from 'react';
import './ArmControl.css';
import { API_BASE } from './config';

const CONNECTION_ERROR = 'Cannot connect to security system';

export default function ArmControl() {
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemStatus, setSystemStatus] = useState(false);
  const [lastActivated, setLastActivated] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [animateStatus, setAnimateStatus] = useState(false);
  const [recordingsCount, setRecordingsCount] = useState(0);
  const [lastMotionTime, setLastMotionTime] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('Checking...');
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const clock = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(clock);
  }, []);
  
  useEffect(() => {
    // Check initial system status and fetch all system data
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/get-armed`);
        if (response.ok) {
          const data = await response.json();
          setSystemStatus(data.armed);
          setStatusMessage((message) =>
            message === CONNECTION_ERROR ? '' : message
          );

          // If the system is armed, camera is active
          setCameraStatus(data.armed ? 'Active' : 'Standby');
        }
      } catch (error) {
        setStatusMessage(CONNECTION_ERROR);
        setCameraStatus('Offline');
      }
    };
    
    // Recordings count and last motion are derived from the backend on every
    // poll, so they stay correct after new detections or deletions.
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/get-logs`);
        if (!response.ok) return;

        const data = await response.json();
        const logs = data.logs || [];
        setRecordingsCount(logs.length);

        // The backend returns newest first; skip entries with unknown dates.
        const latest = logs.find((log) => !Number.isNaN(new Date(log.date).getTime()));
        setLastMotionTime(latest ? new Date(latest.date).toLocaleString() : null);
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };

    const refresh = () => {
      checkStatus();
      fetchLogs();
    };

    refresh();

    // Poll status and recordings every 10 seconds
    const statusInterval = setInterval(refresh, 10000);
    return () => clearInterval(statusInterval);
  }, []);

  const handleArmToggle = async () => {
    try {
      setIsProcessing(true);
      setAnimateStatus(true);
      
      // Make API call to arm/disarm
      const endpoint = systemStatus ? '/disarm' : '/arm';
      const response = await fetch(API_BASE + endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) {
        const payload = await response.json().catch(() => ({}));
        throw new Error(payload.error || 'Failed to update system status');
      }
      
      // Success message and animation
      setStatusMessage(systemStatus ? 'System disarmed successfully' : 'System armed and monitoring');
        // Verify actual armed status
      const armedResponse = await fetch(API_BASE + '/get-armed');
      const armedData = await armedResponse.json();
      setSystemStatus(armedData.armed);
      // Update camera status based on armed status
      setCameraStatus(armedData.armed ? 'Active' : 'Standby');
      setLastActivated(new Date().toLocaleTimeString());

    } catch (error) {
      console.error('SECURITY PROTOCOL FAILURE:', error);
      setStatusMessage(`Error: ${error.message}`);
      setSystemStatus(prev => prev); // Keep current state
    } finally {
      setIsProcessing(false);
      setTimeout(() => setAnimateStatus(false), 1000);
    }
  };
  return (
    <div className="security-dashboard">
      <div className="dashboard-header">
        <h1>Security Control Center</h1>
        <div className="system-time">{now.toLocaleString()}</div>
      </div>
      
      <div className="control-panels">
        <div className="main-panel">
          <div className={`status-display ${systemStatus ? 'armed' : 'disarmed'} ${animateStatus ? 'animate' : ''}`}>
            <div className="status-ring"></div>
            <div className="status-icon"></div>
            <h2 className="status-text">{systemStatus ? 'ARMED' : 'DISARMED'}</h2>
            {lastActivated && (
              <div className="last-activated">
                Last status change: {lastActivated}
              </div>
            )}
          </div>
            <button 
            className={`control-button ${systemStatus ? 'armed' : 'disarmed'}`}
            onClick={handleArmToggle}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <span className="button-icon loading"></span>
                <span>Processing...</span>
              </>
            ) : (
              <>                <span className="button-icon"></span>
                <span>{systemStatus ? 'Disarm System' : 'Arm System'}</span>
              </>
            )}
          </button>
          
          {statusMessage && (
            <div className="status-message animate-fade-in">
              {statusMessage}
            </div>
          )}
        </div>
          <div className="side-panel">            <div className="security-stats">
            <h3>System Statistics</h3>
            <div className="stat-item">
              <span className="stat-label">Camera Status:</span>
              <span className={`stat-value ${cameraStatus === 'Active' ? 'online' : cameraStatus === 'Offline' ? 'offline' : ''}`}>
                {cameraStatus}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Recordings:</span>
              <span className="stat-value">
                {recordingsCount > 0 ? recordingsCount : 'No recordings'}
              </span>
            </div>
            <div className="stat-item">
              <span className="stat-label">Last Motion:</span>
              <span className="stat-value">
                {lastMotionTime || 'None detected'}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>  );
}