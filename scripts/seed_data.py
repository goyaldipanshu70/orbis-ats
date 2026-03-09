"""
Comprehensive seed script for Orbis ATS platform.
Seeds both auth_db and recruiting_db with realistic data.

Usage: python3 scripts/seed_data.py
"""

import random
import string
import json
from datetime import datetime, timedelta

import bcrypt
import psycopg2
from psycopg2.extras import Json

# ── Config ─────────────────────────────────────────────────────────────────

AUTH_DB = "dbname=auth_db user=intesa password=intesa123 host=localhost port=5432"
RECRUITING_DB = "dbname=recruiting_db user=intesa password=intesa123 host=localhost port=5432"

NOW = datetime.utcnow()

def days_ago(n: int) -> datetime:
    return NOW - timedelta(days=n)

def hash_password(pw: str) -> str:
    return bcrypt.hashpw(pw.encode(), bcrypt.gensalt()).decode()

def random_code(length=8) -> str:
    return "".join(random.choices(string.ascii_uppercase + string.digits, k=length))

HASHED_PW = hash_password("password123")

# ── Users ──────────────────────────────────────────────────────────────────

USERS = [
    ("admin@orbis.io", "Admin", "User", "admin"),
    ("priya.sharma@orbis.io", "Priya", "Sharma", "hr"),
    ("rajesh.kumar@orbis.io", "Rajesh", "Kumar", "hr"),
    ("anita.desai@orbis.io", "Anita", "Desai", "hiring_manager"),
    ("vikram.singh@orbis.io", "Vikram", "Singh", "hiring_manager"),
    ("deepak.patel@orbis.io", "Deepak", "Patel", "interviewer"),
    ("meera.nair@orbis.io", "Meera", "Nair", "interviewer"),
    ("suresh.reddy@orbis.io", "Suresh", "Reddy", "interviewer"),
    ("kavita.joshi@orbis.io", "Kavita", "Joshi", "interviewer"),
    ("arjun.menon@orbis.io", "Arjun", "Menon", "interviewer"),
]

# ── Jobs ───────────────────────────────────────────────────────────────────

JOBS = [
    {
        "title": "Senior Full-Stack Engineer", "rubric": "Looking for experienced full-stack developers.",
        "status": "Open", "country": "India", "city": "Bangalore",
        "job_type": "full_time", "position_type": "individual_contributor",
        "experience_range": "5-8 years", "salary_min": 2500000, "salary_max": 4000000,
        "salary_currency": "INR", "location_type": "hybrid", "vacancies": 3, "user_id": "2", "days_ago": 45,
        "ai_result": {
            "job_title": "Senior Full-Stack Engineer",
            "summary": "We are looking for an experienced Full-Stack Engineer to join our product team.",
            "extracted_rubric": {
                "core_skills": ["React", "Node.js", "TypeScript", "PostgreSQL", "AWS"],
                "preferred_skills": ["Docker", "Kubernetes", "GraphQL"],
                "experience_requirements": {"description": "5+ years of full-stack development"},
                "educational_requirements": {"degree": "B.Tech/M.Tech", "field": "Computer Science"},
                "soft_skills": ["Communication", "Problem-solving", "Team leadership"],
                "certifications": ["AWS Certified Developer (preferred)"],
                "role_keywords": ["full-stack", "frontend", "backend", "web development"],
            },
        },
    },
    {
        "title": "Product Manager - Growth", "rubric": "Seeking a PM to drive growth initiatives.",
        "status": "Open", "country": "India", "city": "Mumbai",
        "job_type": "full_time", "position_type": "manager",
        "experience_range": "4-7 years", "salary_min": 2000000, "salary_max": 3500000,
        "salary_currency": "INR", "location_type": "onsite", "vacancies": 1, "user_id": "2", "days_ago": 30,
        "ai_result": {
            "job_title": "Product Manager - Growth",
            "summary": "Lead growth product initiatives to drive user acquisition and retention.",
            "extracted_rubric": {
                "core_skills": ["Product Strategy", "Data Analysis", "A/B Testing", "SQL"],
                "preferred_skills": ["Python", "Mixpanel", "Amplitude"],
                "experience_requirements": {"description": "4+ years in product management"},
                "educational_requirements": {"degree": "MBA", "field": "Business Administration"},
                "soft_skills": ["Strategic thinking", "Stakeholder management"],
                "certifications": [], "role_keywords": ["product", "growth", "analytics"],
            },
        },
    },
    {
        "title": "Data Scientist", "rubric": "Data scientist with strong ML background.",
        "status": "Open", "country": "India", "city": "Hyderabad",
        "job_type": "full_time", "position_type": "individual_contributor",
        "experience_range": "3-6 years", "salary_min": 1800000, "salary_max": 3200000,
        "salary_currency": "INR", "location_type": "remote", "vacancies": 2, "user_id": "3", "days_ago": 20,
        "ai_result": {
            "job_title": "Data Scientist",
            "summary": "Build ML models and recommendation systems.",
            "extracted_rubric": {
                "core_skills": ["Python", "TensorFlow", "PyTorch", "SQL", "Statistics"],
                "preferred_skills": ["Spark", "Airflow", "MLflow"],
                "experience_requirements": {"description": "3+ years in ML/Data Science"},
                "educational_requirements": {"degree": "M.Tech/PhD", "field": "Computer Science or Statistics"},
                "soft_skills": ["Analytical thinking", "Communication"],
                "certifications": [], "role_keywords": ["machine learning", "data science", "NLP"],
            },
        },
    },
    {
        "title": "DevOps Engineer", "rubric": "DevOps engineer for cloud infrastructure.",
        "status": "Open", "country": "India", "city": "Bangalore",
        "job_type": "full_time", "position_type": "individual_contributor",
        "experience_range": "3-5 years", "salary_min": 1500000, "salary_max": 2800000,
        "salary_currency": "INR", "location_type": "hybrid", "vacancies": 2, "user_id": "2", "days_ago": 15,
        "ai_result": {
            "job_title": "DevOps Engineer",
            "summary": "Manage and optimize cloud infrastructure on AWS.",
            "extracted_rubric": {
                "core_skills": ["AWS", "Docker", "Kubernetes", "Terraform", "Jenkins"],
                "preferred_skills": ["Ansible", "Prometheus", "Grafana"],
                "experience_requirements": {"description": "3+ years in DevOps/SRE"},
                "educational_requirements": {"degree": "B.Tech", "field": "Computer Science"},
                "soft_skills": ["Problem-solving", "Collaboration"],
                "certifications": ["AWS Solutions Architect"],
                "role_keywords": ["devops", "cloud", "infrastructure", "CI/CD"],
            },
        },
    },
    {
        "title": "UX Designer", "rubric": "Creative UX designer for mobile and web.",
        "status": "Open", "country": "India", "city": "Pune",
        "job_type": "full_time", "position_type": "individual_contributor",
        "experience_range": "2-5 years", "salary_min": 1200000, "salary_max": 2200000,
        "salary_currency": "INR", "location_type": "hybrid", "vacancies": 1, "user_id": "3", "days_ago": 10,
        "ai_result": {
            "job_title": "UX Designer",
            "summary": "Design intuitive user experiences for web and mobile.",
            "extracted_rubric": {
                "core_skills": ["Figma", "User Research", "Wireframing", "Prototyping"],
                "preferred_skills": ["Adobe XD", "Illustration", "Motion Design"],
                "experience_requirements": {"description": "2+ years in UX/Product Design"},
                "educational_requirements": {"degree": "Bachelor's", "field": "Design or HCI"},
                "soft_skills": ["Creativity", "Empathy"],
                "certifications": [], "role_keywords": ["UX", "UI", "design"],
            },
        },
    },
    {
        "title": "Sales Executive - Enterprise", "rubric": "Enterprise sales professional.",
        "status": "Closed", "country": "India", "city": "Delhi",
        "job_type": "full_time", "position_type": "individual_contributor",
        "experience_range": "4-7 years", "salary_min": 1500000, "salary_max": 3000000,
        "salary_currency": "INR", "location_type": "onsite", "vacancies": 2, "user_id": "3", "days_ago": 60,
        "ai_result": {
            "job_title": "Sales Executive - Enterprise",
            "summary": "Drive enterprise B2B sales for our SaaS platform.",
            "extracted_rubric": {
                "core_skills": ["B2B Sales", "CRM", "Negotiation", "Account Management"],
                "preferred_skills": ["Salesforce", "HubSpot"],
                "experience_requirements": {"description": "4+ years in enterprise sales"},
                "educational_requirements": {"degree": "MBA", "field": "Business"},
                "soft_skills": ["Persuasion", "Relationship building"],
                "certifications": [], "role_keywords": ["sales", "enterprise", "B2B"],
            },
        },
    },
]

CANDIDATES = [
    {"name": "Rahul Verma", "email": "rahul.verma@gmail.com", "phone": "+91-9876543210", "source": "manual"},
    {"name": "Sneha Gupta", "email": "sneha.gupta@gmail.com", "phone": "+91-9876543211", "source": "linkedin"},
    {"name": "Amit Jain", "email": "amit.jain@outlook.com", "phone": "+91-9876543212", "source": "referral"},
    {"name": "Pooja Mehta", "email": "pooja.mehta@gmail.com", "phone": "+91-9876543213", "source": "job_board"},
    {"name": "Karthik Iyer", "email": "karthik.iyer@yahoo.com", "phone": "+91-9876543214", "source": "manual"},
    {"name": "Neha Agarwal", "email": "neha.agarwal@gmail.com", "phone": "+91-9876543215", "source": "linkedin"},
    {"name": "Rohan Das", "email": "rohan.das@gmail.com", "phone": "+91-9876543216", "source": "csv_import"},
    {"name": "Divya Krishnan", "email": "divya.k@gmail.com", "phone": "+91-9876543217", "source": "referral"},
    {"name": "Sanjay Mishra", "email": "sanjay.mishra@gmail.com", "phone": "+91-9876543218", "source": "job_board"},
    {"name": "Ananya Rao", "email": "ananya.rao@gmail.com", "phone": "+91-9876543219", "source": "manual"},
    {"name": "Varun Thakur", "email": "varun.thakur@gmail.com", "phone": "+91-9876543220", "source": "linkedin"},
    {"name": "Priyanka Bose", "email": "priyanka.bose@gmail.com", "phone": "+91-9876543221", "source": "github"},
    {"name": "Aditya Kulkarni", "email": "aditya.k@gmail.com", "phone": "+91-9876543222", "source": "csv_import"},
    {"name": "Riya Saxena", "email": "riya.saxena@outlook.com", "phone": "+91-9876543223", "source": "manual"},
    {"name": "Manish Tiwari", "email": "manish.tiwari@gmail.com", "phone": "+91-9876543224", "source": "referral"},
    {"name": "Shreya Chatterjee", "email": "shreya.c@gmail.com", "phone": "+91-9876543225", "source": "job_board"},
    {"name": "Nikhil Pandey", "email": "nikhil.pandey@gmail.com", "phone": "+91-9876543226", "source": "linkedin"},
    {"name": "Ishita Banerjee", "email": "ishita.b@gmail.com", "phone": "+91-9876543227", "source": "manual"},
    {"name": "Gaurav Chopra", "email": "gaurav.chopra@gmail.com", "phone": "+91-9876543228", "source": "github"},
    {"name": "Nandini Pillai", "email": "nandini.pillai@gmail.com", "phone": "+91-9876543229", "source": "referral"},
    {"name": "Rajat Khanna", "email": "rajat.khanna@gmail.com", "phone": "+91-9876543230", "source": "job_board"},
    {"name": "Tanvi Malhotra", "email": "tanvi.m@gmail.com", "phone": "+91-9876543231", "source": "csv_import"},
    {"name": "Ashish Kapoor", "email": "ashish.kapoor@gmail.com", "phone": "+91-9876543232", "source": "manual"},
    {"name": "Meghna Srinivasan", "email": "meghna.s@gmail.com", "phone": "+91-9876543233", "source": "linkedin"},
    {"name": "Siddharth Dutta", "email": "siddharth.dutta@gmail.com", "phone": "+91-9876543234", "source": "referral"},
    {"name": "Pallavi Sharma", "email": "pallavi.sharma@gmail.com", "phone": "+91-9876543235", "source": "job_board"},
    {"name": "Vivek Goyal", "email": "vivek.goyal@gmail.com", "phone": "+91-9876543236", "source": "manual"},
    {"name": "Ritu Singh", "email": "ritu.singh@gmail.com", "phone": "+91-9876543237", "source": "github"},
    {"name": "Abhishek Chandra", "email": "abhishek.chandra@gmail.com", "phone": "+91-9876543238", "source": "linkedin"},
    {"name": "Swati Bhatt", "email": "swati.bhatt@gmail.com", "phone": "+91-9876543239", "source": "csv_import"},
]

# (candidate_idx, job_idx, stage, days_ago_created, score)
CANDIDATE_JOBS = [
    # Job 0: Senior Full-Stack Engineer
    (0, 0, "hired", 40, 88), (1, 0, "hired", 38, 85), (2, 0, "offer", 35, 82),
    (3, 0, "interview", 30, 78), (4, 0, "interview", 28, 75), (5, 0, "ai_interview", 25, 72),
    (6, 0, "screening", 20, 68), (7, 0, "screening", 18, 65),
    (8, 0, "applied", 15, 60), (9, 0, "applied", 12, 55), (10, 0, "rejected", 35, 45),
    # Job 1: Product Manager
    (11, 1, "hired", 25, 90), (12, 1, "offer", 20, 83), (13, 1, "interview", 18, 79),
    (14, 1, "ai_interview", 15, 74), (15, 1, "screening", 12, 70),
    (16, 1, "applied", 10, 62), (17, 1, "rejected", 20, 42),
    # Job 2: Data Scientist
    (18, 2, "interview", 15, 86), (19, 2, "interview", 14, 81),
    (20, 2, "ai_interview", 12, 76), (21, 2, "screening", 10, 71),
    (22, 2, "applied", 8, 64), (23, 2, "applied", 7, 58),
    # Job 3: DevOps Engineer
    (24, 3, "offer", 10, 84), (25, 3, "interview", 10, 79),
    (26, 3, "screening", 8, 73), (27, 3, "applied", 5, 66),
    # Job 4: UX Designer
    (28, 4, "interview", 7, 82), (29, 4, "screening", 5, 74),
    # Job 5: Sales Executive (closed)
    (3, 5, "hired", 50, 87), (8, 5, "hired", 48, 83),
    (14, 5, "rejected", 45, 55), (16, 5, "rejected", 43, 48),
]


def seed_auth():
    conn = psycopg2.connect(AUTH_DB)
    cur = conn.cursor()

    # Users
    print("[auth_db] Seeding users...")
    for email, first, last, role in USERS:
        cur.execute("""
            INSERT INTO users (email, hashed_password, first_name, last_name, role, is_active, must_change_password, created_at)
            VALUES (%s, %s, %s, %s, %s, true, false, %s)
            ON CONFLICT (email) DO UPDATE SET first_name = EXCLUDED.first_name, last_name = EXCLUDED.last_name, role = EXCLUDED.role, hashed_password = EXCLUDED.hashed_password
        """, (email, HASHED_PW, first, last, role, days_ago(90)))

    # Announcements
    cur.execute("SELECT count(*) FROM announcements")
    if cur.fetchone()[0] == 0:
        print("[auth_db] Seeding announcements...")
        for title, content, priority, pinned, cb, ca in [
            ("New Office Opening in Bangalore", "We are excited to announce our new office in Bangalore starting next quarter.", "urgent", True, 1, days_ago(2)),
            ("Annual Company Offsite - Save the Date", "Mark your calendars! Our annual offsite will be held from March 20-22 in Goa.", "normal", True, 1, days_ago(5)),
            ("Updated Leave Policy", "Please review the updated leave policy effective April 1st.", "normal", False, 2, days_ago(10)),
            ("Q1 Hiring Targets Achieved", "Great news! We've surpassed our Q1 hiring targets by 15%.", "normal", False, 2, days_ago(15)),
            ("New Employee Referral Bonus", "We're increasing the employee referral bonus to INR 50,000 for engineering positions.", "normal", False, 1, days_ago(20)),
            ("IT Security Training Mandatory", "All employees must complete the cybersecurity awareness training by March 15th.", "urgent", False, 1, days_ago(1)),
        ]:
            cur.execute("INSERT INTO announcements (title, content, priority, pinned, created_by, created_at) VALUES (%s,%s,%s,%s,%s,%s)",
                        (title, content, priority, pinned, cb, ca))

    # Document templates
    cur.execute("SELECT count(*) FROM document_templates")
    if cur.fetchone()[0] == 0:
        print("[auth_db] Seeding document templates...")
        for name, cat, desc, content, variables, cb in [
            ("Offer Letter - Standard", "Offer Letters", "Standard offer letter", "<p>Dear {{candidate_name}}, We are pleased to extend an offer...</p>", ["candidate_name","position","salary","start_date"], 1),
            ("NDA - Employee", "Legal", "Non-disclosure agreement", "<p>This NDA is entered between {{company_name}} and {{employee_name}}...</p>", ["company_name","employee_name","date"], 1),
            ("Interview Feedback Form", "Interview", "Standard feedback form", "<h3>Candidate: {{candidate_name}}</h3>", ["candidate_name","position","interviewer_name"], 2),
            ("Rejection Letter", "Communication", "Professional rejection letter", "<p>Dear {{candidate_name}}, Thank you for your interest...</p>", ["candidate_name","position"], 2),
            ("Background Check Consent", "Legal", "Consent for background verification", "<p>I, {{candidate_name}}, hereby authorize...</p>", ["candidate_name","date"], 1),
            ("Probation Completion", "HR", "Probation completion letter", "<p>Congratulations on completing your probation...</p>", ["employee_name","department"], 2),
        ]:
            cur.execute("INSERT INTO document_templates (name, category, description, content, variables, created_by, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                        (name, cat, desc, content, Json(variables), cb, days_ago(30)))

    # Onboarding templates
    cur.execute("SELECT count(*) FROM onboarding_templates")
    if cur.fetchone()[0] == 0:
        print("[auth_db] Seeding onboarding templates...")
        for title, desc, checklist in [
            ("Engineering Onboarding", "For engineering hires", [{"task":"Setup dev environment","done":False},{"task":"Complete Git training","done":False},{"task":"Meet team members","done":False},{"task":"Review codebase docs","done":False},{"task":"Security training","done":False}]),
            ("Sales Onboarding", "For sales team", [{"task":"CRM training","done":False},{"task":"Product demo walkthrough","done":False},{"task":"Meet key accounts","done":False},{"task":"Sales playbook review","done":False}]),
            ("General Onboarding", "For all new hires", [{"task":"Submit ID documents","done":False},{"task":"IT setup","done":False},{"task":"Review company policies","done":False},{"task":"Payroll setup","done":False},{"task":"Office tour","done":False}]),
        ]:
            cur.execute("INSERT INTO onboarding_templates (title, description, checklist, created_by, created_at) VALUES (%s,%s,%s,1,%s)",
                        (title, desc, Json(checklist), days_ago(45)))

    # Audit logs
    cur.execute("SELECT count(*) FROM audit_logs")
    if cur.fetchone()[0] == 0:
        print("[auth_db] Seeding audit logs...")
        for i, (uid, email, action, rtype, rid, details) in enumerate([
            (1, "admin@orbis.io", "user.create", "user", "2", "Created user priya.sharma@orbis.io"),
            (2, "priya.sharma@orbis.io", "job.create", "job", "1", "Created: Senior Full-Stack Engineer"),
            (3, "rajesh.kumar@orbis.io", "candidate.import", "candidate", None, "Imported 15 candidates via CSV"),
            (2, "priya.sharma@orbis.io", "candidate.stage_change", "candidate", "5", "Moved to interview stage"),
            (1, "admin@orbis.io", "settings.update", "settings", None, "Updated theme settings"),
            (6, "deepak.patel@orbis.io", "interview.feedback", "interview", "1", "Submitted feedback"),
            (2, "priya.sharma@orbis.io", "offer.create", "offer", "1", "Created offer for Rahul Verma"),
            (3, "rajesh.kumar@orbis.io", "job.create", "job", "3", "Created: Data Scientist"),
            (2, "priya.sharma@orbis.io", "campaign.create", "campaign", "1", "Created outreach campaign"),
            (1, "admin@orbis.io", "user.update", "user", "6", "Updated interviewer permissions"),
        ]):
            cur.execute("INSERT INTO audit_logs (user_id, user_email, action, resource_type, resource_id, details, ip_address, created_at) VALUES (%s,%s,%s,%s,%s,%s,'192.168.1.1',%s)",
                        (uid, email, action, rtype, rid, details, days_ago(30 - i * 2)))

    conn.commit()
    cur.close()
    conn.close()
    print("[auth_db] Done!")


def seed_recruiting():
    conn = psycopg2.connect(RECRUITING_DB)
    cur = conn.cursor()

    # Check & clear
    cur.execute("SELECT count(*) FROM job_descriptions")
    if cur.fetchone()[0] > 0:
        print("[recruiting_db] Clearing existing data...")
        for t in ["interviewer_feedback","pipeline_stage_history","interview_evaluations",
                   "offers","interview_schedules","email_campaign_recipients","email_campaign_steps",
                   "email_campaigns","referrals","referral_links","job_board_postings","hiring_costs",
                   "leads","lead_lists","job_requests","jd_templates","notifications",
                   "candidate_job_entries","candidate_profiles","job_applications",
                   "job_location_vacancies","interviewer_profiles","job_members",
                   "candidates","job_descriptions"]:
            try:
                cur.execute(f"TRUNCATE TABLE {t} CASCADE")
            except Exception:
                conn.rollback()
        conn.commit()

    # Jobs
    print("[recruiting_db] Seeding jobs...")
    for i, job in enumerate(JOBS):
        jid = i + 1
        cur.execute("""
            INSERT INTO job_descriptions
            (id, user_id, ai_result, rubric_text, model_answer_text, uploaded_file_info, status,
             country, city, job_type, position_type, experience_range,
             salary_range_min, salary_range_max, salary_currency, salary_visibility,
             location_type, number_of_vacancies, visibility, created_at, updated_at)
            VALUES (%s,%s,%s,%s,'','[]',%s,%s,%s,%s,%s,%s,%s,%s,%s,'public',%s,%s,'public',%s,%s)
        """, (jid, job["user_id"], Json(job["ai_result"]), job["rubric"], job["status"],
              job["country"], job["city"], job["job_type"], job["position_type"], job["experience_range"],
              job["salary_min"], job["salary_max"], job["salary_currency"],
              job["location_type"], job["vacancies"], days_ago(job["days_ago"]), days_ago(job["days_ago"])))

        cur.execute("INSERT INTO job_location_vacancies (jd_id, country, city, vacancies, created_at) VALUES (%s,%s,%s,%s,%s)",
                    (jid, job["country"], job["city"], job["vacancies"], days_ago(job["days_ago"])))

    cur.execute("SELECT setval('job_descriptions_id_seq', (SELECT MAX(id) FROM job_descriptions))")

    # Candidate profiles
    print("[recruiting_db] Seeding candidates...")
    for i, c in enumerate(CANDIDATES):
        cur.execute("""
            INSERT INTO candidate_profiles (id, email, full_name, phone, linkedin_url, status, original_source, created_by, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,'active',%s,'2',%s,%s)
        """, (i+1, c["email"], c["name"], c["phone"], f"https://linkedin.com/in/{c['name'].lower().replace(' ','')}", c["source"], days_ago(50), days_ago(50)))
    cur.execute("SELECT setval('candidate_profiles_id_seq', (SELECT MAX(id) FROM candidate_profiles))")

    # Candidate job entries
    print("[recruiting_db] Seeding pipeline entries...")
    entry_id = 0
    entries = []
    seen = set()
    for ci, ji, stage, da, score in CANDIDATE_JOBS:
        if (ci, ji) in seen:
            continue
        seen.add((ci, ji))
        entry_id += 1
        entries.append((entry_id, ci, ji, stage, da, score))
        job = JOBS[ji]
        cand = CANDIDATES[ci]
        created = days_ago(da)
        stage_changed = days_ago(max(1, da - random.randint(2, 8))) if stage != "applied" else None

        ai = Json({
            "overall_score": score,
            "skills_match": {"score": score - random.randint(0, 10), "matched": random.randint(3, 6), "total": 7},
            "experience_match": score - random.randint(0, 15),
            "summary": f"Strong alignment with {job['title']} requirements.",
        })
        cur.execute("""
            INSERT INTO candidate_job_entries
            (id, profile_id, jd_id, user_id, ai_resume_analysis, pipeline_stage,
             stage_changed_at, stage_changed_by, source, onboard, screening, interview_status, created_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
        """, (entry_id, ci+1, ji+1, job["user_id"], ai, stage,
              stage_changed, "2" if stage_changed else None, cand["source"],
              stage in ("screening","ai_interview","interview","offer","hired"),
              stage in ("screening","ai_interview","interview","offer","hired"),
              stage in ("interview","offer","hired"),
              created))

    cur.execute("SELECT setval('candidate_job_entries_id_seq', (SELECT MAX(id) FROM candidate_job_entries))")

    # Pipeline stage history
    print("[recruiting_db] Seeding stage history...")
    stage_order = ["applied", "screening", "ai_interview", "interview", "offer", "hired"]
    for eid, ci, ji, stage, da, score in entries:
        if stage == "applied":
            cur.execute("INSERT INTO pipeline_stage_history (candidate_id, jd_id, from_stage, to_stage, changed_by, created_at) VALUES (%s,%s,NULL,'applied','2',%s)",
                        (eid, ji+1, days_ago(da)))
        elif stage == "rejected":
            cur.execute("INSERT INTO pipeline_stage_history (candidate_id, jd_id, from_stage, to_stage, changed_by, created_at) VALUES (%s,%s,NULL,'applied','2',%s)",
                        (eid, ji+1, days_ago(da)))
            reason = random.choice(["Skills mismatch", "Insufficient experience", "Better candidates available", "Culture fit concerns"])
            cur.execute("INSERT INTO pipeline_stage_history (candidate_id, jd_id, from_stage, to_stage, changed_by, notes, created_at) VALUES (%s,%s,'applied','rejected','2',%s,%s)",
                        (eid, ji+1, reason, days_ago(da - 3)))
        else:
            idx = stage_order.index(stage) if stage in stage_order else 0
            for si in range(idx + 1):
                f_s = stage_order[si - 1] if si > 0 else None
                t_s = stage_order[si]
                td = da - si * random.randint(2, 5)
                if td < 0: td = 0
                cur.execute("INSERT INTO pipeline_stage_history (candidate_id, jd_id, from_stage, to_stage, changed_by, created_at) VALUES (%s,%s,%s,%s,'2',%s)",
                            (eid, ji+1, f_s, t_s, days_ago(td)))

    # Interview schedules
    print("[recruiting_db] Seeding interviews...")
    interviewer_pools = [
        ["Deepak Patel", "Meera Nair"], ["Suresh Reddy", "Kavita Joshi"],
        ["Arjun Menon", "Deepak Patel"], ["Meera Nair", "Suresh Reddy"],
    ]
    sid = 0
    sched_entries = []
    for eid, ci, ji, stage, da, score in entries:
        if stage in ("interview", "offer", "hired"):
            sid += 1
            interviewers = random.choice(interviewer_pools)
            sdate = days_ago(max(1, da - 5))
            status = "completed" if stage in ("offer", "hired") else "scheduled"
            cur.execute("""
                INSERT INTO interview_schedules
                (id, candidate_id, jd_id, interview_type, scheduled_date, scheduled_time,
                 duration_minutes, interviewer_ids, interviewer_names, status, created_by,
                 round_number, round_type, meeting_link, feedback_submitted, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,'2',1,%s,%s,%s,%s,%s)
            """, (sid, eid, ji+1, random.choice(["video","in_person"]),
                  sdate.strftime("%Y-%m-%d"), random.choice(["10:00","11:00","14:00","15:00"]),
                  random.choice([45, 60]), Json([6, 7]), Json(interviewers),
                  status, random.choice(["technical","behavioral","system_design"]),
                  "https://meet.google.com/abc-defg-hij",
                  status == "completed", sdate - timedelta(days=2), sdate - timedelta(days=2)))
            if status == "completed":
                sched_entries.append((sid, interviewers, score))
    if sid > 0:
        cur.execute("SELECT setval('interview_schedules_id_seq', (SELECT MAX(id) FROM interview_schedules))")

    # Feedback
    print("[recruiting_db] Seeding feedback...")
    iid_map = {"Deepak Patel": "6", "Meera Nair": "7", "Suresh Reddy": "8", "Kavita Joshi": "9", "Arjun Menon": "10"}
    rec_map = {5: "strong_yes", 4: "yes", 3: "neutral", 2: "no", 1: "strong_no"}
    for sid, interviewers, score in sched_entries:
        for iname in interviewers:
            rating = min(5, max(1, round(score / 20)))
            cur.execute("""
                INSERT INTO interviewer_feedback (schedule_id, interviewer_id, interviewer_name, rating, recommendation, strengths, concerns, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s)
            """, (sid, iid_map.get(iname, "6"), iname, rating, rec_map[rating],
                  random.choice(["Strong technical skills","Good communication","Problem-solving ability","Team player","Excellent domain knowledge"]),
                  random.choice(["Needs system design improvement","Could be more proactive",None,None]),
                  days_ago(random.randint(1, 10))))

    # Offers
    print("[recruiting_db] Seeding offers...")
    oid = 0
    for eid, ci, ji, stage, da, score in entries:
        if stage in ("offer", "hired"):
            oid += 1
            job = JOBS[ji]
            salary = random.randint(job["salary_min"], job["salary_max"])
            o_status = "accepted" if stage == "hired" else random.choice(["sent", "sent", "declined"])
            cur.execute("""
                INSERT INTO offers (id, candidate_id, jd_id, salary, salary_currency, start_date, position_title, department, status, created_by, created_at, updated_at, sent_at, responded_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,'Engineering',%s,'2',%s,%s,%s,%s)
            """, (oid, eid, ji+1, salary, job["salary_currency"],
                  (NOW + timedelta(days=30)).strftime("%Y-%m-%d"), job["title"],
                  o_status, days_ago(max(1, da-8)), days_ago(max(1, da-8)),
                  days_ago(max(1, da-7)),
                  days_ago(max(1, da-5)) if o_status in ("accepted","declined") else None))
    if oid > 0:
        cur.execute("SELECT setval('offers_id_seq', (SELECT MAX(id) FROM offers))")

    # Interviewer profiles
    print("[recruiting_db] Seeding interviewer profiles...")
    for uid, email, name, specs, dept in [
        (6, "deepak.patel@orbis.io", "Deepak Patel", ["React","Node.js","System Design"], "Engineering"),
        (7, "meera.nair@orbis.io", "Meera Nair", ["Python","Data Science","ML"], "Data Science"),
        (8, "suresh.reddy@orbis.io", "Suresh Reddy", ["DevOps","AWS","Kubernetes"], "Infrastructure"),
        (9, "kavita.joshi@orbis.io", "Kavita Joshi", ["Product Management","UX","Analytics"], "Product"),
        (10, "arjun.menon@orbis.io", "Arjun Menon", ["Java","Microservices","Spring Boot"], "Backend"),
    ]:
        cur.execute("""
            INSERT INTO interviewer_profiles (user_id, email, full_name, specializations, seniority, department, max_interviews_per_week, is_active, total_interviews, avg_rating_given, created_at, updated_at)
            VALUES (%s,%s,%s,%s,'senior',%s,8,true,%s,%s,%s,%s)
        """, (uid, email, name, Json(specs), dept, random.randint(15,40), round(random.uniform(3.2,4.5),1), days_ago(60), days_ago(60)))

    # Referrals
    print("[recruiting_db] Seeding referrals...")
    lid = 0
    rid = 0
    for uid, name, email in [("4","Anita Desai","anita.desai@orbis.io"),("5","Vikram Singh","vikram.singh@orbis.io"),("6","Deepak Patel","deepak.patel@orbis.io")]:
        for jid in [1, 2, 3]:
            lid += 1
            cur.execute("""
                INSERT INTO referral_links (id, jd_id, referrer_user_id, referrer_name, referrer_email, code, is_active, click_count, reward_amount, reward_currency, created_at)
                VALUES (%s,%s,%s,%s,%s,%s,true,%s,50000,'INR',%s)
            """, (lid, jid, uid, name, email, random_code(), random.randint(5,30), days_ago(random.randint(10,40))))
            for _ in range(random.randint(1, 3)):
                rid += 1
                rs = random.choice(["pending","applied","hired","rejected"])
                cur.execute("INSERT INTO referrals (id, link_id, status, reward_type, reward_amount, reward_currency, reward_status, created_at) VALUES (%s,%s,%s,%s,%s,'INR',%s,%s)",
                            (rid, lid, rs, "cash" if rs=="hired" else None, 50000 if rs=="hired" else None, "paid" if rs=="hired" else "pending", days_ago(random.randint(5,30))))
    cur.execute("SELECT setval('referral_links_id_seq', (SELECT MAX(id) FROM referral_links))")
    cur.execute("SELECT setval('referrals_id_seq', (SELECT MAX(id) FROM referrals))")

    # Email campaigns
    print("[recruiting_db] Seeding campaigns...")
    for ci, (name, jid, subject, body, status) in enumerate([
        ("Spring Engineering Drive", 1, "Exciting opportunity at Orbis!", "<p>Hi, We have an exciting opening...</p>", "sent"),
        ("Data Science Talent Hunt", 3, "Join our Data Science team", "<p>We're building an amazing team...</p>", "sending"),
        ("Product Leadership Outreach", 2, "Product Manager role", "<p>We're looking for a growth-focused PM...</p>", "draft"),
    ]):
        cid = ci + 1
        cur.execute("INSERT INTO email_campaigns (id, name, jd_id, template_subject, template_body, campaign_type, status, created_by, created_at) VALUES (%s,%s,%s,%s,%s,'one_time',%s,'2',%s)",
                    (cid, name, jid, subject, body, status, days_ago(20 - ci*5)))
        for ri in range(random.randint(8, 15)):
            rs = random.choice(["sent","opened","clicked","replied","bounced","pending"])
            cur.execute("INSERT INTO email_campaign_recipients (campaign_id, candidate_email, candidate_name, status, sent_at, opened_at, clicked_at) VALUES (%s,%s,%s,%s,%s,%s,%s)",
                        (cid, f"prospect{ci*20+ri}@example.com", f"Prospect {ci*20+ri+1}", rs,
                         days_ago(random.randint(1,15)) if rs != "pending" else None,
                         days_ago(random.randint(1,10)) if rs in ("opened","clicked","replied") else None,
                         days_ago(random.randint(1,5)) if rs in ("clicked","replied") else None))
    cur.execute("SELECT setval('email_campaigns_id_seq', 3)")

    # Job board postings
    print("[recruiting_db] Seeding job boards...")
    boards = ["linkedin","indeed","glassdoor","naukri","internal"]
    bp_id = 0
    for jid in range(1, len(JOBS)+1):
        for board in random.sample(boards, random.randint(2,4)):
            bp_id += 1
            cur.execute("INSERT INTO job_board_postings (id, jd_id, board_name, status, published_at, views, applications, created_at) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
                        (bp_id, jid, board, "published" if JOBS[jid-1]["status"]=="Open" else "expired",
                         days_ago(JOBS[jid-1]["days_ago"]-1), random.randint(50,500), random.randint(5,50), days_ago(JOBS[jid-1]["days_ago"])))
    cur.execute(f"SELECT setval('job_board_postings_id_seq', {bp_id})")

    # Job requests
    print("[recruiting_db] Seeding job requests...")
    for ri, (uid, name, email, role, team, dept, just, budget, priority, status) in enumerate([
        ("4","Anita Desai","anita.desai@orbis.io","Frontend Developer","UI Team","Engineering","Need to expand frontend team",1800000,"high","approved"),
        ("5","Vikram Singh","vikram.singh@orbis.io","QA Engineer","Quality","Engineering","QA team is overwhelmed",1500000,"medium","pending"),
        ("4","Anita Desai","anita.desai@orbis.io","Technical Writer","Documentation","Engineering","Need writer for API docs",1200000,"low","pending"),
        ("5","Vikram Singh","vikram.singh@orbis.io","Security Engineer","InfoSec","Engineering","Critical: need security expert",2500000,"critical","approved"),
        ("4","Anita Desai","anita.desai@orbis.io","Marketing Manager","Growth","Marketing","Lead marketing campaigns",2000000,"medium","rejected"),
    ]):
        cur.execute("""
            INSERT INTO job_requests (id, requested_by, requester_name, requester_email, requested_role, team, department,
             justification, budget, budget_currency, priority, number_of_positions, job_type, location_type, status, skills_required, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,'INR',%s,%s,'full_time','hybrid',%s,%s,%s,%s)
        """, (ri+1, uid, name, email, role, team, dept, just, budget, priority, random.randint(1,3), status,
              Json(["JavaScript","React"]), days_ago(random.randint(5,25)), days_ago(random.randint(5,25))))
    cur.execute("SELECT setval('job_requests_id_seq', 5)")

    # JD templates
    print("[recruiting_db] Seeding JD templates...")
    for ti, (name, cat, desc, content, skills, exp, usage) in enumerate([
        ("Senior Backend Engineer","Engineering","Backend engineering template",{"responsibilities":["Design APIs","Code reviews"],"requirements":["5+ years"]},["Node.js","Python","PostgreSQL"],"5-8 years",3),
        ("Product Designer","Design","Product design template",{"responsibilities":["User research","Wireframing"],"requirements":["3+ years"]},["Figma","Sketch","User Research"],"3-5 years",2),
        ("Growth Marketing Manager","Marketing","Marketing leadership template",{"responsibilities":["Campaign strategy","Team management"],"requirements":["5+ years"]},["Google Ads","SEO","Analytics"],"5-7 years",1),
        ("Data Engineer","Engineering","Data engineering template",{"responsibilities":["Build data pipelines","ETL"],"requirements":["3+ years"]},["Python","Spark","Airflow","SQL"],"3-6 years",4),
        ("HR Business Partner","HR","HRBP template",{"responsibilities":["Partner with business leaders","Talent strategy"],"requirements":["5+ years"]},["HRBP","Talent Management"],"5-8 years",1),
    ]):
        cur.execute("""
            INSERT INTO jd_templates (id, name, category, description, jd_content, skills, experience_range, is_active, usage_count, created_by, created_at, updated_at)
            VALUES (%s,%s,%s,%s,%s,%s,%s,true,%s,'2',%s,%s)
        """, (ti+1, name, cat, desc, Json(content), Json(skills), exp, usage, days_ago(random.randint(15,40)), days_ago(random.randint(15,40))))
    cur.execute("SELECT setval('jd_templates_id_seq', 5)")

    # Lead lists & leads
    print("[recruiting_db] Seeding leads...")
    for li, (name, desc, source, jid) in enumerate([
        ("Bangalore React Developers","AI-sourced React devs","ai_discovery",1),
        ("Senior Python Engineers","LinkedIn Python engineers","linkedin",3),
        ("Design Professionals Pune","Manual design talent list","manual",5),
    ]):
        lc = random.randint(8, 20)
        cur.execute("INSERT INTO lead_lists (id, name, description, source, jd_id, lead_count, status, created_by, created_at) VALUES (%s,%s,%s,%s,%s,%s,'active','2',%s)",
                    (li+1, name, desc, source, jid, lc, days_ago(random.randint(5,20))))
        for ldi in range(lc):
            ls = random.choice(["new","new","contacted","responded","converted","rejected"])
            cur.execute("""
                INSERT INTO leads (list_id, name, email, title, company, location, source_platform, skills, experience_years, relevance_score, status, created_at, updated_at)
                VALUES (%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s,%s)
            """, (li+1, f"Lead {li*20+ldi+1}", f"lead{li*20+ldi+1}@example.com",
                  random.choice(["Software Engineer","Senior Developer","Tech Lead","Designer","Data Scientist"]),
                  random.choice(["TCS","Infosys","Flipkart","Razorpay","Swiggy","Paytm"]),
                  random.choice(["Bangalore","Mumbai","Hyderabad","Pune","Delhi"]),
                  random.choice(["linkedin","github","naukri"]),
                  Json(random.sample(["React","Python","Node.js","AWS","Docker","ML","Java","Go"],3)),
                  random.randint(2,12), round(random.uniform(40,95),1), ls, days_ago(random.randint(1,15)), days_ago(random.randint(1,15))))
    cur.execute("SELECT setval('lead_lists_id_seq', 3)")

    # Hiring costs
    print("[recruiting_db] Seeding hiring costs...")
    for jid in range(1, len(JOBS)+1):
        for ct in random.sample(["job_board","agency","referral_bonus","recruiter_hours","advertising"], random.randint(2,4)):
            cur.execute("INSERT INTO hiring_costs (jd_id, cost_type, amount, currency, description, created_by, created_at) VALUES (%s,%s,%s,'INR',%s,'2',%s)",
                        (jid, ct, random.randint(5000,200000), f"{ct.replace('_',' ').title()} for {JOBS[jid-1]['title']}", days_ago(random.randint(5,30))))

    # Notifications
    print("[recruiting_db] Seeding notifications...")
    for ni in range(20):
        ntype = random.choice(["application_received","interview_scheduled","stage_changed","offer_sent","reminder"])
        uid = random.choice([2,3,4,5,6,7])
        cur.execute("INSERT INTO notifications (user_id, user_email, type, subject, body, channel, status, is_read, created_at) VALUES (%s,%s,%s,%s,%s,'in_app','sent',%s,%s)",
                    (uid, USERS[uid-1][0], ntype, f"{ntype.replace('_',' ').title()}", f"Notification for {ntype}", random.choice([True,True,False]), days_ago(random.randint(0,15))))

    conn.commit()
    cur.close()
    conn.close()
    print("[recruiting_db] Done!")


def main():
    print("=" * 60)
    print("  Orbis ATS - Comprehensive Data Seed Script")
    print("=" * 60)
    print()
    seed_auth()
    print()
    seed_recruiting()
    print()
    print("=" * 60)
    print("  Seeding complete! All features should now show data.")
    print("=" * 60)
    print()
    print("Data seeded:")
    print(f"  - {len(USERS)} users (admin, HR, hiring managers, interviewers)")
    print(f"  - {len(JOBS)} jobs across departments & locations")
    print(f"  - {len(CANDIDATES)} candidate profiles")
    print(f"  - {len(CANDIDATE_JOBS)} candidate-job pipeline entries")
    print(f"  - Interview schedules with interviewer feedback")
    print(f"  - Offers (accepted, declined, sent)")
    print(f"  - 5 interviewer profiles")
    print(f"  - 9 referral links with referrals")
    print(f"  - 3 email campaigns with recipients")
    print(f"  - Job board postings across 5 platforms")
    print(f"  - 5 job requests (approved/pending/rejected)")
    print(f"  - 5 JD templates")
    print(f"  - 3 lead lists with ~15 leads each")
    print(f"  - Hiring costs per job")
    print(f"  - 6 announcements, 6 document templates, 3 onboarding templates")
    print(f"  - 10 audit logs, 20 notifications")
    print()
    print("Login: any user email with password 'password123'")
    print("Admin: admin@orbis.io / password123")


if __name__ == "__main__":
    main()
