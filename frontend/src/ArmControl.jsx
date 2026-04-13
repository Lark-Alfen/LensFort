import { useState, useEffect } from 'react';
import './ArmControl.css';

const API_BASE = "http://127.0.0.1:5000";

export default function ArmControl({ status, toggleStatus }) {
  const [isProcessing, setIsProcessing] = useState(false);
  const [systemStatus, setSystemStatus] = useState(status);
  const [lastActivated, setLastActivated] = useState(null);
  const [statusMessage, setStatusMessage] = useState('');
  const [animateStatus, setAnimateStatus] = useState(false);
  const [recordingsCount, setRecordingsCount] = useState(0);
  const [lastMotionTime, setLastMotionTime] = useState(null);
  const [cameraStatus, setCameraStatus] = useState('Checking...');
  
  useEffect(() => {
    // Check initial system status and fetch all system data
    const checkStatus = async () => {
      try {
        const response = await fetch(`${API_BASE}/get-armed`);
        if (response.ok) {
          const data = await response.json();
          setSystemStatus(data.armed);
          
          // If the system is armed, camera is active
          setCameraStatus(data.armed ? 'Active' : 'Standby');
        }
      } catch (error) {
        setStatusMessage('Cannot connect to security system');
        setCameraStatus('Offline');
      }
    };
    
    // Get recordings count from localStorage (set by RecordingsPage)
    const storedCount = localStorage.getItem('recordingsCount');
    if (storedCount) {
      setRecordingsCount(storedCount);
    }
    
    // Check for most recent recording to determine last motion
    const fetchLogs = async () => {
      try {
        const response = await fetch(`${API_BASE}/get-logs`);
        if (response.ok) {
          const data = await response.json();
          if (data.logs && data.logs.length > 0) {
            // Sort logs by date (newest first)
            const sortedLogs = data.logs.sort((a, b) => 
              new Date(b.date) - new Date(a.date)
            );
            
            // Set last motion time from most recent recording
            if (sortedLogs[0] && sortedLogs[0].date) {
              setLastMotionTime(new Date(sortedLogs[0].date).toLocaleString());
              
              // Update recordings count
              setRecordingsCount(data.logs.length);
              localStorage.setItem('recordingsCount', data.logs.length);
            }
          }
        }
      } catch (error) {
        console.error('Failed to fetch logs:', error);
      }
    };
    
    checkStatus();
    fetchLogs();
    
    // Set up interval to check status every 10 seconds
    const statusInterval = setInterval(checkStatus, 10000);
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

      if (!response.ok) throw new Error('Failed to update system status');
      
      // Success message and animation
      setStatusMessage(systemStatus ? 'System disarmed successfully' : 'System armed and monitoring');
        // Verify actual armed status
      const armedResponse = await fetch(API_BASE + '/get-armed');
      const armedData = await armedResponse.json();
      setSystemStatus(armedData.armed);
      // Update camera status based on armed status
      setCameraStatus(armedData.armed ? 'Active' : 'Standby');
      setLastActivated(new Date().toLocaleTimeString());
      toggleStatus();

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
        <div className="system-time">{new Date().toLocaleString()}</div>
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