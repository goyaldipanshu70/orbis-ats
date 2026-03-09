from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from app.core.config import settings
from app.db.models import Base
from typing import AsyncGenerator

engine = create_async_engine(settings.DATABASE_URL, pool_pre_ping=True, pool_size=10, max_overflow=20)
AsyncSessionLocal = async_sessionmaker(bind=engine, expire_on_commit=False, class_=AsyncSession)


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
        t = __import__("sqlalchemy").text
        # Migrations for existing tables — safe to re-run (IF NOT EXISTS)
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS resume_url TEXT"))
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active'"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_candidates_status ON candidates (status)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS visibility VARCHAR(20) NOT NULL DEFAULT 'internal'"))
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS source VARCHAR(20) NOT NULL DEFAULT 'manual'"))
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS application_id INTEGER"))
        # Pipeline stage columns
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(20) NOT NULL DEFAULT 'applied'"))
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMP"))
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS stage_changed_by VARCHAR(50)"))
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS category VARCHAR(50)"))
        # Performance indexes
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_candidates_pipeline_stage ON candidates (pipeline_stage)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_candidates_source ON candidates (source)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_candidates_category ON candidates (category)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_applications_jd_id ON job_applications (jd_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_applications_user_id ON job_applications (user_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_descriptions_visibility ON job_descriptions (visibility)"))
        # Social link columns on job_applications
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS phone VARCHAR(30)"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS linkedin_url TEXT"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS github_url TEXT"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS portfolio_url TEXT"))
        # Soft delete columns
        for tbl in ("job_descriptions", "candidates", "job_applications", "offers"):
            await conn.execute(t(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMP"))
            await conn.execute(t(f"ALTER TABLE {tbl} ADD COLUMN IF NOT EXISTS deleted_by VARCHAR(50)"))

        # V3 migrations — JobDescription approval columns
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS approval_status VARCHAR(20) NOT NULL DEFAULT 'approved'"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS approval_required BOOLEAN NOT NULL DEFAULT FALSE"))

        # V3 migrations — Candidate global profile columns
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS parsed_metadata JSONB"))
        await conn.execute(t("ALTER TABLE candidates ADD COLUMN IF NOT EXISTS has_complete_profile BOOLEAN NOT NULL DEFAULT FALSE"))

        # V3 migrations — JobApplication pipeline & status transparency columns
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS pipeline_stage VARCHAR(20) NOT NULL DEFAULT 'applied'"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS stage_changed_at TIMESTAMP"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS stage_changed_by VARCHAR(50)"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS status_message TEXT"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS estimated_next_step_date VARCHAR(10)"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS rejection_reason TEXT"))
        await conn.execute(t("ALTER TABLE job_applications ADD COLUMN IF NOT EXISTS last_status_updated_at TIMESTAMP"))

        # V3 migrations — InterviewSchedule calendar + feedback columns
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS calendar_event_id VARCHAR(255)"))
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS meeting_link TEXT"))
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS feedback_submitted BOOLEAN NOT NULL DEFAULT FALSE"))

        # V3 migrations — Offer rejection_reason
        await conn.execute(t("ALTER TABLE offers ADD COLUMN IF NOT EXISTS rejection_reason TEXT"))

        # V3 migration — backfill onboard=True for candidates with AI scores
        await conn.execute(t("UPDATE candidates SET onboard = TRUE WHERE ai_resume_analysis != '{}' AND ai_resume_analysis IS NOT NULL AND onboard = FALSE"))

        # V3 migration — number_of_vacancies on jobs
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS number_of_vacancies INTEGER NOT NULL DEFAULT 1"))

        # V4 migration — rejection lock + duplicate detection indexes
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS rejection_lock_days INTEGER"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_applications_user_email ON job_applications (user_email)"))

        # V3 Performance indexes
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_ai_jobs_status ON ai_jobs (status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_ai_jobs_type ON ai_jobs (type)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_notifications_status ON notifications (status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_approvals_job_id ON job_approvals (job_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_members_job_id ON job_members (job_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_members_user_id ON job_members (user_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_interviewer_feedback_schedule_id ON interviewer_feedback (schedule_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_resume_versions_application_id ON resume_versions (application_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_applications_pipeline_stage ON job_applications (pipeline_stage)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_applications_status ON job_applications (status)"))

        # V5 migration — Job location columns
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS country VARCHAR(100)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS city VARCHAR(100)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_descriptions_country ON job_descriptions (country)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_descriptions_city ON job_descriptions (city)"))

        # ── V6 migration — Candidate-Job data model separation ──
        # candidate_profiles and candidate_job_entries are created by Base.metadata.create_all above.
        # This migration populates them from the legacy candidates table.

        has_old = (await conn.execute(t(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidates')"
        ))).scalar()

        has_new = (await conn.execute(t(
            "SELECT EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'candidate_profiles')"
        ))).scalar()

        already_migrated = False
        if has_new:
            count = (await conn.execute(t("SELECT COUNT(*) FROM candidate_profiles"))).scalar()
            already_migrated = count > 0

        if has_old and has_new and not already_migrated:
            # Check if legacy table has any rows
            old_count = (await conn.execute(t("SELECT COUNT(*) FROM candidates"))).scalar()
            if old_count > 0:
                # Step 1: Deduplicate into candidate_profiles by LOWER(email)
                await conn.execute(t("""
                    INSERT INTO candidate_profiles (email, full_name, phone, resume_url, status, category, parsed_metadata, original_source, created_by, created_at, updated_at, deleted_at)
                    SELECT DISTINCT ON (LOWER(COALESCE(ai_resume_analysis->'metadata'->>'email', '')))
                        NULLIF(ai_resume_analysis->'metadata'->>'email', '') AS email,
                        ai_resume_analysis->'metadata'->>'full_name' AS full_name,
                        ai_resume_analysis->'metadata'->>'phone' AS phone,
                        resume_url,
                        CASE WHEN status IN ('active', 'blacklisted') THEN status ELSE 'active' END AS status,
                        category,
                        parsed_metadata,
                        COALESCE(source, 'manual') AS original_source,
                        user_id AS created_by,
                        created_at,
                        created_at AS updated_at,
                        deleted_at
                    FROM candidates
                    WHERE ai_resume_analysis->'metadata'->>'email' IS NOT NULL
                      AND ai_resume_analysis->'metadata'->>'email' != ''
                    ORDER BY LOWER(COALESCE(ai_resume_analysis->'metadata'->>'email', '')), created_at DESC
                """))

                # Step 1b: Insert candidates WITHOUT email (each gets own profile)
                await conn.execute(t("""
                    INSERT INTO candidate_profiles (email, full_name, phone, resume_url, status, category, parsed_metadata, original_source, created_by, created_at, updated_at, deleted_at)
                    SELECT
                        NULL AS email,
                        ai_resume_analysis->'metadata'->>'full_name' AS full_name,
                        ai_resume_analysis->'metadata'->>'phone' AS phone,
                        resume_url,
                        CASE WHEN status IN ('active', 'blacklisted') THEN status ELSE 'active' END AS status,
                        category,
                        parsed_metadata,
                        COALESCE(source, 'manual') AS original_source,
                        user_id AS created_by,
                        created_at,
                        created_at AS updated_at,
                        deleted_at
                    FROM candidates
                    WHERE ai_resume_analysis->'metadata'->>'email' IS NULL
                       OR ai_resume_analysis->'metadata'->>'email' = ''
                """))

                # Step 2: Create candidate_job_entries linking old rows to profiles
                await conn.execute(t("""
                    INSERT INTO candidate_job_entries (profile_id, jd_id, user_id, ai_resume_analysis, pipeline_stage, stage_changed_at, stage_changed_by, onboard, screening, interview_status, source, application_id, imported_at, created_at, deleted_at)
                    SELECT
                        cp.id AS profile_id,
                        c.jd_id,
                        c.user_id,
                        c.ai_resume_analysis,
                        COALESCE(c.pipeline_stage, 'applied'),
                        c.stage_changed_at,
                        c.stage_changed_by,
                        c.onboard,
                        c.screening,
                        c.interview_status,
                        COALESCE(c.source, 'manual'),
                        c.application_id,
                        c.imported_at,
                        c.created_at,
                        c.deleted_at
                    FROM candidates c
                    JOIN candidate_profiles cp ON (
                        CASE
                            WHEN c.ai_resume_analysis->'metadata'->>'email' IS NOT NULL
                                 AND c.ai_resume_analysis->'metadata'->>'email' != ''
                            THEN LOWER(cp.email) = LOWER(c.ai_resume_analysis->'metadata'->>'email')
                            ELSE cp.id = (
                                SELECT cp2.id FROM candidate_profiles cp2
                                WHERE cp2.email IS NULL
                                  AND cp2.created_by = c.user_id
                                  AND cp2.full_name = c.ai_resume_analysis->'metadata'->>'full_name'
                                  AND cp2.created_at = c.created_at
                                LIMIT 1
                            )
                        END
                    )
                    ON CONFLICT (profile_id, jd_id) DO NOTHING
                """))

                # Step 3: Create old-to-new ID mapping and update child table IDs
                await conn.execute(t("""
                    CREATE TEMP TABLE _cand_id_map AS
                    SELECT c.id AS old_id, cje.id AS new_id
                    FROM candidates c
                    JOIN candidate_profiles cp ON (
                        CASE
                            WHEN c.ai_resume_analysis->'metadata'->>'email' IS NOT NULL
                                 AND c.ai_resume_analysis->'metadata'->>'email' != ''
                            THEN LOWER(cp.email) = LOWER(c.ai_resume_analysis->'metadata'->>'email')
                            ELSE cp.id = (
                                SELECT cp2.id FROM candidate_profiles cp2
                                WHERE cp2.email IS NULL
                                  AND cp2.created_by = c.user_id
                                  AND cp2.full_name = c.ai_resume_analysis->'metadata'->>'full_name'
                                  AND cp2.created_at = c.created_at
                                LIMIT 1
                            )
                        END
                    )
                    JOIN candidate_job_entries cje ON cje.profile_id = cp.id AND cje.jd_id = c.jd_id
                """))

                # Update candidate_id values in child tables using the mapping
                child_tables_list = [
                    "interview_evaluations", "interview_schedules", "offers",
                    "pipeline_stage_history", "screening_responses",
                    "resume_versions", "job_applications",
                ]
                for child_table in child_tables_list:
                    await conn.execute(t(f"""
                        UPDATE {child_table} SET candidate_id = m.new_id
                        FROM _cand_id_map m
                        WHERE {child_table}.candidate_id = m.old_id
                    """))

                await conn.execute(t("DROP TABLE IF EXISTS _cand_id_map"))

        # Always ensure child table FKs point to candidate_job_entries (not candidates)
        # This handles both fresh databases and post-migration databases
        if has_new:
            child_tables = [
                ("interview_evaluations", "interview_evaluations_candidate_id_fkey"),
                ("interview_schedules", "interview_schedules_candidate_id_fkey"),
                ("offers", "offers_candidate_id_fkey"),
                ("pipeline_stage_history", "pipeline_stage_history_candidate_id_fkey"),
                ("screening_responses", "screening_responses_candidate_id_fkey"),
                ("resume_versions", "resume_versions_candidate_id_fkey"),
                ("job_applications", "job_applications_candidate_id_fkey"),
            ]
            for child_table, fk_name in child_tables:
                # Check if FK already points to candidate_job_entries
                fk_check = (await conn.execute(t(f"""
                    SELECT ccu.table_name
                    FROM information_schema.table_constraints tc
                    JOIN information_schema.constraint_column_usage ccu ON tc.constraint_name = ccu.constraint_name
                    WHERE tc.table_name = '{child_table}' AND tc.constraint_name = '{fk_name}'
                """))).first()
                if fk_check and fk_check[0] == 'candidate_job_entries':
                    continue  # Already correct
                # Drop old FK (may point to candidates) and add new one
                await conn.execute(t(f"ALTER TABLE {child_table} DROP CONSTRAINT IF EXISTS {fk_name}"))
                cascade = "CASCADE" if child_table != "job_applications" else "SET NULL"
                await conn.execute(t(f"""
                    ALTER TABLE {child_table}
                    ADD CONSTRAINT {fk_name}
                    FOREIGN KEY (candidate_id) REFERENCES candidate_job_entries(id)
                    ON DELETE {cascade}
                """))

        # Partial unique index on candidate_profiles email
        await conn.execute(t("""
            CREATE UNIQUE INDEX IF NOT EXISTS uq_profiles_email
            ON candidate_profiles (LOWER(email))
            WHERE email IS NOT NULL AND deleted_at IS NULL
        """))

        # ── V7 migration — Social link columns on candidate_profiles ──
        await conn.execute(t("ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS linkedin_url TEXT"))
        await conn.execute(t("ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS github_url TEXT"))
        await conn.execute(t("ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS portfolio_url TEXT"))

        # Partial indexes for duplicate detection on social links
        await conn.execute(t("""
            CREATE INDEX IF NOT EXISTS ix_profiles_linkedin_url
            ON candidate_profiles (linkedin_url)
            WHERE linkedin_url IS NOT NULL AND deleted_at IS NULL
        """))
        await conn.execute(t("""
            CREATE INDEX IF NOT EXISTS ix_profiles_github_url
            ON candidate_profiles (github_url)
            WHERE github_url IS NOT NULL AND deleted_at IS NULL
        """))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_profiles_phone ON candidate_profiles (phone) WHERE phone IS NOT NULL AND deleted_at IS NULL"))

        # Backfill social links from parsed_metadata JSONB
        await conn.execute(t("""
            UPDATE candidate_profiles
            SET linkedin_url = parsed_metadata->>'linkedin_url'
            WHERE linkedin_url IS NULL
              AND parsed_metadata->>'linkedin_url' IS NOT NULL
              AND parsed_metadata->>'linkedin_url' != ''
        """))
        await conn.execute(t("""
            UPDATE candidate_profiles
            SET github_url = parsed_metadata->>'github_url'
            WHERE github_url IS NULL
              AND parsed_metadata->>'github_url' IS NOT NULL
              AND parsed_metadata->>'github_url' != ''
        """))
        await conn.execute(t("""
            UPDATE candidate_profiles
            SET portfolio_url = parsed_metadata->>'portfolio_url'
            WHERE portfolio_url IS NULL
              AND parsed_metadata->>'portfolio_url' IS NOT NULL
              AND parsed_metadata->>'portfolio_url' != ''
        """))

        # ── V7b migration — Photo URL on candidate_profiles ──
        await conn.execute(t("ALTER TABLE candidate_profiles ADD COLUMN IF NOT EXISTS photo_url TEXT"))

        # ── V8 migration — Interviewer module ──────────────────────────────
        # interviewer_profiles table created by metadata.create_all above

        # InterviewSchedule: round_number + round_type
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS round_number INTEGER NOT NULL DEFAULT 1"))
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS round_type VARCHAR(30)"))

        # InterviewerFeedback: criteria_scores + rubric_scores
        await conn.execute(t("ALTER TABLE interviewer_feedback ADD COLUMN IF NOT EXISTS criteria_scores JSONB"))
        await conn.execute(t("ALTER TABLE interviewer_feedback ADD COLUMN IF NOT EXISTS rubric_scores JSONB"))

        # Indexes for interviewer_profiles
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_interviewer_profiles_email ON interviewer_profiles (email)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_interviewer_profiles_user_id ON interviewer_profiles (user_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_interviewer_profiles_active ON interviewer_profiles (is_active) WHERE is_active = true"))

        # ── V9 migration — Sourcing, Outreach, Intelligence, Enterprise ──
        # Tables are created by Base.metadata.create_all above.
        # Add indexes for new tables:
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_referral_links_code ON referral_links (code)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_referral_links_jd_id ON referral_links (jd_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_referrals_link_id ON referrals (link_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_board_postings_jd_id ON job_board_postings (jd_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_email_campaigns_jd_id ON email_campaigns (jd_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_email_campaign_steps_campaign_id ON email_campaign_steps (campaign_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_email_campaign_recipients_campaign_id ON email_campaign_recipients (campaign_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_stage_automations_jd_id ON stage_automations (jd_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_custom_pipeline_stages_jd_id ON custom_pipeline_stages (jd_id)"))

        # ── V10 migration — Agent Conversations ──────────────────────────
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_agent_conversations_user_id ON agent_conversations (user_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_agent_messages_conversation_id ON agent_messages (conversation_id)"))

        # ── V11 migration — Pipeline Document Templates ──────────────────
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_stage_document_rules_stage ON stage_document_rules (stage)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_candidate_documents_candidate_id ON candidate_documents (candidate_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_candidate_documents_jd_id ON candidate_documents (jd_id)"))

        # ── V12 migration — Multi-location vacancies ─────────────────────
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_jlv_jd_id ON job_location_vacancies (jd_id)"))
        await conn.execute(t("ALTER TABLE candidate_job_entries ADD COLUMN IF NOT EXISTS hired_location_id INTEGER"))
        # Backfill existing single-location jobs into the new table
        await conn.execute(t("""
            INSERT INTO job_location_vacancies (jd_id, country, city, vacancies, created_at)
            SELECT id, country, city, number_of_vacancies, NOW()
            FROM job_descriptions
            WHERE country IS NOT NULL AND city IS NOT NULL AND deleted_at IS NULL
              AND NOT EXISTS (SELECT 1 FROM job_location_vacancies jlv WHERE jlv.jd_id = job_descriptions.id)
        """))


        # ── V13 migration — Job metadata fields ──────────────────────────
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS job_type VARCHAR(30)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS position_type VARCHAR(30)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS experience_range VARCHAR(50)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS salary_range_min NUMERIC(12,2)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS salary_range_max NUMERIC(12,2)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS salary_currency VARCHAR(10)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS salary_visibility VARCHAR(30) NOT NULL DEFAULT 'hidden'"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS location_type VARCHAR(20)"))
        await conn.execute(t("ALTER TABLE job_descriptions ADD COLUMN IF NOT EXISTS hiring_close_date TIMESTAMP"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_jd_job_type ON job_descriptions (job_type)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_jd_location_type ON job_descriptions (location_type)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_jd_hiring_close_date ON job_descriptions (hiring_close_date)"))

        # ── V14 migration — Referral reward fields ───────────────────────
        await conn.execute(t("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_type VARCHAR(30)"))
        await conn.execute(t("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(12,2)"))
        await conn.execute(t("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_currency VARCHAR(10) DEFAULT 'INR'"))
        await conn.execute(t("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_status VARCHAR(20) DEFAULT 'pending'"))
        await conn.execute(t("ALTER TABLE referrals ADD COLUMN IF NOT EXISTS reward_paid_at TIMESTAMP"))
        await conn.execute(t("ALTER TABLE referral_links ADD COLUMN IF NOT EXISTS reward_amount NUMERIC(12,2)"))
        await conn.execute(t("ALTER TABLE referral_links ADD COLUMN IF NOT EXISTS reward_currency VARCHAR(10) DEFAULT 'INR'"))
        await conn.execute(t("ALTER TABLE referral_links ADD COLUMN IF NOT EXISTS reward_conditions TEXT"))

        # ── V15 migration — Interview rescheduling ───────────────────────
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS reschedule_count INTEGER NOT NULL DEFAULT 0"))
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS reschedule_reason TEXT"))
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS original_date VARCHAR(10)"))
        await conn.execute(t("ALTER TABLE interview_schedules ADD COLUMN IF NOT EXISTS original_time VARCHAR(5)"))

        # ── V16 migration — New table indexes ────────────────────────────
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_hiring_costs_jd_id ON hiring_costs (jd_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_requests_status ON job_requests (status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_requests_requested_by ON job_requests (requested_by)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_jd_templates_category ON jd_templates (category)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_job_portal_configs_active ON job_portal_configs (is_active) WHERE is_active = true"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_reschedule_history_schedule_id ON interview_reschedule_history (schedule_id)"))

        # ── V17 migration — Lead generation tables ─────────────────────
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_lead_lists_jd_id ON lead_lists (jd_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_lead_lists_status ON lead_lists (status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_leads_list_id ON leads (list_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_leads_email ON leads (email)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_leads_status ON leads (status)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_leads_source_platform ON leads (source_platform)"))

        # ── V18 migration — Inbox capture tables ─────────────────────────
        await conn.execute(t("""
            CREATE TABLE IF NOT EXISTS inbox_capture_configs (
                id SERIAL PRIMARY KEY,
                name VARCHAR(200) NOT NULL,
                imap_host VARCHAR(255) NOT NULL,
                imap_port INTEGER NOT NULL DEFAULT 993,
                username VARCHAR(255) NOT NULL,
                password VARCHAR(500) NOT NULL,
                use_ssl BOOLEAN NOT NULL DEFAULT TRUE,
                folder VARCHAR(100) NOT NULL DEFAULT 'INBOX',
                is_active BOOLEAN NOT NULL DEFAULT TRUE,
                last_scan_at TIMESTAMP,
                created_by VARCHAR(50) NOT NULL,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(t("""
            CREATE TABLE IF NOT EXISTS inbox_capture_logs (
                id SERIAL PRIMARY KEY,
                config_id INTEGER NOT NULL REFERENCES inbox_capture_configs(id) ON DELETE CASCADE,
                from_name VARCHAR(255),
                from_email VARCHAR(255) NOT NULL,
                subject VARCHAR(500),
                body_preview TEXT,
                attachments JSONB,
                status VARCHAR(30) NOT NULL DEFAULT 'pending_review',
                candidate_id INTEGER,
                processed_at TIMESTAMP,
                created_at TIMESTAMP NOT NULL DEFAULT NOW()
            )
        """))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_inbox_capture_logs_config_id ON inbox_capture_logs (config_id)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_inbox_capture_logs_status ON inbox_capture_logs (status)"))

        # ── V19a migration — Job portal enhancements (MCP, web automation) ──
        await conn.execute(t("ALTER TABLE job_portal_configs ADD COLUMN IF NOT EXISTS mcp_server_url TEXT"))
        await conn.execute(t("ALTER TABLE job_portal_configs ADD COLUMN IF NOT EXISTS mcp_transport VARCHAR(20)"))
        await conn.execute(t("ALTER TABLE job_portal_configs ADD COLUMN IF NOT EXISTS mcp_tools JSONB"))
        await conn.execute(t("ALTER TABLE job_portal_configs ADD COLUMN IF NOT EXISTS web_automation_config JSONB"))
        await conn.execute(t("ALTER TABLE job_portal_configs ADD COLUMN IF NOT EXISTS capabilities JSONB"))
        await conn.execute(t("ALTER TABLE job_portal_configs ADD COLUMN IF NOT EXISTS last_synced_at TIMESTAMP"))

        # ── V19 migration — Notification center extensions ────────────
        await conn.execute(t("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS channel VARCHAR(20) NOT NULL DEFAULT 'email'"))
        await conn.execute(t("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS is_read BOOLEAN NOT NULL DEFAULT FALSE"))
        await conn.execute(t("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS read_at TIMESTAMP"))
        await conn.execute(t("ALTER TABLE notifications ADD COLUMN IF NOT EXISTS metadata JSONB"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_notifications_user_channel ON notifications (user_id, channel)"))
        await conn.execute(t("CREATE INDEX IF NOT EXISTS ix_notifications_is_read ON notifications (user_id, is_read) WHERE is_read = FALSE"))


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        yield session
