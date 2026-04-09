import { useState, useEffect } from 'react';
import { useSession } from '../contexts/SessionContext';
import { useVault } from '../hooks/useVault';
import { useDetokenizer } from '../hooks/useDetokenizer';

export function Dashboard() {
  const { session, isSessionValid } = useSession();
  const { vault, ready: vaultReady, getStats } = useVault();
  const { detokenize } = useDetokenizer();
  const [vaultStats, setVaultStats] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const loadStats = async () => {
      if (vaultReady && vault && isSessionValid()) {
        try {
          const stats = await getStats();
          setVaultStats(stats);
        } catch (error) {
          console.error('Failed to load vault stats:', error);
        } finally {
          setLoading(false);
        }
      } else {
        setLoading(false);
      }
    };

    loadStats();
  }, [vaultReady, vault, isSessionValid, getStats]);

  const testDetokenization = () => {
    const testText = "Hello USER_123, your order ORD_456 is ready for delivery at LOC_789.";
    const detokenized = detokenize(testText);
    return detokenized;
  };

  if (!session.isActive) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">No Active Session</h2>
        <p className="text-gray-600 mb-8">Please start a session to access the dashboard.</p>
        <button
          onClick={() => window.location.href = '/test'}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Go to Test Lab
        </button>
      </div>
    );
  }

  if (!isSessionValid()) {
    return (
      <div className="text-center py-12">
        <h2 className="text-2xl font-bold text-gray-900 mb-4">Session Expired</h2>
        <p className="text-gray-600 mb-8">Your session has expired. Please start a new session.</p>
        <button
          onClick={() => window.location.href = '/test'}
          className="px-4 py-2 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
        >
          Start New Session
        </button>
      </div>
    );
  }

  return (
    <div>
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
        <p className="mt-2 text-gray-600">
          Monitor your privacy vault and system status
        </p>
      </div>

      {/* Status Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
        {/* Vault Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-green-100 rounded-full flex items-center justify-center">
                <span className="text-green-600">🔐</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Vault Status</h3>
              <p className="text-sm text-gray-500">
                {vaultReady ? 'Ready' : 'Not Ready'}
              </p>
            </div>
          </div>
        </div>

        {/* Session Status */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-blue-100 rounded-full flex items-center justify-center">
                <span className="text-blue-600">👤</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Session</h3>
              <p className="text-sm text-gray-500">
                {session.id?.substring(0, 8)}...
              </p>
            </div>
          </div>
        </div>

        {/* Tokens Stored */}
        <div className="bg-white p-6 rounded-lg shadow">
          <div className="flex items-center">
            <div className="flex-shrink-0">
              <div className="w-8 h-8 bg-purple-100 rounded-full flex items-center justify-center">
                <span className="text-purple-600">🔑</span>
              </div>
            </div>
            <div className="ml-4">
              <h3 className="text-lg font-medium text-gray-900">Tokens</h3>
              <p className="text-sm text-gray-500">
                {loading ? 'Loading...' : vaultStats?.tokenCount || '0'} stored
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Vault Statistics */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Vault Statistics</h2>
        {loading ? (
          <div className="text-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-indigo-600 mx-auto"></div>
          </div>
        ) : vaultStats ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{vaultStats.tokenCount}</div>
              <div className="text-sm text-gray-500">Total Tokens</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{vaultStats.cacheSize}</div>
              <div className="text-sm text-gray-500">Cached Items</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{vaultStats.encryptedSize}</div>
              <div className="text-sm text-gray-500">Encrypted Size</div>
            </div>
            <div className="text-center">
              <div className="text-2xl font-bold text-gray-900">{vaultStats.sessionId?.substring(0, 8)}...</div>
              <div className="text-sm text-gray-500">Session ID</div>
            </div>
          </div>
        ) : (
          <p className="text-gray-600">No statistics available</p>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white p-6 rounded-lg shadow mb-8">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <button
            onClick={() => window.location.href = '/documents'}
            className="flex items-center justify-center px-4 py-3 bg-indigo-600 text-white rounded-md hover:bg-indigo-700"
          >
            <span className="mr-2">📄</span>
            Process Documents
          </button>
          <button
            onClick={() => window.location.href = '/chat'}
            className="flex items-center justify-center px-4 py-3 bg-green-600 text-white rounded-md hover:bg-green-700"
          >
            <span className="mr-2">💬</span>
            Start Chat
          </button>
        </div>
      </div>

      {/* Test Detokenization */}
      <div className="bg-white p-6 rounded-lg shadow">
        <h2 className="text-xl font-bold text-gray-900 mb-4">Test Detokenization</h2>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Sample Text
            </label>
            <div className="p-3 bg-gray-50 rounded-md text-sm">
              Hello USER_123, your order ORD_456 is ready for delivery at LOC_789.
            </div>
          </div>
          <button
            onClick={testDetokenization}
            className="px-4 py-2 bg-purple-600 text-white rounded-md hover:bg-purple-700"
          >
            Test Detokenization
          </button>
        </div>
      </div>
    </div>
  );
}