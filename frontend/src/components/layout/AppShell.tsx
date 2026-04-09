import { ReactNode } from 'react';
import { Header } from './Header';
import { Navigation } from './Navigation';
import { useSession } from '../../contexts/SessionContext';
import { useSecurity } from '../../contexts/SecurityContext';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSessionValid } = useSession();
  const { isSecure } = useSecurity();

  const isAppHealthy = isSecure && isSessionValid();

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <Header />

      {/* Navigation */}
      <Navigation />

      {/* Security Warning Banner */}
      {!isSecure && (
        <div className="bg-red-50 border-l-4 border-red-400 p-4">
          <div className="flex">
            <div className="flex-shrink-0">
              <span className="text-red-400">⚠️</span>
            </div>
            <div className="ml-3">
              <p className="text-sm text-red-700">
                Security issues detected. Please check your session and contact support if needed.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Main Content */}
      <main className="max-w-7xl mx-auto py-6 sm:px-6 lg:px-8">
        <div className="px-4 py-6 sm:px-0">
          {children}
        </div>
      </main>

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-auto">
        <div className="max-w-7xl mx-auto py-4 px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center text-sm text-gray-500">
            <div>
              © 2024 VaultSim - Privacy-First Tokenization Platform
            </div>
            <div className="flex space-x-4">
              <span>Status: {isAppHealthy ? '✅ Operational' : '⚠️ Issues Detected'}</span>
              <span>Environment: Production</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}