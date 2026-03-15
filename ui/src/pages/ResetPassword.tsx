import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
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

const leftPanel = (
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
);

const mobileLogo = (
  <div className="flex lg:hidden items-center gap-2.5 mb-2">
    <OrbisLogoIcon size="md" />
    <span className="font-bold text-xl text-foreground tracking-tight">Orbis</span>
  </div>
);

export default function ResetPassword() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const token = searchParams.get('token');

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]">
        {leftPanel}
        <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-12" style={{ background: 'var(--orbis-page)' }}>
          <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} className="w-full max-w-[420px] space-y-8">
            {mobileLogo}
            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(244,63,94,0.1)' }}>
                <AlertCircle className="w-8 h-8 text-rose-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Invalid Reset Link</h2>
                <p className="mt-2 text-muted-foreground text-[15px]">This password reset link is invalid or missing. Please request a new one.</p>
              </div>
              <Link
                to="/forgot-password"
                className="inline-block px-8 py-3 rounded-xl text-[15px] font-bold text-white transition-all hover:scale-105"
                style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))', boxShadow: '0 8px 24px rgba(27,142,229,0.25)' }}
              >
                Request New Link
              </Link>
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (password.length < 6) { setError('Password must be at least 6 characters'); return; }
    if (password !== confirmPassword) { setError('Passwords do not match'); return; }
    setIsSubmitting(true);
    try { await apiClient.resetPasswordWithToken(token, password); setSuccess(true); toast.success('Password reset successful!'); }
    catch (err: any) { setError(err.message || 'Reset failed. The link may have expired.'); }
    finally { setIsSubmitting(false); }
  };

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]">
      {leftPanel}
      <div className="flex-1 flex items-center justify-center px-6 sm:px-12 py-12" style={{ background: 'var(--orbis-page)' }}>
        <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.15 }} className="w-full max-w-[420px] space-y-8">
          {mobileLogo}

          {success ? (
            <motion.div initial={{ opacity: 0, scale: 0.95 }} animate={{ opacity: 1, scale: 1 }} transition={{ duration: 0.4 }} className="space-y-6">
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl flex items-center justify-center mx-auto" style={{ background: 'rgba(52,211,153,0.1)' }}>
                  <CheckCircle2 className="w-8 h-8 text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Password Reset!</h2>
                  <p className="mt-2 text-muted-foreground text-[15px]">Your password has been updated successfully.</p>
                </div>
              </div>
              <RippleButton
                onClick={() => navigate('/login')}
                className="w-full h-12 rounded-xl text-[15px] font-bold text-white transition-all duration-300"
                style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))', boxShadow: '0 8px 24px rgba(27,142,229,0.25)' }}
              >
                Go to Sign In
              </RippleButton>
            </motion.div>
          ) : (
            <>
              <div className="space-y-4">
                <div className="hidden lg:flex w-14 h-14 rounded-2xl items-center justify-center" style={{ background: 'rgba(27,142,229,0.1)' }}>
                  <KeyRound className="w-7 h-7" style={{ color: '#4db5f0' }} />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">Set new password</h2>
                  <p className="mt-2 text-muted-foreground text-[15px]">Enter your new password below.</p>
                </div>
              </div>

              {error && (
                <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="flex items-center gap-2 rounded-xl px-4 py-3 text-sm" style={{ background: 'rgba(244,63,94,0.08)', border: '1px solid rgba(244,63,94,0.2)', color: '#fb7185' }}>
                  <AlertCircle className="w-4 h-4 shrink-0" /> {error}
                </motion.div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-muted-foreground">New password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-[18px] h-[18px] pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="At least 6 characters"
                      autoFocus
                      className="w-full pl-11 pr-11 h-12 rounded-xl text-sm outline-none transition-all placeholder:text-slate-500"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <button type="button" onClick={() => setShowPassword(!showPassword)} className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors" tabIndex={-1}>
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm" className="text-sm font-medium text-muted-foreground">Confirm new password</label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-[18px] h-[18px] pointer-events-none" />
                    <input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter your password"
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
                    <span className="flex items-center gap-2.5"><Loader2 className="w-[18px] h-[18px] animate-spin" /> Resetting...</span>
                  ) : 'Reset Password'}
                </RippleButton>
              </form>

              <Link to="/login" className="block text-center text-sm text-muted-foreground hover:text-foreground font-medium transition-colors duration-150">
                Back to Sign In
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
