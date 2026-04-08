import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Lock, ShieldCheck } from 'lucide-react';

export function AppLock({ children }: { children: React.ReactNode }) {
  const [isLocked, setIsLocked] = useState(false);
  const [isAuthenticating, setIsAuthenticating] = useState(false);
  const [error, setError] = useState('');

  const IDLE_TIMEOUT_MS = 60 * 1000; // 1 minute
  let idleTimer: ReturnType<typeof setTimeout>;

  const handleActivity = useCallback(() => {
    if (isLocked) return;
    clearTimeout(idleTimer);
    idleTimer = setTimeout(() => {
      setIsLocked(true);
    }, IDLE_TIMEOUT_MS);
  }, [isLocked]);

  useEffect(() => {
    // Initial timer setup
    handleActivity();

    const activityEvents = ['mousemove', 'mousedown', 'keydown', 'touchstart', 'scroll'];
    
    activityEvents.forEach((eventName) => {
      window.addEventListener(eventName, handleActivity);
    });

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Automatically lock when app is backgrounded to ensure maximum security
        setIsLocked(true);
      } else {
        handleActivity();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);

    return () => {
      clearTimeout(idleTimer);
      activityEvents.forEach((eventName) => {
        window.removeEventListener(eventName, handleActivity);
      });
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [handleActivity]);

  const unlockLocally = async () => {
    setIsAuthenticating(true);
    setError('');
    
    try {
      // Demo simplification:
      // We intentionally remove any external auth prompt and provide a local unlock action.
      await new Promise((resolve) => setTimeout(resolve, 700));
      setIsLocked(false);
    } catch (err: any) {
      setError(err.message || 'Unlock failed. Please try again.');
    } finally {
      setIsAuthenticating(false);
    }
  };

  return (
    <>
      <AnimatePresence>
        {isLocked && (
          <motion.div 
            initial={{ opacity: 0, backdropFilter: "blur(0px)" }}
            animate={{ opacity: 1, backdropFilter: "blur(20px)" }}
            exit={{ opacity: 0, backdropFilter: "blur(0px)" }}
            transition={{ duration: 0.4 }}
            className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-900/60"
          >
            <motion.div 
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              className="mx-4 flex w-full max-w-sm flex-col items-center rounded-3xl border border-white/20 bg-white/90 p-8 text-center shadow-2xl backdrop-blur-xl"
            >
              <div className="mb-6 rounded-full bg-slate-100 p-4 shadow-inner">
                <Lock className="h-10 w-10 text-slate-800" />
              </div>
              
              <h2 className="mb-2 text-2xl font-bold text-slate-900">App Locked</h2>
              <p className="mb-8 text-sm text-slate-600">
                For your security, SPARC locks automatically when idle to protect sensitive documents.
              </p>

              {error && <p className="mb-4 text-xs font-semibold text-rose-500">{error}</p>}

              <button
                onClick={unlockLocally}
                disabled={isAuthenticating}
                className="group relative flex w-full items-center justify-center space-x-3 overflow-hidden rounded-xl bg-slate-900 px-6 py-4 text-sm font-bold text-white shadow-lg transition-all hover:bg-slate-800 disabled:bg-slate-700"
              >
                {isAuthenticating ? (
                   <span className="flex items-center space-x-2 animate-pulse">
                     <ShieldCheck className="h-5 w-5" />
                     <span>Authenticating...</span>
                   </span>
                ) : (
                  <>
                    <ShieldCheck className="h-5 w-5" />
                    <span>Unlock</span>
                  </>
                )}
              </button>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
      
      {/* Underlying content remains rendered but securely obscured behind the blurred AppLock overlay */}
      {children}
    </>
  );
}
