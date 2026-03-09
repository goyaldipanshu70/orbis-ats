import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Shared proxy headers helper
const recruitingProxy = 'http://localhost:8002';

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    allowedHosts: ['.ngrok-free.app'],
    proxy: {
      // ── Auth Service (8001) ──────────────────────────────────────────
      '/api/auth': {
        target: 'http://localhost:8001',
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.url?.includes('/stream')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },

      // ── Recruiting Service (8002) ────────────────────────────────────
      '/api/job': recruitingProxy,
      '/api/candidates': recruitingProxy,
      '/api/interview': recruitingProxy,
      '/api/dashboard': recruitingProxy,
      '/api/hiring-agent': {
        target: recruitingProxy,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes, req) => {
            if (req.url?.includes('/stream')) {
              proxyRes.headers['cache-control'] = 'no-cache';
              proxyRes.headers['x-accel-buffering'] = 'no';
            }
          });
        },
      },
      '/api/talent-pool': recruitingProxy,
      '/api/careers': recruitingProxy,
      '/api/applications': recruitingProxy,
      '/api/offers': recruitingProxy,
      '/api/ai-jobs': recruitingProxy,
      '/api/profiles': recruitingProxy,
      '/api/interviewers': recruitingProxy,
      '/api/referrals': recruitingProxy,
      '/api/job-boards': recruitingProxy,
      '/api/outreach': recruitingProxy,
      '/api/ai-tools': recruitingProxy,
      '/api/scorecard': recruitingProxy,
      '/api/export': recruitingProxy,
      '/api/compliance': recruitingProxy,
      '/api/pipeline-config': recruitingProxy,
      '/api/approvals': recruitingProxy,
      '/api/events': {
        target: recruitingProxy,
        configure: (proxy) => {
          proxy.on('proxyRes', (proxyRes) => {
            proxyRes.headers['cache-control'] = 'no-cache';
            proxyRes.headers['x-accel-buffering'] = 'no';
          });
        },
      },
      '/api/ai-interview': recruitingProxy,
      '/api/linkedin': recruitingProxy,
      '/api/job-requests': recruitingProxy,
      '/api/jd-templates': recruitingProxy,
      '/api/portals': recruitingProxy,
      '/api/leads': recruitingProxy,
      '/api/inbox-capture': recruitingProxy,
      '/api/notifications': recruitingProxy,
      '/files/': recruitingProxy,

      // ── Admin Service (8003) ─────────────────────────────────────────
      '/api/admin': 'http://localhost:8003',
      '/api/settings': 'http://localhost:8003',

      // ── AI Chat Service (8004) ───────────────────────────────────────
      '/chat': 'http://localhost:8004',

      // ── AI Orchestrator (8014) ───────────────────────────────────────
      '/api/orchestrator': 'http://localhost:8014',

      // ── Workflow Service (8015) ──────────────────────────────────────
      '/api/workflows': 'http://localhost:8015',
    },
  },
  plugins: [
    react(),
    mode === 'development' &&
    componentTagger(),
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));
