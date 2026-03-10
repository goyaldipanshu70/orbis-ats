import { Job, InterviewEvaluation, InterviewEvaluationResponse, PipelineSummary, ScreeningQuestion, InterviewSchedule, Offer, CandidateProfile, AIInterviewSession, AIInterviewResults, LocationVacancy } from '@/types/api';
import { PaginatedResponse } from '@/types/pagination';
const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || '';

interface DashboardStats {
  total_jobs: number;
  active_jobs: number;
  total_candidates: number;
  recommended_candidates: number;
  closed_jobs: number;
  pending_interviews: number;
}

interface AdminDashboardStats {
  total_users: number;
  admin_users: number;
  hr_users: number;
  hiring_manager_users: number;
  active_sessions: number;
  total_jobs: number;
  total_candidates: number;
}

export interface AdminUser {
  id: string;
  email: string;
  first_name: string;
  last_name: string;
  role: 'admin' | 'hr' | 'hiring_manager' | 'interviewer' | 'candidate';
  created_at: string;
  last_login?: string;
  is_active: boolean;
}

// ── Deep Resume Parsing Types ──────────────────────────────────────────

export interface EducationEntry {
  degree?: string | null;
  field_of_study?: string | null;
  institution?: string | null;
  graduation_year?: number | null;
  gpa?: string | null;
  honors?: string | null;
}

export interface WorkExperienceEntry {
  company?: string | null;
  role?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  location?: string | null;
  responsibilities?: string[];
}

export interface ProjectEntry {
  title?: string | null;
  description?: string | null;
  tech_stack?: string[];
  url?: string | null;
}

export interface CertificationEntry {
  name?: string | null;
  issuer?: string | null;
  year?: number | null;
  expiry_year?: number | null;
  credential_id?: string | null;
}

export interface LanguageEntry {
  language: string;
  proficiency?: string | null;
}

export interface SocialLinks {
  linkedin_url?: string | null;
  github_url?: string | null;
  leetcode_url?: string | null;
  hackerrank_url?: string | null;
  stackoverflow_url?: string | null;
  twitter_url?: string | null;
  personal_website?: string | null;
  portfolio_url?: string | null;
  other_urls?: string[];
}

export interface DeepResumeMetadata {
  full_name?: string;
  email?: string | null;
  phone?: string | null;
  location?: string | null;
  current_role?: string | null;
  years_of_experience?: number | null;
  summary?: string | null;
  objective?: string | null;
  linkedin_url?: string | null;
  github_url?: string | null;
  portfolio_url?: string | null;
  skills?: string[];
  education?: EducationEntry[];
  work_experience?: WorkExperienceEntry[];
  projects?: ProjectEntry[];
  certifications?: CertificationEntry[];
  languages?: LanguageEntry[];
  links?: SocialLinks;
}

class ApiClient {
  private getAuthHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Content-Type': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private getMultipartHeaders() {
    const token = localStorage.getItem('access_token');
    return {
      'Accept': 'application/json',
      ...(token && { Authorization: `Bearer ${token}` }),
    };
  }

  private async tryRefreshToken(): Promise<boolean> {
    const refreshToken = localStorage.getItem('refresh_token');
    if (!refreshToken) return false;
    try {
      const response = await fetch(`${API_BASE_URL}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refresh_token: refreshToken }),
      });
      if (!response.ok) return false;
      const data = await response.json();
      localStorage.setItem('access_token', data.access_token);
      return true;
    } catch {
      return false;
    }
  }

  async request<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    let response = await fetch(url, {
      ...options,
      headers: {
        ...this.getAuthHeaders(),
        ...options.headers,
      },
    });

    // Auto-refresh on 401
    if (response.status === 401) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        response = await fetch(url, {
          ...options,
          headers: {
            ...this.getAuthHeaders(),
            ...options.headers,
          },
        });
      }
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.detail || JSON.stringify(errorBody);
      } catch (e) {
        errorMessage = `${errorMessage}: ${response.statusText}`;
      }

      const error: any = new Error(errorMessage);
      error.status = response.status;
      error.statusText = response.statusText;
      throw error;
    }

    const contentType = response.headers.get("content-type");
    if (contentType && contentType.indexOf("application/json") !== -1) {
      return response.json();
    }
    return Promise.resolve({} as T);
  }

  async uploadFile<T>(endpoint: string, formData: FormData): Promise<T> {
    const url = `${API_BASE_URL}${endpoint}`;

    let response = await fetch(url, {
      method: 'POST',
      headers: this.getMultipartHeaders(),
      body: formData,
    });

    // Auto-refresh on 401
    if (response.status === 401) {
      const refreshed = await this.tryRefreshToken();
      if (refreshed) {
        response = await fetch(url, {
          method: 'POST',
          headers: this.getMultipartHeaders(),
          body: formData,
        });
      }
      if (response.status === 401) {
        localStorage.removeItem('access_token');
        localStorage.removeItem('refresh_token');
        localStorage.removeItem('user');
        window.location.href = '/login';
        throw new Error('Authentication failed');
      }
    }

    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.detail || JSON.stringify(errorBody);
      } catch {
        errorMessage = `${errorMessage}: ${response.statusText}`;
      }
      const error: any = new Error(errorMessage);
      error.status = response.status;
      throw error;
    }

    return response.json();
  }

  // ── Auth ─────────────────────────────────────────────────────────────

  async login(email: string, password: string) {
    return await this.request<{ access_token: string }>('/api/auth/login', {
      method: 'POST',
      body: JSON.stringify({ email, password }),
    });
  }

  async signup(first_name: string, last_name: string, email: string, password: string) {
    return await this.request<{ message: string }>('/api/auth/signup', {
      method: 'POST',
      body: JSON.stringify({ first_name, last_name, email, password }),
    });
  }

  async resetPassword(new_password: string) {
    return await this.request<{ message: string }>('/api/auth/reset-password', {
      method: 'POST',
      body: JSON.stringify({ new_password }),
    });
  }

  async forgotPassword(email: string) {
    const url = `${API_BASE_URL}/api/auth/forgot-password`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || 'Request failed');
    }
    return response.json() as Promise<{ message: string }>;
  }

  async resetPasswordWithToken(token: string, new_password: string) {
    const url = `${API_BASE_URL}/api/auth/reset-password-token`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || 'Reset failed');
    }
    return response.json() as Promise<{ message: string }>;
  }

  // ── Dashboard ────────────────────────────────────────────────────────

  async getDashboardStats(): Promise<DashboardStats> {
    return await this.request<DashboardStats>('/api/dashboard/stats');
  }

  // ── Admin ────────────────────────────────────────────────────────────

  async getAdminStats(): Promise<AdminDashboardStats> {
    return await this.request<AdminDashboardStats>('/api/admin/stats');
  }

  async getAdminUsers(page = 1, pageSize = 20): Promise<PaginatedResponse<AdminUser>> {
    return await this.request<PaginatedResponse<AdminUser>>(`/api/admin/users?page=${page}&page_size=${pageSize}`);
  }

  async createAdminUser(userData: Omit<AdminUser, 'id' | 'created_at' | 'last_login' | 'is_active'> & { password?: string }) {
    return await this.request<{ message: string }>('/api/admin/users', {
      method: 'POST',
      body: JSON.stringify(userData),
    });
  }

  async updateAdminUser(userId: string, userData: Partial<Omit<AdminUser, 'id' | 'created_at' | 'last_login'>>) {
    return await this.request<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'PUT',
      body: JSON.stringify(userData),
    });
  }

  async deleteAdminUser(userId: string) {
    return await this.request<{ message: string }>(`/api/admin/users/${userId}`, {
      method: 'DELETE',
    });
  }

  async resetAdminUserPassword(userId: string, newPassword: string) {
    return await this.request<{ message: string }>(`/api/admin/users/${userId}/reset-password`, {
      method: 'POST',
      body: JSON.stringify({ new_password: newPassword }),
    });
  }

  async updateAdminUserStatus(userId: string, isActive: boolean) {
    return await this.request<{ message: string }>(`/api/admin/users/${userId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  // ── Jobs ─────────────────────────────────────────────────────────────

  async getJobs(page = 1, pageSize = 20, filters?: { search?: string; status?: string }): Promise<PaginatedResponse<Job>> {
    const params = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (filters?.search) params.set('search', filters.search);
    if (filters?.status) params.set('status', filters.status);
    return await this.request<PaginatedResponse<Job>>(`/api/job?${params}`);
  }

  async getJobById(jobId: string): Promise<Job> {
    return await this.request<Job>(`/api/job/${jobId}`);
  }

  async deleteJob(jobId: string) {
    return await this.request<{ message: string }>(`/api/job/${jobId}`, { method: 'DELETE' });
  }

  async updateJobStatus(jobId: string, status: string) {
    return await this.request<{ message: string }>(`/api/job/${jobId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async updateJobVisibility(jobId: string, visibility: 'public' | 'internal') {
    return await this.request<{ message: string }>(`/api/job/${jobId}/visibility`, {
      method: 'PUT',
      body: JSON.stringify({ visibility }),
    });
  }

  async extractJD(file: File) {
    const formData = new FormData();
    formData.append('jd_file', file);
    return await this.uploadFile<any>('/api/job/extract/jd', formData);
  }

  async submitJob(aiResult: any, rubricFile: File | null, modelAnswerFile?: File, numberOfVacancies: number = 1, rejectionLockDays?: number, country?: string, city?: string, locationVacancies?: Array<{country: string; city: string; vacancies: number}>, jobMetadata?: Record<string, any>) {
    const formData = new FormData();
    formData.append('ai_result', JSON.stringify(aiResult));
    formData.append('number_of_vacancies', String(numberOfVacancies));
    if (rejectionLockDays != null) formData.append('rejection_lock_days', String(rejectionLockDays));
    // Backward compat: send first location as country/city
    const firstLoc = locationVacancies?.[0];
    formData.append('country', firstLoc?.country || country || '');
    formData.append('city', firstLoc?.city || city || '');
    if (locationVacancies && locationVacancies.length > 0) {
      formData.append('location_vacancies', JSON.stringify(locationVacancies));
    }
    if (jobMetadata) {
      for (const [key, value] of Object.entries(jobMetadata)) {
        if (value != null) formData.append(key, String(value));
      }
    }
    if (rubricFile) formData.append('rubric_file', rubricFile);
    if (modelAnswerFile) formData.append('model_answer_file', modelAnswerFile);
    return await this.uploadFile<{ message: string; jd_id: string }>('/api/job/submit', formData);
  }

  async editJob(jobId: string | number, data: Record<string, any>): Promise<any> {
    return await this.request<any>(`/api/job/${jobId}/edit`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getJobsForImport(excludeJobId: string) {
    return await this.request<any[]>(`/api/job/import/available?exclude_job_id=${excludeJobId}`);
  }

  async searchJobsForImport(query: string, excludeJobId: string, limit = 10) {
    const params = new URLSearchParams({ q: query, exclude_job_id: excludeJobId, limit: String(limit) });
    return await this.request<any[]>(`/api/job/import/search?${params}`);
  }

  async searchCandidatesGlobal(query: string, excludeJdId: string, limit = 20, category?: string) {
    const params = new URLSearchParams({ q: query, exclude_jd_id: excludeJdId, limit: String(limit) });
    if (category) params.set('category', category);
    return await this.request<any[]>(`/api/candidates/search?${params}`);
  }

  // ── Candidates ───────────────────────────────────────────────────────

  async getCandidates(
    jdId?: string,
    page = 1,
    pageSize = 20,
    filters?: { pipeline_stage?: string; search?: string },
  ): Promise<PaginatedResponse<any>> {
    const params = new URLSearchParams();
    if (jdId) params.set('jd_id', jdId);
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    if (filters?.pipeline_stage) params.set('pipeline_stage', filters.pipeline_stage);
    if (filters?.search) params.set('search', filters.search);
    return await this.request<PaginatedResponse<any>>(`/api/candidates?${params}`);
  }

  async getCandidateById(candidateId: string): Promise<InterviewEvaluationResponse> {
    return await this.request<InterviewEvaluationResponse>(`/api/interview/evaluation/candidate/${candidateId}`);
  }

  async deleteCandidate(candidateId: string) {
    return await this.request<{ message: string }>(`/api/candidates/${candidateId}`, { method: 'DELETE' });
  }

  async checkDuplicateCandidate(params: { email?: string; phone?: string; linkedin_url?: string; github_url?: string }) {
    return await this.request<{ is_duplicate: boolean; duplicate_info?: any }>('/api/candidates/check-duplicate', {
      method: 'POST',
      body: JSON.stringify(params),
    });
  }

  async uploadCandidate(jdId: string, resumeFile: File, useRubric: boolean = false) {
    const formData = new FormData();
    formData.append('resume_file', resumeFile);
    formData.append('jd_id', jdId);
    formData.append('use_rubric', useRubric.toString());
    return await this.uploadFile<any>('/api/candidates/upload', formData);
  }

  async uploadMultipleCandidates(formData: FormData) {
    const response = await fetch(`${API_BASE_URL}/api/candidates/upload-multiple`, {
      method: 'POST',
      headers: this.getMultipartHeaders(),
      body: formData,
    });
    if (response.status === 401) {
      localStorage.removeItem('access_token');
      window.location.href = '/login';
      throw new Error('Authentication failed');
    }
    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Upload failed: ${response.statusText} - ${errorText}`);
    }
    return response.json();
  }

  async screenCandidate(candidateId: string, screening: boolean) {
    const formData = new FormData();
    formData.append('candidate_id', candidateId);
    formData.append('screening', screening.toString());
    const response = await fetch(`${API_BASE_URL}/api/candidates/screening`, {
      method: 'PUT',
      headers: this.getMultipartHeaders(),
      body: formData,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    try { return await response.json(); } catch { return { success: true }; }
  }

  async getCandidatesForImport(jobId: string, category?: string) {
    const params = new URLSearchParams({ job_id: jobId });
    if (category) params.set('category', category);
    return await this.request<any[]>(`/api/candidates/import?${params}`);
  }

  async importCandidates(targetJobId: string, candidateIds: string[]) {
    return await this.request<{ message: string; imported_count: number }>('/api/candidates/import', {
      method: 'POST',
      body: JSON.stringify({ target_job_id: targetJobId, candidate_ids: candidateIds }),
    });
  }

  // ── Pipeline ─────────────────────────────────────────────────────────

  async getPipelineCandidates(jdId: string): Promise<PipelineSummary> {
    return await this.request<PipelineSummary>(`/api/candidates/pipeline/${jdId}`);
  }

  async moveCandidateStage(candidateId: number, stage: string, notes?: string, hiredLocationId?: number) {
    return await this.request<{ message: string; pending_email_id: number | null }>(`/api/candidates/${candidateId}/stage`, {
      method: 'PUT',
      body: JSON.stringify({ stage, notes, ...(hiredLocationId ? { hired_location_id: hiredLocationId } : {}) }),
    });
  }

  async cancelStageEmail(emailId: number) {
    return await this.request<{ message: string }>(`/api/candidates/stage-email/${emailId}`, {
      method: 'DELETE',
    });
  }

  async offerAndMove(candidateId: number, data: {
    jd_id: number;
    salary?: number;
    salary_currency?: string;
    start_date?: string;
    position_title?: string;
    template_ids?: number[];
    variables?: Record<string, string>;
    notes?: string;
    from_stage?: string;
  }) {
    return await this.request<{ message: string; offer_id: number; pending_email_id: number }>(`/api/candidates/${candidateId}/offer-and-move`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAvailableHireLocations(jobId: string): Promise<LocationVacancy[]> {
    return await this.request<LocationVacancy[]>(`/api/job/${jobId}/available-locations`);
  }

  async bulkMoveCandidates(candidateIds: number[], stage: string, notes?: string) {
    return await this.request<{ message: string }>('/api/candidates/bulk-stage', {
      method: 'PUT',
      body: JSON.stringify({ candidate_ids: candidateIds, stage, notes }),
    });
  }

  async getCandidateStageHistory(candidateId: number) {
    return await this.request<any[]>(`/api/candidates/${candidateId}/history`);
  }

  // ── Screening Questions ──────────────────────────────────────────────

  async getScreeningQuestions(jdId: string): Promise<ScreeningQuestion[]> {
    return await this.request<ScreeningQuestion[]>(`/api/job/${jdId}/screening-questions`);
  }

  async createScreeningQuestion(jdId: string, data: Partial<ScreeningQuestion>) {
    return await this.request<ScreeningQuestion>(`/api/job/${jdId}/screening-questions`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateScreeningQuestion(jdId: string, questionId: number, data: Partial<ScreeningQuestion>) {
    return await this.request<ScreeningQuestion>(`/api/job/${jdId}/screening-questions/${questionId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteScreeningQuestion(jdId: string, questionId: number) {
    return await this.request<{ message: string }>(`/api/job/${jdId}/screening-questions/${questionId}`, {
      method: 'DELETE',
    });
  }

  async generateScreeningQuestions(jdId: string) {
    return await this.request<ScreeningQuestion[]>(`/api/job/${jdId}/screening-questions/generate`, {
      method: 'POST',
    });
  }

  async getScreeningResponses(candidateId: number) {
    return await this.request<any[]>(`/api/candidates/${candidateId}/screening-responses`);
  }

  // ── Interview Scheduling ─────────────────────────────────────────────

  async scheduleInterview(data: Partial<InterviewSchedule>) {
    return await this.request<InterviewSchedule>('/api/interview/schedule', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInterviewsForJob(jdId: string) {
    return await this.request<InterviewSchedule[]>(`/api/interview/schedule/job/${jdId}`);
  }

  async getInterviewsForCandidate(candidateId: number) {
    return await this.request<InterviewSchedule[]>(`/api/interview/schedule/candidate/${candidateId}`);
  }

  async getUpcomingInterviews() {
    return await this.request<InterviewSchedule[]>('/api/interview/schedule/upcoming');
  }

  async updateInterviewSchedule(scheduleId: number, data: Partial<InterviewSchedule>) {
    return await this.request<InterviewSchedule>(`/api/interview/schedule/${scheduleId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async updateInterviewStatus(scheduleId: number, status: string) {
    return await this.request<{ message: string }>(`/api/interview/schedule/${scheduleId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // ── Offers ───────────────────────────────────────────────────────────

  async createOffer(jdId: string, data: Partial<Offer>) {
    return await this.request<Offer>(`/api/job/${jdId}/offers`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getOffersForJob(jdId: string) {
    return await this.request<Offer[]>(`/api/job/${jdId}/offers`);
  }

  async getOffer(offerId: number) {
    return await this.request<Offer>(`/api/offers/${offerId}`);
  }

  async updateOffer(offerId: number, data: Partial<Offer>) {
    return await this.request<Offer>(`/api/offers/${offerId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async sendOffer(offerId: number) {
    return await this.request<{ message: string }>(`/api/offers/${offerId}/send`, { method: 'POST' });
  }

  async updateOfferStatus(offerId: number, status: string) {
    return await this.request<{ message: string }>(`/api/offers/${offerId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  async previewOffer(offerId: number) {
    return await this.request<{ content: string }>(`/api/offers/${offerId}/preview`);
  }

  // ── Interview Evaluations ────────────────────────────────────────────

  async uploadInterview(candidateId: string, transcriptFile: File) {
    const formData = new FormData();
    formData.append('transcript_file', transcriptFile);
    formData.append('candidate_id', candidateId);
    const response = await fetch(`${API_BASE_URL}/api/interview/upload`, {
      method: 'POST',
      headers: this.getMultipartHeaders(),
      body: formData,
    });
    if (!response.ok) throw new Error(`API Error: ${response.statusText}`);
    try { return await response.json(); } catch { return { success: true }; }
  }

  async getInterviewEvaluations(jobId: string, page = 1, pageSize = 20): Promise<PaginatedResponse<InterviewEvaluation>> {
    return await this.request<PaginatedResponse<InterviewEvaluation>>(`/api/interview/evaluation/job/${jobId}?page=${page}&page_size=${pageSize}`);
  }

  async getInterviewEvaluationForCandidate(candidateId: string): Promise<InterviewEvaluationResponse> {
    return await this.request<InterviewEvaluationResponse>(`/api/interview/evaluation/candidate/${candidateId}`);
  }

  // ── Hiring Agent ─────────────────────────────────────────────────────

  async queryHiringAgent(
    query: string,
    conversationHistory: Array<{role: string; content: string}> = [],
    jobId?: string,
    webSearchEnabled = false,
    fileContext?: string,
  ) {
    return await this.request<{
      answer: string;
      data?: any;
      data_type?: string;
      actions?: Array<{tool: string; args: any; result: any}>;
    }>('/api/hiring-agent/query', {
      method: 'POST',
      body: JSON.stringify({
        query,
        conversation_history: conversationHistory,
        job_id: jobId,
        web_search_enabled: webSearchEnabled,
        file_context: fileContext,
      }),
    });
  }

  async uploadHiringAgentFile(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return await this.uploadFile<{ url: string; filename: string; extracted_text?: string; char_count?: number; truncated?: boolean }>(
      '/api/hiring-agent/upload', formData,
    );
  }

  async confirmHiringAgentAction(token: string) {
    return await this.request<{ tool: string; args: any; result: any }>(`/api/hiring-agent/confirm/${token}`, {
      method: 'POST',
    });
  }

  async cancelHiringAgentAction(token: string) {
    return await this.request<{ cancelled: boolean }>(`/api/hiring-agent/cancel/${token}`, {
      method: 'POST',
    });
  }

  // ── Hiring Agent Conversations ──────────────────────────────────────

  async getAgentConversations(page = 1, pageSize = 20) {
    return await this.request<{ items: any[]; total: number }>(`/api/hiring-agent/conversations?page=${page}&page_size=${pageSize}`);
  }

  async createAgentConversation(title?: string) {
    return await this.request<{ id: number; title: string }>('/api/hiring-agent/conversations', {
      method: 'POST',
      body: JSON.stringify({ title }),
    });
  }

  async getAgentConversationMessages(conversationId: number) {
    return await this.request<{ messages: any[] }>(`/api/hiring-agent/conversations/${conversationId}/messages`);
  }

  async deleteAgentConversation(conversationId: number) {
    return await this.request<{ deleted: boolean }>(`/api/hiring-agent/conversations/${conversationId}`, {
      method: 'DELETE',
    });
  }

  // ── Hiring Agent SSE Streaming ──────────────────────────────────────

  queryHiringAgentStream(
    query: string,
    conversationHistory: Array<{role: string; content: string}> = [],
    jobId?: string,
    webSearchEnabled = false,
    fileContext?: string,
    conversationId?: number,
  ): { response: Promise<Response>; abort: () => void } {
    const controller = new AbortController();
    const token = localStorage.getItem('access_token') || sessionStorage.getItem('access_token') || '';
    const response = fetch(`${API_BASE_URL}/api/hiring-agent/query/stream`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        query,
        conversation_history: conversationHistory,
        job_id: jobId,
        web_search_enabled: webSearchEnabled,
        file_context: fileContext,
        conversation_id: conversationId,
      }),
      signal: controller.signal,
    });
    return { response, abort: () => controller.abort() };
  }

  // ── Audit Logs ───────────────────────────────────────────────────────

  async getAuditLogs(action?: string, page = 1, pageSize = 20) {
    const params = new URLSearchParams();
    if (action) params.set('action', action);
    params.set('page', String(page));
    params.set('page_size', String(pageSize));
    return await this.request<PaginatedResponse<any>>(`/api/admin/audit-logs?${params}`);
  }

  async getAuditActions() {
    return await this.request<string[]>('/api/admin/audit-logs/actions');
  }

  // ── Document Templates ───────────────────────────────────────────────

  async getDocumentTemplates(page = 1, pageSize = 20, search?: string, category?: string): Promise<PaginatedResponse<any>> {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) p.set('search', search);
    if (category) p.set('category', category);
    return await this.request<PaginatedResponse<any>>(`/api/admin/templates?${p.toString()}`);
  }

  async getDocumentTemplate(id: number) {
    return await this.request<any>(`/api/admin/templates/${id}`);
  }

  async getDocumentTemplateCategories() {
    return await this.request<string[]>('/api/admin/templates/categories');
  }

  async createDocumentTemplate(data: { name: string; category: string; description?: string; content: string; variables?: string[] }) {
    return await this.request<any>('/api/admin/templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateDocumentTemplate(id: number, data: Record<string, any>) {
    return await this.request<any>(`/api/admin/templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteDocumentTemplate(id: number) {
    return await this.request<{ message: string }>(`/api/admin/templates/${id}`, { method: 'DELETE' });
  }

  async renderDocumentTemplate(id: number, variables: Record<string, string>) {
    return await this.request<{ rendered_content: string }>(`/api/admin/templates/${id}/render`, {
      method: 'POST',
      body: JSON.stringify({ variables }),
    });
  }

  async downloadTemplatePDF(id: number, variables: Record<string, string>) {
    const url = `${API_BASE_URL}/api/admin/templates/${id}/pdf`;
    const token = localStorage.getItem('access_token');
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token && { Authorization: `Bearer ${token}` }),
      },
      body: JSON.stringify({ variables }),
    });
    if (!response.ok) {
      let errorMessage = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        errorMessage = errorBody.detail || JSON.stringify(errorBody);
      } catch {
        errorMessage = `${errorMessage}: ${response.statusText}`;
      }
      throw new Error(errorMessage);
    }
    const blob = await response.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    const disposition = response.headers.get('Content-Disposition');
    const match = disposition?.match(/filename="?(.+?)"?$/);
    a.download = match?.[1] || 'document.pdf';
    a.click();
    URL.revokeObjectURL(blobUrl);
  }

  async duplicateDocumentTemplate(id: number) {
    return await this.request<any>(`/api/admin/templates/duplicate/${id}`, { method: 'POST' });
  }

  async seedDocumentTemplates() {
    return await this.request<{ message: string; seeded: number }>('/api/admin/templates/seed', { method: 'POST' });
  }

  // ── Announcements ───────────────────────────────────────────────────

  async getAnnouncements(page = 1, pageSize = 20, search?: string): Promise<PaginatedResponse<any>> {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) p.set('search', search);
    return await this.request<PaginatedResponse<any>>(`/api/admin/announcements?${p.toString()}`);
  }

  async getAnnouncement(id: number) {
    return await this.request<any>(`/api/admin/announcements/${id}`);
  }

  async createAnnouncement(data: { title: string; content: string; priority?: string; pinned?: boolean }) {
    return await this.request<any>('/api/admin/announcements', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateAnnouncement(id: number, data: Record<string, any>) {
    return await this.request<any>(`/api/admin/announcements/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteAnnouncement(id: number) {
    return await this.request<{ message: string }>(`/api/admin/announcements/${id}`, { method: 'DELETE' });
  }

  // ── Onboarding Templates ──────────────────────────────────────────

  async getOnboardingTemplates(page = 1, pageSize = 20, search?: string): Promise<PaginatedResponse<any>> {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (search) p.set('search', search);
    return await this.request<PaginatedResponse<any>>(`/api/admin/onboarding?${p.toString()}`);
  }

  async getOnboardingTemplate(id: number) {
    return await this.request<any>(`/api/admin/onboarding/${id}`);
  }

  async createOnboardingTemplate(data: { title: string; description?: string; checklist: string[] }) {
    return await this.request<any>('/api/admin/onboarding', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateOnboardingTemplate(id: number, data: Record<string, any>) {
    return await this.request<any>(`/api/admin/onboarding/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteOnboardingTemplate(id: number) {
    return await this.request<{ message: string }>(`/api/admin/onboarding/${id}`, { method: 'DELETE' });
  }

  // ── Talent Pool ──────────────────────────────────────────────────────

  async getTalentPool(params: {
    page?: number; pageSize?: number; search?: string;
    recommendation?: string; minExperience?: number; maxExperience?: number;
    jdId?: string; sort?: string; category?: string; status?: string;
  } = {}) {
    const p = new URLSearchParams();
    if (params.page) p.set('page', String(params.page));
    if (params.pageSize) p.set('page_size', String(params.pageSize));
    if (params.search) p.set('search', params.search);
    if (params.recommendation) p.set('recommendation', params.recommendation);
    if (params.minExperience !== undefined) p.set('min_experience', String(params.minExperience));
    if (params.maxExperience !== undefined) p.set('max_experience', String(params.maxExperience));
    if (params.jdId) p.set('jd_id', params.jdId);
    if (params.sort) p.set('sort', params.sort);
    if (params.category) p.set('category', params.category);
    if (params.status) p.set('status', params.status);
    return await this.request<PaginatedResponse<any>>(`/api/talent-pool?${p}`);
  }

  async getTalentPoolCandidate(id: string) {
    return await this.request<any>(`/api/talent-pool/${id}`);
  }

  async getTalentPoolHistory(id: string) {
    return await this.request<any[]>(`/api/talent-pool/${id}/history`);
  }

  async addTalentToJob(profileIds: string[], targetJobId: string) {
    return await this.request<{ message: string; imported_count: number }>('/api/talent-pool/add-to-job', {
      method: 'POST',
      body: JSON.stringify({ profile_ids: profileIds, candidate_ids: profileIds, target_job_id: targetJobId }),
    });
  }

  async deleteTalentPoolCandidate(candidateId: string) {
    return await this.request<{ message: string }>(`/api/talent-pool/${candidateId}`, { method: 'DELETE' });
  }

  async updateCandidateStatus(candidateId: string, status: string) {
    return await this.request<{ message: string }>(`/api/talent-pool/${candidateId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // ── Candidate Profiles ─────────────────────────────────────────────

  async getProfiles(params: {
    page?: number; pageSize?: number; search?: string;
    category?: string; status?: string;
  } = {}) {
    const p = new URLSearchParams();
    if (params.page) p.set('page', String(params.page));
    if (params.pageSize) p.set('page_size', String(params.pageSize));
    if (params.search) p.set('search', params.search);
    if (params.category) p.set('category', params.category);
    if (params.status) p.set('status', params.status);
    return await this.request<PaginatedResponse<CandidateProfile>>(`/api/profiles?${p}`);
  }

  async parseResumeForProfile(file: File) {
    const formData = new FormData();
    formData.append('resume_file', file);
    return await this.uploadFile<{
      metadata: DeepResumeMetadata;
      resume_url: string;
      temp_filename: string;
    }>('/api/profiles/parse-resume', formData);
  }

  async createProfile(data: {
    full_name: string; email?: string; phone?: string; category?: string;
    current_role?: string; notes?: string; resume_url?: string;
    linkedin_url?: string; github_url?: string; portfolio_url?: string;
    parsed_metadata?: DeepResumeMetadata;
  }) {
    return await this.request<{ id: number; full_name: string; email: string; was_existing?: boolean; duplicate_info?: any }>('/api/profiles', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCandidateProfile(profileId: number) {
    return await this.request<CandidateProfile>(`/api/profiles/${profileId}`);
  }

  async updateCandidateProfile(profileId: number, data: Record<string, any>) {
    return await this.request<{ message: string }>(`/api/profiles/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async uploadCandidatePhoto(profileId: number, file: File): Promise<{ photo_url: string }> {
    const formData = new FormData();
    formData.append('photo', file);
    return await this.uploadFile<{ photo_url: string }>(`/api/candidates/${profileId}/photo`, formData);
  }

  async getProfileJobs(profileId: number) {
    return await this.request<any[]>(`/api/profiles/${profileId}/jobs`);
  }

  // ── Public Careers ───────────────────────────────────────────────────

  async getPublicJobs(params: {
    page?: number; pageSize?: number; search?: string;
    location?: string; location_type?: string; job_type?: string;
    experience?: string; salary_min?: number; salary_max?: number;
  } = {}) {
    const p = new URLSearchParams();
    if (params.page) p.set('page', String(params.page));
    if (params.pageSize) p.set('page_size', String(params.pageSize));
    if (params.search) p.set('search', params.search);
    if (params.location) p.set('location', params.location);
    if (params.location_type) p.set('location_type', params.location_type);
    if (params.job_type) p.set('job_type', params.job_type);
    if (params.experience) p.set('experience', params.experience);
    if (params.salary_min) p.set('salary_min', String(params.salary_min));
    if (params.salary_max) p.set('salary_max', String(params.salary_max));
    const url = `${API_BASE_URL}/api/careers/jobs?${p}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Failed to fetch jobs');
    return response.json();
  }

  async getPublicJobDetail(jobId: string) {
    const url = `${API_BASE_URL}/api/careers/jobs/${jobId}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Job not found');
    return response.json();
  }

  async getPublicScreeningQuestions(jobId: string) {
    const url = `${API_BASE_URL}/api/careers/jobs/${jobId}/screening-questions`;
    const response = await fetch(url);
    if (!response.ok) return [];
    return response.json();
  }

  // ── Candidate Applications ───────────────────────────────────────────

  async parseResume(file: File) {
    const formData = new FormData();
    formData.append('resume_file', file);
    return await this.uploadFile<{
      metadata: {
        full_name?: string;
        email?: string;
        phone?: string;
        location?: string;
        current_role?: string;
        years_of_experience?: number;
        linkedin_url?: string;
        github_url?: string;
        portfolio_url?: string;
        skills?: string[];
      };
      resume_url: string;
      temp_filename: string;
    }>('/api/applications/parse-resume', formData);
  }

  async applyToJob(formData: FormData) {
    return await this.uploadFile<{ application_id: number; status: string; message: string }>(
      '/api/applications', formData,
    );
  }

  async getMyApplications(page = 1, pageSize = 20) {
    return await this.request<PaginatedResponse<any>>(`/api/applications?page=${page}&page_size=${pageSize}`);
  }

  async getApplicationDetail(id: number) {
    return await this.request<any>(`/api/applications/${id}`);
  }

  async withdrawApplication(id: number) {
    return await this.request<{ message: string }>(`/api/applications/${id}`, { method: 'DELETE' });
  }

  // ── HR Application Management ────────────────────────────────────────

  async getJobApplications(jdId: number, page = 1, pageSize = 20) {
    return await this.request<PaginatedResponse<any>>(`/api/applications/job/${jdId}?page=${page}&page_size=${pageSize}`);
  }

  async updateApplicationStatus(applicationId: number, status: string) {
    return await this.request<{ message: string }>(`/api/applications/${applicationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status }),
    });
  }

  // ── Analytics ────────────────────────────────────────────────────────

  private _analyticsParams(jdId?: string, dateFrom?: string, dateTo?: string) {
    const p = new URLSearchParams();
    if (jdId) p.set('jd_id', jdId);
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    return p;
  }

  async getAnalyticsFunnel(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/funnel?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsTimeToHire(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/time-to-hire?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsSourceEffectiveness(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/source-effectiveness?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsVelocity(period?: string, jdId?: string, dateFrom?: string, dateTo?: string) {
    const p = this._analyticsParams(jdId, dateFrom, dateTo);
    if (period) p.set('period', period);
    return await this.request<any>(`/api/dashboard/analytics/velocity?${p}`);
  }

  async getAnalyticsOfferRate(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/offer-rate?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsInterviewerLoad(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/interviewer-load?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsRejectionReasons(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/rejection-reasons?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsRecruiterPerformance(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/recruiter-performance?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsTimeInStage(jdId?: string, dateFrom?: string, dateTo?: string) {
    return await this.request<any>(`/api/dashboard/analytics/time-in-stage?${this._analyticsParams(jdId, dateFrom, dateTo)}`);
  }

  async getAnalyticsSummary(dateFrom?: string, dateTo?: string) {
    const p = new URLSearchParams();
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    return await this.request<any>(`/api/dashboard/analytics/summary?${p}`);
  }

  async getJobBoardPerformance(dateFrom?: string, dateTo?: string) {
    const p = new URLSearchParams();
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    return await this.request<any>(`/api/dashboard/analytics/job-board-performance?${p}`);
  }

  async getSchedulingLag(dateFrom?: string, dateTo?: string) {
    const p = new URLSearchParams();
    if (dateFrom) p.set('date_from', dateFrom);
    if (dateTo) p.set('date_to', dateTo);
    return await this.request<any>(`/api/dashboard/analytics/scheduling-lag?${p}`);
  }

  // ── AI Job Polling ──────────────────────────────────────────────────

  async getAIJobStatus(jobId: number) {
    return await this.request<any>(`/api/ai-jobs/${jobId}`);
  }

  async getCandidateAIStatus(candidateId: number) {
    return await this.request<{ ai_status: string; ai_job_id: number | null; error?: string }>(`/api/candidates/${candidateId}/ai-status`);
  }

  // ── Candidate Feedback ────────────────────────────────────────────

  async getCandidateFeedback(candidateId: number) {
    return await this.request<any>(`/api/candidates/${candidateId}/feedback`);
  }

  async submitInterviewFeedback(scheduleId: number, data: {
    rating: number;
    recommendation: string;
    strengths?: string;
    concerns?: string;
    notes?: string;
  }) {
    return await this.request<any>(`/api/interview/schedule/${scheduleId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInterviewFeedback(scheduleId: number) {
    return await this.request<any[]>(`/api/interview/schedule/${scheduleId}/feedback`);
  }

  // ── Job Approval ──────────────────────────────────────────────────

  async requestJobApproval(jobId: string) {
    return await this.request<any>(`/api/job/${jobId}/request-approval`, { method: 'POST' });
  }

  async approveJob(jobId: string, comments?: string) {
    return await this.request<any>(`/api/job/${jobId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  }

  async rejectJob(jobId: string, comments?: string) {
    return await this.request<any>(`/api/job/${jobId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  }

  async getJobApprovals(jobId: string) {
    return await this.request<any[]>(`/api/job/${jobId}/approvals`);
  }

  async getPendingApprovals() {
    return await this.request<any[]>('/api/job/approvals/pending');
  }

  // ── Job Members ───────────────────────────────────────────────────

  async addJobMember(jobId: string, userId: number, role: string = 'viewer') {
    return await this.request<any>(`/api/job/${jobId}/members`, {
      method: 'POST',
      body: JSON.stringify({ user_id: userId, role }),
    });
  }

  async removeJobMember(jobId: string, userId: number) {
    return await this.request<any>(`/api/job/${jobId}/members/${userId}`, { method: 'DELETE' });
  }

  async getJobMembers(jobId: string) {
    return await this.request<any[]>(`/api/job/${jobId}/members`);
  }

  // ── Resume Versions ───────────────────────────────────────────────

  async uploadResumeVersion(applicationId: number, file: File) {
    const formData = new FormData();
    formData.append('resume_file', file);
    return await this.uploadFile<any>(`/api/applications/${applicationId}/resume`, formData);
  }

  async getResumeVersions(applicationId: number) {
    return await this.request<any[]>(`/api/applications/${applicationId}/resumes`);
  }

  // ── User Profile ──────────────────────────────────────────────────

  async getProfile() {
    return await this.request<any>('/api/auth/profile');
  }

  async updateProfile(data: { phone?: string; location?: string; current_role?: string; resume_url?: string }) {
    return await this.request<any>('/api/auth/profile', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ── Refresh Token ─────────────────────────────────────────────────

  async refreshAccessToken(refreshToken: string) {
    return await this.request<{ access_token: string; token_type: string; expires_in: number }>('/api/auth/refresh', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  async logoutServer(refreshToken: string) {
    return await this.request<{ message: string }>('/api/auth/logout', {
      method: 'POST',
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
  }

  // ── HR Application Status ─────────────────────────────────────────

  async updateApplicationStatusWithReason(applicationId: number, status: string, rejectionReason?: string) {
    return await this.request<{ message: string }>(`/api/applications/${applicationId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ status, rejection_reason: rejectionReason }),
    });
  }

  // ── OTP Signup Flow ──────────────────────────────────────────────────

  async initiateSignup(data: { first_name: string; last_name: string; email: string; phone: string; password: string }) {
    const url = `${API_BASE_URL}/api/auth/signup/candidate/initiate`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      const error: any = new Error(typeof body.detail === 'string' ? body.detail : body.detail?.duplicate_info?.message || 'Signup failed');
      error.status = response.status;
      error.data = body.detail;
      throw error;
    }
    return response.json() as Promise<{ session_token: string; message: string }>;
  }

  async verifyEmailOTP(sessionToken: string, otp: string) {
    const url = `${API_BASE_URL}/api/auth/signup/candidate/verify-email`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken, otp }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || 'Verification failed');
    }
    return response.json() as Promise<{ message: string }>;
  }

  async verifyPhoneOTP(sessionToken: string, otp: string) {
    const url = `${API_BASE_URL}/api/auth/signup/candidate/verify-phone`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken, otp }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || 'Verification failed');
    }
    return response.json() as Promise<{ access_token: string; refresh_token: string; token_type: string; expires_in: number }>;
  }

  async resendOTP(sessionToken: string, type: 'email' | 'phone') {
    const url = `${API_BASE_URL}/api/auth/signup/candidate/resend-otp`;
    const response = await fetch(url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ session_token: sessionToken, type }),
    });
    if (!response.ok) {
      const body = await response.json().catch(() => ({}));
      throw new Error(body.detail || 'Failed to resend code');
    }
    return response.json() as Promise<{ message: string }>;
  }

  // ── Lock Status ───────────────────────────────────────────────────────

  async checkLockStatus(jobId: string) {
    return await this.request<{ locked: boolean; lock_expiry?: string; remaining_days?: number; message?: string }>(
      `/api/careers/jobs/${jobId}/lock-status`,
    );
  }

  // ── ATS Settings ──────────────────────────────────────────────────────

  async getATSSettings() {
    return await this.request<{
      default_rejection_lock_days: number;
      rejection_lock_enabled: boolean;
      otp_email_required: boolean;
      otp_phone_required: boolean;
      otp_expiry_minutes: number;
      otp_max_attempts: number;
    }>('/api/settings/ats');
  }

  async updateATSSettings(data: {
    default_rejection_lock_days: number;
    rejection_lock_enabled: boolean;
    otp_email_required: boolean;
    otp_phone_required: boolean;
    otp_expiry_minutes: number;
    otp_max_attempts: number;
  }) {
    return await this.request<{ message: string }>('/api/settings/ats', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ── Theme Settings ──────────────────────────────────────────────────

  async getOrgTheme() {
    return await this.request<{ mode: string; accent_color: string }>('/api/settings/theme');
  }

  async updateOrgTheme(data: { mode?: string; accent_color?: string }) {
    return await this.request<{ message: string }>('/api/settings/theme', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async getUserTheme() {
    return await this.request<{ theme_preference: string | null }>('/api/settings/user-theme');
  }

  async updateUserTheme(theme_preference: string) {
    return await this.request<{ message: string }>('/api/settings/user-theme', {
      method: 'PUT',
      body: JSON.stringify({ theme_preference }),
    });
  }

  // ── Orchestrator ────────────────────────────────────────────────────

  async getOrchestratorExecutions(params?: {
    workflow_type?: string;
    status?: string;
    page?: number;
    page_size?: number;
  }) {
    const searchParams = new URLSearchParams();
    if (params?.workflow_type) searchParams.set('workflow_type', params.workflow_type);
    if (params?.status) searchParams.set('status', params.status);
    searchParams.set('page', String(params?.page ?? 1));
    searchParams.set('page_size', String(params?.page_size ?? 20));
    return await this.request<PaginatedResponse<any>>(`/api/orchestrator/executions?${searchParams}`);
  }

  async getOrchestratorExecutionDetail(executionId: string) {
    return await this.request<any>(`/api/orchestrator/executions/${executionId}`);
  }

  async getOrchestratorStats() {
    return await this.request<{
      total: number;
      completed: number;
      failed: number;
      success_rate: number;
      avg_duration_ms: number;
      by_workflow: Record<string, number>;
    }>('/api/orchestrator/executions/stats/summary');
  }

  // ── Interviewer Management ──────────────────────────────────────────
  async inviteInterviewer(data: { email: string; first_name: string; last_name: string; specializations?: string[]; seniority?: string; department?: string }) {
    return await this.request<{ profile_id: number; user_id: number; invite_url: string; message: string }>('/api/interviewers/invite', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInterviewers(params?: { search?: string; specialization?: string; department?: string; active_only?: boolean }) {
    const query = new URLSearchParams();
    if (params?.search) query.set('search', params.search);
    if (params?.specialization) query.set('specialization', params.specialization);
    if (params?.department) query.set('department', params.department);
    if (params?.active_only !== undefined) query.set('active_only', String(params.active_only));
    const qs = query.toString();
    return await this.request<any[]>(`/api/interviewers${qs ? `?${qs}` : ''}`);
  }

  async getInterviewerProfile(profileId: number) {
    return await this.request<any>(`/api/interviewers/${profileId}`);
  }

  async updateInterviewerProfile(profileId: number, data: any) {
    return await this.request<any>(`/api/interviewers/${profileId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async toggleInterviewerStatus(profileId: number, isActive: boolean) {
    return await this.request<any>(`/api/interviewers/${profileId}/status`, {
      method: 'PATCH',
      body: JSON.stringify({ is_active: isActive }),
    });
  }

  // ── Interviewer Dashboard ─────────────────────────────────────────────
  async getMyInterviews(status?: string) {
    const query = status ? `?status=${status}` : '';
    return await this.request<any[]>(`/api/interviewers/me/interviews${query}`);
  }

  async getMyInterviewStats() {
    return await this.request<any>('/api/interviewers/me/stats');
  }

  // ── Panel Builder ─────────────────────────────────────────────────────
  async createInterviewPanel(data: { candidate_id: number; jd_id: number; rounds: any[] }) {
    return await this.request<any>('/api/interview/panel', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getInterviewPanel(candidateId: number, jdId: number) {
    return await this.request<any[]>(`/api/interview/panel/${candidateId}/${jdId}`);
  }

  // ── Enhanced Feedback ─────────────────────────────────────────────────
  async submitEnhancedFeedback(scheduleId: number, data: {
    rating: number;
    recommendation: string;
    strengths: string;
    concerns?: string;
    notes?: string;
    would_interview_again?: boolean;
    criteria_scores?: Record<string, { score: number; comment: string }>;
    rubric_scores?: Record<string, { score: number; comment: string }>;
  }) {
    return await this.request<any>(`/api/interview/schedule/${scheduleId}/feedback`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getAggregateFeedback(candidateId: number, jdId: number) {
    return await this.request<any>(`/api/interview/feedback/candidate/${candidateId}/${jdId}`);
  }

  // ── Invite ────────────────────────────────────────────────────────────
  async acceptInvite(token: string, password: string) {
    return await this.request<any>('/api/auth/accept-invite', {
      method: 'POST',
      body: JSON.stringify({ token, password }),
    });
  }

  // ── Referrals ──────────────────────────────────────────────────────────

  async createReferralLink(jdId: number) {
    return await this.request<any>('/api/referrals/links', {
      method: 'POST',
      body: JSON.stringify({ jd_id: jdId }),
    });
  }

  async getReferralLinks(jdId?: number) {
    const p = jdId ? `?jd_id=${jdId}` : '';
    return await this.request<any[]>(`/api/referrals/links${p}`);
  }

  async trackReferral(code: string) {
    const url = `${API_BASE_URL}/api/referrals/track/${code}`;
    const response = await fetch(url);
    if (!response.ok) throw new Error('Invalid referral code');
    return response.json();
  }

  async getReferralLeaderboard() {
    return await this.request<any[]>('/api/referrals/leaderboard');
  }

  async getMyReferrals() {
    return await this.request<any[]>('/api/referrals/mine');
  }

  // ── CSV Import ─────────────────────────────────────────────────────────

  async previewCSV(file: File) {
    const formData = new FormData();
    formData.append('file', file);
    return await this.uploadFile<{ headers: string[]; sample_rows: any[] }>('/api/candidates/csv-preview', formData);
  }

  async importCSV(jdId: number | null, file: File, fieldMapping: Record<string, string>) {
    const formData = new FormData();
    formData.append('file', file);
    if (jdId !== null) formData.append('jd_id', String(jdId));
    formData.append('field_mapping', JSON.stringify(fieldMapping));
    return await this.uploadFile<{ imported: number; skipped: number; errors: string[] }>('/api/candidates/csv-import', formData);
  }

  // ── Job Boards ─────────────────────────────────────────────────────────

  async publishToJobBoard(jdId: number, boardName: string) {
    return await this.request<any>('/api/job-boards/publish', {
      method: 'POST',
      body: JSON.stringify({ jd_id: jdId, board_name: boardName }),
    });
  }

  async removeJobBoardPosting(postingId: number) {
    return await this.request<any>(`/api/job-boards/${postingId}`, { method: 'DELETE' });
  }

  async getJobBoardPostings(jdId: number) {
    return await this.request<any[]>(`/api/job-boards?jd_id=${jdId}`);
  }

  // ── Outreach Campaigns ────────────────────────────────────────────────

  async createCampaign(data: { name: string; jd_id?: number; template_subject: string; template_body: string; audience_filter?: any; campaign_type?: string }) {
    return await this.request<any>('/api/outreach/campaigns', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getCampaigns(page = 1, pageSize = 20) {
    return await this.request<any>(`/api/outreach/campaigns?page=${page}&page_size=${pageSize}`);
  }

  async getCampaignDetail(campaignId: number) {
    return await this.request<any>(`/api/outreach/campaigns/${campaignId}`);
  }

  async addCampaignStep(campaignId: number, data: { step_number: number; delay_days: number; subject: string; body: string }) {
    return await this.request<any>(`/api/outreach/campaigns/${campaignId}/steps`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async addCampaignRecipients(campaignId: number, recipients: { email: string; name?: string; company?: string }[]) {
    return await this.request<any>(`/api/outreach/campaigns/${campaignId}/recipients`, {
      method: 'POST',
      body: JSON.stringify({ recipients }),
    });
  }

  async sendCampaign(campaignId: number) {
    return await this.request<any>(`/api/outreach/campaigns/${campaignId}/send`, { method: 'POST' });
  }

  // ── Stage Automations ──────────────────────────────────────────────────

  async createStageAutomation(data: { jd_id: number; trigger_stage: string; email_subject: string; email_body: string }) {
    return await this.request<any>('/api/outreach/automations', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getStageAutomations(jdId?: number) {
    const p = jdId ? `?jd_id=${jdId}` : '';
    return await this.request<any[]>(`/api/outreach/automations${p}`);
  }

  async updateStageAutomation(id: number, data: any) {
    return await this.request<any>(`/api/outreach/automations/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteStageAutomation(id: number) {
    return await this.request<any>(`/api/outreach/automations/${id}`, { method: 'DELETE' });
  }

  // ── AI Toolkit ─────────────────────────────────────────────────────────

  async rankCandidates(jdId: number) {
    const res = await this.request<any>(`/api/ai-tools/rank/${jdId}`);
    return (res?.rankings ?? res ?? []) as any[];
  }

  async generateInterviewQuestions(jdId: number, candidateId: number) {
    const res = await this.request<any>(`/api/ai-tools/questions/${jdId}/${candidateId}`);
    return (res?.questions ?? res ?? []) as any[];
  }

  async getSalaryIntelligence(jdId: number, country?: string) {
    const params = country ? `?country=${encodeURIComponent(country)}` : '';
    return await this.request<any>(`/api/ai-tools/salary/${jdId}${params}`);
  }

  async getSkillsGap(jdId: number, candidateId: number) {
    return await this.request<any>(`/api/ai-tools/skills-gap/${jdId}/${candidateId}`);
  }

  async scoreScreening(jdId: number, candidateId: number) {
    const res = await this.request<any>(`/api/ai-tools/score-screening/${jdId}/${candidateId}`, { method: 'POST' });
    return (res?.scores ?? res ?? []) as any[];
  }

  // ── Candidate Scorecard ────────────────────────────────────────────────

  async getCandidateScorecard(candidateId: number, jdId?: number) {
    const p = jdId ? `?jd_id=${jdId}` : '';
    return await this.request<any>(`/api/scorecard/${candidateId}${p}`);
  }

  async compareCandidates(candidateIds: number[], jdId: number) {
    return await this.request<any>('/api/scorecard/compare', {
      method: 'POST',
      body: JSON.stringify({ candidate_ids: candidateIds, jd_id: jdId }),
    });
  }

  async getCandidateTimeline(candidateId: number) {
    return await this.request<any[]>(`/api/scorecard/${candidateId}/timeline`);
  }

  // ── Data Export / GDPR ─────────────────────────────────────────────────

  async exportCandidate(candidateId: number, format: 'json' | 'csv' = 'json') {
    return await this.request<any>(`/api/export/candidate/${candidateId}?format=${format}`);
  }

  async eraseCandidate(candidateId: number) {
    return await this.request<any>(`/api/export/candidate/${candidateId}/erase`, { method: 'DELETE' });
  }

  async exportJobCandidates(jdId: number) {
    return await this.request<any>(`/api/export/job/${jdId}/candidates?format=csv`);
  }

  // ── Compliance ─────────────────────────────────────────────────────────

  async getDiversityStats() {
    return await this.request<any>('/api/compliance/diversity');
  }

  async getSLAStats(jdId?: number) {
    const p = jdId ? `?jd_id=${jdId}` : '';
    return await this.request<any>(`/api/compliance/sla${p}`);
  }

  async getEEOSummary() {
    return await this.request<any>('/api/compliance/eeo');
  }

  // ── Pipeline Config ────────────────────────────────────────────────────

  async getPipelineConfig(jdId: number) {
    return await this.request<any[]>(`/api/pipeline-config/?jd_id=${jdId}`);
  }

  async setPipelineConfig(jdId: number, stages: any[]) {
    return await this.request<any>(`/api/pipeline-config/${jdId}`, {
      method: 'PUT',
      body: JSON.stringify(stages),
    });
  }

  // ── Approvals (new endpoints) ──────────────────────────────────────────

  async requestApproval(jobId: number) {
    return await this.request<any>(`/api/approvals/${jobId}/request`, { method: 'POST' });
  }

  async approveJobApproval(jobId: number, comments?: string) {
    return await this.request<any>(`/api/approvals/${jobId}/approve`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  }

  async rejectJobApproval(jobId: number, comments?: string) {
    return await this.request<any>(`/api/approvals/${jobId}/reject`, {
      method: 'POST',
      body: JSON.stringify({ comments }),
    });
  }

  async getApprovalHistory(jobId: number) {
    return await this.request<any[]>(`/api/approvals/${jobId}`);
  }

  async getAllPendingApprovals() {
    return await this.request<any[]>('/api/approvals/pending');
  }

  // ── AI Interview ─────────────────────────────────────────────────

  async sendAIInterviewInvite(candidateId: number, jdId: number, config: {
    email?: string;
    interview_type?: string;
    max_questions?: number;
    time_limit_minutes?: number;
    include_coding?: boolean;
    coding_language?: string;
  } = {}) {
    return await this.request<{ session_id: number; token: string; invite_url: string }>('/api/ai-interview/invite', {
      method: 'POST',
      body: JSON.stringify({ candidate_id: candidateId, jd_id: jdId, ...config }),
    });
  }

  async getAIInterviewSessions(jdId: number) {
    return await this.request<AIInterviewSession[]>(`/api/ai-interview/sessions/${jdId}`);
  }

  async getAIInterviewResults(sessionId: number) {
    return await this.request<AIInterviewResults>(`/api/ai-interview/results/${sessionId}`);
  }

  async cancelAIInterview(sessionId: number) {
    return await this.request<void>(`/api/ai-interview/${sessionId}`, { method: 'DELETE' });
  }

  // ── Ad-hoc Email ────────────────────────────────────────────────────────

  async sendAdhocEmail(to: string, subject: string, body: string, candidateId?: number) {
    return await this.request<any>('/api/outreach/email/send', {
      method: 'POST',
      body: JSON.stringify({ to, subject, body, candidate_id: candidateId }),
    });
  }

  async getCampaignStats(campaignId: number) {
    return await this.request<any>(`/api/outreach/campaigns/${campaignId}`);
  }

  // ── LinkedIn Integration ────────────────────────────────────────────────

  async postJobToLinkedIn(jobId: number, message?: string) {
    return await this.request<any>('/api/linkedin/post-job', {
      method: 'POST',
      body: JSON.stringify({ job_data: { job_id: jobId, message } }),
    });
  }

  async getLinkedInProfile(url: string) {
    return await this.request<any>(`/api/linkedin/profile?url=${encodeURIComponent(url)}`);
  }

  async sendLinkedInMessage(recipientUrl: string, message: string) {
    return await this.request<any>('/api/linkedin/message', {
      method: 'POST',
      body: JSON.stringify({ recipient_urn: recipientUrl, message }),
    });
  }

  // ── Pipeline Documents ─────────────────────────────────────────────

  async getStageDocumentRules(stage?: string) {
    const params = stage ? `?stage=${stage}` : '';
    return await this.request<{ rules: any[]; by_stage: Record<string, any[]> }>(`/api/candidates/stage-document-rules${params}`);
  }

  async createStageDocumentRule(data: { stage: string; template_id: number; template_name: string; template_category?: string; is_required?: boolean }) {
    return await this.request<any>('/api/candidates/stage-document-rules', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteStageDocumentRule(ruleId: number) {
    return await this.request<{ deleted: boolean }>(`/api/candidates/stage-document-rules/${ruleId}`, {
      method: 'DELETE',
    });
  }

  async getCandidateDocuments(candidateId: number, jdId?: number) {
    const params = jdId ? `?jd_id=${jdId}` : '';
    return await this.request<{ documents: any[] }>(`/api/candidates/${candidateId}/documents${params}`);
  }

  async generateCandidateDocument(candidateId: number, docId: number, variables: Record<string, string> = {}) {
    return await this.request<any>(`/api/candidates/${candidateId}/documents/${docId}/generate`, {
      method: 'POST',
      body: JSON.stringify({ variables }),
    });
  }

  async updateDocumentStatus(candidateId: number, docId: number, status: string) {
    return await this.request<any>(`/api/candidates/${candidateId}/documents/${docId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status }),
    });
  }

  // ── Provider Settings (Email / SMS / AI) ──────────────────────────────

  async getEmailProviderSettings() {
    return await this.request<Record<string, any>>('/api/settings/email');
  }

  async updateEmailProviderSettings(data: Record<string, any>) {
    return await this.request<{ message: string }>('/api/settings/email', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testEmailProvider(to: string) {
    return await this.request<{ message: string }>('/api/settings/email/test', {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
  }

  async getSMSProviderSettings() {
    return await this.request<Record<string, any>>('/api/settings/sms');
  }

  async updateSMSProviderSettings(data: Record<string, any>) {
    return await this.request<{ message: string }>('/api/settings/sms', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testSMSProvider(to: string) {
    return await this.request<{ message: string }>('/api/settings/sms/test', {
      method: 'POST',
      body: JSON.stringify({ to }),
    });
  }

  async getAIProviderSettings() {
    return await this.request<Record<string, any>>('/api/settings/ai-provider');
  }

  async updateAIProviderSettings(data: Record<string, any>) {
    return await this.request<{ message: string }>('/api/settings/ai-provider', {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async testAIProvider() {
    return await this.request<{ message: string }>('/api/settings/ai-provider/test', {
      method: 'POST',
      body: JSON.stringify({}),
    });
  }

  // ── Job Metadata ────────────────────────────────────────────────────

  async updateJobMetadata(jobId: string, data: Record<string, any>) {
    return await this.request<{ message: string }>(`/api/job/${jobId}/metadata`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ── Hiring Costs ────────────────────────────────────────────────────

  async addHiringCost(jobId: string, data: { cost_type: string; amount: number; currency?: string; description?: string }) {
    return await this.request<any>(`/api/job/${jobId}/costs`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getHiringCosts(jobId: string) {
    return await this.request<any[]>(`/api/job/${jobId}/costs`);
  }

  async deleteHiringCost(costId: number) {
    return await this.request<{ message: string }>(`/api/job/costs/${costId}`, { method: 'DELETE' });
  }

  async getCostPerHire(jdId?: number) {
    const p = jdId ? `?jd_id=${jdId}` : '';
    return await this.request<any>(`/api/job/analytics/cost-per-hire${p}`);
  }

  // ── Job Requests ────────────────────────────────────────────────────

  async createJobRequest(data: Record<string, any>) {
    return await this.request<any>('/api/job-requests', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getJobRequests(status?: string, mine?: boolean) {
    const p = new URLSearchParams();
    if (status) p.set('status', status);
    if (mine) p.set('mine', 'true');
    return await this.request<any[]>(`/api/job-requests?${p}`);
  }

  async getJobRequest(id: number) {
    return await this.request<any>(`/api/job-requests/${id}`);
  }

  async reviewJobRequest(id: number, action: 'approved' | 'rejected', comments?: string) {
    return await this.request<any>(`/api/job-requests/${id}/review`, {
      method: 'POST',
      body: JSON.stringify({ action, comments }),
    });
  }

  async convertJobRequest(id: number, jobId: number) {
    return await this.request<{ message: string }>(`/api/job-requests/${id}/convert`, {
      method: 'POST',
      body: JSON.stringify({ job_id: jobId }),
    });
  }

  // ── JD Templates ────────────────────────────────────────────────────

  async getJDTemplates(category?: string) {
    const p = category ? `?category=${encodeURIComponent(category)}` : '';
    return await this.request<any[]>(`/api/jd-templates${p}`);
  }

  async getJDTemplate(id: number) {
    return await this.request<any>(`/api/jd-templates/${id}`);
  }

  async getJDTemplateCategories() {
    return await this.request<string[]>('/api/jd-templates/categories');
  }

  async createJDTemplate(data: Record<string, any>) {
    return await this.request<any>('/api/jd-templates', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJDTemplate(id: number, data: Record<string, any>) {
    return await this.request<any>(`/api/jd-templates/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteJDTemplate(id: number) {
    return await this.request<{ message: string }>(`/api/jd-templates/${id}`, { method: 'DELETE' });
  }

  async useJDTemplate(id: number) {
    return await this.request<any>(`/api/jd-templates/${id}/use`, { method: 'POST' });
  }

  // ── Job Portals ─────────────────────────────────────────────────────

  async getJobPortals() {
    return await this.request<any[]>('/api/portals');
  }

  async addJobPortal(data: Record<string, any>) {
    return await this.request<any>('/api/portals', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async updateJobPortal(id: number, data: Record<string, any>) {
    return await this.request<any>(`/api/portals/${id}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteJobPortal(id: number) {
    return await this.request<{ message: string }>(`/api/portals/${id}`, { method: 'DELETE' });
  }

  async testJobPortal(id: number) {
    return await this.request<{ success: boolean; message: string; type?: string }>(`/api/portals/${id}/test`, { method: 'POST' });
  }

  async syncJobPortal(id: number, action: string) {
    return await this.request<any>(`/api/portals/${id}/sync`, {
      method: 'POST',
      body: JSON.stringify({ action }),
    });
  }

  // ── Analytics ───────────────────────────────────────────────────────

  async getJobAttractiveness(jdId: number) {
    return await this.request<any>(`/api/dashboard/analytics/job-attractiveness/${jdId}`);
  }

  async getSourceAnalytics(jdId?: number) {
    const p = jdId ? `?jd_id=${jdId}` : '';
    return await this.request<any>(`/api/dashboard/analytics/source-analytics${p}`);
  }

  async getCompatibilityScore(jdId: number, candidateId: number) {
    return await this.request<any>(`/api/dashboard/analytics/compatibility/${jdId}/${candidateId}`);
  }

  // ── Interview Rescheduling ──────────────────────────────────────────

  async rescheduleInterview(scheduleId: number, data: { new_date: string; new_time: string; reason?: string }) {
    return await this.request<{ message: string }>(`/api/interview/schedule/${scheduleId}/reschedule`, {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async getRescheduleHistory(scheduleId: number) {
    return await this.request<any[]>(`/api/interview/schedule/${scheduleId}/reschedule-history`);
  }

  // ── Referral Rewards ────────────────────────────────────────────────

  async updateReferralReward(referralId: number, data: { reward_type?: string; reward_amount?: number; reward_currency?: string; reward_status?: string }) {
    return await this.request<any>(`/api/referrals/${referralId}/reward`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  // ── Lead Generation ──────────────────────────────────────────────────

  async getLeadLists(page = 1, pageSize = 20, jdId?: number) {
    const p = new URLSearchParams({ page: String(page), page_size: String(pageSize) });
    if (jdId) p.set('jd_id', String(jdId));
    return await this.request<any>(`/api/leads/lists?${p}`);
  }

  async getLeadList(listId: number) {
    return await this.request<any>(`/api/leads/lists/${listId}`);
  }

  async createLeadList(data: { name: string; description?: string; source?: string; jd_id?: number }) {
    return await this.request<any>('/api/leads/lists', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  async deleteLeadList(listId: number) {
    return await this.request<any>(`/api/leads/lists/${listId}`, { method: 'DELETE' });
  }

  async addLeadsToList(listId: number, leads: any[]) {
    return await this.request<any>(`/api/leads/lists/${listId}/leads`, {
      method: 'POST',
      body: JSON.stringify({ leads }),
    });
  }

  async updateLead(leadId: number, data: any) {
    return await this.request<any>(`/api/leads/leads/${leadId}`, {
      method: 'PUT',
      body: JSON.stringify(data),
    });
  }

  async deleteLead(leadId: number) {
    return await this.request<any>(`/api/leads/leads/${leadId}`, { method: 'DELETE' });
  }

  async getLeadStats(listId?: number) {
    const p = listId ? `?list_id=${listId}` : '';
    return await this.request<any>(`/api/leads/stats${p}`);
  }

  async pushLeadsToCampaign(listId: number, campaignId: number) {
    return await this.request<any>(`/api/leads/lists/${listId}/push-to-campaign`, {
      method: 'POST',
      body: JSON.stringify({ campaign_id: campaignId }),
    });
  }

  async addLeadToTalentPool(leadId: number) {
    return await this.request<{ message: string; profile_id: number; was_existing: boolean }>(`/api/leads/leads/${leadId}/add-to-talent-pool`, {
      method: 'POST',
    });
  }

  async discoverLeads(data: { role: string; skills?: string[]; location?: string; experience_min?: number; platforms?: string[]; jd_id?: number; jd_context?: string; max_results?: number }) {
    return await this.request<any>('/api/orchestrator/leads/discover', {
      method: 'POST',
      body: JSON.stringify(data),
    });
  }

  // ── Notifications ─────────────────────────────────────────────────────

  async getNotifications(params: { unread_only?: boolean; page?: number; page_size?: number } = {}) {
    const searchParams = new URLSearchParams();
    if (params.unread_only !== undefined) searchParams.set('unread_only', String(params.unread_only));
    if (params.page !== undefined) searchParams.set('page', String(params.page));
    if (params.page_size !== undefined) searchParams.set('page_size', String(params.page_size));
    const qs = searchParams.toString();
    return await this.request<any>(`/api/notifications${qs ? `?${qs}` : ''}`);
  }

  async getUnreadNotificationCount() {
    return await this.request<{ unread_count: number }>('/api/notifications/unread-count');
  }

  async markNotificationRead(id: number) {
    return await this.request<any>(`/api/notifications/${id}/read`, { method: 'PUT' });
  }

  async markAllNotificationsRead() {
    return await this.request<any>('/api/notifications/mark-all-read', { method: 'PUT' });
  }

  // ── Inbox Capture ─────────────────────────────────────────────────────

  async getInboxConfigs() {
    return await this.request<any[]>('/api/inbox-capture/configs');
  }

  async createInboxConfig(data: { name: string; imap_host: string; imap_port: number; username: string; password: string; use_ssl?: boolean; folder?: string }) {
    return await this.request<any>('/api/inbox-capture/configs', { method: 'POST', body: JSON.stringify(data) });
  }

  async deleteInboxConfig(id: number) {
    return await this.request<any>(`/api/inbox-capture/configs/${id}`, { method: 'DELETE' });
  }

  async scanInbox(configId: number) {
    return await this.request<any>(`/api/inbox-capture/configs/${configId}/scan`, { method: 'POST' });
  }

  async getCaptureLogs(params: { config_id?: number; status?: string; page?: number; page_size?: number } = {}) {
    const q = new URLSearchParams();
    if (params.config_id) q.set('config_id', String(params.config_id));
    if (params.status) q.set('status', params.status);
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    return await this.request<any>(`/api/inbox-capture/logs?${q.toString()}`);
  }

  async updateCaptureLogStatus(logId: number, status: string, candidateId?: number) {
    return await this.request<any>(`/api/inbox-capture/logs/${logId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status, candidate_id: candidateId }),
    });
  }

  // ── Workflows ──────────────────────────────────────────────────────────
  async getWorkflows(params: { page?: number; page_size?: number; status?: string; search?: string } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    if (params.status) q.set('status', params.status);
    if (params.search) q.set('search', params.search);
    return await this.request<any>(`/api/workflows?${q.toString()}`);
  }

  async getWorkflow(id: number) {
    return await this.request<any>(`/api/workflows/${id}`);
  }

  async createWorkflow(data: { name: string; description?: string; template_id?: string; definition_json?: any }) {
    return await this.request<any>('/api/workflows', { method: 'POST', body: JSON.stringify(data) });
  }

  async updateWorkflow(id: number, data: { name?: string; description?: string; definition_json?: any; status?: string }) {
    return await this.request<any>(`/api/workflows/${id}`, { method: 'PUT', body: JSON.stringify(data) });
  }

  async deleteWorkflow(id: number) {
    return await this.request<any>(`/api/workflows/${id}`, { method: 'DELETE' });
  }

  async duplicateWorkflow(id: number) {
    return await this.request<any>(`/api/workflows/${id}/duplicate`, { method: 'POST' });
  }

  async getWorkflowNodeTypes() {
    return await this.request<any[]>('/api/workflows/node-types');
  }

  async getWorkflowTemplates() {
    return await this.request<any[]>('/api/workflows/templates');
  }

  async startWorkflowRun(workflowId: number, inputData?: Record<string, any>) {
    return await this.request<any>(`/api/workflows/${workflowId}/run`, {
      method: 'POST',
      body: JSON.stringify({ input_data: inputData }),
    });
  }

  async getWorkflowRuns(workflowId: number, params: { page?: number; page_size?: number } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    return await this.request<any>(`/api/workflows/${workflowId}/runs?${q.toString()}`);
  }

  async getWorkflowRun(runId: number) {
    return await this.request<any>(`/api/workflows/runs/${runId}`);
  }

  async cancelWorkflowRun(runId: number) {
    return await this.request<any>(`/api/workflows/runs/${runId}/cancel`, { method: 'POST' });
  }

  async getWorkflowRunLeads(runId: number, params: { page?: number; page_size?: number } = {}) {
    const q = new URLSearchParams();
    if (params.page) q.set('page', String(params.page));
    if (params.page_size) q.set('page_size', String(params.page_size));
    return await this.request<any>(`/api/workflows/runs/${runId}/leads?${q.toString()}`);
  }
}

export const apiClient = new ApiClient();
