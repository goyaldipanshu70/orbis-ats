import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/contexts/AuthContext';
import { RippleButton } from '@/components/ui/ripple-button';
import { Eye, EyeOff, Mail, Lock, User, Zap, Loader2 } from 'lucide-react';
import { motion } from 'framer-motion';

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

const Signup = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const navigate = useNavigate();
  const { toast } = useToast();
  const { signupAsCandidate, loginWithGoogle, user } = useAuth();

  useEffect(() => {
    if (user) navigate('/', { replace: true });
  }, [user, navigate]);

  if (user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    try {
      await signupAsCandidate(firstName, lastName, email, password);
      toast({ title: 'Success', description: 'Account created successfully. Please sign in.' });
      navigate('/login');
    } catch {
      toast({ title: 'Error', description: 'Failed to create account. Please try again.', variant: 'destructive' });
    } finally {
      setIsLoading(false);
    }
  };

  const handleGoogleSignup = async () => {
    try {
      await loginWithGoogle();
    } catch {
      toast({ title: 'Error', description: 'Google signup failed. Please try again.', variant: 'destructive' });
    }
  };

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]">
      {/* Left Panel */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-1/2 flex-col items-center justify-center relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, #0B0822 0%, var(--orbis-page) 40%, #1a1145 100%)' }}
      >
        <div className="absolute top-[-100px] right-[-60px] w-[500px] h-[500px] rounded-full blur-[140px] pointer-events-none" style={{ background: 'rgba(27,142,229,0.15)' }} />
        <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] rounded-full blur-[120px] pointer-events-none" style={{ background: 'rgba(22,118,192,0.12)' }} />
        <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] rounded-full blur-[100px] pointer-events-none" style={{ background: 'rgba(59,130,246,0.08)' }} />
        <div className="absolute inset-0 opacity-[0.03]" style={{ backgroundImage: 'linear-gradient(rgba(255,255,255,0.5) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.5) 1px, transparent 1px)', backgroundSize: '60px 60px' }} />

        <div className="relative z-10 flex flex-col items-center text-center px-12">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl shadow-2xl mb-8" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 20px 40px rgba(27,142,229,0.3)' }}>
            <Zap className="w-10 h-10 text-white" strokeWidth={2} />
          </div>
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
            <div className="flex h-9 w-9 items-center justify-center rounded-lg shadow-md" style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}>
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-white tracking-tight">Orbis</span>
          </div>

          <div>
            <h2 className="text-2xl font-bold text-white tracking-tight">Create your account</h2>
            <p className="mt-2 text-slate-400 text-[15px]">Join the AI-powered hiring platform</p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-5">
            <div className="grid grid-cols-2 gap-3">
              {[
                { id: 'firstName', icon: User, value: firstName, set: setFirstName, placeholder: 'First name', label: 'First name' },
                { id: 'lastName', icon: User, value: lastName, set: setLastName, placeholder: 'Last name', label: 'Last name' },
              ].map(f => (
                <div key={f.id} className="space-y-2">
                  <label htmlFor={f.id} className="text-sm font-medium text-slate-300">{f.label}</label>
                  <div className="relative">
                    <f.icon className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-[18px] h-[18px] pointer-events-none" />
                    <input
                      id={f.id}
                      type="text"
                      value={f.value}
                      onChange={e => f.set(e.target.value)}
                      required
                      placeholder={f.placeholder}
                      className="w-full pl-11 h-12 rounded-xl text-sm outline-none transition-all placeholder:text-slate-500"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                    />
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <label htmlFor="email" className="text-sm font-medium text-slate-300">Email address</label>
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
                  className="w-full pl-11 h-12 rounded-xl text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
              </div>
            </div>

            <div className="space-y-2">
              <label htmlFor="password" className="text-sm font-medium text-slate-300">Password</label>
              <div className="relative">
                <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-slate-500 w-[18px] h-[18px] pointer-events-none" />
                <input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  placeholder="Create a password"
                  autoComplete="new-password"
                  className="w-full pl-11 pr-11 h-12 rounded-xl text-sm outline-none transition-all placeholder:text-slate-500"
                  style={glassInput}
                  onFocus={handleFocus}
                  onBlur={handleBlur}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white transition-colors duration-150"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                </button>
              </div>
            </div>

            <RippleButton
              type="submit"
              disabled={isLoading}
              className="w-full h-12 rounded-xl text-[15px] font-bold text-white transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)', boxShadow: '0 8px 24px rgba(27,142,229,0.25)' }}
            >
              {isLoading ? (
                <span className="flex items-center gap-2.5"><Loader2 className="w-[18px] h-[18px] animate-spin" /> Creating account...</span>
              ) : 'Create Account'}
            </RippleButton>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full" style={{ borderTop: '1px solid var(--orbis-hover)' }} />
            </div>
            <div className="relative flex justify-center">
              <span className="px-4 text-xs text-slate-500 font-medium uppercase tracking-wider" style={{ background: 'var(--orbis-page)' }}>or continue with</span>
            </div>
          </div>

          {/* Google Button */}
          <button
            type="button"
            onClick={handleGoogleSignup}
            className="w-full h-12 rounded-xl font-medium text-slate-300 transition-all hover:text-white flex items-center justify-center gap-2"
            style={{ background: 'var(--orbis-card)', border: '1px solid var(--orbis-border)' }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-card)'; }}
          >
            <svg className="w-5 h-5" viewBox="0 0 24 24">
              <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z" />
              <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
              <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
              <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
            </svg>
            Continue with Google
          </button>

          <div className="text-center">
            <p className="text-sm text-slate-400">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold transition-colors duration-150" style={{ color: '#4db5f0' }}>Sign in</Link>
            </p>
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default Signup;
