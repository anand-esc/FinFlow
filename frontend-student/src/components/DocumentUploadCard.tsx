import { motion } from 'framer-motion';
import { UploadCloud, CheckCircle, FileText, Loader2 } from 'lucide-react';

import { useRef } from 'react';
import { uploadBytesResumable, getDownloadURL, ref } from 'firebase/storage';
import { storage } from '../lib/firebase';
import { useAuth } from '../contexts/AuthContext';

interface Props {
  title: string;
  subtitle: string;
  onUploadComplete: (url: string) => void;
  status: 'IDLE' | 'PROCESSING' | 'VERIFIED';
}

export function DocumentUploadCard({ title, subtitle, onUploadComplete, status }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuth();

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    // We will simulate the "PROCESSING" state while uploading
    const storageRef = ref(storage, `documents/${user.uid}/${Date.now()}_${file.name}`);
    const uploadTask = uploadBytesResumable(storageRef, file);

    uploadTask.on(
      'state_changed',
      (_snapshot) => {
        // We could track progress here, but for Hackathon speed, we let the parent handle 'PROCESSING' CSS state
      },
      (error) => {
        console.error("Upload failed", error);
      },
      async () => {
        const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
        onUploadComplete(downloadURL);
      }
    );
  };

  const handleCardClick = () => {
    if (status === 'IDLE' && fileInputRef.current) {
         fileInputRef.current.click();
    }
  };

  return (
    <motion.div 
       whileHover={{ scale: status === 'IDLE' ? 1.02 : 1 }}
       whileTap={{ scale: status === 'IDLE' ? 0.98 : 1 }}
       onClick={handleCardClick}
       className={`relative overflow-hidden rounded-2xl p-5 border transition-all duration-300 ${
         status === 'VERIFIED' ? 'bg-[#0a231b] border-emerald-500/30 shadow-[0_0_20px_rgba(16,185,129,0.05)]' :
         status === 'PROCESSING' ? 'bg-[#12163b] border-indigo-500/30' :
         'bg-slate-800/30 border-slate-700/50 hover:bg-slate-800/60 hover:shadow-lg hover:border-slate-600/50 cursor-pointer'
       }`}
    >
      <div className="flex items-center justify-between relative z-10">
         <div className="flex items-center space-x-4">
            <div className={`w-12 h-12 rounded-2xl flex items-center justify-center transition-colors shadow-inner ${
               status === 'VERIFIED' ? 'bg-emerald-500/20 text-emerald-400' :
               status === 'PROCESSING' ? 'bg-indigo-500/20 text-indigo-400' :
               'bg-slate-700/40 text-slate-400'
            }`}>
               {status === 'VERIFIED' ? <CheckCircle className="w-6 h-6" /> :
                status === 'PROCESSING' ? <Loader2 className="w-6 h-6 animate-spin" /> :
                <FileText className="w-6 h-6" />}
            </div>
            <div>
               <h4 className="text-slate-100 font-semibold text-base tracking-tight">{title}</h4>
               <p className="text-slate-400 text-sm mt-0.5">{status === 'PROCESSING' ? 'Data Intel Agent Analyzing...' : subtitle}</p>
            </div>
         </div>
         {status === 'IDLE' && (
            <div className="w-9 h-9 rounded-full bg-slate-700/30 flex items-center justify-center group-hover:bg-indigo-500/20 transition-colors">
               <UploadCloud className="w-4 h-4 text-slate-300" />
            </div>
         )}
      </div>

      {status === 'PROCESSING' && (
         <motion.div 
            initial={{ width: "0%" }}
            animate={{ width: "100%" }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
            className="absolute bottom-0 left-0 h-1 bg-gradient-to-r from-indigo-600 to-emerald-400"
         />
      )}
      <input 
         type="file" 
         ref={fileInputRef} 
         onChange={handleFileChange} 
         className="hidden" 
         accept="image/*,application/pdf" 
         capture="environment"
      />
    </motion.div>
  );
}
