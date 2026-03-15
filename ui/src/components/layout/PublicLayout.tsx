import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { LogIn, UserPlus } from 'lucide-react';
import { OrbisLogoIcon } from '@/components/Logo';
import { motion } from 'framer-motion';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen" style={{ background: 'var(--orbis-page)' }}>
      {/* Top Navigation */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="sticky top-0 z-50"
        style={{
          background: 'var(--orbis-overlay)',
          backdropFilter: 'blur(16px)',
          borderBottom: '1px solid var(--orbis-border)',
        }}
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/careers" className="flex items-center gap-2.5">
            <OrbisLogoIcon size="md" />
            <div>
              <p className="text-sm font-bold tracking-tight text-white">Orbis</p>
              <p className="text-[10px] text-slate-500">Careers</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden sm:flex items-center gap-6">
            <Link to="/careers" className="text-sm font-medium text-slate-400 hover:text-white transition-colors">
              Jobs
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <button
                onClick={() => navigate(user.role === 'candidate' ? '/my-applications' : '/')}
                className="rounded-lg text-white text-sm font-medium px-4 py-2 transition-all"
                style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))' }}
              >
                {user.role === 'candidate' ? 'My Applications' : 'Dashboard'}
              </button>
            ) : (
              <>
                <button
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium text-slate-400 hover:text-white transition-colors flex items-center gap-1.5 px-3 py-2"
                >
                  <LogIn className="h-4 w-4" />
                  Sign In
                </button>
                <button
                  onClick={() => navigate('/careers/signup')}
                  className="rounded-lg text-white text-sm font-medium px-4 py-2 flex items-center gap-1.5 transition-all"
                  style={{ background: 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))' }}
                >
                  <UserPlus className="h-4 w-4" />
                  Apply Now
                </button>
              </>
            )}
          </div>
        </div>
      </motion.header>

      {/* Main Content */}
      <main>{children}</main>

      {/* Footer */}
      <motion.footer
        initial={{ opacity: 0 }}
        whileInView={{ opacity: 1 }}
        viewport={{ once: true }}
        transition={{ duration: 0.5 }}
        className="py-8"
        style={{ borderTop: '1px solid var(--orbis-border)', background: 'var(--orbis-subtle)' }}
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <OrbisLogoIcon size="xs" />
              <span className="text-sm font-semibold text-white">Orbis</span>
            </div>
            <p className="text-xs text-slate-400">Powered by Orbis HR Intelligence</p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
