# AI Toolkit Full Rebuild — Design Document

**Date:** 2026-03-13
**Status:** Approved

## Goal

Replace the standalone AI Toolkit page with contextually embedded AI features across the entire Orbis ATS application. Fix all broken integrations, eliminate hardcoded/fake data, and route all AI through `svc-ai-orchestrator` (LangGraph workflows).

## Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| LLM backend | `svc-ai-orchestrator` only | Leverages existing execution logging, role guards, LLM provider abstraction, retry logic |
| UI placement | No standalone page — features embedded contextually | AI insights appear where users need them (job editor, pipeline, candidate detail) |
| Salary data | LLM-estimated with disclaimer | Real salary APIs are expensive; LLM estimates with clear disclaimer are honest and useful |
| Result caching | Backend (JSONB on existing tables) | AI calls are slow/expensive; cached results load instantly, refresh on demand |
| Architecture | New dedicated LangGraph workflows per feature | Fast deterministic structured responses; independently deployable and testable |
| Scope | All 7 features | JD Generator, Bias Detector, Candidate Fit Summary, Candidate Ranking, Semantic Skills Gap, Interview Questions, Salary Intelligence |

---

## Architecture

No standalone `/ai-toolkit` page. 7 AI features embedded contextually:

| Feature | UI Location | Orchestrator Endpoint |
|---------|------------|----------------------|
| JD Generator | Job creation/edit — "Generate with AI" button | `POST /api/orchestrator/jd/generate` |
| JD Bias Detector | Job creation/edit — inline highlights in editor | `POST /api/orchestrator/jd/bias-check` |
| Candidate Fit Summary | Candidate Detail — AI summary card | `POST /api/orchestrator/candidate/fit-summary` |
| Candidate Ranking | Job pipeline — score badges on candidate cards | `POST /api/orchestrator/candidate/rank` |
| Skills Gap (Semantic) | Candidate Detail — skills section | `POST /api/orchestrator/candidate/skills-gap` |
| Interview Questions | Interview scheduling — suggested questions panel | `POST /api/orchestrator/interview/questions` |
| Salary Intelligence | Job creation/edit — salary insights card | `POST /api/orchestrator/salary/estimate` |

**Data flow:** Frontend -> Gateway (`/api/orchestrator/*`) -> `svc-ai-orchestrator` (new workflows) -> LLM provider. Results cached in `svc-recruiting` DB tables.

**Caching strategy:** Each feature stores its result in a JSONB column on the relevant existing table with a `generated_at` timestamp for staleness tracking. UI shows cached result instantly with a "Refresh" button to re-trigger.

---

## Feature Designs

### 1. JD Generator

**Location:** Job creation/edit page — "Generate with AI" button next to JD editor.

**Flow:**
1. Recruiter enters job title (required), optionally department/seniority/location
2. Clicks "Generate with AI"
3. Orchestrator generates full JD (summary, responsibilities, requirements, qualifications, benefits)
4. Result populates editor — recruiter edits freely
5. Cached on `job_descriptions.ai_generated_jd`

**Workflow:** `jd_generation` graph — `build_prompt -> generate_jd -> parse_structured -> END`. Returns structured sections as JSON.

### 2. JD Bias Detector

**Location:** Same job editor — runs on save/blur or via "Check for Bias" button.

**Flow:**
1. Recruiter writes/edits JD text
2. On trigger, text sent to bias check endpoint
3. Returns flagged phrases with bias type (gendered, age, ability, exclusionary) and suggested alternatives
4. UI highlights flagged phrases inline with tooltip showing suggestion
5. One-click to accept suggestion (replaces phrase)
6. Cached on `job_descriptions.ai_bias_check`

**Workflow:** `jd_bias_check` graph — `analyze_text -> extract_flags -> END`. Returns `{ score: 0-100, flags: [{ phrase, type, suggestion, position }] }`.

### 3. Candidate Fit Summary

**Location:** Candidate Detail page — "AI Analysis" card at top.

**Flow:**
1. Recruiter opens candidate profile for a specific job
2. Cached summary shown if fresh, otherwise auto-triggers or shows "Generate" button
3. Shows: overall fit rating (Strong/Good/Moderate/Weak), key strengths with evidence citations, concerns, recommendation
4. Cached on `candidate_job_entries.ai_fit_summary`

**Workflow:** `candidate_fit` graph — `gather_context -> analyze_fit -> structure_output -> END`. Context: job rubric + resume analysis + interview scores + screening responses.

### 4. Candidate Ranking

**Location:** Job Detail pipeline view — score badges on candidate cards.

**Fixes from audit:**
- Interview scores filtered by `jd_id` (was missing)
- Screening responses filtered by job's questions only (was counting all jobs)
- Screening score uses AI quality assessment (was just completion rate)
- Composite weights configurable

**Flow:**
1. Pipeline view shows cached ranking scores as badges
2. "Rank Candidates" button triggers batch ranking
3. Click score opens breakdown popover (resume 40%, interview 30%, feedback 20%, screening 10%)
4. Cached on `candidate_job_entries.ai_ranking_score`

**Workflow:** `candidate_ranking` graph — `fetch_candidates -> compute_scores -> rank -> END`. Mostly computation, LLM used for screening quality scoring.

### 5. Semantic Skills Gap

**Location:** Candidate Detail — skills section, replacing keyword-only matching.

**Upgrade:** LLM understands skill equivalences ("project management" ~ "program leadership"). Returns confidence scores per match.

**Flow:**
1. Candidate detail shows: matched skills (with confidence %), missing required skills, bonus skills
2. Overall match percentage displayed
3. Cached on `candidate_job_entries.ai_skills_gap`

**Workflow:** `skills_gap` graph — `extract_skills -> semantic_match -> structure_output -> END`. LLM evaluates each required skill against candidate skills, returning confidence 0-1.

### 6. AI Interview Questions

**Location:** Interview scheduling flow — panel alongside scheduling form.

**Flow:**
1. During scheduling, "AI Suggested Questions" panel appears
2. Questions generated based on: job requirements, candidate skills gap, interview round type
3. Copy individual or copy all
4. Cached on `interview_schedules.ai_suggested_questions`

**Workflow:** `interview_questions` graph — `gather_context -> generate_questions -> parse -> END`. Context: job rubric, resume analysis, skills gap, interview type.

### 7. Salary Intelligence

**Location:** Job creation/edit — "Salary Insights" card next to salary fields.

**Flow:**
1. Auto-triggers when job title + location are set
2. Shows estimated range (p25/p50/p75) with "AI-estimated" disclaimer
3. Country selector adjusts for cost-of-living
4. Cached on `job_descriptions.ai_salary_estimate`

**Workflow:** `salary_estimate` graph — `build_prompt -> estimate -> structure -> END`. Returns `{ currency, p25, p50, p75, disclaimer, confidence }`.

---

## Data Model Changes

### New JSONB columns on existing tables

**`job_descriptions` table:**
- `ai_generated_jd` — `{ summary, responsibilities, requirements, qualifications, benefits, generated_at }`
- `ai_bias_check` — `{ score, flags: [{ phrase, type, suggestion, start, end }], checked_at }`
- `ai_salary_estimate` — `{ currency, p25, p50, p75, country, disclaimer, confidence, estimated_at }`

**`candidate_job_entries` table:**
- `ai_fit_summary` — `{ rating, strengths: [{ point, evidence }], concerns, recommendation, generated_at }`
- `ai_ranking_score` — `{ composite, breakdown: { resume, interview, feedback, screening }, weights, ranked_at }`
- `ai_skills_gap` — `{ match_pct, matched: [{ skill, confidence }], missing, bonus, analyzed_at }`

**`interview_schedules` table:**
- `ai_suggested_questions` — `{ questions: [{ question, type, rationale }], generated_at }`

No new tables. All results live as JSONB on existing entities.

### Data Access

Orchestrator reads from recruiting DB directly (existing pattern via `recruiting_db` session). Frontend writes cached results back via recruiting API endpoints.

---

## Frontend Component Design

### Removed

- `/ai-toolkit` route and `AIToolkit.tsx` page deleted
- "AI Toolkit" nav item removed from TopNavbar `ai-tools` group

### New Components

**Job Creation/Edit page:**
- `JDGeneratorButton` — "Generate with AI" button, loading state, populates editor
- `JDBiasChecker` — Inline bias highlights on JD editor, tooltips with one-click fix, summary badge
- `SalaryInsightsCard` — Sidebar card with p25/p50/p75, auto-triggers on title+location

**Job Detail Pipeline view:**
- `CandidateRankBadge` — Score badge (0-100) on candidate cards, click opens breakdown popover
- `RankCandidatesButton` — Header button for batch ranking with progress indicator

**Candidate Detail page:**
- `AIFitSummaryCard` — Rating badge, strengths with citations, concerns, recommendation, refresh button
- `SemanticSkillsGap` — Replaces `SkillsGapMatrix`. Confidence bars per skill, circular progress ring
- `AIScreeningScores` — Per-answer AI score (1-5 stars) with reasoning, overall quality score

**Interview Scheduling:**
- `AISuggestedQuestions` — Auto-generated questions panel, copy buttons, collapsible

### State Management

React Query pattern:
- `queryFn` fetches cached result from recruiting API (fast)
- Mutation triggers orchestrator endpoint to regenerate
- On mutation success, invalidates the query to refetch cached result

### Access Control

- `admin`, `hr`, `hiring_manager` — all AI features visible
- `interviewer` — only AI Suggested Questions on their interview schedules
- `candidate` — nothing

---

## Error Handling

- **LLM timeout/failure:** Graceful error state ("AI analysis unavailable") with retry button. Never blocks the page.
- **Missing prerequisite data:** Helpful message explaining what's needed (e.g., "Upload a resume to generate AI analysis").
- **Stale cache:** Shows "Updated X ago" with refresh button. No automatic re-generation (controls LLM costs).
- **Concurrent requests:** React Query mutation deduplication prevents double-triggering. Workflows are idempotent.
- **Empty results:** Designed empty states for all features (0 candidates, 0 flags, 0 skills).
