import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import Sidebar from './Sidebar';
import ArmControl from './ArmControl';
import RecordingsPage from './RecordingsPage';
import Details from './Details';
import './index.css';

function App() {
  return (
    <Router>
      <div className="app-container animate-fade-in">
        <Sidebar />
        <main className="page-content">
          <Routes>
            <Route path="/" element={<ArmControl />} />
            <Route path="/recordings" element={<RecordingsPage />} />
            <Route path="/details" element={<Details />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}

export default App;