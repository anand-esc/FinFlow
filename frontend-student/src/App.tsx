import { useState } from 'react';
import type { ReactNode } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { ShieldCheck, GraduationCap, ArrowRight, ScanLine, LogOut } from 'lucide-react';
import { TrustGauge } from './components/TrustGauge';
import { DocumentUploadCard } from './components/DocumentUploadCard';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { StudentLogin } from './components/StudentLogin';

function StudentDashboard() {
  const [score, setScore] = useState(300);
  const [isOrchestrating, setIsOrchestrating] = useState(false);
  const [docStatuses, setDocStatuses] = useState({
     aadhaar: 'IDLE',
     utility: 'IDLE'
  });
  const [docUrls, setDocUrls] = useState({
     aadhaar: '',
     utility: ''
  });
  const { logout, user } = useAuth();

  const triggerOrchestrator = async () => {
     setIsOrchestrating(true);
     try {
         const res = await fetch("http://localhost:8000/api/orchestrate", {
             method: "POST",
             headers: { "Content-Type": "application/json" },
             body: JSON.stringify({
                 user_id: user?.uid || "anonymous_student",
                 event: "DOCUMENTS_UPLOADED",
                 payload: {
                    new_documents: [
                       { doc_type: "aadhaar", url: docUrls.aadhaar }, 
                       { doc_type: "utility", alt_points: 385, url: docUrls.utility }
                    ]
                 }
             })
         });
         const data = await res.json();
         console.log("Agent Data:", data);
     } catch (e) {
         console.error(e);
     }
  };

  const handleUploadComplete = (type: 'aadhaar' | 'utility', url: string) => {
     setDocUrls(prev => ({ ...prev, [type]: url }));
     setDocStatuses(prev => ({ ...prev, [type]: 'PROCESSING' }));
     setTimeout(() => {
        setDocStatuses(prev => ({ ...prev, [type]: 'VERIFIED' }));
        setScore(prev => prev + (type === 'utility' ? 385 : 115));
     }, 1000);
  };

  return (
    <div className="min-h-screen bg-[#060913] text-slate-100 flex flex-col font-sans selection:bg-indigo-500/30">
      <header className="px-6 py-4 flex items-center justify-between border-b border-slate-800/40 bg-[#060913]/60 backdrop-blur-2xl sticky top-0 z-50">
         <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-indigo-600 to-emerald-400 p-[1px] shadow-lg shadow-indigo-500/20">
                <div className="w-full h-full bg-[#0B0F19] rounded-xl flex items-center justify-center">
                    <GraduationCap className="w-5 h-5 text-emerald-400" />
                </div>
            </div>
            <div>
                <h1 className="text-lg font-bold tracking-tight text-white leading-tight">SPARC</h1>
                <p className="text-[9px] uppercase tracking-widest text-slate-400 font-bold">Agentic Finance</p>
            </div>
         </div>
         <div className="flex items-center space-x-3">
            <div className="px-3 py-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-[10px] font-semibold text-emerald-400 hidden sm:flex items-center uppercase tracking-wider backdrop-blur-sm shadow-[0_0_15px_rgba(16,185,129,0.1)]">
               <ShieldCheck className="w-3.5 h-3.5 mr-1" />
               Bank Grade
            </div>
            <button onClick={logout} className="p-2 rounded-full bg-slate-800/50 text-slate-400 hover:text-rose-400 hover:bg-rose-500/10 transition-colors" title="Sign Out">
               <LogOut className="w-4 h-4"/>
            </button>
         </div>
      </header>
      
      <main className="flex-1 w-full max-w-md mx-auto p-6 flex flex-col pt-8 pb-24 relative">
          <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#060913] to-[#060913] z-[-1]"></div>

          <TrustGauge score={score} />

          <div className="mb-6 px-1">
             <h2 className="text-2xl font-bold text-white tracking-tight mb-2">Prove your consistency.</h2>
             <p className="text-slate-400 text-sm leading-relaxed">
               No formal income required. Upload standard alternative data and watch the risk-assessor build your profile in real-time.
             </p>
          </div>

          <div className="space-y-4 mb-10">
             <DocumentUploadCard 
                title="Aadhaar Card"
                subtitle="Government ID Verification"
                status={docStatuses.aadhaar as any}
                onUploadComplete={(url) => handleUploadComplete('aadhaar', url)}
             />
             <DocumentUploadCard 
                title="Recent Utility Bill"
                subtitle="Electricity, Gas, or Water (Alt-Data)"
                status={docStatuses.utility as any}
                onUploadComplete={(url) => handleUploadComplete('utility', url)}
             />
          </div>

          <AnimatePresence>
             {docStatuses.aadhaar === 'VERIFIED' && docStatuses.utility === 'VERIFIED' && !isOrchestrating && (
                <motion.div 
                   initial={{ opacity: 0, y: 20 }}
                   animate={{ opacity: 1, y: 0 }}
                   exit={{ opacity: 0, scale: 0.95 }}
                   className="mt-auto pt-6"
                >
                   <button 
                      onClick={triggerOrchestrator}
                      className="w-full py-4 rounded-xl bg-white text-slate-900 font-bold text-[15px] flex items-center justify-center hover:bg-slate-100 transition-all active:scale-95 shadow-[0_0_30px_rgba(255,255,255,0.15)]"
                   >
                      Trigger LangGraph Orchestrator
                      <ArrowRight className="w-5 h-5 ml-2" />
                   </button>
                </motion.div>
             )}

             {isOrchestrating && (
                 <motion.div 
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="p-6 rounded-2xl bg-indigo-600/10 border border-indigo-500/30 flex flex-col items-center mt-2"
                 >
                     <ScanLine className="w-10 h-10 text-indigo-400 animate-pulse mb-4" />
                     <h3 className="text-lg font-bold text-white mb-2">Master Agent Initiated</h3>
                     <p className="text-slate-300 text-sm text-center">Negotiating with Eligibility Assessor and Scholarship Logic Engine...</p>
                 </motion.div>
             )}
          </AnimatePresence>
      </main>
    </div>
  );
}

function StudentRoute({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  if (!user) return <StudentLogin />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
       <StudentRoute>
          <StudentDashboard />
       </StudentRoute>
    </AuthProvider>
  );
}
