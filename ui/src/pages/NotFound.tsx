import { useLocation, Link } from "react-router-dom";
import { motion } from "framer-motion";
import { Home, ArrowLeft, Compass } from "lucide-react";

const NotFound = () => {
  const location = useLocation();

  return (
    <div className="min-h-screen flex items-center justify-center relative overflow-hidden" style={{ background: 'var(--orbis-page)' }}>
      {/* Decorative background orbs */}
      <motion.div
        className="absolute top-1/4 -left-32 w-96 h-96 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(27,142,229,0.15), transparent)' }}
        animate={{ x: [0, 30, 0], y: [0, -20, 0] }}
        transition={{ duration: 8, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute bottom-1/4 -right-32 w-80 h-80 rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(22,118,192,0.12), transparent)' }}
        animate={{ x: [0, -25, 0], y: [0, 25, 0] }}
        transition={{ duration: 10, repeat: Infinity, ease: "easeInOut" }}
      />
      <motion.div
        className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] rounded-full blur-3xl"
        style={{ background: 'radial-gradient(circle, rgba(27,142,229,0.06), transparent)' }}
        animate={{ scale: [1, 1.1, 1] }}
        transition={{ duration: 6, repeat: Infinity, ease: "easeInOut" }}
      />

      {/* Grid pattern overlay */}
      <div
        className="absolute inset-0"
        style={{
          backgroundImage: 'linear-gradient(var(--orbis-subtle) 1px, transparent 1px), linear-gradient(90deg, var(--orbis-subtle) 1px, transparent 1px)',
          backgroundSize: '60px 60px',
        }}
      />

      <div className="relative z-10 text-center px-6 max-w-lg mx-auto">
        {/* Compass icon */}
        <motion.div
          initial={{ opacity: 0, rotate: -180, scale: 0 }}
          animate={{ opacity: 1, rotate: 0, scale: 1 }}
          transition={{ type: "spring", stiffness: 150, damping: 12, delay: 0.1 }}
          className="mb-4 inline-flex"
        >
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center"
            style={{ background: 'rgba(27,142,229,0.1)', border: '1px solid rgba(27,142,229,0.2)' }}
          >
            <Compass className="w-8 h-8 text-blue-400" />
          </div>
        </motion.div>

        {/* Large 404 text */}
        <motion.div
          initial={{ opacity: 0, scale: 0.3, y: 40 }}
          animate={{
            opacity: 1,
            scale: 1,
            y: [0, -10, 0],
          }}
          transition={{
            opacity: { duration: 0.5 },
            scale: { type: "spring", stiffness: 200, damping: 12 },
            y: { repeat: Infinity, duration: 4, ease: "easeInOut", delay: 0.8 },
          }}
        >
          <h1 className="text-[140px] sm:text-[180px] font-black leading-none tracking-tighter select-none">
            <span className="bg-gradient-to-b from-blue-400 via-blue-400 to-blue-500 bg-clip-text text-transparent drop-shadow-sm">
              4
            </span>
            <motion.span
              className="inline-block bg-gradient-to-b from-blue-400 via-blue-500 to-cyan-400 bg-clip-text text-transparent"
              animate={{ rotate: [0, 10, -10, 0] }}
              transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut", delay: 1.5 }}
            >
              0
            </motion.span>
            <span className="bg-gradient-to-b from-blue-500 via-blue-400 to-blue-400 bg-clip-text text-transparent drop-shadow-sm">
              4
            </span>
          </h1>
        </motion.div>

        {/* Divider line */}
        <motion.div
          initial={{ scaleX: 0 }}
          animate={{ scaleX: 1 }}
          transition={{ duration: 0.6, delay: 0.3, ease: "easeOut" }}
          className="h-1 w-24 mx-auto rounded-full mb-6"
          style={{ background: 'linear-gradient(90deg, #1B8EE5, #1676c0, #a855f7)' }}
        />

        {/* Title */}
        <motion.h2
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.35, ease: "easeOut" }}
          className="text-2xl sm:text-3xl font-bold text-white mb-3"
        >
          Page not found
        </motion.h2>

        {/* Description */}
        <motion.p
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.45, ease: "easeOut" }}
          className="text-slate-400 text-base sm:text-lg leading-relaxed max-w-md mx-auto mb-10"
        >
          The page you're looking for doesn't exist or has been moved.
          Let's get you back on track.
        </motion.p>

        {/* Action buttons */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.55, ease: "easeOut" }}
          className="flex flex-col sm:flex-row items-center justify-center gap-3"
        >
          <Link to="/">
            <button
              className="flex items-center gap-2 text-white rounded-xl px-8 h-12 text-base font-semibold transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
              style={{
                background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
                boxShadow: '0 4px 20px rgba(27,142,229,0.3)',
              }}
            >
              <Home className="w-4 h-4" />
              Return to Home
            </button>
          </Link>

          <button
            onClick={() => window.history.back()}
            className="flex items-center gap-2 rounded-xl px-6 h-12 text-base font-medium text-slate-300 transition-all duration-300 hover:scale-[1.02] active:scale-[0.98]"
            style={{
              background: 'var(--orbis-input)',
              border: '1px solid var(--orbis-border)',
            }}
            onMouseEnter={e => { e.currentTarget.style.background = 'var(--orbis-hover)'; }}
            onMouseLeave={e => { e.currentTarget.style.background = 'var(--orbis-input)'; }}
          >
            <ArrowLeft className="w-4 h-4" />
            Go Back
          </button>
        </motion.div>

        {/* Attempted path hint */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 0.5, delay: 0.8, ease: "easeOut" }}
          className="mt-10 text-xs text-slate-400 font-mono"
        >
          {location.pathname}
        </motion.p>
      </div>
    </div>
  );
};

export default NotFound;
