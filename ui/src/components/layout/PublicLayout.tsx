import { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { Zap, LogIn, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { motion } from 'framer-motion';

interface PublicLayoutProps {
  children: ReactNode;
}

export default function PublicLayout({ children }: PublicLayoutProps) {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background">
      {/* Top Navigation */}
      <motion.header
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.4, ease: 'easeOut' }}
        className="sticky top-0 z-50 border-b border-border bg-card/80 backdrop-blur-lg"
      >
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6 lg:px-8">
          {/* Logo */}
          <Link to="/careers" className="flex items-center gap-2.5">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600">
              <Zap className="h-5 w-5 text-white" />
            </div>
            <div>
              <p className="text-sm font-bold tracking-tight text-foreground">Orbis</p>
              <p className="text-[10px] text-muted-foreground">Careers</p>
            </div>
          </Link>

          {/* Nav Links */}
          <nav className="hidden sm:flex items-center gap-6">
            <Link to="/careers" className="text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
              Jobs
            </Link>
          </nav>

          {/* Auth Buttons */}
          <div className="flex items-center gap-3">
            {user ? (
              <Button
                onClick={() => navigate(user.role === 'candidate' ? '/my-applications' : '/')}
                className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium px-4 py-2"
              >
                {user.role === 'candidate' ? 'My Applications' : 'Dashboard'}
              </Button>
            ) : (
              <>
                <Button
                  variant="ghost"
                  onClick={() => navigate('/login')}
                  className="text-sm font-medium text-muted-foreground"
                >
                  <LogIn className="mr-1.5 h-4 w-4" />
                  Sign In
                </Button>
                <Button
                  onClick={() => navigate('/careers/signup')}
                  className="rounded-lg bg-gradient-to-r from-blue-600 to-indigo-600 text-white text-sm font-medium"
                >
                  <UserPlus className="mr-1.5 h-4 w-4" />
                  Apply Now
                </Button>
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
        className="border-t border-border bg-muted py-8"
      >
        <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <div className="flex h-7 w-7 items-center justify-center rounded-md bg-gradient-to-br from-blue-500 to-indigo-600">
                <Zap className="h-3.5 w-3.5 text-white" />
              </div>
              <span className="text-sm font-semibold text-foreground">Orbis</span>
            </div>
            <p className="text-xs text-muted-foreground">Powered by Orbis HR Intelligence</p>
          </div>
        </div>
      </motion.footer>
    </div>
  );
}
