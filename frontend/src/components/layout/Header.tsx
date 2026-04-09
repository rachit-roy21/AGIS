import { useSession } from '../../contexts/SessionContext';
import { useVault } from '../../hooks/useVault';
import { useSecurity } from '../../contexts/SecurityContext';

export function Header() {
  const { session, clearSession, isSessionValid } = useSession();
  const { ready: vaultReady } = useVault();
  const { isSecure, getEvents } = useSecurity();

  const securityEvents = getEvents('security_violation');

  const handleLogout = async () => {
    await clearSession();
  };

  const getVaultStatus = () => {
    if (!session.isActive) return { text: 'No Session', color: 'text-gray-600' };
    if (!isSessionValid()) return { text: 'Session Expired', color: 'text-orange-600' };
    if (!vaultReady) return { text: 'Vault Initializing', color: 'text-amber-600' };
    return { text: 'Secure', color: 'text-green-600' };
  };

  const getSecurityStatus = () => {
    if (!isSecure) return { text: '⚠️ Security Risk', color: 'text-red-600' };
    if (securityEvents.length > 0) return { text: '⚠️ Events', color: 'text-orange-600' };
    return { text: '✓ Secure', color: 'text-green-600' };
  };

  const vaultStatus = getVaultStatus();
  const securityStatus = getSecurityStatus();

  return (
    <header className="bg-white border-b border-gray-200 shadow-sm">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex justify-between items-center h-16">
          {/* Logo and Title */}
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <h1 className="text-xl font-bold text-gray-900">VaultSim</h1>
            </div>
            <div className="ml-4 hidden md:block">
              <p className="text-sm text-gray-500">Privacy-First Tokenization Platform</p>
            </div>
          </div>

          {/* Status Indicators */}
          <div className="flex items-center space-x-6">
            {/* Vault Status */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-500">Vault</span>
              <span className={`text-sm font-medium ${vaultStatus.color}`}>
                {vaultStatus.text}
              </span>
            </div>

            {/* Security Status */}
            <div className="flex flex-col items-center">
              <span className="text-xs text-gray-500">Security</span>
              <span className={`text-sm font-medium ${securityStatus.color}`}>
                {securityStatus.text}
              </span>
            </div>

            {/* Session Info */}
            {session.isActive && (
              <div className="flex flex-col items-center">
                <span className="text-xs text-gray-500">Session</span>
                <span className="text-sm font-medium text-gray-700">
                  {session.id?.substring(0, 8)}...
                </span>
              </div>
            )}

            {/* Logout Button */}
            {session.isActive && (
              <button
                onClick={handleLogout}
                className="px-3 py-2 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded-md hover:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-indigo-500"
              >
                Logout
              </button>
            )}
          </div>
        </div>
      </div>
    </header>
  );
}