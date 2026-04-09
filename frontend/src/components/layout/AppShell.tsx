import { ReactNode } from 'react';
import { useSession } from '../../contexts/SessionContext';
import { useSecurity } from '../../contexts/SecurityContext';

interface AppShellProps {
  children: ReactNode;
}

export function AppShell({ children }: AppShellProps) {
  const { isSecure } = useSecurity();
  const { session, clearSession } = useSession();

  return (
    <div className="min-h-screen bg-[#f6f4f0] text-[#1f1e1c] font-sans relative selection:bg-[#ff8a3d]/20 selection:text-[#ff8a3d]">
      {/* Grid Background overlay */}
      <div className="absolute inset-0 z-0 pointer-events-none mix-blend-multiply opacity-70" style={{
        backgroundSize: '40px 40px',
        backgroundImage: 'linear-gradient(to right, #e8e5df 1px, transparent 1px), linear-gradient(to bottom, #e8e5df 1px, transparent 1px)'
      }} />

      {/* Floating Header Pill */}
      <div className="relative z-20 pt-6 px-4 sm:px-10 lg:px-14">
        <header className="bg-[#acaa9f] rounded-full px-8 py-4 flex items-center justify-between shadow-sm border border-black/5">
          <div className="flex items-center gap-3 text-white font-bold text-2xl tracking-wide">
            <span className="text-2xl leading-none">❋</span> AGIS
          </div>

          <div className="flex items-center gap-4">
            {session.isActive && (
              <button 
                onClick={clearSession}
                className="text-white/70 hover:text-white text-sm font-bold tracking-widest px-4 py-2 transition-all"
              >
                LOGOUT
              </button>
            )}
            <button 
              onClick={() => document.getElementById('main-content')?.scrollIntoView({ behavior: 'smooth' })}
              className="bg-[#fcfaf8] text-[#1f1e1c] hover:bg-white text-sm font-bold tracking-widest px-8 py-2.5 rounded-full transition-all shadow-sm"
            >
              TRY →
            </button>
          </div>
        </header>

        {/* Security Warning Banner (if insecure) */}
        {!isSecure && (
          <div className="mt-4 bg-red-50/90 backdrop-blur-sm border-l-4 border-red-500 rounded-r-xl p-4 shadow-sm relative z-20">
            <div className="flex">
              <span className="text-red-500 mr-3 text-xl">⚠️</span>
              <p className="text-base text-red-800 font-medium">
                Security issues detected. Local crypto context may be compromised.
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Main Page Area */}
      <main id="main-content" className="relative z-10 px-4 sm:px-10 lg:px-14 pb-10 flex-1">
        {children}
      </main>
    </div>
  );
}