import { useState, useRef } from 'react';
import { useAuth } from '../contexts/AuthContext';
import { Sparkles, Phone, ArrowRight, CheckCircle2, Loader2, XCircle } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

export function StudentLogin({ onClose }: { onClose: () => void }) {
  const { loginWithGoogle, setupRecaptcha, sendPhoneOtp, verifyOtp } = useAuth();
  
  const [phoneNumber, setPhoneNumber] = useState('');
  const [otpCode, setOtpCode] = useState('');
  const [showOtp, setShowOtp] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [confirmationResult, setConfirmationResult] = useState<any>(null);
  
  const recaptchaVerifierRef = useRef<any>(null);

  const handleSendOtp = async () => {
    if (!phoneNumber || phoneNumber.length < 10) {
      setError('Please enter a valid phone number with country code (e.g., +91).');
      return;
    }
    setError('');
    setLoading(true);
    try {
      if (!recaptchaVerifierRef.current) {
        recaptchaVerifierRef.current = setupRecaptcha('recaptcha-container');
      }
      const result = await sendPhoneOtp(phoneNumber, recaptchaVerifierRef.current);
      setConfirmationResult(result);
      setShowOtp(true);
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Failed to send OTP.');
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyOtp = async () => {
    if (!otpCode || otpCode.length < 6) {
      setError('Please enter a valid 6-digit OTP.');
      return;
    }
    setError('');
    setLoading(true);
    try {
      await verifyOtp(confirmationResult, otpCode);
      // Auth state listener in context handles the rest automatically
    } catch (err: any) {
      console.error(err);
      setError(err.message || 'Invalid OTP code. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  // Stop propagation when clicking modal body
  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4 font-sans"
      onClick={onClose}
    >
      <motion.div 
         initial={{ opacity: 0, scale: 0.95, y: 20 }}
         animate={{ opacity: 1, scale: 1, y: 0 }}
         exit={{ opacity: 0, scale: 0.95, y: 20 }}
         className="relative mx-auto flex w-full max-w-md flex-col items-center rounded-3xl border border-white/60 bg-white/95 p-10 shadow-[0_20px_60px_-15px_rgba(0,0,0,0.3)] backdrop-blur-xl"
         onClick={(e) => e.stopPropagation()}
      >
          <button 
             onClick={onClose}
             className="absolute right-4 top-4 rounded-full p-2 text-slate-400 hover:bg-slate-100 hover:text-slate-600 transition"
          >
             <XCircle className="h-6 w-6" />
          </button>

          <div className="w-16 h-16 rounded-2xl bg-gradient-to-tr from-emerald-400 to-teal-500 p-[1px] shadow-[0_0_30px_rgba(52,211,153,0.3)] mb-6">
              <div className="flex h-full w-full items-center justify-center rounded-2xl bg-white">
                  <Sparkles className="w-8 h-8 text-emerald-400" />
              </div>
          </div>
          
          <h1 className="mb-2 text-3xl font-black tracking-tight text-slate-900">SPARC</h1>
          <p className="mb-6 text-center text-sm font-medium text-slate-600">Empowering your future securely. Tap to begin your guided onboarding.</p>
          
          <div className="w-full space-y-4">
            <AnimatePresence mode="wait">
              {!showOtp ? (
                <motion.div 
                  key="phone-step"
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  className="space-y-4"
                >
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">Mobile Number</label>
                    <div className="relative">
                      <Phone className="absolute left-3 top-3 h-5 w-5 text-slate-400" />
                      <input 
                        type="tel" 
                        value={phoneNumber}
                        onChange={(e) => setPhoneNumber(e.target.value)}
                        placeholder="+91 9876543210" 
                        className="w-full rounded-xl border border-slate-300 bg-slate-50 py-3 pl-10 pr-3 text-sm font-medium text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                      />
                    </div>
                  </div>
                  
                  {error && <p className="text-xs text-rose-500 font-medium">{error}</p>}
                  
                  <button 
                    onClick={handleSendOtp}
                    disabled={loading}
                    className="flex w-full items-center justify-center space-x-2 rounded-xl bg-slate-900 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-slate-800 hover:shadow-lg disabled:opacity-70"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <span>Send OTP</span>}
                    {!loading && <ArrowRight className="w-4 h-4" />}
                  </button>
                  
                  <div className="relative flex items-center py-2">
                    <div className="flex-grow border-t border-slate-200"></div>
                    <span className="shrink-0 px-4 text-xs font-semibold text-slate-400 uppercase tracking-widest">OR</span>
                    <div className="flex-grow border-t border-slate-200"></div>
                  </div>

                  <button 
                     onClick={loginWithGoogle}
                     className="w-full flex items-center justify-center space-x-3 px-6 py-3.5 bg-white border border-slate-200 hover:bg-slate-50 text-slate-900 rounded-xl font-bold transition-all shadow-sm hover:shadow-md"
                  >
                     <svg className="w-5 h-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/><path fill="none" d="M1 1h22v22H1z"/></svg>
                     <span>Continue with Google</span>
                  </button>
                </motion.div>
              ) : (
                <motion.div 
                  key="otp-step"
                  initial={{ opacity: 0, x: 20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -20 }}
                  className="space-y-4"
                >
                  <p className="text-xs text-emerald-600 font-medium bg-emerald-50 p-3 rounded-lg border border-emerald-100 mb-2">Code sent to {phoneNumber}</p>
                  
                  <div>
                    <label className="text-xs font-semibold text-slate-600 mb-1 block">6-Digit OTP</label>
                    <input 
                      type="text" 
                      maxLength={6}
                      value={otpCode}
                      onChange={(e) => setOtpCode(e.target.value.replace(/\D/g, ''))}
                      placeholder="• • • • • •" 
                      className="w-full text-center tracking-[1em] rounded-xl border border-slate-300 bg-slate-50 py-3 text-lg font-bold text-slate-900 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
                    />
                  </div>
                  
                  {error && <p className="text-xs text-rose-500 font-medium text-center">{error}</p>}
                  
                  <button 
                    onClick={handleVerifyOtp}
                    disabled={loading || otpCode.length !== 6}
                    className="flex w-full items-center justify-center space-x-2 rounded-xl bg-indigo-600 py-3.5 text-sm font-bold text-white shadow-md transition-all hover:bg-indigo-700 hover:shadow-lg disabled:opacity-70 disabled:hover:shadow-md"
                  >
                    {loading ? <Loader2 className="animate-spin w-5 h-5" /> : <span>Verify & Login</span>}
                    {!loading && <CheckCircle2 className="w-4 h-4 text-indigo-200" />}
                  </button>
                  
                  <button 
                    onClick={() => { setShowOtp(false); setError(''); }}
                    className="w-full text-xs font-semibold text-slate-500 hover:text-slate-900 mt-2"
                  >
                    Change phone number
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
          
          <div id="recaptcha-container"></div>
      </motion.div>
    </motion.div>
  );
}
