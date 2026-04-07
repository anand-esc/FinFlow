import { useState } from 'react';
import { motion } from 'framer-motion';
import { ShieldCheck, FileWarning, SearchCode, AlertTriangle, Eye, EyeOff } from 'lucide-react';

export function EscalationPanel({ data, explainable }: any) {
  const [piiMasked, setPiiMasked] = useState(true);

  const togglePii = () => {
    if (piiMasked) {
       console.log(`[AUDIT] Human Admin revealed PII for Applicant: ${data.id}`);
    }
    setPiiMasked(!piiMasked);
  };
  return (
    <motion.div 
       initial={{ opacity: 0, y: 15 }}
       animate={{ opacity: 1, y: 0 }}
       exit={{ opacity: 0, y: -15 }}
       className="w-full max-w-5xl bg-[#0B0F19]/80 backdrop-blur-xl border border-slate-700/50 rounded-2xl shadow-2xl overflow-hidden"
    >
       {/* Identity Bar */}
       <div className="bg-slate-800/40 px-6 py-5 border-b border-slate-800 flex justify-between items-center">
          <div className="flex items-center space-x-4">
             <div className="w-12 h-12 rounded-xl bg-slate-700/50 flex items-center justify-center font-bold text-xl text-white shadow-inner">
                {data.applicant.charAt(0)}
             </div>
             <div>
                <h3 className="text-white font-bold text-lg flex items-center">
                   <span className={piiMasked ? "filter blur-md select-none transition-all" : "transition-all"}>{data.applicant}</span>
                   <button onClick={togglePii} className="ml-3 text-slate-500 hover:text-indigo-400 transition-colors">
                      {piiMasked ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                   </button>
                </h3>
                <p className="text-slate-400 text-sm uppercase tracking-widest">
                   App ID: <span className={`font-mono ml-1 ${piiMasked ? "filter blur-sm select-none transition-all" : "transition-all"}`}>{data.id}</span>
                </p>
             </div>
          </div>
          <div className="flex items-center space-x-4">
             <div className="text-right">
                <p className="text-[10px] text-slate-400 uppercase tracking-widest font-bold">Alt-Score</p>
                <p className="text-2xl font-black text-rose-400 tracking-tight">{data.altScore} <span className="text-sm font-medium text-slate-500">/ 1000</span></p>
             </div>
             <div className="px-3 py-1.5 flex items-center bg-rose-500/10 text-rose-400 rounded-lg border border-rose-500/20 text-xs font-bold uppercase tracking-widest">
                <AlertTriangle className="w-4 h-4 mr-2" />
                Needs Review
             </div>
          </div>
       </div>

       {/* The Agentic Debate Split View */}
       <div className="p-6">
          <h4 className="text-xs font-bold text-slate-400 uppercase tracking-[0.2em] mb-4 flex items-center">
             <SearchCode className="w-4 h-4 mr-2 text-indigo-400" /> 
             Live Agent Argumentation Log
          </h4>
          
          <div className="grid grid-cols-2 gap-6">
             {/* Advocate Agent (Emerald) */}
             <div className="p-5 rounded-2xl bg-emerald-950/10 border border-emerald-900/30 shadow-inner">
                <div className="flex items-center mb-4">
                   <div className="w-8 h-8 rounded-lg bg-emerald-500/20 flex items-center justify-center mr-3">
                      <ShieldCheck className="w-5 h-5 text-emerald-400" />
                   </div>
                   <h5 className="font-bold text-emerald-400 uppercase tracking-widest text-xs">Prospective Advocate Agent</h5>
                </div>
                {explainable ? (
                   <p className="text-emerald-300 text-sm leading-relaxed">
                     "This student is an excellent fit! The rent document isn't perfectly formal, but their alternative data proves deep consistency and incredible merit."
                   </p>
                ) : (
                   <p className="text-emerald-300/60 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                     {`EVAL: POSITIVE. \nWEIGHT_MERIT=HIGH. \nNLP_ANALYSIS="NCC Cadet" == POSITIVE_TRAIT. \nPROBABILITY_SUCCESS: 87.2%.`}
                   </p>
                )}
             </div>

             {/* Risk Assessor (Rose) */}
             <div className="p-5 rounded-xl bg-rose-950/10 border border-rose-900/30 shadow-inner">
                <div className="flex items-center mb-4">
                   <div className="w-8 h-8 rounded-lg bg-rose-500/20 flex items-center justify-center mr-3">
                      <FileWarning className="w-5 h-5 text-rose-400" />
                   </div>
                   <h5 className="font-bold text-rose-400 uppercase tracking-widest text-xs">Risk Assessor Agent</h5>
                </div>
                {explainable ? (
                   <p className="text-rose-300 text-sm leading-relaxed">
                     "I flagged this application because the rent document intel confidence dropped to 42%. This brings their total credit score to 385, which halts my auto-approve logic."
                   </p>
                ) : (
                   <p className="text-rose-300/60 text-sm leading-relaxed font-mono whitespace-pre-wrap">
                     {`EVAL: NEGATIVE/FLAG. \nDOC_INTEL_CONFIDENCE=0.42. \nFAIL_REASON="SIGNATURE_MISSING". \nADJ_SCORE: 385. \nACTION: HALT & ESCALATE.`}
                   </p>
                )}
             </div>
          </div>

          {/* Action Buttons */}
          <div className="mt-6 pt-6 border-t border-slate-800 flex justify-end space-x-4">
             <button className="px-6 py-2.5 rounded-xl font-bold text-sm bg-slate-800 text-slate-300 hover:bg-slate-700 transition-colors border border-slate-700 hover:border-slate-600">
                Request Documents
             </button>
             <button className="px-6 py-2.5 rounded-xl font-bold text-sm bg-emerald-500 hover:bg-emerald-400 text-slate-900 transition-all shadow-[0_0_20px_rgba(16,185,129,0.2)]">
                Override & Approve
             </button>
          </div>
       </div>
    </motion.div>
  );
}
