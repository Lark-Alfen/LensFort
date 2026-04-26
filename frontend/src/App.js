import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import ArmControl from './ArmControl';
import RecordingsPage from './RecordingsPage';
import Details from './Details';
import './index.css';

function App() {
  const [systemStatus, setSystemStatus] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading of resources
    const timer = setTimeout(() => {
      setLoading(false);
    }, 1000);
    
    return () => clearTimeout(timer);
  }, []);  if (loading) {
    return (
      <div className="loading-screen">
        <div className="loading-container">
          <div className="loading-logo">LensFort</div>
          <div className="loading-spinner"></div>
          <p>Initializing Security System...</p>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="app-container animate-fade-in">
        <Sidebar />
        <main className="page-content">
          <Routes>
            <Route path="/" element={
              <ArmControl 
                status={systemStatus} 
                toggleStatus={() => setSystemStatus(!systemStatus)}
              />
            } />
            <Route path="/recordings" element={<RecordingsPage />} />
            <Route path="/details" element={<Details />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;