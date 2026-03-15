import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react';
import { OrbisLogoIcon } from '@/components/Logo';
import { apiClient } from '@/utils/api';

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

export default function AcceptInvite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();

  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');

  if (!token) {
    return (
      <div className="min-h-screen flex items-center justify-center px-4" style={{ background: 'var(--orbis-page)' }}>
        <div className="w-full max-w-[420px]">
          <div className="rounded-2xl p-8 text-center" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
            <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(239,68,68,0.1)' }}>
              <AlertCircle className="w-7 h-7 text-red-400" />
            </div>
            <h2 className="text-xl font-bold text-white mb-2">Invalid Invite Link</h2>
            <p className="text-sm text-slate-400 mb-6">
              This invite link is invalid or missing. Please contact your administrator for a new invitation.
            </p>
            <Link
              to="/login"
              className="inline-block px-6 py-2.5 rounded-xl text-sm font-semibold text-white transition-all"
              style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))' }}
            >
              Go to Sign In
            </Link>
          </div>
        </div>
      </div>
    );
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (password.length < 8) {
      setError('Password must be at least 8 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      const result = await apiClient.acceptInvite(token, password);
      localStorage.setItem('access_token', result.access_token);
      setSuccess(true);
      toast.success('Welcome!', {
        description: 'Your account is set up. Redirecting to your dashboard...',
      });
      setTimeout(() => navigate('/interviews'), 1500);
    } catch (err: any) {
      setError(err.message || 'Failed to accept invite. The link may have expired.');
      toast.error('Failed to set password', {
        description: 'Please try again or contact your administrator.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center px-4 relative overflow-hidden" style={{ background: 'var(--orbis-page)' }}>
      {/* Ambient glow */}
      <div className="fixed top-[-20%] left-[-10%] w-[500px] h-[500px] rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(27,142,229,0.08)' }} />
      <div className="fixed bottom-[-20%] right-[-10%] w-[400px] h-[400px] rounded-full blur-3xl pointer-events-none" style={{ background: 'rgba(22,118,192,0.06)' }} />

      <div className="w-full max-w-[420px] relative z-10">
        {/* Logo */}
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <OrbisLogoIcon size="md" />
          <span className="font-bold text-2xl text-white tracking-tight">Orbis</span>
        </div>

        <div className="rounded-2xl p-8" style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}>
          {success ? (
            /* -- Success State -- */
            <div className="text-center">
              <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(16,185,129,0.1)' }}>
                <CheckCircle2 className="w-7 h-7 text-emerald-400" />
              </div>
              <h2 className="text-xl font-bold text-white mb-2">You're All Set!</h2>
              <p className="text-sm text-slate-400 mb-6">
                Your account has been activated. Redirecting you to your interview dashboard...
              </p>
              <button
                onClick={() => navigate('/interviews')}
                className="w-full h-12 rounded-xl text-[15px] font-semibold text-white transition-all"
                style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
              >
                Go to Dashboard
              </button>
            </div>
          ) : (
            /* -- Form State -- */
            <>
              <div className="mb-6 text-center">
                <div className="w-14 h-14 rounded-full flex items-center justify-center mx-auto mb-4" style={{ background: 'rgba(27,142,229,0.1)' }}>
                  <UserPlus className="w-7 h-7 text-blue-400" />
                </div>
                <h2 className="text-xl font-bold text-white mb-1">Set Your Password</h2>
                <p className="text-sm text-slate-400">
                  You've been invited as an interviewer. Create a password to get started.
                </p>
              </div>

              {error && (
                <div className="flex items-center gap-2 text-sm rounded-xl px-4 py-3 mb-5" style={{ background: 'rgba(239,68,68,0.08)', border: '1px solid rgba(239,68,68,0.2)', color: '#f87171' }}>
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </div>
              )}

              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <label htmlFor="password" className="text-sm font-medium text-slate-300">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-[18px] h-[18px] pointer-events-none" />
                    <input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="At least 8 characters"
                      autoFocus
                      className="w-full pl-11 pr-11 h-12 rounded-xl text-sm placeholder:text-slate-500 transition-all outline-none"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <label htmlFor="confirm" className="text-sm font-medium text-slate-300">
                    Confirm password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-[18px] h-[18px] pointer-events-none" />
                    <input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter your password"
                      className="w-full pl-11 h-12 rounded-xl text-sm placeholder:text-slate-500 transition-all outline-none"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isSubmitting || !password || !confirmPassword}
                  className="w-full h-12 rounded-xl text-[15px] font-semibold text-white transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))', boxShadow: '0 4px 20px rgba(27,142,229,0.25)' }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center justify-center gap-2.5">
                      <Loader2 className="w-[18px] h-[18px] animate-spin" />
                      Setting up...
                    </span>
                  ) : (
                    'Set Password & Continue'
                  )}
                </button>
              </form>

              <Link
                to="/login"
                className="block text-center mt-5 text-sm font-medium transition-colors"
                style={{ color: '#4db5f0' }}
              >
                Already have an account? Sign In
              </Link>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
