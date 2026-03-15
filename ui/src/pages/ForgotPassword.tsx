import { useState } from 'react';
import { Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Mail, ArrowLeft, Loader2, CheckCircle2, ShieldQuestion } from 'lucide-react';
import { motion } from 'framer-motion';
import { OrbisLogoIcon } from '@/components/Logo';
import { apiClient } from '@/utils/api';
import { RippleButton } from '@/components/ui/ripple-button';

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};
const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};
const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

export default function ForgotPassword() {
  const [email, setEmail] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) { toast.error('Please enter your email address'); return; }
    setIsSubmitting(true);
    try { await apiClient.forgotPassword(email); setSent(true); }
    catch { setSent(true); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]">
      {/* Left Panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B0822 0%, #0c1a2e 40%, #1a1145 100%)' }}
      >
        <div className="absolute top-[-100px] right-[-60px] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'rgba(27,142,229,0.15)' }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(22,118,192,0.12)' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="mb-8"><OrbisLogoIcon size="lg" /></div>
          <h1 className="text-5xl xl:text-6xl font-black text-white tracking-tight">Orbis</h1>
          <p className="text-slate-400 text-xl mt-4 font-medium tracking-wide max-w-sm">Intelligent Hiring, Simplified</p>
        </div>
      </motion.div>

      {/* Right Panel */}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-12" style={{ background: 'var(--orbis-page)' }}>
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-[420px] space-y-8"
        >
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-2">
            <OrbisLogoIcon size="md" />
            <span className="font-bold text-xl text-foreground tracking-tight">Orbis</span>
          </div>

          {sent ? (
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(52,211,153,0.1)' }}>
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Check your email</h2>
                  <p className="mt-2 text-muted-foreground text-[15px] leading-relaxed">
                    If an account exists for <strong className="text-foreground">{email}</strong>, we've sent a password reset link. It expires in 1 hour.
                  </p>
                </div>
                <p className="text-xs text-muted-foreground">Don't see it? Check your spam folder.</p>
              </div>

              <div className="space-y-3">
                <button
                  onClick={() => { setSent(false); setEmail(''); }}
                  className="w-full h-12 rounded-xl font-bold text-foreground transition-all"
                  style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
                  onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
                  onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
                >
                  Try a different email
                </button>
                <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm font-medium transition-colors duration-150 text-[#1B8EE5] hover:text-[#1676c0]">
                  <ArrowLeft className="w-4 h-4" /> Back to Sign In
                </Link>
              </div>
            </motion.div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="hidden lg:flex w-14 h-14 rounded-2xl items-center justify-center" style={{ background: 'rgba(27,142,229,0.1)' }}>
                  <ShieldQuestion className="w-7 h-7" style={{ color: '#4db5f0' }} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Forgot password?</h2>
                  <p className="mt-2 text-muted-foreground text-[15px]">Enter your email and we'll send you a link to reset your password.</p>
                </div>
              </div>

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="email" className="text-sm font-medium text-muted-foreground">Email address</label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-[18px] h-[18px] pointer-events-none" />
                    <input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@company.com"
                      autoComplete="email"
                      autoFocus
                      className="w-full pl-11 h-12 rounded-xl text-sm outline-none transition-all placeholder:text-slate-500"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>

                <RippleButton
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-xl text-[15px] font-bold text-white transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))', boxShadow: '0 8px 24px rgba(27,142,229,0.25)' }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2.5"><Loader2 className="w-[18px] h-[18px] animate-spin" /> Sending...</span>
                  ) : 'Send Reset Link'}
                </RippleButton>
              </form>

              <Link to="/login" className="flex items-center justify-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors duration-150">
                <ArrowLeft className="w-4 h-4" /> Back to Sign In
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
