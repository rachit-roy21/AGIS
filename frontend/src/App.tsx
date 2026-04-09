import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './contexts/SessionContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import { Dashboard } from './pages/Dashboard';
import { Documents } from './pages/Documents';
import { Chat } from './pages/Chat';
import { Settings } from './pages/Settings';
import { Debate } from './pages/Debate';
import { TestSecurityVaultPage } from './pages/TestSecurityVaultPage';

function App() {
  return (
    <Router>
      <SecurityProvider>
        <SessionProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<Dashboard />} />
              <Route path="/documents" element={<Documents />} />
              <Route path="/chat" element={<Chat />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="/debate" element={<Debate />} />
              <Route path="/test" element={<TestSecurityVaultPage />} />
            </Routes>
          </AppShell>
        </SessionProvider>
      </SecurityProvider>
    </Router>
  );
}

export default App;
