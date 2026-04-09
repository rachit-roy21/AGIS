import { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useVault } from '../hooks/useVault';
import { useSecurity } from '../contexts/SecurityContext';

export function Settings() {
  const { session, clearSession } = useSession();
  const { vault, ready: vaultReady, getStats } = useVault();
  const { events, clearEvents, isSecure } = useSecurity();
  
  const [vaultStats, setVaultStats] = useState<any>(null);
  const [showConfirmation, setShowConfirmation] = useState(false);
  const [actionType, setActionType] = useState<'wipe' | 'logout' | 'clearEvents' | null>(null);

  useEffect(() => {
    const loadStats = async () => {
      if (vaultReady && vault) {
        try {
          const stats = await getStats();
          setVaultStats(stats);
        } catch (error) {
          console.error('Failed to load vault stats:', error);
        }
      }
    };

    loadStats();
  }, [vaultReady, vault, getStats]);

  const handleAction = (type: 'wipe' | 'logout' | 'clearEvents') => {
    setActionType(type);
    setShowConfirmation(true);
  };

  const confirmAction = async () => {
    if (!actionType) return;

    try {
      switch (actionType) {
        case 'wipe':
          if (vaultReady && vault) {
            await vault.wipe();
          }
          break;
        case 'logout':
          await clearSession();
          break;
        case 'clearEvents':
          clearEvents();
          break;
      }
    } catch (error) {
      console.error('Action failed:', error);
    } finally {
      setShowConfirmation(false);
      setActionType(null);
    }
  };

  const getActionDescription = () => {
    switch (actionType) {
      case 'wipe':
        return 'This will permanently delete all tokens and encryption keys from your vault. This action cannot be undone.';
      case 'logout':
        return 'This will end your current session and clear temporary data from memory.';
      case 'clearEvents':
        return 'This will clear all security events from the log.';
      default:
        return '';
    }
  };

  const getConfirmationButtonText = () => {
    switch (actionType) {
      case 'wipe':
        return 'Wipe Vault';
      case 'logout':
        return 'Logout';
      case 'clearEvents':
        return 'Clear Events';
      default:
        return 'Confirm';
    }
  };

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Settings</h1>
        <p className="mt-2 text-gray-600">
          Manage your vault, security settings, and session
        </p>
      </div>

      {/* Session Information */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Session Information</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Session Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              session.isActive && session.id ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
            }`}>
              {session.isActive && session.id ? 'Active' : 'Inactive'}
            </span>
          </div>
          
          {session.id && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Session ID:</span>
              <code className="text-sm bg-gray-100 px-2 py-1 rounded">
                {session.id}
              </code>
            </div>
          )}
          
          {session.lastActivity && (
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Last Activity:</span>
              <span className="text-sm">
                {session.lastActivity.toLocaleString()}
              </span>
            </div>
          )}
        </div>

        <div className="mt-6">
          <button
            onClick={() => handleAction('logout')}
            disabled={!session.isActive}
            className="px-4 py-2 bg-orange-600 text-white rounded-md hover:bg-orange-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            End Session
          </button>
        </div>
      </div>

      {/* Vault Information */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Vault Information</h2>
        
        {vaultStats ? (
          <div className="space-y-3">
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Vault Status:</span>
              <span className={`px-3 py-1 rounded-full text-sm font-medium ${
                vaultReady ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
              }`}>
                {vaultReady ? 'Ready' : 'Not Ready'}
              </span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Tokens Stored:</span>
              <span className="font-medium">{vaultStats.tokenCount}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Cache Size:</span>
              <span className="font-medium">{vaultStats.cacheSize}</span>
            </div>
            
            <div className="flex justify-between items-center">
              <span className="text-gray-600">Encrypted Size:</span>
              <span className="font-medium">{vaultStats.encryptedSize}</span>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">Vault not initialized</p>
        )}

        <div className="mt-6">
          <button
            onClick={() => handleAction('wipe')}
            disabled={!vaultReady || !vaultStats || vaultStats.tokenCount === 0}
            className="px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Wipe Vault
          </button>
        </div>
      </div>

      {/* Security Status */}
      <div className="bg-white p-6 rounded-lg shadow mb-6">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Security Status</h2>
        
        <div className="space-y-3">
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Security Status:</span>
            <span className={`px-3 py-1 rounded-full text-sm font-medium ${
              isSecure ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'
            }`}>
              {isSecure ? 'Secure' : 'Security Issues'}
            </span>
          </div>
          
          <div className="flex justify-between items-center">
            <span className="text-gray-600">Security Events:</span>
            <span className="font-medium">{events.length}</span>
          </div>
        </div>

        {events.length > 0 && (
          <div className="mt-4">
            <h3 className="text-sm font-medium text-gray-900 mb-2">Recent Events</h3>
            <div className="max-h-32 overflow-y-auto space-y-1">
              {events.slice(0, 10).map((event) => (
                <div key={event.id} className="text-xs bg-gray-50 p-2 rounded">
                  <span className="font-medium">
                    {event.type.replace('_', ' ').toUpperCase()}
                  </span>
                  <span className="text-gray-500 ml-2">
                    {event.timestamp.toLocaleTimeString()}
                  </span>
                  <p className="text-gray-700 mt-1">{event.message}</p>
                </div>
              ))}
            </div>
          </div>
        )}

        <div className="mt-6">
          <button
            onClick={() => handleAction('clearEvents')}
            disabled={events.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:bg-gray-400 disabled:cursor-not-allowed"
          >
            Clear Events
          </button>
        </div>
      </div>

      {/* System Information */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">System Information</h2>
        
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-gray-600">Browser:</span>
            <span>{navigator.userAgent.split(' ')[0]}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Platform:</span>
            <span>{navigator.platform}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Language:</span>
            <span>{navigator.language}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-gray-600">Time Zone:</span>
            <span>{Intl.DateTimeFormat().resolvedOptions().timeZone}</span>
          </div>
        </div>
      </div>

      {/* Confirmation Modal */}
      {showConfirmation && actionType && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-bold text-gray-900 mb-4">
              Confirm {actionType === 'wipe' ? 'Vault Wipe' : actionType === 'logout' ? 'Logout' : 'Clear Events'}
            </h3>
            <p className="text-gray-600 mb-6">
              {getActionDescription()}
            </p>
            <div className="flex space-x-4">
              <button
                onClick={confirmAction}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"
              >
                {getConfirmationButtonText()}
              </button>
              <button
                onClick={() => {
                  setShowConfirmation(false);
                  setActionType(null);
                }}
                className="flex-1 px-4 py-2 bg-gray-200 text-gray-800 rounded-md hover:bg-gray-300"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}