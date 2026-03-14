import { useState, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  User, MapPin, Briefcase, GraduationCap, Globe, Linkedin, Github,
  ExternalLink, X, Plus, Edit3, Save, Loader2, Upload, Download,
  FileText, Brain, Lightbulb, Clock,
  Check, AlertCircle,
} from 'lucide-react';
import CandidateLayout from '@/components/layout/CandidateLayout';
import { useAuth } from '@/contexts/AuthContext';
import { toast } from 'sonner';

/* ── Design System Constants ─────────────────────────────────── */

const glassCard: React.CSSProperties = {
  background: 'var(--orbis-card)',
  backdropFilter: 'blur(12px)',
  border: '1px solid var(--orbis-border)',
};

const glassInput: React.CSSProperties = {
  background: 'var(--orbis-input)',
  border: '1px solid var(--orbis-border)',
  color: 'hsl(var(--foreground))',
};

const gradientBtn: React.CSSProperties = {
  background: 'linear-gradient(135deg, #1B8EE5, #1676c0)',
  boxShadow: '0 8px 24px rgba(27,142,229,0.2)',
};

const handleFocus = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.background = 'var(--orbis-hover)';
  e.target.style.borderColor = '#1B8EE5';
  e.target.style.boxShadow = '0 0 20px rgba(27,142,229,0.15)';
};

const handleBlur = (e: React.FocusEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
  e.target.style.background = 'var(--orbis-input)';
  e.target.style.borderColor = 'var(--orbis-border)';
  e.target.style.boxShadow = 'none';
};

/* ── Framer Motion Variants ──────────────────────────────────── */

const container = {
  hidden: {},
  visible: {
    transition: { staggerChildren: 0.07, delayChildren: 0.1 },
  },
};

const itemFade = {
  hidden: { opacity: 0, y: 16 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.45, ease: [0.25, 0.46, 0.45, 0.94] },
  },
};

/* ── Types ────────────────────────────────────────────────────── */

type Proficiency = 'Beginner' | 'Intermediate' | 'Advanced' | 'Expert';
type WorkType = 'Remote' | 'Hybrid' | 'On-site';
type JobType = 'Full-time' | 'Part-time' | 'Contract' | 'Freelance';
type Availability = 'Immediately' | '2 Weeks' | '1 Month' | '2 Months' | '3+ Months';

interface Skill {
  name: string;
  proficiency: Proficiency;
}

interface ProfileData {
  title: string;
  location: string;
  bio: string;
  currentRole: string;
  yearsExperience: string;
  education: string;
  skills: Skill[];
  linkedinUrl: string;
  githubUrl: string;
  portfolioUrl: string;
  preferredWorkType: WorkType;
  salaryMin: string;
  salaryMax: string;
  availability: Availability;
  preferredJobTypes: JobType[];
  preferredLocations: string[];
  resumeFileName: string;
  resumeLastUpdated: string;
}

interface AssessmentData {
  overall: number;
  communication: number;
  technical: number;
  problemSolving: number;
  attempts: number;
  maxAttempts: number;
}

/* ── Proficiency Color Map ───────────────────────────────────── */

const proficiencyColors: Record<Proficiency, { bg: string; text: string; border: string }> = {
  Beginner: { bg: 'rgba(100,116,139,0.12)', text: '#94a3b8', border: 'rgba(100,116,139,0.25)' },
  Intermediate: { bg: 'rgba(27,142,229,0.12)', text: '#60a5fa', border: 'rgba(27,142,229,0.25)' },
  Advanced: { bg: 'rgba(147,51,234,0.12)', text: '#c084fc', border: 'rgba(147,51,234,0.25)' },
  Expert: { bg: 'rgba(234,179,8,0.12)', text: '#fbbf24', border: 'rgba(234,179,8,0.25)' },
};

/* ── Circular Progress Component ─────────────────────────────── */

function CircularProgress({
  value,
  size = 64,
  strokeWidth = 5,
  color = '#1B8EE5',
  trackColor = 'rgba(100,116,139,0.15)',
  children,
}: {
  value: number;
  size?: number;
  strokeWidth?: number;
  color?: string;
  trackColor?: string;
  children?: React.ReactNode;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <div className="relative inline-flex items-center justify-center" style={{ width: size, height: size }}>
      <svg width={size} height={size} className="transform -rotate-90">
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={trackColor}
          strokeWidth={strokeWidth}
        />
        <motion.circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth={strokeWidth}
          strokeLinecap="round"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{ strokeDashoffset: offset }}
          transition={{ duration: 1.2, ease: [0.25, 0.46, 0.45, 0.94] }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

/* ── Progress Bar Component ──────────────────────────────────── */

function ProgressBar({ label, value, color = '#1B8EE5' }: { label: string; value: number; color?: string }) {
  return (
    <div className="space-y-1.5">
      <div className="flex items-center justify-between">
        <span className="text-xs font-medium text-slate-400">{label}</span>
        <span className="text-xs font-bold" style={{ color }}>{value}%</span>
      </div>
      <div className="h-2 rounded-full overflow-hidden" style={{ background: 'rgba(100,116,139,0.15)' }}>
        <motion.div
          className="h-full rounded-full"
          style={{ background: color }}
          initial={{ width: 0 }}
          animate={{ width: `${value}%` }}
          transition={{ duration: 1, ease: [0.25, 0.46, 0.45, 0.94], delay: 0.3 }}
        />
      </div>
    </div>
  );
}

/* ── Main Component ──────────────────────────────────────────── */

export default function CandidateProfile() {
  const { user } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Mock assessment data
  const mockAssessment: AssessmentData = {
    overall: 85,
    communication: 88,
    technical: 82,
    problemSolving: 85,
    attempts: 1,
    maxAttempts: 3,
  };

  // Initialize profile data from user context + defaults
  const initialProfile: ProfileData = {
    title: user?.current_role || 'Software Engineer',
    location: user?.location || 'San Francisco, CA',
    bio: 'Passionate software engineer with a strong foundation in full-stack development. I enjoy building intuitive user experiences and scalable backend systems. Always learning, always shipping.',
    currentRole: user?.current_role || 'Senior Software Engineer',
    yearsExperience: '5',
    education: "Bachelor's in Computer Science",
    skills: [
      { name: 'React', proficiency: 'Expert' },
      { name: 'TypeScript', proficiency: 'Advanced' },
      { name: 'Node.js', proficiency: 'Advanced' },
      { name: 'Python', proficiency: 'Intermediate' },
      { name: 'PostgreSQL', proficiency: 'Intermediate' },
      { name: 'AWS', proficiency: 'Intermediate' },
    ],
    linkedinUrl: 'https://linkedin.com/in/example',
    githubUrl: 'https://github.com/example',
    portfolioUrl: 'https://example.dev',
    preferredWorkType: 'Remote',
    salaryMin: '120000',
    salaryMax: '160000',
    availability: 'Immediately',
    preferredJobTypes: ['Full-time'],
    preferredLocations: ['San Francisco, CA', 'New York, NY', 'Remote'],
    resumeFileName: user?.resume_url ? 'resume.pdf' : 'resume_2026.pdf',
    resumeLastUpdated: 'Mar 10, 2026',
  };

  const [profile, setProfile] = useState<ProfileData>(initialProfile);
  const [editProfile, setEditProfile] = useState<ProfileData>(initialProfile);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [assessment] = useState<AssessmentData | null>(mockAssessment);
  const [newSkillName, setNewSkillName] = useState('');
  const [newSkillProficiency, setNewSkillProficiency] = useState<Proficiency>('Intermediate');
  const [newLocationInput, setNewLocationInput] = useState('');

  // Compute profile completion
  const computeCompletion = useCallback((p: ProfileData): number => {
    let filled = 0;
    let total = 10;
    if (p.title) filled++;
    if (p.location) filled++;
    if (p.bio && p.bio.length > 10) filled++;
    if (p.currentRole) filled++;
    if (p.yearsExperience) filled++;
    if (p.education) filled++;
    if (p.skills.length > 0) filled++;
    if (p.linkedinUrl || p.githubUrl || p.portfolioUrl) filled++;
    if (p.preferredWorkType) filled++;
    if (p.resumeFileName) filled++;
    return Math.round((filled / total) * 100);
  }, []);

  const profileCompletion = computeCompletion(profile);

  // Toggle edit mode
  const handleEditToggle = () => {
    if (isEditing) {
      // Cancel editing
      setEditProfile({ ...profile });
      setIsEditing(false);
    } else {
      setEditProfile({ ...profile });
      setIsEditing(true);
    }
  };

  // Save profile
  const handleSave = async () => {
    setIsSaving(true);
    try {
      // Simulate API call
      await new Promise((resolve) => setTimeout(resolve, 1000));
      setProfile({ ...editProfile });
      setIsEditing(false);
      toast.success('Profile updated successfully');
    } catch {
      toast.error('Failed to update profile. Please try again.');
    } finally {
      setIsSaving(false);
    }
  };

  // Skill management
  const handleAddSkill = () => {
    const trimmed = newSkillName.trim();
    if (!trimmed) return;
    if (editProfile.skills.some((s) => s.name.toLowerCase() === trimmed.toLowerCase())) {
      toast.error('Skill already exists');
      return;
    }
    setEditProfile((prev) => ({
      ...prev,
      skills: [...prev.skills, { name: trimmed, proficiency: newSkillProficiency }],
    }));
    setNewSkillName('');
    setNewSkillProficiency('Intermediate');
  };

  const handleRemoveSkill = (name: string) => {
    setEditProfile((prev) => ({
      ...prev,
      skills: prev.skills.filter((s) => s.name !== name),
    }));
  };

  // Preferred location management
  const handleAddLocation = () => {
    const trimmed = newLocationInput.trim();
    if (!trimmed) return;
    if (editProfile.preferredLocations.includes(trimmed)) {
      toast.error('Location already added');
      return;
    }
    setEditProfile((prev) => ({
      ...prev,
      preferredLocations: [...prev.preferredLocations, trimmed],
    }));
    setNewLocationInput('');
  };

  const handleRemoveLocation = (loc: string) => {
    setEditProfile((prev) => ({
      ...prev,
      preferredLocations: prev.preferredLocations.filter((l) => l !== loc),
    }));
  };

  // Job type toggle
  const handleToggleJobType = (jt: JobType) => {
    setEditProfile((prev) => {
      const has = prev.preferredJobTypes.includes(jt);
      return {
        ...prev,
        preferredJobTypes: has
          ? prev.preferredJobTypes.filter((t) => t !== jt)
          : [...prev.preferredJobTypes, jt],
      };
    });
  };

  // File upload
  const handleResumeUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (isEditing) {
      setEditProfile((prev) => ({
        ...prev,
        resumeFileName: file.name,
        resumeLastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
    } else {
      setProfile((prev) => ({
        ...prev,
        resumeFileName: file.name,
        resumeLastUpdated: new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' }),
      }));
    }
    toast.success(`Resume "${file.name}" uploaded`);
  };

  // Active data source
  const data = isEditing ? editProfile : profile;

  const initials = `${user?.first_name?.[0] ?? ''}${user?.last_name?.[0] ?? ''}`.toUpperCase();
  const displayName = `${user?.first_name ?? ''} ${user?.last_name ?? ''}`.trim() || 'Candidate';
  const displayEmail = user?.email ?? 'candidate@example.com';

  // Top skills for header pills (up to 5)
  const topSkills = data.skills.slice(0, 5);

  if (!user) return null;

  return (
    <CandidateLayout>
      <motion.div
        variants={container}
        initial="hidden"
        animate="visible"
        className="max-w-7xl mx-auto space-y-6"
      >
        {/* ── PROFILE HEADER ─────────────────────────────────── */}
        <motion.div variants={itemFade} className="rounded-xl p-6" style={glassCard}>
          <div className="flex flex-col md:flex-row md:items-start gap-5">
            {/* Avatar */}
            <div
              className="flex h-20 w-20 shrink-0 items-center justify-center rounded-full text-2xl font-bold text-white"
              style={{ background: 'linear-gradient(135deg, #1B8EE5, #1676c0)' }}
            >
              {user.avatar_url || user.picture ? (
                <img
                  src={user.avatar_url || user.picture}
                  alt={displayName}
                  className="h-full w-full rounded-full object-cover"
                />
              ) : (
                initials
              )}
            </div>

            {/* Name & Info */}
            <div className="flex-1 min-w-0 space-y-2">
              <div>
                <h1 className="text-2xl font-bold text-white">{displayName}</h1>
                <p className="text-sm text-slate-400">{displayEmail}</p>
              </div>

              {isEditing ? (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-lg">
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Title / Role</label>
                    <input
                      value={editProfile.title}
                      onChange={(e) => setEditProfile((p) => ({ ...p, title: e.target.value }))}
                      className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="e.g. Software Engineer"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-xs font-medium text-slate-400">Location</label>
                    <input
                      value={editProfile.location}
                      onChange={(e) => setEditProfile((p) => ({ ...p, location: e.target.value }))}
                      className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="e.g. San Francisco, CA"
                    />
                  </div>
                </div>
              ) : (
                <div className="flex flex-wrap items-center gap-3 text-sm text-slate-300">
                  {data.title && (
                    <span className="flex items-center gap-1.5">
                      <Briefcase className="h-3.5 w-3.5 text-slate-500" />
                      {data.title}
                    </span>
                  )}
                  {data.location && (
                    <span className="flex items-center gap-1.5">
                      <MapPin className="h-3.5 w-3.5 text-slate-500" />
                      {data.location}
                    </span>
                  )}
                </div>
              )}

              {/* Top Skills Pills */}
              <div className="flex flex-wrap gap-2 pt-1">
                {topSkills.map((skill) => (
                  <span
                    key={skill.name}
                    className="text-xs font-medium px-2.5 py-1 rounded-full"
                    style={{
                      background: 'rgba(27,142,229,0.12)',
                      color: '#60a5fa',
                      border: '1px solid rgba(27,142,229,0.25)',
                    }}
                  >
                    {skill.name}
                  </span>
                ))}
              </div>
            </div>

            {/* Completion Ring & Edit Button */}
            <div className="flex flex-col items-center gap-3 shrink-0">
              <CircularProgress value={profileCompletion} size={72} strokeWidth={5}>
                <span className="text-sm font-bold text-white">{profileCompletion}%</span>
              </CircularProgress>
              <span className="text-[10px] text-slate-500 uppercase tracking-wider">Profile</span>

              {isEditing ? (
                <div className="flex gap-2">
                  <button
                    onClick={handleEditToggle}
                    className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-lg text-slate-300 transition-colors hover:bg-white/5"
                    style={{ border: '1px solid var(--orbis-border)' }}
                  >
                    <X className="h-3.5 w-3.5" />
                    Cancel
                  </button>
                  <button
                    onClick={handleSave}
                    disabled={isSaving}
                    className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90 disabled:opacity-50"
                    style={gradientBtn}
                  >
                    {isSaving ? (
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                    ) : (
                      <Save className="h-3.5 w-3.5" />
                    )}
                    {isSaving ? 'Saving...' : 'Save'}
                  </button>
                </div>
              ) : (
                <button
                  onClick={handleEditToggle}
                  className="flex items-center gap-1.5 px-4 py-1.5 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
                  style={gradientBtn}
                >
                  <Edit3 className="h-3.5 w-3.5" />
                  Edit Profile
                </button>
              )}
            </div>
          </div>
        </motion.div>

        {/* ── TWO-COLUMN LAYOUT ──────────────────────────────── */}
        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* LEFT COLUMN (60%) */}
          <div className="lg:col-span-3 space-y-6">
            {/* About Me Card */}
            <motion.div variants={itemFade} className="rounded-xl" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <User className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">About Me</h2>
                </div>
              </div>
              <div className="px-6 pb-6">
                {isEditing ? (
                  <div className="space-y-2">
                    <textarea
                      value={editProfile.bio}
                      onChange={(e) => setEditProfile((p) => ({ ...p, bio: e.target.value }))}
                      rows={4}
                      maxLength={500}
                      className="w-full rounded-lg px-3 py-2.5 text-sm outline-none transition-all resize-none"
                      style={glassInput}
                      onFocus={handleFocus as any}
                      onBlur={handleBlur as any}
                      placeholder="Write a brief summary about yourself..."
                    />
                    <p className="text-xs text-slate-500 text-right">
                      {editProfile.bio.length}/500
                    </p>
                  </div>
                ) : (
                  <p className="text-sm text-slate-300 leading-relaxed whitespace-pre-wrap">
                    {data.bio || 'No bio added yet.'}
                  </p>
                )}
              </div>
            </motion.div>

            {/* Experience Card */}
            <motion.div variants={itemFade} className="rounded-xl" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">Experience</h2>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-4">
                {isEditing ? (
                  <>
                    <div className="space-y-1.5">
                      <label className="text-xs font-medium text-slate-400">Current Role</label>
                      <input
                        value={editProfile.currentRole}
                        onChange={(e) => setEditProfile((p) => ({ ...p, currentRole: e.target.value }))}
                        className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                        style={glassInput}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="e.g. Senior Software Engineer"
                      />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Years of Experience</label>
                        <input
                          value={editProfile.yearsExperience}
                          onChange={(e) => setEditProfile((p) => ({ ...p, yearsExperience: e.target.value }))}
                          type="number"
                          min="0"
                          className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                          style={glassInput}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          placeholder="e.g. 5"
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-medium text-slate-400">Education Level</label>
                        <input
                          value={editProfile.education}
                          onChange={(e) => setEditProfile((p) => ({ ...p, education: e.target.value }))}
                          className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                          style={glassInput}
                          onFocus={handleFocus}
                          onBlur={handleBlur}
                          placeholder="e.g. Bachelor's in CS"
                        />
                      </div>
                    </div>
                  </>
                ) : (
                  <div className="space-y-3">
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: 'rgba(27,142,229,0.1)' }}
                      >
                        <Briefcase className="h-4 w-4 text-blue-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{data.currentRole || 'Not specified'}</p>
                        <p className="text-xs text-slate-500">{data.yearsExperience ? `${data.yearsExperience} years experience` : 'Experience not set'}</p>
                      </div>
                    </div>
                    <div className="flex items-start gap-3">
                      <div
                        className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg"
                        style={{ background: 'rgba(147,51,234,0.1)' }}
                      >
                        <GraduationCap className="h-4 w-4 text-purple-400" />
                      </div>
                      <div>
                        <p className="text-sm font-medium text-white">{data.education || 'Not specified'}</p>
                        <p className="text-xs text-slate-500">Education</p>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Skills Card */}
            <motion.div variants={itemFade} className="rounded-xl" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Brain className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">Skills</h2>
                  <span className="text-xs text-slate-500 ml-auto">{data.skills.length} skills</span>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-4">
                {/* Skill Tags */}
                <div className="flex flex-wrap gap-2">
                  <AnimatePresence mode="popLayout">
                    {data.skills.map((skill) => {
                      const colors = proficiencyColors[skill.proficiency];
                      return (
                        <motion.span
                          key={skill.name}
                          layout
                          initial={{ opacity: 0, scale: 0.8 }}
                          animate={{ opacity: 1, scale: 1 }}
                          exit={{ opacity: 0, scale: 0.8 }}
                          transition={{ duration: 0.2 }}
                          className="inline-flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-lg"
                          style={{
                            background: colors.bg,
                            color: colors.text,
                            border: `1px solid ${colors.border}`,
                          }}
                        >
                          {skill.name}
                          <span
                            className="text-[10px] opacity-70 px-1 py-0.5 rounded"
                            style={{ background: 'rgba(0,0,0,0.15)' }}
                          >
                            {skill.proficiency}
                          </span>
                          {isEditing && (
                            <button
                              onClick={() => handleRemoveSkill(skill.name)}
                              className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                            >
                              <X className="h-3 w-3" />
                            </button>
                          )}
                        </motion.span>
                      );
                    })}
                  </AnimatePresence>
                </div>

                {/* Add Skill Input */}
                {isEditing && (
                  <motion.div
                    initial={{ opacity: 0, height: 0 }}
                    animate={{ opacity: 1, height: 'auto' }}
                    exit={{ opacity: 0, height: 0 }}
                    className="flex flex-wrap items-end gap-2"
                  >
                    <div className="flex-1 min-w-[140px] space-y-1">
                      <label className="text-xs font-medium text-slate-400">Skill Name</label>
                      <input
                        value={newSkillName}
                        onChange={(e) => setNewSkillName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddSkill(); } }}
                        className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                        style={glassInput}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="e.g. React, Python..."
                      />
                    </div>
                    <div className="w-36 space-y-1">
                      <label className="text-xs font-medium text-slate-400">Proficiency</label>
                      <select
                        value={newSkillProficiency}
                        onChange={(e) => setNewSkillProficiency(e.target.value as Proficiency)}
                        className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all appearance-none cursor-pointer"
                        style={glassInput}
                        onFocus={handleFocus as any}
                        onBlur={handleBlur as any}
                      >
                        <option value="Beginner">Beginner</option>
                        <option value="Intermediate">Intermediate</option>
                        <option value="Advanced">Advanced</option>
                        <option value="Expert">Expert</option>
                      </select>
                    </div>
                    <button
                      onClick={handleAddSkill}
                      className="flex items-center gap-1.5 h-9 px-3 text-xs font-medium text-white rounded-lg transition-all hover:opacity-90"
                      style={gradientBtn}
                    >
                      <Plus className="h-3.5 w-3.5" />
                      Add
                    </button>
                  </motion.div>
                )}
              </div>
            </motion.div>

            {/* Portfolio & Links Card */}
            <motion.div variants={itemFade} className="rounded-xl" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Globe className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">Portfolio & Links</h2>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-4">
                {/* LinkedIn */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Linkedin className="h-3.5 w-3.5" /> LinkedIn
                  </label>
                  {isEditing ? (
                    <input
                      value={editProfile.linkedinUrl}
                      onChange={(e) => setEditProfile((p) => ({ ...p, linkedinUrl: e.target.value }))}
                      className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="https://linkedin.com/in/..."
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-300 truncate flex-1">{data.linkedinUrl || 'Not provided'}</p>
                      {data.linkedinUrl && (
                        <a href={data.linkedinUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                {/* GitHub */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Github className="h-3.5 w-3.5" /> GitHub
                  </label>
                  {isEditing ? (
                    <input
                      value={editProfile.githubUrl}
                      onChange={(e) => setEditProfile((p) => ({ ...p, githubUrl: e.target.value }))}
                      className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="https://github.com/..."
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-300 truncate flex-1">{data.githubUrl || 'Not provided'}</p>
                      {data.githubUrl && (
                        <a href={data.githubUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>

                <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                {/* Portfolio */}
                <div className="space-y-1.5">
                  <label className="text-xs font-medium text-slate-400 flex items-center gap-1.5">
                    <Globe className="h-3.5 w-3.5" /> Portfolio
                  </label>
                  {isEditing ? (
                    <input
                      value={editProfile.portfolioUrl}
                      onChange={(e) => setEditProfile((p) => ({ ...p, portfolioUrl: e.target.value }))}
                      className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                      style={glassInput}
                      onFocus={handleFocus}
                      onBlur={handleBlur}
                      placeholder="https://yoursite.dev"
                    />
                  ) : (
                    <div className="flex items-center gap-2">
                      <p className="text-sm text-slate-300 truncate flex-1">{data.portfolioUrl || 'Not provided'}</p>
                      {data.portfolioUrl && (
                        <a href={data.portfolioUrl} target="_blank" rel="noopener noreferrer" className="text-blue-400 hover:text-blue-300 transition-colors shrink-0">
                          <ExternalLink className="h-3.5 w-3.5" />
                        </a>
                      )}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          </div>

          {/* RIGHT COLUMN (40%) */}
          <div className="lg:col-span-2 space-y-6">
            {/* Work Preferences Card */}
            <motion.div variants={itemFade} className="rounded-xl" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Briefcase className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">Work Preferences</h2>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-5">
                {/* Work Type Toggle */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Preferred Work Type</label>
                  <div className="flex gap-2">
                    {(['Remote', 'Hybrid', 'On-site'] as WorkType[]).map((wt) => {
                      const active = data.preferredWorkType === wt;
                      return (
                        <button
                          key={wt}
                          onClick={() => isEditing && setEditProfile((p) => ({ ...p, preferredWorkType: wt }))}
                          disabled={!isEditing}
                          className={`flex-1 py-2 text-xs font-medium rounded-lg transition-all ${
                            active ? 'text-white' : 'text-slate-400'
                          } ${!isEditing ? 'cursor-default' : 'cursor-pointer'}`}
                          style={
                            active
                              ? { background: 'rgba(27,142,229,0.15)', border: '1px solid rgba(27,142,229,0.35)', color: '#60a5fa' }
                              : { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }
                          }
                        >
                          {wt}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                {/* Salary Range */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Salary Expectation (USD/year)</label>
                  {isEditing ? (
                    <div className="grid grid-cols-2 gap-2">
                      <input
                        value={editProfile.salaryMin}
                        onChange={(e) => setEditProfile((p) => ({ ...p, salaryMin: e.target.value }))}
                        type="number"
                        className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                        style={glassInput}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="Min"
                      />
                      <input
                        value={editProfile.salaryMax}
                        onChange={(e) => setEditProfile((p) => ({ ...p, salaryMax: e.target.value }))}
                        type="number"
                        className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all"
                        style={glassInput}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="Max"
                      />
                    </div>
                  ) : (
                    <p className="text-sm text-white font-medium">
                      {data.salaryMin && data.salaryMax
                        ? `$${Number(data.salaryMin).toLocaleString()} - $${Number(data.salaryMax).toLocaleString()}`
                        : 'Not specified'}
                    </p>
                  )}
                </div>

                <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                {/* Availability */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Availability</label>
                  {isEditing ? (
                    <select
                      value={editProfile.availability}
                      onChange={(e) => setEditProfile((p) => ({ ...p, availability: e.target.value as Availability }))}
                      className="w-full h-9 rounded-lg px-3 text-sm outline-none transition-all appearance-none cursor-pointer"
                      style={glassInput}
                      onFocus={handleFocus as any}
                      onBlur={handleBlur as any}
                    >
                      <option value="Immediately">Immediately</option>
                      <option value="2 Weeks">2 Weeks</option>
                      <option value="1 Month">1 Month</option>
                      <option value="2 Months">2 Months</option>
                      <option value="3+ Months">3+ Months</option>
                    </select>
                  ) : (
                    <span
                      className="inline-block text-xs font-medium px-2.5 py-1 rounded-lg"
                      style={{
                        background: data.availability === 'Immediately' ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                        color: data.availability === 'Immediately' ? '#4ade80' : '#fbbf24',
                        border: `1px solid ${data.availability === 'Immediately' ? 'rgba(34,197,94,0.25)' : 'rgba(234,179,8,0.25)'}`,
                      }}
                    >
                      {data.availability}
                    </span>
                  )}
                </div>

                <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                {/* Preferred Job Types */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Preferred Job Types</label>
                  <div className="space-y-2">
                    {(['Full-time', 'Part-time', 'Contract', 'Freelance'] as JobType[]).map((jt) => {
                      const checked = data.preferredJobTypes.includes(jt);
                      return (
                        <label
                          key={jt}
                          className={`flex items-center gap-2.5 text-sm ${isEditing ? 'cursor-pointer' : 'cursor-default'}`}
                        >
                          <div
                            className="flex h-4 w-4 shrink-0 items-center justify-center rounded transition-all"
                            style={
                              checked
                                ? { background: '#1B8EE5', border: '1px solid #1B8EE5' }
                                : { background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }
                            }
                            onClick={() => isEditing && handleToggleJobType(jt)}
                          >
                            {checked && <Check className="h-2.5 w-2.5 text-white" />}
                          </div>
                          <span className={checked ? 'text-white' : 'text-slate-400'}>{jt}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>

                <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                {/* Preferred Locations */}
                <div className="space-y-2">
                  <label className="text-xs font-medium text-slate-400">Preferred Locations</label>
                  <div className="flex flex-wrap gap-1.5">
                    {data.preferredLocations.map((loc) => (
                      <span
                        key={loc}
                        className="inline-flex items-center gap-1 text-xs font-medium px-2 py-1 rounded-md"
                        style={{
                          background: 'rgba(100,116,139,0.1)',
                          color: '#94a3b8',
                          border: '1px solid rgba(100,116,139,0.2)',
                        }}
                      >
                        <MapPin className="h-3 w-3" />
                        {loc}
                        {isEditing && (
                          <button
                            onClick={() => handleRemoveLocation(loc)}
                            className="ml-0.5 opacity-60 hover:opacity-100 transition-opacity"
                          >
                            <X className="h-3 w-3" />
                          </button>
                        )}
                      </span>
                    ))}
                  </div>
                  {isEditing && (
                    <div className="flex gap-2">
                      <input
                        value={newLocationInput}
                        onChange={(e) => setNewLocationInput(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); handleAddLocation(); } }}
                        className="flex-1 h-8 rounded-lg px-3 text-xs outline-none transition-all"
                        style={glassInput}
                        onFocus={handleFocus}
                        onBlur={handleBlur}
                        placeholder="Add location..."
                      />
                      <button
                        onClick={handleAddLocation}
                        className="flex items-center gap-1 h-8 px-2.5 text-xs font-medium text-white rounded-lg transition-all hover:opacity-90"
                        style={gradientBtn}
                      >
                        <Plus className="h-3 w-3" />
                      </button>
                    </div>
                  )}
                </div>
              </div>
            </motion.div>

            {/* AI Assessment Score Card */}
            <motion.div variants={itemFade} className="rounded-xl" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <Lightbulb className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">AI Assessment Score</h2>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-5">
                {assessment ? (
                  <>
                    {/* Overall Score Ring */}
                    <div className="flex items-center gap-5">
                      <CircularProgress
                        value={assessment.overall}
                        size={88}
                        strokeWidth={6}
                        color={
                          assessment.overall >= 80 ? '#22c55e'
                          : assessment.overall >= 60 ? '#eab308'
                          : '#ef4444'
                        }
                      >
                        <div className="text-center">
                          <span className="text-xl font-bold text-white">{assessment.overall}</span>
                          <span className="text-[10px] text-slate-500 block">/100</span>
                        </div>
                      </CircularProgress>
                      <div className="space-y-1">
                        <p className="text-sm font-medium text-white">Overall Score</p>
                        <p className="text-xs text-slate-500">
                          Attempt {assessment.attempts} of {assessment.maxAttempts}
                        </p>
                        <span
                          className="inline-block text-[10px] font-medium px-2 py-0.5 rounded"
                          style={{
                            background: assessment.overall >= 80 ? 'rgba(34,197,94,0.12)' : 'rgba(234,179,8,0.12)',
                            color: assessment.overall >= 80 ? '#4ade80' : '#fbbf24',
                          }}
                        >
                          {assessment.overall >= 80 ? 'Excellent' : assessment.overall >= 60 ? 'Good' : 'Needs Improvement'}
                        </span>
                      </div>
                    </div>

                    <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                    {/* Breakdown */}
                    <div className="space-y-3">
                      <ProgressBar label="Communication" value={assessment.communication} color="#60a5fa" />
                      <ProgressBar label="Technical" value={assessment.technical} color="#c084fc" />
                      <ProgressBar label="Problem Solving" value={assessment.problemSolving} color="#34d399" />
                    </div>

                    <div style={{ borderBottom: '1px solid var(--orbis-border)' }} />

                    <div className="flex items-center justify-between">
                      <button
                        className="flex items-center gap-1.5 px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
                        style={gradientBtn}
                      >
                        <Brain className="h-3.5 w-3.5" />
                        Retake Assessment
                      </button>
                      <span className="text-[10px] text-slate-500 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />
                        Best of {assessment.maxAttempts} attempts
                      </span>
                    </div>
                  </>
                ) : (
                  <div className="text-center py-6 space-y-3">
                    <div
                      className="flex h-14 w-14 mx-auto items-center justify-center rounded-full"
                      style={{ background: 'rgba(27,142,229,0.1)' }}
                    >
                      <Brain className="h-7 w-7 text-blue-400" />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">No assessment taken yet</p>
                      <p className="text-xs text-slate-500 mt-1">
                        Complete the AI assessment to showcase your skills to employers.
                      </p>
                    </div>
                    <button
                      className="flex items-center gap-1.5 mx-auto px-4 py-2 text-xs font-semibold text-white rounded-lg transition-all hover:opacity-90"
                      style={gradientBtn}
                    >
                      <Brain className="h-3.5 w-3.5" />
                      Take Assessment
                    </button>
                  </div>
                )}
              </div>
            </motion.div>

            {/* Resume Card */}
            <motion.div variants={itemFade} className="rounded-xl" style={glassCard}>
              <div className="p-6 pb-4">
                <div className="flex items-center gap-2">
                  <FileText className="h-5 w-5 text-slate-400" />
                  <h2 className="text-lg font-semibold text-white">Resume</h2>
                </div>
              </div>
              <div className="px-6 pb-6 space-y-4">
                {data.resumeFileName ? (
                  <div
                    className="flex items-center gap-3 p-3 rounded-lg"
                    style={{ background: 'var(--orbis-input)', border: '1px solid var(--orbis-border)' }}
                  >
                    <div
                      className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg"
                      style={{ background: 'rgba(27,142,229,0.1)' }}
                    >
                      <FileText className="h-5 w-5 text-blue-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-white truncate">{data.resumeFileName}</p>
                      <p className="text-xs text-slate-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        Last updated: {data.resumeLastUpdated}
                      </p>
                    </div>
                    <button
                      className="text-blue-400 hover:text-blue-300 transition-colors p-1.5 rounded-lg hover:bg-white/5"
                      title="Download resume"
                    >
                      <Download className="h-4 w-4" />
                    </button>
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">No resume uploaded yet.</p>
                )}

                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.doc,.docx"
                  onChange={handleResumeUpload}
                  className="hidden"
                />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="flex items-center justify-center gap-2 w-full py-2.5 text-xs font-medium rounded-lg transition-all hover:bg-white/5"
                  style={{ border: '1px dashed var(--orbis-border)', color: '#94a3b8' }}
                >
                  <Upload className="h-3.5 w-3.5" />
                  Upload New Resume
                </button>
              </div>
            </motion.div>
          </div>
        </div>
      </motion.div>
    </CandidateLayout>
  );
}
