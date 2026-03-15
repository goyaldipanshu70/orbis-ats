import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';
import {
  Eye,
  EyeOff,
  Loader2,
  Users,
  Sparkles,
  Zap,
} from 'lucide-react';
import { motion } from 'framer-motion';
import { OrbisLogoIcon } from '@/components/Logo';

const Login = () => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const navigate = useNavigate();
  const { login, loginWithGoogle, loginWithLinkedIn, user, isLoading } = useAuth();

  useEffect(() => {
    if (user) {
      navigate('/', { replace: true });
    }
  }, [user, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    setIsSubmitting(true);
    try {
      await login(email, password);
      toast.success('Welcome back!', {
        description: 'You have been signed in successfully.',
      });
    } catch {
      toast.error('Sign in failed', {
        description: 'Invalid email or password. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleGoogleLogin = async () => {
    try {
      await loginWithGoogle();
    } catch {
      toast.error('Google sign in failed', {
        description: 'Something went wrong. Please try again.',
      });
    }
  };

  const handleLinkedInLogin = async () => {
    try {
      await loginWithLinkedIn();
    } catch {
      toast.error('LinkedIn sign in failed', {
        description: 'Something went wrong. Please try again.',
      });
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center" style={{ background: 'var(--orbis-page)' }} role="status" aria-label="Loading">
        <Loader2 aria-hidden="true" className="w-8 h-8 animate-spin text-blue-400" />
      </div>
    );
  }

  if (user) {
    return null;
  }

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif] antialiased overflow-x-hidden">
      {/* ══════════ Left Panel — Branding ══════════ */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="hidden lg:flex w-[55%] flex-col justify-between p-16 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #051D2E 0%, #0c3a5e 50%, #1B8EE5 100%)' }}
      >
        {/* Animated mesh grid */}
        <div
          className="absolute inset-0 opacity-20"
          style={{
            backgroundImage: 'linear-gradient(var(--orbis-input) 1px, transparent 1px), linear-gradient(90deg, var(--orbis-input) 1px, transparent 1px)',
            backgroundSize: '60px 60px',
            animation: 'mesh-move 10s ease-in-out infinite',
          }}
        />

        {/* Glow blobs */}
        <div className="absolute top-1/4 left-1/4 w-[500px] h-[500px] bg-cyan-500/20 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[400px] h-[400px] bg-blue-600/30 rounded-full blur-[100px] pointer-events-none" />

        {/* Top — Logo + Brand */}
        <div className="relative z-10">
          <div className="flex items-center gap-5">
            <OrbisLogoIcon size="lg" />
            <div className="flex flex-col">
              <span className="text-white text-4xl font-black tracking-tighter leading-none">ORBIS</span>
              <span className="text-blue-200/60 text-xs font-bold tracking-[0.2em] uppercase mt-1">Enterprise ATS</span>
            </div>
          </div>

          <div className="mt-24 max-w-xl">
            <h2 className="text-white text-6xl xl:text-7xl font-extrabold tracking-tight leading-[1.1]">
              Intelligent Hiring,{' '}
              <br />
              <span
                className="bg-clip-text text-transparent"
                style={{ backgroundImage: 'linear-gradient(to right, #fde68a, #fdba74, #fda4af)' }}
              >
                Simplified.
              </span>
            </h2>
            <p className="mt-8 text-indigo-100/80 text-xl font-medium leading-relaxed max-w-md">
              The premium platform for enterprise HR. Powering the world's fastest growing teams with AI precision.
            </p>
          </div>
        </div>

        {/* Bottom — Glassmorphism stat cards */}
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.7, delay: 0.3, ease: 'easeOut' }}
          className="relative z-10 grid grid-cols-2 gap-6 w-full max-w-2xl mb-12"
        >
          <div
            className="rounded-3xl p-8 shadow-2xl flex flex-col gap-4 transform hover:-translate-y-1 transition-transform duration-500"
            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Users className="w-5 h-5 text-cyan-300" />
            </div>
            <div>
              <p className="text-white text-3xl font-bold tracking-tight">2.4M+</p>
              <p className="text-blue-200/70 text-sm font-semibold uppercase tracking-wider">Candidates Processed</p>
            </div>
          </div>

          <div
            className="rounded-3xl p-8 shadow-2xl flex flex-col gap-4 translate-y-12 transform hover:translate-y-11 transition-transform duration-500"
            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="w-12 h-12 rounded-full bg-white/10 flex items-center justify-center">
              <Sparkles className="w-5 h-5 text-amber-300" />
            </div>
            <div>
              <p className="text-white text-3xl font-bold tracking-tight">94%</p>
              <p className="text-blue-200/70 text-sm font-semibold uppercase tracking-wider">AI Accuracy</p>
            </div>
          </div>

          <div
            className="col-span-2 rounded-3xl p-8 shadow-2xl flex items-center justify-between group cursor-default"
            style={{ background: 'rgba(255,255,255,0.08)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid rgba(255,255,255,0.12)' }}
          >
            <div className="flex flex-col gap-1">
              <p className="text-white text-4xl font-bold tracking-tight">50% Faster</p>
              <p className="text-blue-200/70 text-base font-medium">Time-to-Hire for Enterprise Teams</p>
            </div>
            <div className="w-16 h-16 rounded-2xl bg-blue-500/20 flex items-center justify-center border border-white/10 group-hover:scale-110 transition-transform">
              <Zap className="w-7 h-7 text-white" />
            </div>
          </div>
        </motion.div>

        {/* Footer */}
        <div className="relative z-10 flex items-center gap-8 text-xs text-blue-200/40 font-bold uppercase tracking-widest">
          <span>&copy; {new Date().getFullYear()} Orbis Global</span>
          <a href="#" className="hover:text-white transition-colors">Security</a>
          <a href="#" className="hover:text-white transition-colors">Privacy</a>
        </div>
      </motion.div>

      {/* ══════════ Right Panel — Login Form ══════════ */}
      <div
        className="w-full lg:w-[45%] flex flex-col justify-center items-center p-8 sm:p-20 relative"
        style={{ background: 'var(--orbis-page)' }}
      >
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-[420px] flex flex-col"
        >
          {/* Mobile-only Logo */}
          <div className="lg:hidden flex items-center gap-3 mb-12">
            <OrbisLogoIcon size="md" />
            <h1 className="text-foreground text-2xl font-black tracking-tight uppercase">Orbis</h1>
          </div>

          {/* Heading */}
          <div className="mb-10">
            <h2 className="text-foreground text-4xl font-extrabold tracking-tight mb-3">Welcome back</h2>
            <p className="text-muted-foreground text-lg">Enter your credentials to access Orbis.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="space-y-6">
            {/* Email */}
            <div className="space-y-2">
              <label htmlFor="email" className="text-xs font-bold uppercase tracking-widest text-muted-foreground ml-1">
                Work Email
              </label>
              <input
                id="email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                placeholder="name@company.com"
                autoComplete="email"
                className="w-full h-14 px-5 rounded-2xl text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-300"
                style={{
                  background: 'var(--orbis-input)',
                  backdropFilter: 'blur(8px)',
                  border: '1px solid var(--orbis-border)',
                }}
                onFocus={(e) => {
                  e.target.style.background = 'var(--orbis-hover)';
                  e.target.style.borderColor = '#1B8EE5';
                  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
                }}
                onBlur={(e) => {
                  e.target.style.background = 'var(--orbis-input)';
                  e.target.style.borderColor = 'var(--orbis-border)';
                  e.target.style.boxShadow = 'none';
                }}
              />
            </div>

            {/* Password */}
            <div className="space-y-2">
              <div className="flex justify-between items-center px-1">
                <label htmlFor="password" className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                  Password
                </label>
                <Link
                  to="/forgot-password"
                  className="text-xs font-bold text-[#1B8EE5] hover:text-[#1676c0] transition-colors uppercase tracking-widest"
                >
                  Forgot?
                </Link>
              </div>
              <div className="relative">
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                  placeholder="••••••••"
                  autoComplete="current-password"
                  className="w-full h-14 px-5 pr-12 rounded-2xl text-foreground placeholder:text-muted-foreground/50 outline-none transition-all duration-300"
                  style={{
                    background: 'var(--orbis-input)',
                    backdropFilter: 'blur(8px)',
                    border: '1px solid var(--orbis-border)',
                  }}
                  onFocus={(e) => {
                    e.target.style.background = 'var(--orbis-hover)';
                    e.target.style.borderColor = '#1676c0';
                    e.target.style.boxShadow = '0 0 20px rgba(22,118,192,0.15)';
                  }}
                  onBlur={(e) => {
                    e.target.style.background = 'var(--orbis-input)';
                    e.target.style.borderColor = 'var(--orbis-border)';
                    e.target.style.boxShadow = 'none';
                  }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-4 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors duration-150"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? (
                    <EyeOff aria-hidden="true" className="w-[18px] h-[18px]" />
                  ) : (
                    <Eye aria-hidden="true" className="w-[18px] h-[18px]" />
                  )}
                </button>
              </div>
            </div>

            {/* Sign In Button */}
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full h-14 rounded-2xl font-bold text-lg text-white transform active:scale-[0.98] transition-all duration-200 mt-2 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{
                background: 'linear-gradient(to right, var(--orbis-accent), var(--orbis-accent-dark))',
                boxShadow: '0 10px 30px rgba(27,142,229,0.3)',
              }}
            >
              {isSubmitting ? (
                <div className="flex items-center justify-center gap-2.5">
                  <Loader2 aria-hidden="true" className="w-[18px] h-[18px] animate-spin" />
                  <span>Signing in...</span>
                </div>
              ) : (
                'Sign In'
              )}
            </button>
          </form>

          {/* Divider */}
          <div className="relative flex items-center my-10">
            <div className="flex-grow border-t" style={{ borderColor: 'var(--orbis-border)' }} />
            <span className="px-4 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
              Or continue with
            </span>
            <div className="flex-grow border-t" style={{ borderColor: 'var(--orbis-border)' }} />
          </div>

          {/* Social Login Buttons */}
          <div className="grid grid-cols-2 gap-4">
            <button
              type="button"
              onClick={handleGoogleLogin}
              className="h-14 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/5 transition-all group"
              style={{ background: 'var(--orbis-card)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid var(--orbis-border)' }}
            >
              <svg aria-hidden="true" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              <span className="text-sm font-bold text-foreground">Google</span>
            </button>

            <button
              type="button"
              onClick={handleLinkedInLogin}
              className="h-14 rounded-2xl flex items-center justify-center gap-3 hover:bg-white/5 transition-all group"
              style={{ background: 'var(--orbis-card)', backdropFilter: 'blur(20px) saturate(180%)', border: '1px solid var(--orbis-border)' }}
            >
              <svg aria-hidden="true" className="w-5 h-5 opacity-80 group-hover:opacity-100 transition-opacity" fill="#0A66C2" viewBox="0 0 24 24">
                <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
              </svg>
              <span className="text-sm font-bold text-foreground">LinkedIn</span>
            </button>
          </div>

          {/* Sign Up Links */}
          <div className="mt-12 flex flex-col items-center gap-3 text-sm">
            <p className="text-muted-foreground">
              Don't have an account?{' '}
              <Link to="/signup" className="text-[#1B8EE5] font-bold hover:text-[#1676c0] transition-colors">
                Sign up
              </Link>
            </p>
            <Link
              to="/careers"
              className="px-8 h-10 flex items-center justify-center rounded-full border text-[#1B8EE5] hover:bg-[#1B8EE5]/10 transition-colors font-bold uppercase tracking-widest text-[10px]"
              style={{ borderColor: 'var(--orbis-border)' }}
            >
              Browse Careers
            </Link>
          </div>
        </motion.div>
      </div>

      {/* Keyframe animation for mesh grid */}
      <style>{`
        @keyframes mesh-move {
          0% { transform: translateY(0px) rotate(0deg); }
          50% { transform: translateY(-20px) rotate(1deg); }
          100% { transform: translateY(0px) rotate(0deg); }
        }
      `}</style>
    </div>
  );
};

export default Login;
