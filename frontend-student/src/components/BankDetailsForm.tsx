import { useState } from 'react';
import { motion } from 'framer-motion';
import { Lock, CheckCircle2, AlertCircle } from 'lucide-react';
import type { BankDetails } from '../types/state';

interface BankDetailsFormProps {
  onSubmit: (bankDetails: BankDetails) => Promise<void>;
  isLoading?: boolean;
}

export function BankDetailsForm({ onSubmit, isLoading = false }: BankDetailsFormProps) {
  const [formData, setFormData] = useState({
    accountHolderName: '',
    bankName: '',
    lastFourDigits: '',
  });
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement>) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
    setError('');
  };

  const generateTokenId = (): string => {
    // Simulated token generation (bank_tok_XXXXXX format)
    const random = Math.random().toString(36).substring(2, 8).toUpperCase();
    return `bank_tok_${random}`;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setSubmitting(true);

    try {
      if (!formData.accountHolderName.trim()) {
        throw new Error('Account holder name is required');
      }
      if (!formData.bankName.trim()) {
        throw new Error('Bank name is required');
      }
      if (!/^\d{4}$/.test(formData.lastFourDigits)) {
        throw new Error('Please enter exactly 4 digits');
      }

      const bankDetails: BankDetails = {
        accountHolderName: formData.accountHolderName.trim(),
        bankName: formData.bankName.trim(),
        maskedAccount: `XXXX${formData.lastFourDigits}`,
        tokenized_account_id: generateTokenId(),
        verifiedAt: new Date().toISOString(),
      };

      await onSubmit(bankDetails);
      setSuccess(true);
      setFormData({
        accountHolderName: '',
        bankName: '',
        lastFourDigits: '',
      });

      // Reset success message after 3 seconds
      setTimeout(() => setSuccess(false), 3000);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save bank details');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="w-full max-w-md mx-auto p-6 rounded-2xl bg-slate-900/50 border border-slate-800/50 backdrop-blur-sm"
    >
      <div className="flex items-center space-x-3 mb-6">
        <div className="p-2 rounded-lg bg-indigo-500/10 border border-indigo-500/30">
          <Lock className="w-5 h-5 text-indigo-400" />
        </div>
        <div>
          <h3 className="text-lg font-bold text-white">Bank Account Details</h3>
          <p className="text-xs text-slate-400">Secure one-time setup</p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        {/* Account Holder Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Account Holder Name
          </label>
          <input
            type="text"
            name="accountHolderName"
            value={formData.accountHolderName}
            onChange={handleChange}
            placeholder="e.g., Arjun Kumar"
            disabled={submitting || isLoading}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
          />
        </div>

        {/* Bank Name */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Bank Name
          </label>
          <select
            name="bankName"
            value={formData.bankName}
            onChange={handleChange}
            disabled={submitting || isLoading}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
          >
            <option value="">Select your bank</option>
            <option value="HDFC">HDFC Bank</option>
            <option value="ICICI">ICICI Bank</option>
            <option value="SBI">State Bank of India</option>
            <option value="Axis">Axis Bank</option>
            <option value="Kotak">Kotak Mahindra</option>
            <option value="IDBI">IDBI Bank</option>
            <option value="IndusInd">IndusInd Bank</option>
            <option value="YES">YES Bank</option>
            <option value="Other">Other Bank</option>
          </select>
        </div>

        {/* Last 4 Digits */}
        <div>
          <label className="block text-sm font-medium text-slate-300 mb-2">
            Last 4 Digits of Account
          </label>
          <input
            type="text"
            name="lastFourDigits"
            value={formData.lastFourDigits}
            onChange={handleChange}
            placeholder="e.g., 1234"
            maxLength={4}
            disabled={submitting || isLoading}
            className="w-full px-4 py-2.5 rounded-lg bg-slate-800/80 border border-slate-700 text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-indigo-500 focus:border-transparent transition-all disabled:opacity-50"
          />
          <p className="text-xs text-slate-500 mt-1">Only last 4 digits required for security</p>
        </div>

        {/* Error Message */}
        {error && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg bg-rose-500/10 border border-rose-500/30 flex items-start space-x-2"
          >
            <AlertCircle className="w-4 h-4 text-rose-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-rose-300">{error}</p>
          </motion.div>
        )}

        {/* Success Message */}
        {success && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/30 flex items-start space-x-2"
          >
            <CheckCircle2 className="w-4 h-4 text-emerald-400 flex-shrink-0 mt-0.5" />
            <p className="text-sm text-emerald-300">Bank details saved securely!</p>
          </motion.div>
        )}

        {/* Security Notice */}
        <div className="p-3 rounded-lg bg-slate-800/50 border border-slate-700/50">
          <p className="text-xs text-slate-400">
            🔒 Your account details are encrypted and tokenized. We never store full account numbers.
          </p>
        </div>

        {/* Submit Button */}
        <button
          type="submit"
          disabled={submitting || isLoading}
          className="w-full py-3 rounded-lg bg-indigo-600 hover:bg-indigo-700 disabled:bg-slate-700 text-white font-semibold transition-all active:scale-95 disabled:opacity-50"
        >
          {submitting || isLoading ? 'Saving...' : 'Save Bank Details'}
        </button>
      </form>
    </motion.div>
  );
}
