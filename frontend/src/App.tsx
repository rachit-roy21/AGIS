import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import { SessionProvider } from './contexts/SessionContext';
import { SecurityProvider } from './contexts/SecurityContext';
import { AppShell } from './components/layout/AppShell';

// Pages
import { TestSecurityVaultPage } from './pages/TestSecurityVaultPage';

function App() {
  return (
    <Router>
      <SecurityProvider>
        <SessionProvider>
          <AppShell>
            <Routes>
              <Route path="/" element={<TestSecurityVaultPage />} />
            </Routes>
          </AppShell>
        </SessionProvider>
      </SecurityProvider>
    </Router>
  );
}

export default App;
