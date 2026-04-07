import { motion } from 'framer-motion';

export function TrustGauge({ score }: { score: number }) {
  // Score range from 300 to 1000. 
  // Circumference of half circle with r=80 is pi * 80 = 251.32
  const radius = 80;
  const circumference = Math.PI * radius;
  const percentage = Math.min(Math.max((score - 300) / 700, 0), 1);
  const strokeDashoffset = circumference - (percentage * circumference);

  return (
    <div className="p-6 rounded-3xl relative overflow-hidden mb-8 border border-slate-700/50 bg-gradient-to-b from-[#131b2f] to-[#0B0F19] shadow-2xl">
      {/* Background glow effects */}
      <div className="absolute top-[-20%] right-[-20%] w-48 h-48 bg-emerald-500/10 blur-[50px] rounded-full pointer-events-none" />
      <div className="absolute bottom-[-20%] left-[-20%] w-48 h-48 bg-indigo-500/10 blur-[50px] rounded-full pointer-events-none" />
      
      <div className="flex flex-col items-center z-10 relative">
        <div className="flex items-center space-x-2 mb-6">
            <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
            <h3 className="text-xs font-semibold text-slate-400 uppercase tracking-[0.2em]">Live Trust Quotient</h3>
        </div>
        
        <div className="relative w-48 h-28 flex items-end justify-center">
          <svg className="w-48 h-48 absolute top-0 -rotate-180 transform overflow-visible focus:outline-none">
            <defs>
              <linearGradient id="gaugeGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#6366f1" />       {/* Indigo */}
                <stop offset="50%" stopColor="#2dd4bf" />      {/* Teal */}
                <stop offset="100%" stopColor="#10b981" />     {/* Emerald */}
              </linearGradient>
            </defs>
            {/* Background Arc */}
            <circle
              cx="96" cy="96" r={radius}
              fill="transparent"
              stroke="#1e293b" strokeWidth="14"
              strokeDasharray={`${circumference} ${circumference}`}
              className="opacity-60"
            />
            {/* Value Arc */}
            <motion.circle
              cx="96" cy="96" r={radius}
              fill="transparent"
              stroke="url(#gaugeGradient)" strokeWidth="14"
              strokeLinecap="round"
              strokeDasharray={`${circumference} ${circumference}`}
              initial={{ strokeDashoffset: circumference }}
              animate={{ strokeDashoffset }}
              transition={{ duration: 2, ease: "easeOut", type: "spring", bounce: 0.2 }}
            />
          </svg>
          
          <div className="text-center pb-1">
            <motion.div 
               initial={{ opacity: 0, y: 10 }}
               animate={{ opacity: 1, y: 0 }}
               transition={{ delay: 0.3 }}
               className="text-5xl font-extrabold text-white tracking-tighter drop-shadow-lg"
            >
              {score}
            </motion.div>
            <div className="text-emerald-400 text-xs font-bold uppercase tracking-widest mt-1">
              {score > 600 ? 'High Trust' : score > 400 ? 'Building Trace' : 'Initializing'}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
