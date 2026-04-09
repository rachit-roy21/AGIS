import { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { useVault } from '../hooks/useVault';
import { useSecurity } from './SecurityContext';
import { InputValidator } from '../utils/validation';

interface Session {
  id: string | null;
  challenge: string | null;
  isActive: boolean;
  lastActivity: Date | null;
  startTime: Date | null;
  expiresAt: Date | null;
}

interface SessionContextType {
  session: Session;
  setSession: (session: Partial<Session>) => void;
  clearSession: () => void;
  initializeSession: (sessionId: string, challenge: string) => Promise<void>;
  isSessionValid: () => boolean;
  extendSession: () => void;
  getTimeRemaining: () => number;
}

const SessionContext = createContext<SessionContextType | undefined>(undefined);

interface SessionProviderProps {
  children: ReactNode;
}

export function SessionProvider({ children }: SessionProviderProps) {
  const { vault, ready: vaultReady, initialize: initVault } = useVault();
  const { addSecurityEvent } = useSecurity();

  const [session, setSessionState] = useState<Session>({
    id: null,
    challenge: null,
    isActive: false,
    lastActivity: null,
    startTime: null,
    expiresAt: null,
  });

  const setSession = (updates: Partial<Session>) => {
    setSessionState(prev => ({
      ...prev,
      ...updates,
      lastActivity: new Date(),
    }));
  };

  const extendSession = () => {
    if (!session.isActive || !session.startTime) return;

    const newExpiresAt = new Date(Date.now() + 30 * 60 * 1000); // 30 minutes from now
    setSessionState(prev => ({
      ...prev,
      expiresAt: newExpiresAt,
      lastActivity: new Date(),
    }));
  };

  const getTimeRemaining = () => {
    if (!session.expiresAt) return 0;
    return Math.max(0, session.expiresAt.getTime() - Date.now());
  };

  const clearSession = async () => {
    try {
      if (vaultReady && vault) {
        await vault.wipe();
      }
    } catch (error) {
      console.error('Failed to wipe vault:', error);
      addSecurityEvent({
        type: 'vault_error',
        message: `Vault wipe failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
    }

    setSessionState({
      id: null,
      challenge: null,
      isActive: false,
      lastActivity: null,
      startTime: null,
      expiresAt: null,
    });
  };

  const initializeSession = async (sessionId: string, challenge: string) => {
    try {
      // Validate inputs
      const sessionIdValidation = InputValidator.validateSessionId(sessionId);
      if (!sessionIdValidation.isValid) {
        const error = new Error(sessionIdValidation.error);
        addSecurityEvent({
          type: 'auth_failure',
          message: `Invalid session ID: ${sessionIdValidation.error}`,
          details: { sessionId: sessionId.substring(0, 8) + '...' },
        });
        throw error;
      }

      const challengeValidation = InputValidator.validateChallenge(challenge);
      if (!challengeValidation.isValid) {
        const error = new Error(challengeValidation.error);
        addSecurityEvent({
          type: 'auth_failure',
          message: `Invalid challenge: ${challengeValidation.error}`,
        });
        throw error;
      }

      await initVault(sessionIdValidation.sanitized!, challengeValidation.sanitized!);

      const now = new Date();
      const expiresAt = new Date(now.getTime() + 30 * 60 * 1000); // 30 minutes

      setSessionState({
        id: sessionIdValidation.sanitized!,
        challenge: challengeValidation.sanitized!,
        isActive: true,
        lastActivity: now,
        startTime: now,
        expiresAt,
      });
    } catch (error) {
      console.error('Failed to initialize session:', error);
      addSecurityEvent({
        type: 'auth_failure',
        message: `Session initialization failed: ${error instanceof Error ? error.message : 'Unknown error'}`,
      });
      throw error;
    }
  };

  const isSessionValid = () => {
    if (!session.id || !session.isActive || !session.lastActivity || !session.expiresAt) {
      return false;
    }

    // Check if session has expired
    const now = new Date().getTime();
    const expiresAt = session.expiresAt.getTime();

    if (now >= expiresAt) {
      addSecurityEvent({
        type: 'session_timeout',
        message: 'Session expired due to timeout',
        details: {
          sessionId: session.id.substring(0, 8) + '...',
          expiredAt: session.expiresAt.toISOString(),
        },
      });
      return false;
    }

    return true;
  };

  // Check session validity periodically and handle expiration
  useEffect(() => {
    const interval = setInterval(() => {
      if (session.isActive && !isSessionValid()) {
        clearSession();
      }
    }, 30000); // Check every 30 seconds for better security

    // Activity detection - extend session on user interaction
    const handleActivity = () => {
      if (session.isActive && isSessionValid()) {
        extendSession();
      }
    };

    const events = ['mousedown', 'keydown', 'scroll', 'touchstart'];
    events.forEach(event => {
      window.addEventListener(event, handleActivity, { passive: true });
    });

    return () => {
      clearInterval(interval);
      events.forEach(event => {
        window.removeEventListener(event, handleActivity);
      });
    };
  }, [session, isSessionValid]);

  // Warning before session expiration
  useEffect(() => {
    if (!session.expiresAt || !session.isActive) return;

    const checkExpiration = () => {
      const timeRemaining = getTimeRemaining();

      // Show warning 5 minutes before expiration
      if (timeRemaining > 0 && timeRemaining <= 5 * 60 * 1000) {
        console.warn(`Session expires in ${Math.ceil(timeRemaining / 60000)} minutes`);
      }

      // Force logout if expired
      if (timeRemaining <= 0) {
        clearSession();
      }
    };

    const warningInterval = setInterval(checkExpiration, 60000); // Check every minute

    return () => clearInterval(warningInterval);
  }, [session.expiresAt, session.isActive]);

  const value: SessionContextType = {
    session,
    setSession,
    clearSession,
    initializeSession,
    isSessionValid,
    extendSession,
    getTimeRemaining,
  };

  return (
    <SessionContext.Provider value={value}>
      {children}
    </SessionContext.Provider>
  );
}

export function useSession() {
  const context = useContext(SessionContext);
  if (context === undefined) {
    throw new Error('useSession must be used within a SessionProvider');
  }
  return context;
}