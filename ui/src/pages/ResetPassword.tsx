import { useState } from 'react';
import { Link, useSearchParams, useNavigate } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Loader2, Zap, CheckCircle2, AlertCircle, KeyRound } from 'lucide-react';
import { motion } from 'framer-motion';
import { apiClient } from '@/utils/api';
import { RippleButton } from '@/components/ui/ripple-button';

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

  // Shared left panel component
  const leftPanel = (
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.8, ease: 'easeOut' }}
      className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0B1120 0%, #0f1d44 40%, #1e3a8a 100%)',
      }}
    >
      <div className="absolute top-[-100px] right-[-60px] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[140px] pointer-events-none" />
      <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] bg-indigo-500/25 rounded-full blur-[120px] pointer-events-none" />
      <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none" />
      <div className="absolute bottom-1/3 right-1/4 w-[200px] h-[200px] bg-violet-500/15 rounded-full blur-[90px] pointer-events-none" />

      <div
        className="absolute inset-0 opacity-[0.04]"
        style={{
          backgroundImage: `
            linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px),
            linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)
          `,
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 flex flex-col items-center text-center px-12">
        <div
          className="flex h-20 w-20 items-center justify-center rounded-lg shadow-2xl shadow-blue-500/30 mb-8"
          style={{
            background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
          }}
        >
          <Zap className="w-10 h-10 text-white" strokeWidth={2} />
        </div>
        <h1 className="text-5xl xl:text-6xl font-bold text-white tracking-tight">
          Orbis
        </h1>
        <p className="text-blue-200/70 text-xl mt-4 font-medium tracking-wide max-w-sm">
          Intelligent Hiring, Simplified
        </p>
      </div>
    </motion.div>
  );

  if (!token) {
    return (
      <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]">
        {leftPanel}

        <div className="flex-1 flex items-center justify-center bg-background px-6 sm:px-12 py-12">
          <motion.div
            initial={{ opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
            className="w-full max-w-[420px] space-y-8"
          >
            {/* Mobile-only Logo */}
            <div className="flex lg:hidden items-center gap-2.5 mb-2">
              <div
                className="flex h-9 w-9 items-center justify-center rounded-lg shadow-md"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                }}
              >
                <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
              </div>
              <span className="font-bold text-xl text-foreground tracking-tight">
                Orbis
              </span>
            </div>

            <div className="text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl bg-red-50 dark:bg-red-950/40 flex items-center justify-center mx-auto">
                <AlertCircle className="w-8 h-8 text-red-500 dark:text-red-400" />
              </div>
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">
                  Invalid Reset Link
                </h2>
                <p className="mt-2 text-muted-foreground text-[15px]">
                  This password reset link is invalid or missing. Please request a new one.
                </p>
              </div>
              <Link
                to="/forgot-password"
                className="inline-block px-8 py-3 rounded-lg text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                }}
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

    if (password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (password !== confirmPassword) {
      setError('Passwords do not match');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.resetPasswordWithToken(token, password);
      setSuccess(true);
      toast.success('Password reset successful!');
    } catch (err: any) {
      setError(err.message || 'Reset failed. The link may have expired.');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]">
      {leftPanel}

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 sm:px-12 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-[420px] space-y-8"
        >
          {/* Mobile-only Logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shadow-md"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              }}
            >
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-foreground tracking-tight">
              Orbis
            </span>
          </div>

          {success ? (
            /* Success State */
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              transition={{ duration: 0.4, ease: 'easeOut' }}
              className="space-y-6"
            >
              <div className="text-center space-y-4">
                <div className="w-16 h-16 rounded-2xl bg-emerald-50 dark:bg-emerald-950/40 flex items-center justify-center mx-auto">
                  <CheckCircle2 className="w-8 h-8 text-emerald-600 dark:text-emerald-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    Password Reset!
                  </h2>
                  <p className="mt-2 text-muted-foreground text-[15px]">
                    Your password has been updated successfully. You can now sign in with your new password.
                  </p>
                </div>
              </div>

              <RippleButton
                onClick={() => navigate('/login')}
                className="w-full h-12 rounded-lg text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300"
                style={{
                  background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                }}
              >
                Go to Sign In
              </RippleButton>
            </motion.div>
          ) : (
            /* Form State */
            <>
              {/* Icon + Heading */}
              <div className="space-y-4">
                <div className="hidden lg:flex w-14 h-14 rounded-2xl bg-blue-50 dark:bg-blue-950/40 items-center justify-center">
                  <KeyRound className="w-7 h-7 text-blue-600 dark:text-blue-400" />
                </div>
                <div>
                  <h2 className="text-2xl font-bold text-foreground tracking-tight">
                    Set new password
                  </h2>
                  <p className="mt-2 text-muted-foreground text-[15px]">
                    Enter your new password below.
                  </p>
                </div>
              </div>

              {error && (
                <motion.div
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="flex items-center gap-2 bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-800 text-red-700 dark:text-red-300 text-sm rounded-xl px-4 py-3"
                >
                  <AlertCircle className="w-4 h-4 shrink-0" />
                  {error}
                </motion.div>
              )}

              {/* Form */}
              <form onSubmit={handleSubmit} className="space-y-5">
                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">
                    New password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="At least 6 characters"
                      autoFocus
                      className="pl-11 pr-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="confirm" className="text-sm font-medium text-foreground">
                    Confirm new password
                  </Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                    <Input
                      id="confirm"
                      type={showPassword ? 'text' : 'password'}
                      value={confirmPassword}
                      onChange={e => setConfirmPassword(e.target.value)}
                      required
                      placeholder="Re-enter your password"
                      className="pl-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                </div>

                <RippleButton
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-lg text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{
                    background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
                  }}
                >
                  {isSubmitting ? (
                    <div className="flex items-center gap-2.5">
                      <Loader2 className="w-[18px] h-[18px] animate-spin" />
                      <span>Resetting...</span>
                    </div>
                  ) : (
                    'Reset Password'
                  )}
                </RippleButton>
              </form>

              <Link
                to="/login"
                className="block text-center text-sm text-muted-foreground hover:text-foreground font-medium transition-colors duration-150"
              >
                Back to Sign In
              </Link>
            </>
          )}
        </motion.div>
      </div>
    </div>
  );
}
