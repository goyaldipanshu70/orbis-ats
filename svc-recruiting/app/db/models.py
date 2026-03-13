from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, Float, ForeignKey, UniqueConstraint, Numeric
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func
from datetime import datetime


class Base(DeclarativeBase):
    pass


class JobDescription(Base):
    __tablename__ = "job_descriptions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), nullable=False, index=True)
    ai_result = Column(JSONB, nullable=False, default=dict)
    rubric_text = Column(Text, nullable=False, default="")
    model_answer_text = Column(Text, nullable=False, default="")
    uploaded_file_info = Column(JSONB, nullable=False, default=list)
    status = Column(String(20), nullable=False, default="Open", index=True)
    country = Column(String(100), nullable=True, index=True)
    city = Column(String(100), nullable=True, index=True)
    visibility = Column(String(20), nullable=False, default="internal", server_default="internal")
    approval_status = Column(String(20), nullable=False, default="approved", server_default="approved")
    approval_required = Column(Boolean, nullable=False, default=False, server_default="false")
    number_of_vacancies = Column(Integer, nullable=False, default=1, server_default="1")
    rejection_lock_days = Column(Integer, nullable=True)  # NULL = use global default
    auto_ai_interview = Column(Boolean, nullable=False, default=False, server_default="false")
    # Feature 4: Job Metadata
    job_type = Column(String(30), nullable=True)  # full_time, part_time, contract, internship, freelance
    position_type = Column(String(30), nullable=True)  # individual_contributor, team_lead, manager, director, executive
    experience_range = Column(String(50), nullable=True)  # e.g. "3-5 years"
    salary_range_min = Column(Numeric(12, 2), nullable=True)
    salary_range_max = Column(Numeric(12, 2), nullable=True)
    salary_currency = Column(String(10), nullable=True, default="USD")
    salary_visibility = Column(String(30), nullable=False, default="hidden", server_default="hidden")  # public, hidden, visible_after_screening, visible_after_interview
    location_type = Column(String(20), nullable=True)  # onsite, remote, hybrid
    # Feature 13: Hiring Close Date
    hiring_close_date = Column(DateTime, nullable=True)
    # AI cache columns
    ai_generated_jd = Column(JSONB, nullable=True)
    ai_bias_check = Column(JSONB, nullable=True)
    ai_salary_estimate = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(50), nullable=True)


class JobLocationVacancy(Base):
    __tablename__ = "job_location_vacancies"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    country = Column(String(100), nullable=False)
    city = Column(String(100), nullable=False)
    vacancies = Column(Integer, nullable=False, default=1)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("jd_id", "country", "city", name="uq_job_location"),
    )


class Candidate(Base):
    """LEGACY — kept for migration; new code uses CandidateProfile + CandidateJobEntry."""
    __tablename__ = "candidates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), nullable=False)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    ai_resume_analysis = Column(JSONB, nullable=False, default=dict)
    resume_url = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active", index=True)
    source = Column(String(20), nullable=False, default="manual", server_default="manual")
    application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=True)
    onboard = Column(Boolean, nullable=False, default=False)
    screening = Column(Boolean, nullable=False, default=False)
    interview_status = Column(Boolean, nullable=False, default=False)
    pipeline_stage = Column(String(20), nullable=False, default="applied", server_default="applied")
    stage_changed_at = Column(DateTime, nullable=True)
    stage_changed_by = Column(String(50), nullable=True)
    category = Column(String(50), nullable=True)
    parsed_metadata = Column(JSONB, nullable=True)
    has_complete_profile = Column(Boolean, nullable=False, default=False, server_default="false")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    imported_at = Column(DateTime, nullable=True)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(50), nullable=True)


class CandidateProfile(Base):
    """Person-level identity, deduplicated by email."""
    __tablename__ = "candidate_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    email = Column(String(255), nullable=True, index=True)
    full_name = Column(String(300), nullable=True)
    phone = Column(String(50), nullable=True)
    resume_url = Column(Text, nullable=True)
    linkedin_url = Column(Text, nullable=True)
    github_url = Column(Text, nullable=True)
    portfolio_url = Column(Text, nullable=True)
    photo_url = Column(Text, nullable=True)
    status = Column(String(20), nullable=False, default="active", server_default="active", index=True)
    category = Column(String(50), nullable=True, index=True)
    parsed_metadata = Column(JSONB, nullable=True)
    notes = Column(Text, nullable=True)
    original_source = Column(String(30), nullable=False, default="manual", server_default="manual")
    created_by = Column(String(50), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)


class CandidateJobEntry(Base):
    """One row per person per job — job-specific evaluation data."""
    __tablename__ = "candidate_job_entries"

    id = Column(Integer, primary_key=True, autoincrement=True)
    profile_id = Column(Integer, ForeignKey("candidate_profiles.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(String(50), nullable=False)
    ai_resume_analysis = Column(JSONB, nullable=False, default=dict)
    pipeline_stage = Column(String(20), nullable=False, default="applied", server_default="applied", index=True)
    stage_changed_at = Column(DateTime, nullable=True)
    stage_changed_by = Column(String(50), nullable=True)
    onboard = Column(Boolean, nullable=False, default=False)
    screening = Column(Boolean, nullable=False, default=False)
    interview_status = Column(Boolean, nullable=False, default=False)
    source = Column(String(20), nullable=False, default="manual", server_default="manual")
    application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=True)
    imported_at = Column(DateTime, nullable=True)
    hired_location_id = Column(Integer, ForeignKey("job_location_vacancies.id", ondelete="SET NULL"), nullable=True)
    # AI cache columns
    ai_fit_summary = Column(JSONB, nullable=True)
    ai_ranking_score = Column(JSONB, nullable=True)
    ai_skills_gap = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)

    __table_args__ = (
        UniqueConstraint("profile_id", "jd_id", name="uq_profile_job"),
    )


class JobApplication(Base):
    __tablename__ = "job_applications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, index=True)
    user_email = Column(String(255), nullable=False)
    user_name = Column(String(255), nullable=False)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="SET NULL"), nullable=True)
    resume_url = Column(Text, nullable=False)
    phone = Column(String(30), nullable=True)
    linkedin_url = Column(Text, nullable=True)
    github_url = Column(Text, nullable=True)
    portfolio_url = Column(Text, nullable=True)
    cover_letter = Column(Text, nullable=True)
    source = Column(String(50), nullable=True, default="direct")
    referral_code = Column(String(50), nullable=True)
    status = Column(String(30), nullable=False, default="submitted", server_default="submitted")
    pipeline_stage = Column(String(20), nullable=False, default="applied", server_default="applied")
    stage_changed_at = Column(DateTime, nullable=True)
    stage_changed_by = Column(String(50), nullable=True)
    status_message = Column(Text, nullable=True)
    estimated_next_step_date = Column(String(10), nullable=True)
    rejection_reason = Column(Text, nullable=True)
    last_status_updated_at = Column(DateTime, nullable=True)
    applied_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(50), nullable=True)

    __table_args__ = (
        UniqueConstraint("user_id", "jd_id", name="uq_user_job_application"),
    )


class InterviewEvaluation(Base):
    __tablename__ = "interview_evaluations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    ai_interview_result = Column(JSONB, nullable=False, default=dict)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class PipelineStageHistory(Base):
    __tablename__ = "pipeline_stage_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    from_stage = Column(String(20), nullable=True)
    to_stage = Column(String(20), nullable=False)
    changed_by = Column(String(50), nullable=False)
    notes = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ScreeningQuestion(Base):
    __tablename__ = "screening_questions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    question = Column(Text, nullable=False)
    question_type = Column(String(20), nullable=False, default="text")  # text, multiple_choice, yes_no
    options = Column(JSONB, nullable=True)  # for multiple_choice
    required = Column(Boolean, nullable=False, default=True)
    ai_generated = Column(Boolean, nullable=False, default=False)
    sort_order = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class ScreeningResponse(Base):
    __tablename__ = "screening_responses"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    question_id = Column(Integer, ForeignKey("screening_questions.id", ondelete="CASCADE"), nullable=False)
    response = Column(Text, nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("candidate_id", "question_id", name="uq_candidate_question"),
    )


class InterviewSchedule(Base):
    __tablename__ = "interview_schedules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    interview_type = Column(String(20), nullable=False, default="video")  # phone, video, in_person
    scheduled_date = Column(String(10), nullable=False)  # YYYY-MM-DD
    scheduled_time = Column(String(5), nullable=False)   # HH:MM
    duration_minutes = Column(Integer, nullable=False, default=60)
    location = Column(Text, nullable=True)
    interviewer_ids = Column(JSONB, nullable=True)
    interviewer_names = Column(JSONB, nullable=True)
    status = Column(String(20), nullable=False, default="scheduled")  # scheduled, completed, cancelled, no_show
    notes = Column(Text, nullable=True)
    calendar_event_id = Column(String(255), nullable=True)
    meeting_link = Column(Text, nullable=True)
    feedback_submitted = Column(Boolean, nullable=False, default=False, server_default="false")
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    round_number = Column(Integer, nullable=False, default=1)
    round_type = Column(String(30), nullable=True)
    # Feature 12: Rescheduling
    reschedule_count = Column(Integer, nullable=False, default=0, server_default="0")
    reschedule_reason = Column(Text, nullable=True)
    original_date = Column(String(10), nullable=True)
    original_time = Column(String(5), nullable=True)
    # AI cache columns
    ai_suggested_questions = Column(JSONB, nullable=True)


class Offer(Base):
    __tablename__ = "offers"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(Integer, nullable=True)
    salary = Column(Numeric(12, 2), nullable=True)
    salary_currency = Column(String(10), nullable=False, default="USD")
    start_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    position_title = Column(String(255), nullable=True)
    department = Column(String(100), nullable=True)
    content = Column(Text, nullable=True)  # rendered offer letter
    variables = Column(JSONB, nullable=True)
    status = Column(String(20), nullable=False, default="draft")  # draft, sent, accepted, declined, expired, withdrawn
    rejection_reason = Column(Text, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=True)
    responded_at = Column(DateTime, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    deleted_at = Column(DateTime, nullable=True)
    deleted_by = Column(String(50), nullable=True)


class AIJob(Base):
    __tablename__ = "ai_jobs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    type = Column(String(30), nullable=False)  # resume_scoring, jd_extraction, interview_eval, metadata_extraction
    resource_id = Column(Integer, nullable=False)
    resource_type = Column(String(30), nullable=False)  # candidate, application, job
    input_data = Column(JSONB, nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    result = Column(JSONB, nullable=True)
    error = Column(Text, nullable=True)
    attempts = Column(Integer, nullable=False, default=0, server_default="0")
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class JobApproval(Base):
    __tablename__ = "job_approvals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    requested_by = Column(String(50), nullable=False)
    approved_by = Column(String(50), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, approved, rejected
    comments = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class InterviewerFeedback(Base):
    __tablename__ = "interviewer_feedback"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(Integer, ForeignKey("interview_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    interviewer_id = Column(String(50), nullable=False)
    interviewer_name = Column(String(255), nullable=False)
    rating = Column(Integer, nullable=False)  # 1-5
    recommendation = Column(String(20), nullable=False)  # strong_yes, yes, neutral, no, strong_no
    strengths = Column(Text, nullable=True)
    concerns = Column(Text, nullable=True)
    notes = Column(Text, nullable=True)
    criteria_scores = Column(JSONB, nullable=True)
    rubric_scores = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class InterviewerProfile(Base):
    __tablename__ = "interviewer_profiles"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=False, unique=True, index=True)
    email = Column(String(255), nullable=False, index=True)
    full_name = Column(String(200), nullable=False)
    specializations = Column(JSONB, nullable=True)
    seniority = Column(String(50), nullable=True)
    department = Column(String(100), nullable=True)
    max_interviews_per_week = Column(Integer, nullable=False, default=5)
    is_active = Column(Boolean, nullable=False, default=True)
    total_interviews = Column(Integer, nullable=False, default=0)
    avg_rating_given = Column(Float, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class ResumeVersion(Base):
    __tablename__ = "resume_versions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    application_id = Column(Integer, ForeignKey("job_applications.id", ondelete="CASCADE"), nullable=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=True)
    resume_url = Column(Text, nullable=False)
    version = Column(Integer, nullable=False, default=1)
    is_primary = Column(Boolean, nullable=False, default=True, server_default="true")
    uploaded_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, nullable=True)
    user_email = Column(String(255), nullable=False)
    type = Column(String(30), nullable=False)  # application_received, interview_scheduled, offer_sent, stage_changed, rejection, reminder
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)
    channel = Column(String(20), nullable=False, default="email", server_default="email")  # email, sms, in_app, push
    status = Column(String(20), nullable=False, default="pending", server_default="pending")
    is_read = Column(Boolean, nullable=False, default=False, server_default="false")
    read_at = Column(DateTime, nullable=True)
    extra_data = Column("metadata", JSONB, nullable=True)
    sent_at = Column(DateTime, nullable=True)
    error = Column(Text, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class JobMember(Base):
    __tablename__ = "job_members"

    id = Column(Integer, primary_key=True, autoincrement=True)
    job_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    user_id = Column(Integer, nullable=False, index=True)
    role = Column(String(20), nullable=False, default="viewer")  # viewer, editor, owner
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint("job_id", "user_id", name="uq_job_member"),
    )


# ── Feature: Candidate Sourcing ─────────────────────────────────────────

class ReferralLink(Base):
    __tablename__ = "referral_links"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    referrer_user_id = Column(String(50), nullable=False, index=True)
    referrer_name = Column(String(255), nullable=False)
    referrer_email = Column(String(255), nullable=False)
    code = Column(String(8), nullable=False, unique=True, index=True)
    is_active = Column(Boolean, nullable=False, default=True)
    click_count = Column(Integer, nullable=False, default=0)
    reward_amount = Column(Numeric(12, 2), nullable=True)
    reward_currency = Column(String(10), nullable=True, default="INR")
    reward_conditions = Column(Text, nullable=True)  # e.g. "after probation completion"
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Referral(Base):
    __tablename__ = "referrals"

    id = Column(Integer, primary_key=True, autoincrement=True)
    link_id = Column(Integer, ForeignKey("referral_links.id", ondelete="CASCADE"), nullable=False, index=True)
    candidate_profile_id = Column(Integer, ForeignKey("candidate_profiles.id", ondelete="SET NULL"), nullable=True)
    candidate_entry_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="SET NULL"), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, applied, hired, rejected
    reward_type = Column(String(30), nullable=True)  # cash, voucher, bonus
    reward_amount = Column(Numeric(12, 2), nullable=True)
    reward_currency = Column(String(10), nullable=True, default="INR")
    reward_status = Column(String(20), nullable=True, default="pending")  # pending, approved, paid, rejected
    reward_paid_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class JobBoardPosting(Base):
    __tablename__ = "job_board_postings"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    board_name = Column(String(50), nullable=False)  # linkedin, indeed, glassdoor, internal
    status = Column(String(20), nullable=False, default="draft")  # draft, published, expired, removed
    external_url = Column(Text, nullable=True)
    published_at = Column(DateTime, nullable=True)
    views = Column(Integer, nullable=False, default=0)
    applications = Column(Integer, nullable=False, default=0)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature: Outreach Automation ─────────────────────────────────────────

class EmailCampaign(Base):
    __tablename__ = "email_campaigns"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    template_subject = Column(String(500), nullable=False)
    template_body = Column(Text, nullable=False)
    audience_filter = Column(JSONB, nullable=True)  # {stage, source, score_min, ...}
    campaign_type = Column(String(20), nullable=False, default="one_time")  # one_time, sequence
    status = Column(String(20), nullable=False, default="draft")  # draft, scheduled, sending, sent, paused
    scheduled_at = Column(DateTime, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class EmailCampaignStep(Base):
    __tablename__ = "email_campaign_steps"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey("email_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    step_number = Column(Integer, nullable=False, default=1)
    delay_days = Column(Integer, nullable=False, default=0)
    subject = Column(String(500), nullable=False)
    body = Column(Text, nullable=False)


class EmailCampaignRecipient(Base):
    __tablename__ = "email_campaign_recipients"

    id = Column(Integer, primary_key=True, autoincrement=True)
    campaign_id = Column(Integer, ForeignKey("email_campaigns.id", ondelete="CASCADE"), nullable=False, index=True)
    step_id = Column(Integer, ForeignKey("email_campaign_steps.id", ondelete="SET NULL"), nullable=True)
    candidate_email = Column(String(255), nullable=False)
    candidate_name = Column(String(255), nullable=True)
    status = Column(String(20), nullable=False, default="pending")  # pending, sent, opened, clicked, replied, bounced
    sent_at = Column(DateTime, nullable=True)
    opened_at = Column(DateTime, nullable=True)
    clicked_at = Column(DateTime, nullable=True)


class StageAutomation(Base):
    __tablename__ = "stage_automations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    trigger_stage = Column(String(30), nullable=False)
    email_subject = Column(String(500), nullable=False)
    email_body = Column(Text, nullable=False)
    is_active = Column(Boolean, nullable=False, default=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature: Custom Pipeline Stages ──────────────────────────────────────

class CustomPipelineStage(Base):
    __tablename__ = "custom_pipeline_stages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(50), nullable=False)
    display_name = Column(String(100), nullable=False)
    sort_order = Column(Integer, nullable=False, default=0)
    color = Column(String(20), nullable=True)
    is_terminal = Column(Boolean, nullable=False, default=False)


# ── Feature: Agent Conversations ──────────────────────────────────────

class AgentConversation(Base):
    __tablename__ = "agent_conversations"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(String(50), nullable=False, index=True)
    title = Column(String(200), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow, onupdate=datetime.utcnow)


class AgentMessage(Base):
    __tablename__ = "agent_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    conversation_id = Column(Integer, ForeignKey("agent_conversations.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(20), nullable=False)  # user, assistant
    content = Column(Text, nullable=False)
    data = Column(JSONB, nullable=True)
    actions = Column(JSONB, nullable=True)
    files = Column(JSONB, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature: AI Interview (Live AI-Conducted Interviews) ──────────────

class AIInterviewSession(Base):
    __tablename__ = "ai_interview_sessions"

    id = Column(Integer, primary_key=True, autoincrement=True)
    token = Column(String(64), unique=True, index=True, nullable=False)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id"), nullable=False, index=True)
    application_id = Column(Integer, ForeignKey("job_applications.id"), nullable=True)

    # Config
    interview_type = Column(String(20), nullable=False, default="mixed")  # behavioral, technical, mixed
    max_questions = Column(Integer, nullable=False, default=10)
    time_limit_minutes = Column(Integer, nullable=False, default=30)
    include_coding = Column(Boolean, nullable=False, default=False)
    coding_language = Column(String(30), nullable=True)

    # State
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending, in_progress, completed, expired, cancelled
    current_question = Column(Integer, nullable=False, default=0)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)

    # AI Context (snapshot at creation time)
    jd_context = Column(JSONB, nullable=True)
    resume_context = Column(JSONB, nullable=True)
    questions_plan = Column(JSONB, nullable=True)

    # Results
    transcript = Column(JSONB, nullable=True)
    evaluation = Column(JSONB, nullable=True)
    overall_score = Column(Float, nullable=True)
    proctoring_score = Column(Float, nullable=True)
    ai_recommendation = Column(String(30), nullable=True)  # Hire, Manual Review, Do Not Recommend

    # Invite
    created_by = Column(String(50), nullable=False)
    invite_email = Column(String(255), nullable=True)
    invite_sent_at = Column(DateTime, nullable=True)
    expires_at = Column(DateTime, nullable=False)

    created_at = Column(DateTime, nullable=False, server_default=func.now())
    updated_at = Column(DateTime, nullable=False, server_default=func.now(), onupdate=datetime.utcnow)


class AIInterviewMessage(Base):
    __tablename__ = "ai_interview_messages"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("ai_interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    role = Column(String(15), nullable=False)  # ai, candidate
    content = Column(Text, nullable=False)
    message_type = Column(String(20), nullable=False)  # question, answer, follow_up, code_prompt, code_answer, system
    code_content = Column(Text, nullable=True)
    code_language = Column(String(30), nullable=True)
    sequence = Column(Integer, nullable=False)
    created_at = Column(DateTime, nullable=False, server_default=func.now())


class AIInterviewProctoringEvent(Base):
    __tablename__ = "ai_interview_proctoring"

    id = Column(Integer, primary_key=True, autoincrement=True)
    session_id = Column(Integer, ForeignKey("ai_interview_sessions.id", ondelete="CASCADE"), nullable=False, index=True)
    event_type = Column(String(30), nullable=False)  # tab_away, tab_return, window_blur, window_focus, copy_paste, multiple_faces, code_plagiarism, long_silence, external_device
    timestamp = Column(DateTime, nullable=False)
    duration_ms = Column(Integer, nullable=True)
    extra_data = Column("metadata", JSONB, nullable=True)


# ── Feature: Pipeline Document Templates ───────────────────────────────

class StageDocumentRule(Base):
    """Global mapping: which document templates are auto-assigned when a candidate reaches a stage."""
    __tablename__ = "stage_document_rules"

    id = Column(Integer, primary_key=True, autoincrement=True)
    stage = Column(String(20), nullable=False, index=True)
    template_id = Column(Integer, nullable=False)
    template_name = Column(String(255), nullable=False)
    template_category = Column(String(100), nullable=True)
    is_required = Column(Boolean, nullable=False, default=True)
    sort_order = Column(Integer, nullable=False, default=0)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('stage', 'template_id', name='uq_stage_template'),
    )


class CandidateDocument(Base):
    """Documents assigned to a candidate for a specific job, auto-created when moving pipeline stages."""
    __tablename__ = "candidate_documents"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    template_id = Column(Integer, nullable=False)
    template_name = Column(String(255), nullable=False)
    stage = Column(String(20), nullable=False)
    status = Column(String(20), nullable=False, default="pending")
    content = Column(Text, nullable=True)
    variables = Column(JSONB, nullable=True)
    generated_by = Column(String(50), nullable=True)
    generated_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)

    __table_args__ = (
        UniqueConstraint('candidate_id', 'jd_id', 'template_id', 'stage', name='uq_cand_doc'),
    )


# ── Feature 2: Cost to Hire ─────────────────────────────────────────────

class HiringCost(Base):
    __tablename__ = "hiring_costs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    cost_type = Column(String(30), nullable=False)  # job_board, agency, referral_bonus, interview, recruiter_hours, advertising, other
    amount = Column(Numeric(12, 2), nullable=False, default=0)
    currency = Column(String(10), nullable=False, default="USD")
    description = Column(Text, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature 3: Job Portal Aggregator ────────────────────────────────────

class JobPortalConfig(Base):
    __tablename__ = "job_portal_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    portal_name = Column(String(100), nullable=False)
    api_endpoint = Column(Text, nullable=True)
    auth_type = Column(String(30), nullable=True)  # api_key, oauth2, basic, none
    auth_credentials = Column(JSONB, nullable=True)  # encrypted credentials
    posting_template = Column(JSONB, nullable=True)
    field_mapping = Column(JSONB, nullable=True)  # maps orbis fields to portal fields
    integration_type = Column(String(20), nullable=False, default="api")  # api, rss, web_automation, mcp
    is_active = Column(Boolean, nullable=False, default=True)
    # MCP Server integration
    mcp_server_url = Column(Text, nullable=True)          # ws://... or http://... MCP endpoint
    mcp_transport = Column(String(20), nullable=True)     # stdio, sse, streamable_http
    mcp_tools = Column(JSONB, nullable=True)              # discovered MCP tool list cache
    # Web automation config
    web_automation_config = Column(JSONB, nullable=True)   # login_url, selectors, flow steps
    # Capabilities
    capabilities = Column(JSONB, nullable=True)            # post_job, search_candidates, sync_applications, etc.
    last_synced_at = Column(DateTime, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature 11: Hiring Manager Job Request ──────────────────────────────

class JobRequest(Base):
    __tablename__ = "job_requests"

    id = Column(Integer, primary_key=True, autoincrement=True)
    requested_by = Column(String(50), nullable=False, index=True)
    requester_name = Column(String(255), nullable=False)
    requester_email = Column(String(255), nullable=False)
    requested_role = Column(String(255), nullable=False)
    team = Column(String(100), nullable=True)
    department = Column(String(100), nullable=True)
    justification = Column(Text, nullable=True)
    budget = Column(Numeric(12, 2), nullable=True)
    budget_currency = Column(String(10), nullable=True, default="USD")
    priority = Column(String(20), nullable=False, default="medium")  # low, medium, high, critical
    expected_join_date = Column(String(10), nullable=True)  # YYYY-MM-DD
    number_of_positions = Column(Integer, nullable=False, default=1)
    job_type = Column(String(30), nullable=True)  # full_time, part_time, contract
    location_type = Column(String(20), nullable=True)  # onsite, remote, hybrid
    location = Column(String(200), nullable=True)
    additional_notes = Column(Text, nullable=True)
    skills_required = Column(JSONB, nullable=True)
    status = Column(String(20), nullable=False, default="pending", server_default="pending")  # pending, approved, rejected, converted
    reviewed_by = Column(String(50), nullable=True)
    reviewed_at = Column(DateTime, nullable=True)
    review_comments = Column(Text, nullable=True)
    converted_job_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature 14: JD Templates ───────────────────────────────────────────

class JDTemplate(Base):
    __tablename__ = "jd_templates"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(255), nullable=False)
    category = Column(String(100), nullable=True)  # Engineering, Product, Design, etc.
    description = Column(Text, nullable=True)
    jd_content = Column(JSONB, nullable=False, default=dict)  # full JD structure matching ai_result format
    skills = Column(JSONB, nullable=True)
    experience_range = Column(String(50), nullable=True)
    salary_range = Column(JSONB, nullable=True)  # {min, max, currency}
    benefits = Column(JSONB, nullable=True)
    screening_questions = Column(JSONB, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    usage_count = Column(Integer, nullable=False, default=0)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature 12: Interview Reschedule History ────────────────────────────

class InterviewRescheduleHistory(Base):
    __tablename__ = "interview_reschedule_history"

    id = Column(Integer, primary_key=True, autoincrement=True)
    schedule_id = Column(Integer, ForeignKey("interview_schedules.id", ondelete="CASCADE"), nullable=False, index=True)
    old_date = Column(String(10), nullable=False)
    old_time = Column(String(5), nullable=False)
    new_date = Column(String(10), nullable=False)
    new_time = Column(String(5), nullable=False)
    reason = Column(Text, nullable=True)
    rescheduled_by = Column(String(50), nullable=False)
    rescheduled_by_role = Column(String(30), nullable=True)  # candidate, interviewer, hr
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature 15: Lead Generation ────────────────────────────────────────

class LeadList(Base):
    __tablename__ = "lead_lists"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    source = Column(String(50), nullable=False, default="manual")  # manual, ai_discovery, csv_import, linkedin, github
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="SET NULL"), nullable=True, index=True)
    lead_count = Column(Integer, nullable=False, default=0)
    status = Column(String(20), nullable=False, default="active")  # active, archived
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class Lead(Base):
    __tablename__ = "leads"

    id = Column(Integer, primary_key=True, autoincrement=True)
    list_id = Column(Integer, ForeignKey("lead_lists.id", ondelete="CASCADE"), nullable=False, index=True)
    name = Column(String(200), nullable=False)
    email = Column(String(255), nullable=True, index=True)
    phone = Column(String(50), nullable=True)
    title = Column(String(200), nullable=True)  # current job title
    company = Column(String(200), nullable=True)  # current company
    location = Column(String(200), nullable=True)
    source_platform = Column(String(50), nullable=True)  # linkedin, github, stackoverflow, job_board, manual
    source_url = Column(Text, nullable=True)  # profile URL
    skills = Column(JSONB, nullable=True)  # list of skills
    experience_years = Column(Integer, nullable=True)
    relevance_score = Column(Float, nullable=True)  # AI-computed 0-100
    profile_data = Column(JSONB, nullable=True)  # full extracted profile
    status = Column(String(20), nullable=False, default="new")  # new, contacted, responded, converted, rejected
    notes = Column(Text, nullable=True)
    campaign_id = Column(Integer, ForeignKey("email_campaigns.id", ondelete="SET NULL"), nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
    updated_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature 18: Cold Email Candidate Capture ─────────────────────────────

class InboxCaptureConfig(Base):
    __tablename__ = "inbox_capture_configs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    name = Column(String(200), nullable=False)
    imap_host = Column(String(255), nullable=False)
    imap_port = Column(Integer, nullable=False, default=993)
    username = Column(String(255), nullable=False)
    password = Column(String(500), nullable=False)  # encrypted in production
    use_ssl = Column(Boolean, nullable=False, default=True)
    folder = Column(String(100), nullable=False, default="INBOX")
    is_active = Column(Boolean, nullable=False, default=True)
    last_scan_at = Column(DateTime, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


class InboxCaptureLog(Base):
    __tablename__ = "inbox_capture_logs"

    id = Column(Integer, primary_key=True, autoincrement=True)
    config_id = Column(Integer, ForeignKey("inbox_capture_configs.id", ondelete="CASCADE"), nullable=False, index=True)
    from_name = Column(String(255), nullable=True)
    from_email = Column(String(255), nullable=False)
    subject = Column(String(500), nullable=True)
    body_preview = Column(Text, nullable=True)
    attachments = Column(JSONB, nullable=True)
    status = Column(String(30), nullable=False, default="pending_review")  # pending_review, accepted, rejected, converted
    candidate_id = Column(Integer, nullable=True)
    processed_at = Column(DateTime, nullable=True)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)


# ── Feature: Deferred Stage-Change Emails ────────────────────────────────

class PendingStageEmail(Base):
    """Queued email triggered by a pipeline stage change; held for ~10 s so HR can cancel."""
    __tablename__ = "pending_stage_emails"

    id = Column(Integer, primary_key=True, autoincrement=True)
    candidate_id = Column(Integer, ForeignKey("candidate_job_entries.id", ondelete="CASCADE"), nullable=False, index=True)
    jd_id = Column(Integer, ForeignKey("job_descriptions.id", ondelete="CASCADE"), nullable=False, index=True)
    from_stage = Column(String(30), nullable=True)
    to_stage = Column(String(30), nullable=False)
    subject = Column(Text, nullable=False)
    body_html = Column(Text, nullable=False)
    attachment_doc_ids = Column(JSONB, nullable=False, default=list)
    status = Column(String(20), nullable=False, default="pending", index=True)  # pending, sent, cancelled
    send_after = Column(DateTime, nullable=False)
    sent_at = Column(DateTime, nullable=True)
    cancelled_at = Column(DateTime, nullable=True)
    created_by = Column(String(50), nullable=False)
    created_at = Column(DateTime, nullable=False, default=datetime.utcnow)
