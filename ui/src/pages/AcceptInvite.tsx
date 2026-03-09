import { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { toast } from 'sonner';
import { Lock, Eye, EyeOff, Loader2, Zap, CheckCircle2, AlertCircle, UserPlus } from 'lucide-react';
import { Fade } from '@/components/ui/fade';
import { apiClient } from '@/utils/api';

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
      <div className="min-h-screen flex items-center justify-center bg-background px-4">
        <Fade direction="up" duration={0.5} blur inView={false}>
          <div className="w-full max-w-[420px]">
            <div className="bg-card rounded-2xl shadow-sm border border-border p-8 text-center">
              <div className="w-14 h-14 rounded-full bg-red-50 flex items-center justify-center mx-auto mb-4">
                <AlertCircle className="w-7 h-7 text-red-500" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-2">Invalid Invite Link</h2>
              <p className="text-sm text-muted-foreground mb-6">
                This invite link is invalid or missing. Please contact your administrator for a new invitation.
              </p>
              <Link
                to="/login"
                className="inline-block px-6 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-semibold hover:bg-blue-700 transition-colors"
              >
                Go to Sign In
              </Link>
            </div>
          </div>
        </Fade>
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
    <div className="min-h-screen flex items-center justify-center bg-background px-4">
      <Fade direction="up" duration={0.5} blur inView={false}>
        <div className="w-full max-w-[420px]">
          {/* Logo */}
          <div className="flex items-center justify-center gap-2.5 mb-8">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-blue-600 to-indigo-700 shadow-lg shadow-blue-200/50">
              <Zap className="w-5 h-5 text-white" strokeWidth={2.5} />
            </div>
            <span className="font-bold text-2xl text-foreground tracking-tight">Orbis</span>
          </div>

          <div className="bg-card rounded-2xl shadow-sm border border-border p-8">
            {success ? (
              /* -- Success State -- */
              <div className="text-center">
                <div className="w-14 h-14 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-4">
                  <CheckCircle2 className="w-7 h-7 text-emerald-600" />
                </div>
                <h2 className="text-xl font-bold text-foreground mb-2">You're All Set!</h2>
                <p className="text-sm text-muted-foreground mb-6">
                  Your account has been activated. Redirecting you to your interview dashboard...
                </p>
                <Button
                  onClick={() => navigate('/interviews')}
                  className="w-full h-12 rounded-xl text-[15px] font-semibold bg-blue-600 hover:bg-blue-700 text-white"
                >
                  Go to Dashboard
                </Button>
              </div>
            ) : (
              /* -- Form State -- */
              <>
                <div className="mb-6 text-center">
                  <div className="w-14 h-14 rounded-full bg-blue-50 flex items-center justify-center mx-auto mb-4">
                    <UserPlus className="w-7 h-7 text-blue-600" />
                  </div>
                  <h2 className="text-xl font-bold text-foreground mb-1">Set Your Password</h2>
                  <p className="text-sm text-muted-foreground">
                    You've been invited as an interviewer. Create a password to get started.
                  </p>
                </div>

                {error && (
                  <div className="flex items-center gap-2 bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 mb-5">
                    <AlertCircle className="w-4 h-4 shrink-0" />
                    {error}
                  </div>
                )}

                <form onSubmit={handleSubmit} className="space-y-5">
                  <div className="space-y-2">
                    <Label htmlFor="password" className="text-sm font-medium text-foreground">
                      Password
                    </Label>
                    <div className="relative">
                      <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-muted-foreground w-[18px] h-[18px] pointer-events-none" />
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        value={password}
                        onChange={e => setPassword(e.target.value)}
                        required
                        placeholder="At least 8 characters"
                        autoFocus
                        className="pl-11 pr-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground transition-colors"
                        tabIndex={-1}
                        aria-label={showPassword ? 'Hide password' : 'Show password'}
                      >
                        {showPassword ? <EyeOff className="w-[18px] h-[18px]" /> : <Eye className="w-[18px] h-[18px]" />}
                      </button>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="confirm" className="text-sm font-medium text-foreground">
                      Confirm password
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
                        className="pl-11 h-12 border-border rounded-xl bg-muted/80 text-foreground placeholder:text-muted-foreground focus:bg-card focus:border-blue-500 focus:ring-2 focus:ring-blue-500/20 transition-all"
                      />
                    </div>
                  </div>

                  <Button
                    type="submit"
                    disabled={isSubmitting || !password || !confirmPassword}
                    className="w-full h-12 rounded-xl text-[15px] font-semibold bg-blue-600 hover:bg-blue-700 text-white shadow-lg shadow-blue-600/25 disabled:opacity-70 disabled:cursor-not-allowed"
                  >
                    {isSubmitting ? (
                      <div className="flex items-center gap-2.5">
                        <Loader2 className="w-[18px] h-[18px] animate-spin" />
                        Setting up...
                      </div>
                    ) : (
                      'Set Password & Continue'
                    )}
                  </Button>
                </form>

                <Link
                  to="/login"
                  className="block text-center mt-5 text-sm text-muted-foreground hover:text-foreground font-medium"
                >
                  Already have an account? Sign In
                </Link>
              </>
            )}
          </div>
        </div>
      </Fade>
    </div>
  );
}
