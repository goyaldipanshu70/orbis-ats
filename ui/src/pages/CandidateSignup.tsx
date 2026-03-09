import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useAuth } from '@/contexts/AuthContext';
import { apiClient } from '@/utils/api';
import OTPInput from '@/components/OTPInput';
import DuplicateDetectedModal from '@/components/DuplicateDetectedModal';
import { RippleButton } from '@/components/ui/ripple-button';
import { toast } from 'sonner';
import {
  Eye, EyeOff, Mail, Lock, User, Zap, Briefcase, FileCheck, BarChart3, Loader2,
  Phone, ArrowLeft, CheckCircle2,
} from 'lucide-react';

type Step = 'register' | 'verify-email' | 'verify-phone';

const CandidateSignup = () => {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<Step>('register');
  const [sessionToken, setSessionToken] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [showDuplicateModal, setShowDuplicateModal] = useState(false);
  const [duplicateInfo, setDuplicateInfo] = useState<any>(null);
  const navigate = useNavigate();
  const { user, isLoading, setTokenAndFetchUser, loginWithLinkedIn } = useAuth();

  useEffect(() => {
    if (user) {
      if (user.role === 'candidate') navigate('/my-applications', { replace: true });
      else navigate('/', { replace: true });
    }
  }, [user, navigate]);

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = setTimeout(() => setResendCooldown(c => c - 1), 1000);
    return () => clearTimeout(timer);
  }, [resendCooldown]);

  const handleInitiate = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!firstName || !lastName || !email || !phone || !password) {
      toast.error('Please fill in all fields');
      return;
    }
    if (password.length < 6) {
      toast.error('Password must be at least 6 characters');
      return;
    }
    setIsSubmitting(true);
    try {
      const result = await apiClient.initiateSignup({
        first_name: firstName,
        last_name: lastName,
        email,
        phone,
        password,
      });
      setSessionToken(result.session_token);
      setStep('verify-email');
      setResendCooldown(30);
      toast.success('Verification code sent to your email');
    } catch (err: any) {
      if (err.status === 409 && err.data?.duplicate_info) {
        setDuplicateInfo(err.data.duplicate_info);
        setShowDuplicateModal(true);
      } else {
        toast.error('Signup failed', { description: err.message || 'Please try again.' });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyEmail = async (otp: string) => {
    setIsSubmitting(true);
    try {
      await apiClient.verifyEmailOTP(sessionToken, otp);
      setStep('verify-phone');
      setResendCooldown(30);
      toast.success('Email verified! Code sent to your phone.');
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleVerifyPhone = async (otp: string) => {
    setIsSubmitting(true);
    try {
      const result = await apiClient.verifyPhoneOTP(sessionToken, otp);
      localStorage.setItem('access_token', result.access_token);
      if (result.refresh_token) localStorage.setItem('refresh_token', result.refresh_token);
      await setTokenAndFetchUser(result.access_token);
      toast.success('Welcome to Orbis!', { description: 'Your account has been verified.' });
    } catch (err: any) {
      toast.error(err.message || 'Invalid code');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleResend = async () => {
    if (resendCooldown > 0) return;
    try {
      const type = step === 'verify-email' ? 'email' : 'phone';
      await apiClient.resendOTP(sessionToken, type);
      setResendCooldown(30);
      toast.success(`Code resent to your ${type}`);
    } catch (err: any) {
      toast.error(err.message || 'Failed to resend code');
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <Loader2 className="w-8 h-8 animate-spin text-blue-600" />
      </div>
    );
  }

  if (user) return null;

  const features = [
    { icon: Briefcase, title: 'Browse Open Positions', description: 'Explore all available roles at our company' },
    { icon: FileCheck, title: 'AI Resume Review', description: 'Get instant feedback on how your profile matches' },
    { icon: BarChart3, title: 'Track Applications', description: 'Monitor your application status in real-time' },
  ];

  const maskedEmail = email ? email.replace(/(.{2})(.*)(@)/, '$1***$3') : '';
  const maskedPhone = phone ? phone.replace(/(.{3})(.*)(.{2})$/, '$1***$3') : '';

  return (
    <div className="min-h-screen flex font-[Inter,system-ui,sans-serif]">
      {/* Left Panel - Gradient Hero */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8, ease: 'easeOut' }}
        className="hidden lg:flex lg:w-1/2 flex-col justify-center relative overflow-hidden"
        style={{
          background: 'linear-gradient(135deg, #0B1120 0%, #0f1d44 40%, #1e3a8a 100%)',
        }}
      >
        {/* Decorative gradient blobs */}
        <div className="absolute top-[-100px] right-[-60px] w-[500px] h-[500px] bg-blue-500/20 rounded-full blur-[140px] pointer-events-none" />
        <div className="absolute bottom-[-80px] left-[-80px] w-[400px] h-[400px] bg-indigo-500/25 rounded-full blur-[120px] pointer-events-none" />
        <div className="absolute top-1/3 left-1/4 w-[250px] h-[250px] bg-cyan-400/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute bottom-1/3 right-1/4 w-[200px] h-[200px] bg-violet-500/15 rounded-full blur-[90px] pointer-events-none" />

        {/* Subtle grid overlay */}
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

        {/* Content */}
        <div className="relative z-10 px-12 xl:px-20">
          <div className="flex items-center gap-3 mb-10">
            <div
              className="flex h-14 w-14 items-center justify-center rounded-xl shadow-2xl shadow-blue-500/30"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              }}
            >
              <Zap className="w-7 h-7 text-white" strokeWidth={2} />
            </div>
            <div>
              <h1 className="text-3xl font-bold text-white tracking-tight">Orbis</h1>
              <p className="text-blue-200/70 text-sm font-medium">Careers Portal</p>
            </div>
          </div>

          <h2 className="text-2xl font-bold text-white mb-2">Start your journey with us</h2>
          <p className="text-blue-200/60 mb-10">Create your candidate account to browse jobs, apply, and track your applications.</p>

          <div className="space-y-4">
            {features.map(({ icon: Icon, title, description }) => (
              <div key={title} className="flex items-start gap-4 p-4 rounded-xl bg-white/[0.06] border border-white/[0.1] backdrop-blur-sm">
                <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-white/10 shrink-0">
                  <Icon className="w-5 h-5 text-blue-200" />
                </div>
                <div>
                  <p className="text-white font-semibold text-sm">{title}</p>
                  <p className="text-blue-200/50 text-xs mt-0.5">{description}</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      </motion.div>

      {/* Right Panel - Form */}
      <div className="flex-1 flex items-center justify-center bg-background px-6 sm:px-12 py-12">
        <motion.div
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15, ease: 'easeOut' }}
          className="w-full max-w-[420px] space-y-8"
        >
          {/* Mobile Logo */}
          <div className="flex lg:hidden items-center gap-2.5 mb-2">
            <div
              className="flex h-9 w-9 items-center justify-center rounded-lg shadow-md"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)',
              }}
            >
              <Zap className="w-4 h-4 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-xl text-foreground tracking-tight">Orbis Careers</span>
          </div>

          {/* Step indicator */}
          {step !== 'register' && (
            <div className="flex items-center gap-3">
              {['Register', 'Email', 'Phone'].map((label, i) => {
                const stepIndex = i === 0 ? 'register' : i === 1 ? 'verify-email' : 'verify-phone';
                const currentIndex = step === 'register' ? 0 : step === 'verify-email' ? 1 : 2;
                const done = i < currentIndex;
                const active = stepIndex === step;
                return (
                  <div key={label} className="flex items-center gap-2">
                    <div className={`flex h-8 w-8 items-center justify-center rounded-full text-xs font-bold transition-colors ${
                      done ? 'bg-green-500 text-white' :
                      active ? 'bg-blue-600 text-white' :
                      'bg-muted text-muted-foreground'
                    }`}>
                      {done ? <CheckCircle2 className="h-4 w-4" /> : i + 1}
                    </div>
                    <span className={`text-xs font-medium ${active ? 'text-foreground' : 'text-muted-foreground'}`}>{label}</span>
                    {i < 2 && <div className={`w-8 h-0.5 ${done ? 'bg-green-500' : 'bg-border'}`} />}
                  </div>
                );
              })}
            </div>
          )}

          {/* Step: Register */}
          <AnimatePresence mode="wait">
          {step === 'register' && (
            <motion.div
              key="register"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
              <div className="space-y-8">
              <div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Create your account</h2>
                <p className="mt-2 text-muted-foreground text-[15px]">Sign up as a candidate to start applying</p>
              </div>

              <form onSubmit={handleInitiate} className="space-y-5">
                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-2">
                    <Label htmlFor="firstName" className="text-sm font-medium text-foreground">First name</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                      <Input
                        id="firstName"
                        value={firstName}
                        onChange={e => setFirstName(e.target.value)}
                        required
                        placeholder="First name"
                        className="pl-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="lastName" className="text-sm font-medium text-foreground">Last name</Label>
                    <div className="relative">
                      <User className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                      <Input
                        id="lastName"
                        value={lastName}
                        onChange={e => setLastName(e.target.value)}
                        required
                        placeholder="Last name"
                        className="pl-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                      />
                    </div>
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="email" className="text-sm font-medium text-foreground">Email address</Label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                    <Input
                      id="email"
                      type="email"
                      value={email}
                      onChange={e => setEmail(e.target.value)}
                      required
                      placeholder="you@example.com"
                      autoComplete="email"
                      className="pl-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone" className="text-sm font-medium text-foreground">Phone number</Label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                    <Input
                      id="phone"
                      type="tel"
                      value={phone}
                      onChange={e => setPhone(e.target.value)}
                      required
                      placeholder="+1 (555) 000-0000"
                      className="pl-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all duration-200"
                    />
                  </div>
                </div>

                <div className="space-y-2">
                  <Label htmlFor="password" className="text-sm font-medium text-foreground">Password</Label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                    <Input
                      id="password"
                      type={showPassword ? 'text' : 'password'}
                      value={password}
                      onChange={e => setPassword(e.target.value)}
                      required
                      placeholder="At least 6 characters"
                      autoComplete="new-password"
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

                <RippleButton
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full h-12 rounded-lg text-[15px] font-semibold text-white shadow-lg shadow-blue-600/25 hover:shadow-xl hover:shadow-blue-600/30 transition-all duration-300 disabled:opacity-70 disabled:cursor-not-allowed"
                  style={{ background: 'linear-gradient(135deg, #2563eb 0%, #4f46e5 100%)' }}
                >
                  {isSubmitting ? (
                    <span className="flex items-center gap-2.5">
                      <Loader2 className="w-[18px] h-[18px] animate-spin" /> Sending verification code...
                    </span>
                  ) : (
                    'Create Candidate Account'
                  )}
                </RippleButton>
              </form>

              {/* Divider */}
              <div className="relative">
                <div className="absolute inset-0 flex items-center">
                  <div className="w-full border-t border-border" />
                </div>
                <div className="relative flex justify-center">
                  <span className="px-4 bg-background text-xs text-muted-foreground font-medium uppercase tracking-wider">
                    or continue with
                  </span>
                </div>
              </div>

              {/* LinkedIn Button */}
              <Button
                type="button"
                variant="outline"
                onClick={() => loginWithLinkedIn()}
                className="w-full h-12 rounded-lg border-border text-foreground font-medium hover:bg-muted/50 hover:border-border hover:shadow-sm transition-all duration-200"
              >
                <svg className="w-5 h-5 mr-3" viewBox="0 0 24 24">
                  <path
                    fill="#0A66C2"
                    d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"
                  />
                </svg>
                Continue with LinkedIn
              </Button>
              </div>
            </motion.div>
          )}

          {/* Step: Verify Email */}
          {step === 'verify-email' && (
            <motion.div
              key="verify-email"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
            <div className="space-y-6">
              <button onClick={() => setStep('register')} className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground font-medium transition-colors duration-150">
                <ArrowLeft className="h-4 w-4" /> Back
              </button>
              <div className="text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-50 dark:bg-blue-950/40 mx-auto">
                  <Mail className="h-8 w-8 text-blue-600 dark:text-blue-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Verify your email</h2>
                <p className="text-muted-foreground text-[15px]">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{maskedEmail}</span>
                </p>
              </div>

              <OTPInput onComplete={handleVerifyEmail} disabled={isSubmitting} />

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-sm text-blue-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying...
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className={`text-sm transition-colors duration-150 ${resendCooldown > 0 ? 'text-muted-foreground' : 'text-blue-600 hover:text-blue-700 font-medium'}`}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>
            </motion.div>
          )}

          {/* Step: Verify Phone */}
          {step === 'verify-phone' && (
            <motion.div
              key="verify-phone"
              initial={{ opacity: 0, x: 30 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -30 }}
              transition={{ duration: 0.3 }}
            >
            <div className="space-y-6">
              <div className="text-center space-y-3">
                <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-green-50 dark:bg-green-950/40 mx-auto">
                  <Phone className="h-8 w-8 text-green-600 dark:text-green-400" />
                </div>
                <h2 className="text-2xl font-bold text-foreground tracking-tight">Verify your phone</h2>
                <p className="text-muted-foreground text-[15px]">
                  We sent a 6-digit code to <span className="font-medium text-foreground">{maskedPhone}</span>
                </p>
              </div>

              <OTPInput onComplete={handleVerifyPhone} disabled={isSubmitting} />

              {isSubmitting && (
                <div className="flex items-center justify-center gap-2 text-sm text-green-600">
                  <Loader2 className="h-4 w-4 animate-spin" /> Verifying & creating your account...
                </div>
              )}

              <div className="text-center">
                <button
                  onClick={handleResend}
                  disabled={resendCooldown > 0}
                  className={`text-sm transition-colors duration-150 ${resendCooldown > 0 ? 'text-muted-foreground' : 'text-blue-600 hover:text-blue-700 font-medium'}`}
                >
                  {resendCooldown > 0 ? `Resend code in ${resendCooldown}s` : 'Resend code'}
                </button>
              </div>
            </div>
            </motion.div>
          )}
          </AnimatePresence>

          <div className="text-center space-y-2">
            <p className="text-sm text-muted-foreground">
              Already have an account?{' '}
              <Link to="/login" className="text-blue-600 font-semibold hover:text-blue-700 transition-colors duration-150">Sign In</Link>
            </p>
            <p className="text-sm text-muted-foreground">
              Are you an employee?{' '}
              <Link to="/signup" className="text-blue-600 font-medium hover:text-blue-700 transition-colors duration-150">Employee Sign Up</Link>
            </p>
          </div>
        </motion.div>
      </div>

      {/* Duplicate Modal */}
      {duplicateInfo && (
        <DuplicateDetectedModal
          isOpen={showDuplicateModal}
          onClose={() => setShowDuplicateModal(false)}
          duplicateInfo={duplicateInfo}
        />
      )}
    </div>
  );
};

export default CandidateSignup;
