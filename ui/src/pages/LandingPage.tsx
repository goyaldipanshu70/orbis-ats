import { useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '@/contexts/AuthContext';
import { motion } from 'framer-motion';
import {
  Zap,
  BarChart3,
  FileSearch,
  Kanban,
  Video,
  Workflow,
  MessageSquare,
  ArrowRight,
  CheckCircle2,
  Star,
  Shield,
  Target,
  Sparkles,
  ChevronRight,
  Play,
  Globe,
  Linkedin,
  Twitter,
} from 'lucide-react';
import { OrbisLogoIcon } from '@/components/Logo';

/* ── Animation variants ────────────────────────────────────────────── */
const fadeUp = {
  hidden: { opacity: 0, y: 30 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.1, duration: 0.6, ease: [0.22, 1, 0.36, 1] },
  }),
};
const stagger = { visible: { transition: { staggerChildren: 0.08 } } };

/* ── Static data ───────────────────────────────────────────────────── */
const features = [
  { icon: FileSearch, title: 'AI Resume Screening', desc: 'Auto-score and rank candidates against job requirements using advanced NLP and semantic matching.' },
  { icon: Kanban, title: 'Smart Pipeline', desc: 'Visual Kanban board with drag-and-drop stages, automated transitions, and real-time collaboration.' },
  { icon: Video, title: 'AI Interviews', desc: 'Automated video interviews with real-time proctoring, sentiment analysis, and instant scoring.' },
  { icon: BarChart3, title: 'Analytics Dashboard', desc: 'Real-time hiring metrics, funnel analytics, time-to-hire tracking, and predictive insights.' },
  { icon: Workflow, title: 'Workflow Automation', desc: 'Custom DAG-based workflows for sourcing, screening, and candidate engagement at scale.' },
  { icon: MessageSquare, title: 'Team Collaboration', desc: 'Structured feedback, scorecards, interview panels, and real-time notifications across your team.' },
];

const stats = [
  { value: '10x', label: 'Faster Screening', icon: Zap },
  { value: '85%', label: 'Better Matches', icon: Target },
  { value: '50+', label: 'AI Models', icon: Sparkles },
  { value: '99.9%', label: 'Uptime', icon: Shield },
];

const steps = [
  { step: '01', title: 'Post a Job', desc: 'Create job descriptions with AI assistance, set requirements, and publish to multiple channels instantly.', icon: FileSearch },
  { step: '02', title: 'AI Screens & Ranks', desc: 'Our AI automatically screens resumes, scores candidates, and ranks them by fit — saving hours of manual review.', icon: Sparkles },
  { step: '03', title: 'Hire the Best', desc: 'Conduct AI-powered interviews, gather structured feedback, and make data-driven hiring decisions.', icon: CheckCircle2 },
];

const testimonials = [
  { quote: "Orbis cut our time-to-hire by 60%. The AI screening is incredibly accurate and the pipeline view keeps our entire team aligned.", name: 'Priya Sharma', title: 'VP of Talent Acquisition', company: 'TechNova Solutions' },
  { quote: "The AI interview feature is a game-changer. We can now assess 10x more candidates with consistent evaluation quality across the board.", name: 'Rahul Mehta', title: 'Head of HR', company: 'GlobalScale Inc.' },
  { quote: "Finally an ATS that actually uses AI meaningfully. The workflow automation alone saved our recruiting team 20 hours per week.", name: 'Anita Desai', title: 'Chief People Officer', company: 'Pinnacle Dynamics' },
];

const footerCols = [
  { title: 'Product', links: [{ label: 'Features', href: '#features' }, { label: 'AI Screening', href: '#features' }, { label: 'Pipeline', href: '#features' }, { label: 'Analytics', href: '#features' }] },
  { title: 'Solutions', links: [{ label: 'Enterprise', href: '#' }, { label: 'Startups', href: '#' }, { label: 'Agencies', href: '#' }, { label: 'Remote Hiring', href: '#' }] },
  { title: 'Resources', links: [{ label: 'Blog', href: '#' }, { label: 'Documentation', href: '#' }, { label: 'API Reference', href: '#' }, { label: 'Status', href: '#' }] },
  { title: 'Company', links: [{ label: 'About', href: '#' }, { label: 'Careers', href: '/careers' }, { label: 'Contact', href: '#' }, { label: 'Privacy', href: '#' }] },
];

/* ── Inline style helpers that read CSS variables ──────────────────── */
const accentGradient = 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-dark))';
const accentGradientWide = 'linear-gradient(135deg, var(--orbis-accent), var(--orbis-accent-light))';
const accentBg = (opacity: number) => `rgba(var(--orbis-accent-rgb), ${opacity})`;
const heroBorder = 'var(--orbis-hero-border)';

export default function LandingPage() {
  const navigate = useNavigate();
  const { user, isLoading } = useAuth();

  useEffect(() => {
    if (!isLoading && user) {
      if (user.role === 'interviewer') navigate('/interviews', { replace: true });
      else if (user.role === 'candidate') navigate('/my-applications', { replace: true });
      else if (user.role === 'manager') navigate('/manager/requisitions', { replace: true });
      else navigate('/dashboard', { replace: true });
    }
  }, [user, isLoading, navigate]);

  if (isLoading || user) return null;

  return (
    <div className="min-h-screen overflow-x-hidden" style={{ background: 'var(--orbis-hero-bg)', color: 'var(--orbis-heading)' }}>

      {/* ── Navbar ──────────────────────────────────────────── */}
      <nav
        className="fixed top-0 left-0 right-0 z-50"
        style={{ background: 'var(--orbis-overlay)', backdropFilter: 'blur(20px)', borderBottom: `1px solid ${heroBorder}` }}
      >
        <div className="max-w-7xl mx-auto px-6 h-16 flex items-center justify-between">
          <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-opacity">
            <OrbisLogoIcon size="md" variant="landing" />
            <span className="text-lg font-bold" style={{ color: 'var(--orbis-heading)' }}>Orbis</span>
          </Link>

          <div className="hidden md:flex items-center gap-8">
            {['Features', 'How it Works', 'Testimonials'].map(label => (
              <a key={label} href={`#${label.toLowerCase().replace(/ /g, '-')}`} className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--orbis-text-muted)' }}>
                {label}
              </a>
            ))}
            <Link to="/careers" className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--orbis-text-muted)' }}>
              Careers
            </Link>
          </div>

          <div className="flex items-center gap-3">
            <Link to="/login" className="text-sm px-4 py-2 transition-colors hover:opacity-80" style={{ color: 'var(--orbis-text)' }}>
              Sign In
            </Link>
            <Link
              to="/signup"
              className="text-sm font-medium text-white px-5 py-2 rounded-lg transition-all hover:shadow-lg"
              style={{ background: accentGradient, boxShadow: '0 4px 14px var(--orbis-accent-glow)' }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </nav>

      {/* ── Hero ────────────────────────────────────────────── */}
      <section className="relative pt-32 pb-20 px-6">
        {/* Background glow */}
        <div
          className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[600px] rounded-full opacity-20 pointer-events-none"
          style={{ background: `radial-gradient(ellipse, var(--orbis-accent) 0%, transparent 70%)` }}
        />

        <div className="max-w-7xl mx-auto relative">
          <motion.div className="text-center max-w-4xl mx-auto" initial="hidden" animate="visible" variants={stagger}>
            <motion.div
              variants={fadeUp} custom={0}
              className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full text-xs font-medium mb-8"
              style={{ background: accentBg(0.08), color: 'var(--orbis-accent)', border: `1px solid ${accentBg(0.15)}` }}
            >
              <Sparkles className="h-3.5 w-3.5" />
              AI-Powered Hiring Intelligence Platform
            </motion.div>

            <motion.h1 variants={fadeUp} custom={1} className="text-5xl sm:text-6xl lg:text-7xl font-bold tracking-tight leading-[1.1] mb-6" style={{ color: 'var(--orbis-heading)' }}>
              Hire Smarter with{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: accentGradientWide }}>
                AI-Powered
              </span>{' '}
              Intelligence
            </motion.h1>

            <motion.p variants={fadeUp} custom={2} className="text-lg sm:text-xl max-w-2xl mx-auto mb-10 leading-relaxed" style={{ color: 'var(--orbis-text-muted)' }}>
              From sourcing to onboarding — Orbis automates your entire hiring pipeline with AI screening, intelligent ranking, and real-time analytics.
            </motion.p>

            <motion.div variants={fadeUp} custom={3} className="flex items-center justify-center gap-4 flex-wrap">
              <Link
                to="/signup"
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                style={{ background: accentGradient, boxShadow: `0 8px 24px var(--orbis-accent-glow)` }}
              >
                Start Free Trial <ArrowRight className="h-4 w-4" />
              </Link>
              <button
                className="inline-flex items-center gap-2 px-7 py-3.5 rounded-xl text-sm font-semibold transition-all hover:-translate-y-0.5"
                style={{ color: 'var(--orbis-text)', background: 'var(--orbis-hero-card)', border: `1px solid ${heroBorder}` }}
              >
                <Play className="h-4 w-4" /> Watch Demo
              </button>
            </motion.div>
          </motion.div>

          {/* Product mockup */}
          <motion.div
            initial={{ opacity: 0, y: 60 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
            className="mt-20 max-w-5xl mx-auto"
          >
            <div
              className="relative rounded-2xl overflow-hidden p-1"
              style={{ background: `linear-gradient(135deg, ${accentBg(0.15)}, ${accentBg(0.05)})`, border: `1px solid ${heroBorder}` }}
            >
              <div className="rounded-xl overflow-hidden" style={{ background: 'var(--orbis-card)' }}>
                {/* Browser bar */}
                <div className="flex items-center gap-2 px-4 py-3" style={{ borderBottom: `1px solid ${heroBorder}` }}>
                  <div className="flex gap-1.5">
                    <div className="w-3 h-3 rounded-full" style={{ background: '#ef4444', opacity: 0.6 }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: '#eab308', opacity: 0.6 }} />
                    <div className="w-3 h-3 rounded-full" style={{ background: '#22c55e', opacity: 0.6 }} />
                  </div>
                  <div className="flex-1 flex justify-center">
                    <div className="px-4 py-1 rounded-md text-xs" style={{ background: 'var(--orbis-input)', color: 'var(--orbis-text-subtle)' }}>
                      app.orbis.io/dashboard
                    </div>
                  </div>
                </div>
                {/* Dashboard content */}
                <div className="p-6 space-y-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <div className="h-3 w-32 rounded mb-2" style={{ background: accentBg(0.12) }} />
                      <div className="h-2 w-48 rounded" style={{ background: 'var(--orbis-hero-card)' }} />
                    </div>
                    <div className="flex gap-2">
                      <div className="h-8 w-24 rounded-lg" style={{ background: accentGradient }} />
                      <div className="h-8 w-20 rounded-lg" style={{ background: 'var(--orbis-input)' }} />
                    </div>
                  </div>
                  <div className="grid grid-cols-4 gap-3">
                    {['Active Jobs', 'Candidates', 'Interviews', 'Hires'].map((label, i) => (
                      <div key={label} className="rounded-xl p-4" style={{ background: 'var(--orbis-hero-card)', border: `1px solid ${heroBorder}` }}>
                        <div className="text-xs mb-1" style={{ color: 'var(--orbis-text-subtle)' }}>{label}</div>
                        <div className="text-xl font-bold" style={{ color: 'var(--orbis-heading)' }}>{[12, 248, 36, 8][i]}</div>
                        <div className="mt-2 h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--orbis-input)' }}>
                          <div className="h-full rounded-full" style={{ width: `${[75, 60, 45, 90][i]}%`, background: accentGradientWide }} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <div className="grid grid-cols-5 gap-2">
                    {['Applied', 'Screening', 'Interview', 'Offer', 'Hired'].map((stage, i) => (
                      <div key={stage} className="rounded-lg p-3" style={{ background: 'var(--orbis-hero-card)', border: `1px solid ${heroBorder}` }}>
                        <div className="text-[10px] font-medium mb-2" style={{ color: 'var(--orbis-text-subtle)' }}>{stage}</div>
                        {Array.from({ length: [3, 2, 2, 1, 1][i] }).map((_, j) => (
                          <div key={j} className="mb-1.5 rounded-md p-2" style={{ background: 'var(--orbis-subtle)', border: `1px solid ${heroBorder}` }}>
                            <div className="h-2 w-full rounded mb-1" style={{ background: accentBg(0.08) }} />
                            <div className="h-1.5 w-2/3 rounded" style={{ background: 'var(--orbis-input)' }} />
                          </div>
                        ))}
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <div className="absolute -bottom-20 left-1/2 -translate-x-1/2 w-[600px] h-40 opacity-30 pointer-events-none" style={{ background: `radial-gradient(ellipse, var(--orbis-accent), transparent 70%)` }} />
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Stats Bar ───────────────────────────────────────── */}
      <section className="py-16" style={{ background: accentBg(0.03), borderTop: `1px solid ${heroBorder}`, borderBottom: `1px solid ${heroBorder}` }}>
        <div className="max-w-5xl mx-auto px-6">
          <motion.div className="grid grid-cols-2 md:grid-cols-4 gap-8" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
            {stats.map((s, i) => (
              <motion.div key={s.label} variants={fadeUp} custom={i} className="text-center">
                <div
                  className="inline-flex items-center justify-center w-12 h-12 rounded-xl mb-3"
                  style={{ background: accentBg(0.08), border: `1px solid ${accentBg(0.12)}` }}
                >
                  <s.icon className="h-5 w-5" style={{ color: 'var(--orbis-accent)' }} />
                </div>
                <div className="text-3xl font-bold mb-1" style={{ color: 'var(--orbis-heading)' }}>{s.value}</div>
                <div className="text-sm" style={{ color: 'var(--orbis-text-subtle)' }}>{s.label}</div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Features ────────────────────────────────────────── */}
      <section id="features" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--orbis-heading)' }}>
              Everything You Need to{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: accentGradientWide }}>Hire Better</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg max-w-2xl mx-auto" style={{ color: 'var(--orbis-text-muted)' }}>
              A complete hiring platform with AI at every step — from sourcing to onboarding.
            </motion.p>
          </motion.div>

          <motion.div className="grid md:grid-cols-2 lg:grid-cols-3 gap-5" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
            {features.map((f, i) => (
              <motion.div
                key={f.title} variants={fadeUp} custom={i}
                className="group relative rounded-2xl p-6 transition-all duration-300 hover:-translate-y-1"
                style={{ background: 'var(--orbis-hero-card)', border: `1px solid ${heroBorder}` }}
              >
                <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: accentBg(0.1) }}>
                  <f.icon className="h-5 w-5" style={{ color: 'var(--orbis-accent)' }} />
                </div>
                <h3 className="text-lg font-semibold mb-2" style={{ color: 'var(--orbis-heading)' }}>{f.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: 'var(--orbis-text-muted)' }}>{f.desc}</p>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── How it Works ────────────────────────────────────── */}
      <section id="how-it-works" className="py-24 px-6" style={{ background: 'var(--orbis-subtle)', borderTop: `1px solid ${heroBorder}`, borderBottom: `1px solid ${heroBorder}` }}>
        <div className="max-w-6xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--orbis-heading)' }}>
              How Orbis{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: accentGradientWide }}>Works</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg max-w-xl mx-auto" style={{ color: 'var(--orbis-text-muted)' }}>
              Three simple steps to transform your hiring process.
            </motion.p>
          </motion.div>

          <motion.div className="grid md:grid-cols-3 gap-8" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
            {steps.map((s, i) => (
              <motion.div key={s.step} variants={fadeUp} custom={i} className="relative">
                <div className="rounded-2xl p-8 h-full" style={{ background: 'var(--orbis-card)', border: `1px solid ${heroBorder}`, boxShadow: 'var(--orbis-card-shadow)' }}>
                  <div className="text-5xl font-bold mb-4" style={{ color: accentBg(0.08) }}>{s.step}</div>
                  <div className="w-12 h-12 rounded-xl flex items-center justify-center mb-4" style={{ background: accentBg(0.1), border: `1px solid ${accentBg(0.15)}` }}>
                    <s.icon className="h-5 w-5" style={{ color: 'var(--orbis-accent)' }} />
                  </div>
                  <h3 className="text-xl font-semibold mb-3" style={{ color: 'var(--orbis-heading)' }}>{s.title}</h3>
                  <p className="text-sm leading-relaxed" style={{ color: 'var(--orbis-text-muted)' }}>{s.desc}</p>
                </div>
                {i < 2 && (
                  <div className="hidden md:flex absolute top-1/2 -right-5 z-10">
                    <ChevronRight className="h-5 w-5" style={{ color: 'var(--orbis-text-subtle)' }} />
                  </div>
                )}
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── Testimonials ────────────────────────────────────── */}
      <section id="testimonials" className="py-24 px-6">
        <div className="max-w-7xl mx-auto">
          <motion.div className="text-center mb-16" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
            <motion.h2 variants={fadeUp} custom={0} className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--orbis-heading)' }}>
              Loved by{' '}
              <span className="bg-clip-text text-transparent" style={{ backgroundImage: accentGradientWide }}>Hiring Teams</span>
            </motion.h2>
            <motion.p variants={fadeUp} custom={1} className="text-lg" style={{ color: 'var(--orbis-text-muted)' }}>
              See what leaders say about Orbis.
            </motion.p>
          </motion.div>

          <motion.div className="grid md:grid-cols-3 gap-6" initial="hidden" whileInView="visible" viewport={{ once: true, margin: '-100px' }} variants={stagger}>
            {testimonials.map((t, i) => (
              <motion.div
                key={t.name} variants={fadeUp} custom={i}
                className="rounded-2xl p-6 flex flex-col"
                style={{ background: 'var(--orbis-card)', border: `1px solid ${heroBorder}`, boxShadow: 'var(--orbis-card-shadow)' }}
              >
                <div className="flex gap-1 mb-4">
                  {Array.from({ length: 5 }).map((_, j) => (
                    <Star key={j} className="h-4 w-4 fill-amber-400 text-amber-400" />
                  ))}
                </div>
                <p className="text-sm leading-relaxed mb-6 flex-1" style={{ color: 'var(--orbis-text)' }}>"{t.quote}"</p>
                <div className="flex items-center gap-3 pt-4" style={{ borderTop: `1px solid ${heroBorder}` }}>
                  <div className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white" style={{ background: accentGradient }}>
                    {t.name.split(' ').map(w => w[0]).join('')}
                  </div>
                  <div>
                    <div className="text-sm font-semibold" style={{ color: 'var(--orbis-heading)' }}>{t.name}</div>
                    <div className="text-xs" style={{ color: 'var(--orbis-text-subtle)' }}>{t.title}, {t.company}</div>
                  </div>
                </div>
              </motion.div>
            ))}
          </motion.div>
        </div>
      </section>

      {/* ── CTA Banner ──────────────────────────────────────── */}
      <section className="py-24 px-6">
        <div className="max-w-4xl mx-auto">
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            whileInView={{ opacity: 1, y: 0 }}
            viewport={{ once: true }}
            transition={{ duration: 0.6 }}
            className="relative rounded-3xl p-12 text-center overflow-hidden"
            style={{ background: `linear-gradient(135deg, ${accentBg(0.12)}, ${accentBg(0.04)})`, border: `1px solid ${accentBg(0.15)}` }}
          >
            <div className="absolute inset-0 pointer-events-none" style={{ background: `radial-gradient(ellipse at center, ${accentBg(0.1)}, transparent 70%)` }} />
            <div className="relative">
              <h2 className="text-3xl sm:text-4xl font-bold mb-4" style={{ color: 'var(--orbis-heading)' }}>
                Ready to Transform Your Hiring?
              </h2>
              <p className="text-lg mb-8 max-w-xl mx-auto" style={{ color: 'var(--orbis-text-muted)' }}>
                Join hundreds of companies using Orbis to hire smarter, faster, and fairer.
              </p>
              <div className="flex items-center justify-center gap-4 flex-wrap">
                <Link
                  to="/signup"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold text-white transition-all hover:-translate-y-0.5"
                  style={{ background: accentGradient, boxShadow: `0 8px 24px var(--orbis-accent-glow)` }}
                >
                  Get Started Free <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  to="/careers"
                  className="inline-flex items-center gap-2 px-8 py-4 rounded-xl text-sm font-semibold transition-all"
                  style={{ color: 'var(--orbis-text)', background: 'var(--orbis-hero-card)', border: `1px solid ${heroBorder}` }}
                >
                  View Open Positions
                </Link>
              </div>
            </div>
          </motion.div>
        </div>
      </section>

      {/* ── Footer ──────────────────────────────────────────── */}
      <footer className="pt-16 pb-8 px-6" style={{ background: 'var(--orbis-subtle)', borderTop: `1px solid ${heroBorder}` }}>
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-2 md:grid-cols-5 gap-8 mb-12">
            <div className="col-span-2 md:col-span-1">
              <div className="flex items-center gap-2.5 mb-4">
                <OrbisLogoIcon size="md" variant="landing" />
                <span className="text-lg font-bold" style={{ color: 'var(--orbis-heading)' }}>Orbis</span>
              </div>
              <p className="text-sm leading-relaxed mb-4" style={{ color: 'var(--orbis-text-subtle)' }}>
                AI-powered hiring intelligence for modern teams.
              </p>
              <div className="flex gap-3">
                {[Twitter, Linkedin, Globe].map((Icon, i) => (
                  <a key={i} href="#" className="w-8 h-8 rounded-lg flex items-center justify-center transition-colors" style={{ background: 'var(--orbis-hero-card)', border: `1px solid ${heroBorder}` }}>
                    <Icon className="h-3.5 w-3.5" style={{ color: 'var(--orbis-text-subtle)' }} />
                  </a>
                ))}
              </div>
            </div>
            {footerCols.map(col => (
              <div key={col.title}>
                <h4 className="text-xs font-semibold uppercase tracking-wider mb-4" style={{ color: 'var(--orbis-text-subtle)' }}>{col.title}</h4>
                <ul className="space-y-2.5">
                  {col.links.map(link => (
                    <li key={link.label}>
                      {link.href.startsWith('/') ? (
                        <Link to={link.href} className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--orbis-text-muted)' }}>{link.label}</Link>
                      ) : (
                        <a href={link.href} className="text-sm transition-colors hover:opacity-80" style={{ color: 'var(--orbis-text-muted)' }}>{link.label}</a>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4 pt-8" style={{ borderTop: `1px solid ${heroBorder}` }}>
            <p className="text-xs" style={{ color: 'var(--orbis-text-subtle)' }}>&copy; {new Date().getFullYear()} Orbis Technologies. All rights reserved.</p>
            <div className="flex gap-6">
              {['Terms of Service', 'Privacy Policy', 'Cookies'].map(label => (
                <a key={label} href="#" className="text-xs transition-colors hover:opacity-80" style={{ color: 'var(--orbis-text-subtle)' }}>{label}</a>
              ))}
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
