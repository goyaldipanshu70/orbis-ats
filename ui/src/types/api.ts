export interface User {
  first_name: string;
  last_name: string;
  email: string;
}

export interface UploadedFile {
  file_id: string;
  file_name: string;
  file_type: string;
  display_name: string;
  upload_date: string;
  file_size: number;
  file_link?: string;
}

export interface JobStatistics {
  total_candidates: number;
  recommended_count: number;
  under_review_count: number;
  not_recommended_count: number;
}

export interface LocationVacancy {
  id: number;
  country: string;
  city: string;
  vacancies: number;
  hired_count: number;
  is_full: boolean;
}

export interface Job {
  job_id: string;
  job_title: string;
  status: 'Open' | 'Closed' | 'Draft' | 'Archived';
  visibility: 'internal' | 'public';
  country?: string | null;
  city?: string | null;
  rubric_summary: string;
  uploaded_files: UploadedFile[];
  statistics: JobStatistics;
  number_of_vacancies: number;
  rejection_lock_days?: number | null;
  key_requirements: string[];
  created_date: string;
  updated_date: string;
  approval_status?: 'pending' | 'approved' | 'rejected';
  approval_required?: boolean;
  location_vacancies?: LocationVacancy[];
  // Job Metadata
  job_type?: string | null;
  position_type?: string | null;
  experience_range?: string | null;
  salary_range_min?: number | null;
  salary_range_max?: number | null;
  salary_currency?: string | null;
  salary_visibility?: string;
  location_type?: string | null;
  hiring_close_date?: string | null;
}

export interface JobRequest {
  id: number;
  requested_by: string;
  requester_name: string;
  requester_email: string;
  requested_role: string;
  team?: string;
  department?: string;
  justification?: string;
  budget?: number;
  budget_currency?: string;
  priority: 'low' | 'medium' | 'high' | 'critical';
  expected_join_date?: string;
  number_of_positions: number;
  job_type?: string;
  location_type?: string;
  location?: string;
  additional_notes?: string;
  skills_required?: string[];
  status: 'pending' | 'approved' | 'rejected' | 'converted';
  reviewed_by?: string;
  reviewed_at?: string;
  review_comments?: string;
  converted_job_id?: number;
  created_at: string;
  updated_at: string;
}

export interface JDTemplate {
  id: number;
  name: string;
  category?: string;
  description?: string;
  jd_content: Record<string, unknown>;
  skills?: string[];
  experience_range?: string;
  salary_range?: { min: number; max: number; currency: string };
  benefits?: string[];
  screening_questions?: { question: string; type: string }[];
  is_active: boolean;
  usage_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface HiringCost {
  id: number;
  jd_id: number;
  cost_type: string;
  amount: number;
  currency: string;
  description?: string;
  created_by: string;
  created_at: string;
}

export interface JobPortal {
  id: number;
  portal_name: string;
  api_endpoint?: string;
  auth_type?: string;
  posting_template?: Record<string, unknown>;
  field_mapping?: Record<string, unknown>;
  integration_type: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CheatingFlag {
  type: string;
  count?: number;
  duration_ms?: number;
  severity: 'low' | 'medium' | 'high' | 'critical';
}

export interface DashboardStats {
  total_jobs: number;
  active_jobs: number;
  total_candidates: number;
  recommended_candidates: number;
  closed_jobs: number;
  pending_interviews: number;
}

export interface CandidateMetadata {
  full_name: string;
  email: string;
  phone: string;
  location: string;
  current_role: string;
  years_of_experience: number;
}

export interface CategoryScores {
  core_skills: number;
  preferred_skills: number;
  experience: number;
  education: number;
  industry_fit: number;
  soft_skills: number;
  total_score: number;
}

export interface CandidateEvaluation {
  metadata: CandidateMetadata;
  category_scores: CategoryScores;
  red_flags: string[];
  highlighted_skills: string[];
  ai_recommendation: 'Interview' | 'Consider' | 'Reject';
  notes: string;
  candidate_id: string;
}

export interface ScorePair {
  obtained_score: number;
  max_score: number;
}

export interface InterviewScoreBreakdown {
  technical_competency: ScorePair;
  core_qualifications: ScorePair;
  communication_skills: ScorePair;
  problem_solving: ScorePair;
  domain_knowledge: ScorePair;
  teamwork_culture_fit: ScorePair;
  total_score: ScorePair;
}

export interface InterviewEvaluation {
  candidate_name: string;
  position: string;
  score_breakdown: InterviewScoreBreakdown;
  strongest_competency: string;
  area_for_development: string;
  overall_impression: string;
  cultural_fit: string;
  available_to_start: string;
  willing_to_work_weekends: string;
  ai_recommendation: 'Interview Immediately' | 'Interview' | 'Consider' | 'Do Not Recommend' | 'Manual Review Required';
  red_flags: string[];
  notes: string | null;
  evaluation_id: string;
}

export interface ExtractedRubric {
  core_skills: string[];
  preferred_skills: string[];
  experience_requirements: {
    min_years: number;
    description: string;
  };
  educational_requirements: {
    degree: string;
    field: string;
  };
  soft_skills: string[];
  certifications: string[];
  role_keywords: string[];
}

export interface RawTextClassification {
  matches_known_roles: boolean;
  role_category: string;
  matched_role: string;
}

export interface JDExtractionResult {
  ai_result: {
    job_title: string;
    extracted_rubric: ExtractedRubric;
    summary: string;
    raw_text_classification: RawTextClassification;
  };
}

export interface JobFormData {
  job_title: string;
  summary: string;
  number_of_vacancies: number;
  country: string;
  city: string;
  core_skills: string[];
  preferred_skills: string[];
  experience_requirements: {
    min_years: number;
    description: string;
  };
  educational_requirements: {
    degree: string;
    field: string;
  };
  soft_skills: string[];
  certifications: string[];
  role_keywords: string[];
}

export interface InterviewEvaluationResponse {
  candidate_name: string;
  position: string;
  score_breakdown: InterviewScoreBreakdown;
  strongest_competency: string;
  area_for_development: string;
  overall_impression: string;
  cultural_fit: string;
  available_to_start: string;
  willing_to_work_weekends: string;
  ai_recommendation: 'Interview Immediately' | 'Interview' | 'Consider' | 'Do Not Recommend' | 'Manual Review Required';
  red_flags: string[];
  notes: string | null;
}

// Candidate Profile types (person-level, deduplicated)
export interface CandidateProfile {
  id: number;
  _id: string;
  profile_id: number;
  email: string | null;
  full_name: string | null;
  phone: string | null;
  resume_url: string | null;
  status: 'active' | 'inactive' | 'blacklisted';
  category: string | null;
  notes: string | null;
  job_count: number;
  skills: string[];
  experience: number;
  current_role: string | null;
  location: string | null;
  created_at: string | null;
}

// Pipeline types
export type PipelineStage = 'applied' | 'screening' | 'ai_interview' | 'interview' | 'offer' | 'hired' | 'rejected';

export interface PipelineCandidate {
  id: number;
  full_name: string;
  email: string;
  pipeline_stage: PipelineStage;
  score: number;
  recommendation: string;
  stage_changed_at: string | null;
  created_at: string;
  source?: string;
  // Feedback indicators (interview stage only)
  feedback_progress?: string;       // e.g. "2/3"
  avg_feedback_score?: number | null; // e.g. 4.2
  feedback_signal?: 'positive' | 'mixed' | 'negative' | null;
  // Document count (from auto-assigned pipeline documents)
  document_count?: number;
  // AI interview status
  ai_interview_status?: 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled' | null;
  ai_interview_score?: number | null;
  ai_interview_session_id?: number | null;
  hired_location_id?: number | null;
}

export interface PipelineSummary {
  applied: PipelineCandidate[];
  screening: PipelineCandidate[];
  ai_interview: PipelineCandidate[];
  interview: PipelineCandidate[];
  offer: PipelineCandidate[];
  hired: PipelineCandidate[];
  rejected: PipelineCandidate[];
}

// Screening types
export interface ScreeningQuestion {
  id: number;
  jd_id: number;
  question: string;
  question_type: 'text' | 'multiple_choice' | 'yes_no' | 'numeric' | 'date';
  options: string[] | null;
  required: boolean;
  ai_generated: boolean;
  sort_order: number;
  is_knockout: boolean;
  knockout_condition: string | null;
}

export interface ScreeningResponse {
  id: number;
  candidate_id: number;
  question_id: number;
  response: string;
  created_at: string;
}

export interface ScreeningResponseDetailed {
  id: number;
  question_id: number;
  question: string;
  question_type: string;
  options: string[] | null;
  is_knockout: boolean;
  knockout_condition: string | null;
  response: string;
  is_disqualified: boolean;
  created_at: string;
}

export interface ScreeningTemplateQuestion {
  id: number;
  question: string;
  question_type: 'text' | 'multiple_choice' | 'yes_no';
  options: string[] | null;
  category: string;
  is_knockout: boolean;
  knockout_condition: string | null;
  created_by: string | null;
  created_at: string;
}

// Interview Schedule types
export interface InterviewSchedule {
  id: number;
  candidate_id: number;
  jd_id: number;
  interview_type: 'phone' | 'video' | 'in_person';
  scheduled_date: string;
  scheduled_time: string;
  duration_minutes: number;
  location: string | null;
  interviewer_names: string[];
  status: 'scheduled' | 'completed' | 'cancelled' | 'no_show';
  notes: string | null;
  created_at: string;
  meeting_link?: string;
  calendar_event_id?: string;
  feedback_submitted?: boolean;
}

// Offer types
export interface Offer {
  id: number;
  candidate_id: number;
  jd_id: number;
  template_id: number | null;
  salary: number;
  salary_currency: string;
  start_date: string;
  position_title: string;
  department: string | null;
  content: string | null;
  variables: Record<string, string>;
  status: 'draft' | 'sent' | 'accepted' | 'declined' | 'expired' | 'withdrawn';
  sent_at: string | null;
  expires_at: string | null;
  responded_at: string | null;
  created_at: string;
}

// Job Approval types
export interface JobApproval {
  id: number;
  job_id: number;
  requested_by: string;
  approved_by: string | null;
  status: 'pending' | 'approved' | 'rejected';
  comments: string | null;
  created_at: string;
}

// Resume Version types
export interface ResumeVersion {
  id: number;
  application_id: number | null;
  candidate_id: number | null;
  resume_url: string;
  version: number;
  is_primary: boolean;
  uploaded_at: string;
}

// Job Member types
export interface JobMember {
  id: number;
  job_id: number;
  user_id: number;
  role: 'viewer' | 'editor' | 'owner';
  created_at: string;
}

// AI Job types
export interface AIJob {
  id: number;
  type: string;
  resource_id: number;
  resource_type: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  result: any;
  error: string | null;
  attempts: number;
  created_at: string;
}

// ── Referral types ──────────────────────────────────────────────────────
export interface ReferralLink {
  id: number;
  jd_id: number;
  referrer_user_id: string;
  referrer_name: string;
  referrer_email: string;
  code: string;
  is_active: boolean;
  click_count: number;
  created_at: string;
}

// ── Job Board types ─────────────────────────────────────────────────────
export interface JobBoardPosting {
  id: number;
  jd_id: number;
  board_name: string;
  status: 'draft' | 'published' | 'expired' | 'removed';
  external_url: string | null;
  published_at: string | null;
  views: number;
  applications: number;
  created_at: string;
}

export interface StageAutomation {
  id: number;
  jd_id: number;
  trigger_stage: string;
  email_subject: string;
  email_body: string;
  is_active: boolean;
  created_by: string;
  created_at: string;
}

// ── Scorecard types ─────────────────────────────────────────────────────
export interface CandidateScorecard {
  candidate: {
    id: number;
    name: string | null;
    email: string | null;
    phone: string | null;
    current_role: string | null;
  };
  resume_ai: {
    category_scores: Record<string, { obtained_score: number; max_score: number }>;
    total_score: number;
    highlighted_skills: string[];
    red_flags: string[];
    ai_recommendation: string;
  } | null;
  interview_ai: {
    score_breakdown: Record<string, { obtained_score: number; max_score: number }>;
    ai_recommendation: string;
    strongest_competency: string;
    area_for_development: string;
    overall_impression: string;
  } | null;
  feedback: {
    rounds: Array<{
      round_number: number;
      interviewer_name: string;
      rating: number;
      recommendation: string;
      strengths: string | null;
      concerns: string | null;
    }>;
    avg_rating: number | null;
    recommendation_distribution: Record<string, number>;
  };
  screening: Array<{ question: string; response: string }>;
  timeline: Array<{
    event_type: string;
    description: string;
    date: string;
    actor: string | null;
  }>;
}

// ── Compliance types ────────────────────────────────────────────────────
export interface DiversityStats {
  source_distribution: Record<string, number>;
  stage_distribution: Record<string, Record<string, number>>;
  conversion_by_source: Record<string, number>;
}

export interface SLACandidate {
  name: string;
  email: string | null;
  stage: string;
  days_in_stage: number;
  is_overdue: boolean;
  severity: 'low' | 'medium' | 'high';
}

export interface SLAStats {
  overdue_count: number;
  avg_days_in_stage: number;
  candidates: SLACandidate[];
}

// ── AI Interview types ──────────────────────────────────────────────────

export interface AIInterviewSession {
  id: number;
  token: string;
  candidate_id: number;
  candidate_name?: string;
  candidate_email?: string;
  status: 'pending' | 'in_progress' | 'completed' | 'expired' | 'cancelled';
  interview_type: string;
  overall_score: number | null;
  ai_recommendation: string | null;
  started_at: string | null;
  completed_at: string | null;
  created_at: string;
  expires_at: string;
}

export interface AIInterviewResults {
  id: number;
  evaluation: any;
  transcript: AIInterviewTranscriptMessage[];
  overall_score: number | null;
  proctoring_score: number | null;
  ai_recommendation: string | null;
  proctoring_events: ProctoringEvent[];
  cheating_flags: CheatingFlag[];
  risk_level: 'low' | 'medium' | 'high' | 'critical';
  started_at: string | null;
  completed_at: string | null;
  interview_type: string;
  time_limit_minutes: number;
  // Enhanced multi-round fields
  interview_plan?: any;
  interview_state?: any;
  recruiter_report?: RecruiterReport | null;
}

export interface RecruiterReport {
  candidate_summary: string;
  overall_assessment: string;
  recommendation: string;
  recommendation_confidence: string;
  key_strengths: string[];
  concerns: string[];
  round_highlights?: RoundHighlight[];
  suggested_next_steps: string[];
  interview_quality_notes?: string;
}

export interface RoundHighlight {
  round: string;
  summary: string;
  score?: number;
}

export interface AIInterviewTranscriptMessage {
  role: 'ai' | 'candidate';
  content: string;
  message_type: string;
  code_content?: string;
  code_language?: string;
  timestamp?: string;
  round_number?: number;
  round_type?: string;
}

export interface ProctoringEvent {
  event_type: string;
  timestamp: string;
  duration_ms?: number;
}

// ── Analytics types ──────────────────────────────────────────────────────
export interface AnalyticsKPI {
  value: number;
  change_pct: number;
  trend: 'up' | 'down' | 'flat';
}

export interface AnalyticsSummary {
  total_applications: AnalyticsKPI;
  active_jobs: AnalyticsKPI;
  interviews_scheduled: AnalyticsKPI;
  offers_sent: AnalyticsKPI;
  hires: AnalyticsKPI;
  avg_time_to_hire: AnalyticsKPI;
  offer_acceptance_rate: AnalyticsKPI;
}

export interface JobBoardPerformance {
  boards: Array<{
    board: string;
    applications: number;
    screened: number;
    hired: number;
    conversion_rate: number;
  }>;
}

export interface SchedulingLag {
  transitions: Array<{
    from_stage: string;
    to_stage: string;
    avg_days: number;
    count: number;
  }>;
}

// ── Pipeline Document types ──────────────────────────────────────────
export interface StageDocumentRule {
  id: number;
  stage: string;
  template_id: number;
  template_name: string;
  template_category: string | null;
  is_required: boolean;
  sort_order: number;
  created_by: string;
  created_at: string;
}

export interface CandidateDocument {
  id: number;
  candidate_id: number;
  jd_id: number;
  template_id: number;
  template_name: string;
  stage: string;
  status: 'pending' | 'generated' | 'sent' | 'signed';
  content?: string;
  variables?: Record<string, string>;
  generated_by?: string;
  generated_at?: string;
  created_at: string;
}
