import { useState } from 'react';
import type { ReactNode } from 'react';
import { AnimatePresence } from 'framer-motion';
import { LayoutDashboard, Users, AlertCircle, CheckCircle2, ShieldAlert, BrainCircuit, Activity, LogOut } from 'lucide-react';
import { EscalationPanel } from './components/EscalationPanel';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { AdminLogin } from './components/AdminLogin';

// Mock Data
const mockEscalations = [
  {
    id: 'sparc-2026-X1',
    applicant: 'Suryansh',
    altScore: 385,
    status: 'HITL_ESCALATION',
  }
];

function AdminDashboard() {
  const [activeTab, setActiveTab] = useState('escalations');
  const [plainLanguageMode, setPlainLanguageMode] = useState(false);
  const { logout, user } = useAuth();

  return (
    <div className="flex h-screen bg-[#060913] text-slate-300 font-sans overflow-hidden">
      
      {/* Sidebar Navigation */}
      <aside className="w-64 bg-[#0B0F19]/90 border-r border-slate-800/80 flex flex-col z-20 shadow-2xl relative">
        <div className="absolute top-0 right-[-1px] w-[1px] h-full bg-gradient-to-b from-slate-800 via-rose-500/20 to-slate-800"></div>
        <div className="p-6 border-b border-slate-800/60 flex items-center space-x-3 mt-2">
            <div className="w-10 h-10 rounded-xl bg-gradient-to-tr from-rose-600 to-indigo-500 p-[1px] shadow-[0_0_15px_rgba(225,29,72,0.2)]">
                <div className="w-full h-full bg-[#0B0F19] rounded-xl flex items-center justify-center">
                    <ShieldAlert className="w-5 h-5 text-rose-500" />
                </div>
            </div>
            <div>
                <h1 className="text-lg font-bold text-white tracking-tight leading-tight">Admin Dash</h1>
                <p className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">SPARC Control</p>
            </div>
        </div>
        
        <nav className="p-4 space-y-1.5 flex-1 mt-4">
           <NavItem icon={<AlertCircle />} label="Escalations" active={activeTab === 'escalations'} onClick={() => setActiveTab('escalations')} count={1} alert={true} />
           <NavItem icon={<Users />} label="Priority Queue" active={activeTab === 'queue'} onClick={() => setActiveTab('queue')} />
           <NavItem icon={<CheckCircle2 />} label="Auto-Disbursed" active={activeTab === 'approved'} onClick={() => setActiveTab('approved')} count={142} />
           <NavItem icon={<LayoutDashboard />} label="Metrics" active={activeTab === 'analytics'} onClick={() => setActiveTab('analytics')} />
        </nav>

        <div className="p-6 mt-auto">
            <button onClick={logout} className="w-full mb-4 flex items-center justify-center p-3 text-sm font-semibold text-slate-500 hover:text-white bg-slate-800/30 hover:bg-rose-500/20 hover:text-rose-400 rounded-xl transition-all border border-transparent hover:border-rose-500/30">
               <LogOut className="w-4 h-4 mr-2"/> Sign Out
            </button>
            <div className="p-4 rounded-2xl bg-indigo-500/5 border border-indigo-500/10 text-center">
               <Activity className="w-5 h-5 text-indigo-400/80 mx-auto mb-2" />
               <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Orchestrator Uptime</p>
               <p className="text-indigo-300 font-bold mt-1 text-sm">99.9% / Live</p>
            </div>
        </div>
      </aside>

      {/* Main Content Area */}
      <main className="flex-1 overflow-auto relative">
         <div className="fixed inset-0 pointer-events-none bg-[radial-gradient(ellipse_at_top_right,_var(--tw-gradient-stops))] from-indigo-900/10 via-[#060913] to-[#060913] z-[-1]"></div>
         
         {/* Topbar */}
         <header className="px-8 py-6 flex items-center justify-between sticky top-0 bg-[#060913]/80 backdrop-blur-xl z-10 border-b border-slate-800/40">
             <div>
                <h2 className="text-xl font-bold text-white tracking-tight">Resolution Center</h2>
                <p className="text-xs text-slate-400 mt-1 uppercase tracking-widest font-semibold text-rose-400">1 Human-in-the-loop action required</p>
             </div>
             
             {/* Explainability Toggle */}
             <button 
                onClick={() => setPlainLanguageMode(!plainLanguageMode)}
                className={`flex items-center px-5 py-2.5 rounded-xl font-bold text-xs transition-all border outline-none ${
                   plainLanguageMode 
                   ? 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.1)]'
                   : 'bg-slate-800/50 text-slate-300 border-slate-700/50 hover:bg-slate-700'
                }`}
             >
                <BrainCircuit className={`w-4 h-4 mr-2 ${plainLanguageMode ? 'text-emerald-400 animate-pulse' : 'text-slate-400'}`} />
                Explainability Layer: {plainLanguageMode ? 'ACTIVE' : 'OFF'}
             </button>
         </header>

         {/* Content View */}
         <div className="p-8">
            <AnimatePresence mode="wait">
               {activeTab === 'escalations' && mockEscalations.map(esc => (
                  <EscalationPanel key={esc.id} data={esc} explainable={plainLanguageMode} />
               ))}
               {activeTab !== 'escalations' && (
                  <div className="text-slate-500 flex flex-col items-center justify-center mt-32">
                     <Users className="w-12 h-12 mb-4 opacity-50" />
                     <p>Queue is empty or view isn't implemented for mock demo.</p>
                  </div>
               )}
            </AnimatePresence>
         </div>
      </main>
    </div>
  );
}

function NavItem({ icon, label, active, onClick, count, alert }: any) {
  return (
    <button 
      onClick={onClick}
      className={`w-full flex items-center justify-between p-3 rounded-xl text-sm font-semibold transition-all ${
        active ? (alert ? 'bg-rose-500/10 text-rose-400 fill-rose-400' : 'bg-indigo-600/10 text-indigo-400') : 'text-slate-400 hover:bg-slate-800/50 hover:text-slate-200'
      }`}
    >
       <div className="flex items-center space-x-3">
          <span className="w-5 h-5 opacity-90">{icon}</span>
          <span>{label}</span>
       </div>
       {count !== undefined && (
          <span className={`px-2.5 py-0.5 rounded-full text-[10px] uppercase font-black tracking-wider ${active ? (alert ? 'bg-rose-500/20 text-rose-400' : 'bg-indigo-500/20 text-indigo-400') : 'bg-slate-800 text-slate-500'} `}>
             {count}
          </span>
       )}
    </button>
  );
}

function AdminRoute({ children }: { children: ReactNode }) {
  const { user, role } = useAuth();
  if (!user || role !== 'admin') return <AdminLogin />;
  return <>{children}</>;
}

export default function App() {
  return (
    <AuthProvider>
       <AdminRoute>
          <AdminDashboard />
       </AdminRoute>
    </AuthProvider>
  );
}
