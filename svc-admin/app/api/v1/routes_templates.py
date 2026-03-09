"""Document templates — reusable HR document templates."""
import json, math, re
from io import BytesIO
from fastapi import APIRouter, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, desc, func, or_
from pydantic import BaseModel
from typing import Optional, List, Dict
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer

from app.db.postgres import get_db
from app.db.models import DocumentTemplate
from app.core.security import get_current_user, is_admin_user, is_admin_or_hr_user
from app.api.v1.routes_audit import log_action

router = APIRouter()


class TemplateCreate(BaseModel):
    name: str
    category: str
    description: Optional[str] = None
    content: str
    variables: Optional[List[str]] = None


class TemplateUpdate(BaseModel):
    name: Optional[str] = None
    category: Optional[str] = None
    description: Optional[str] = None
    content: Optional[str] = None
    variables: Optional[List[str]] = None


class RenderRequest(BaseModel):
    variables: Dict[str, str]


CATEGORIES = [
    "offer_letter",
    "nda",
    "employment_contract",
    "policy",
    "onboarding",
    "termination",
    "performance_review",
    "other",
]


def _serialize(t: DocumentTemplate) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "category": t.category,
        "description": t.description,
        "content": t.content,
        "variables": t.variables or [],
        "created_by": t.created_by,
        "created_at": t.created_at.isoformat() if t.created_at else None,
    }


# ---------------------------------------------------------------------------
# List with server-side search + category filter
# ---------------------------------------------------------------------------

@router.get("")
async def list_templates(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    search: Optional[str] = Query(None),
    category: Optional[str] = Query(None),
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    base = select(DocumentTemplate)
    count_base = select(func.count()).select_from(DocumentTemplate)

    if category:
        base = base.where(DocumentTemplate.category == category)
        count_base = count_base.where(DocumentTemplate.category == category)

    if search:
        like = f"%{search}%"
        search_filter = or_(
            DocumentTemplate.name.ilike(like),
            DocumentTemplate.description.ilike(like),
        )
        base = base.where(search_filter)
        count_base = count_base.where(search_filter)

    total = (await db.execute(count_base)).scalar_one()
    offset = (page - 1) * page_size
    stmt = base.order_by(desc(DocumentTemplate.created_at)).offset(offset).limit(page_size)
    result = await db.execute(stmt)
    return {
        "items": [_serialize(t) for t in result.scalars().all()],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": math.ceil(total / page_size) if total else 0,
    }


@router.get("/categories")
async def list_categories(user: dict = Depends(get_current_user)):
    return CATEGORIES


# ---------------------------------------------------------------------------
# Seed (admin-only, idempotent) — must be before /{template_id}
# ---------------------------------------------------------------------------

SEED_TEMPLATES = [
    {
        "name": "Standard Offer Letter",
        "category": "offer_letter",
        "description": "Formal offer of employment with compensation details and start date.",
        "variables": ["candidate_name", "position_title", "department", "salary", "start_date", "company_name", "hr_contact_name", "hr_contact_email"],
        "content": """{{company_name}}
Human Resources Department

Date: {{start_date}}

Dear {{candidate_name}},

We are pleased to extend this offer of employment for the position of {{position_title}} in our {{department}} department at {{company_name}}.

POSITION DETAILS
- Title: {{position_title}}
- Department: {{department}}
- Start Date: {{start_date}}
- Employment Type: Full-time
- Reports To: Department Head

COMPENSATION
- Annual Base Salary: {{salary}}
- Payment Frequency: Monthly (12 equal installments)
- Benefits: Standard company benefits package including health insurance, dental coverage, and retirement plan

TERMS AND CONDITIONS
1. This offer is contingent upon successful completion of background verification and reference checks.
2. Employment is at-will and may be terminated by either party with appropriate notice as per company policy.
3. You will be expected to comply with all company policies and procedures as outlined in the employee handbook.
4. A probationary period of 90 days will apply from your start date.

NEXT STEPS
Please confirm your acceptance of this offer by signing and returning this letter by {{start_date}}.

If you have any questions, please contact {{hr_contact_name}} at {{hr_contact_email}}.

We are excited to welcome you to the {{company_name}} team!

Sincerely,

_________________________
{{hr_contact_name}}
Human Resources
{{company_name}}


ACCEPTANCE

I, {{candidate_name}}, accept the offer of employment as described above.

Signature: _________________________
Date: _________________________""",
    },
    {
        "name": "Employment Contract",
        "category": "employment_contract",
        "description": "Comprehensive employment agreement covering terms, compensation, and obligations.",
        "variables": ["employee_name", "position", "department", "salary", "probation_period", "notice_period", "company_name", "effective_date"],
        "content": """EMPLOYMENT CONTRACT

This Employment Contract ("Agreement") is entered into as of {{effective_date}}, by and between:

EMPLOYER: {{company_name}} ("the Company")
EMPLOYEE: {{employee_name}} ("the Employee")

1. POSITION AND DUTIES
   1.1 The Company hereby employs {{employee_name}} in the position of {{position}} within the {{department}} department.
   1.2 The Employee shall perform all duties and responsibilities associated with this position as directed by their supervisor.
   1.3 The Employee agrees to devote their full professional time and attention to the duties of this position.

2. TERM AND PROBATION
   2.1 This agreement shall commence on {{effective_date}}.
   2.2 The Employee shall serve a probationary period of {{probation_period}}.
   2.3 During probation, either party may terminate this agreement with 7 days written notice.

3. COMPENSATION AND BENEFITS
   3.1 Annual Salary: {{salary}}, payable monthly.
   3.2 The Employee is entitled to standard company benefits as outlined in the employee handbook.
   3.3 Salary reviews will be conducted annually based on performance.

4. WORKING HOURS
   4.1 Standard working hours are 40 hours per week, Monday through Friday.
   4.2 Overtime may be required and will be compensated in accordance with applicable labor laws.

5. TERMINATION
   5.1 After probation, either party may terminate this agreement with {{notice_period}} written notice.
   5.2 The Company reserves the right to terminate immediately for cause including but not limited to misconduct, breach of confidentiality, or gross negligence.

6. CONFIDENTIALITY
   6.1 The Employee agrees to maintain strict confidentiality of all proprietary information, trade secrets, and business strategies.
   6.2 This obligation survives termination of employment.

7. INTELLECTUAL PROPERTY
   7.1 All work product created during employment shall be the exclusive property of the Company.

8. GOVERNING LAW
   This agreement shall be governed by applicable employment laws and regulations.

SIGNATURES

For {{company_name}}:
Name: _________________________
Title: _________________________
Date: _________________________

Employee:
{{employee_name}}
Signature: _________________________
Date: _________________________""",
    },
    {
        "name": "Non-Disclosure Agreement",
        "category": "nda",
        "description": "Standard NDA for protecting confidential business information.",
        "variables": ["receiving_party", "effective_date", "duration", "jurisdiction", "company_name", "disclosing_party_title"],
        "content": """NON-DISCLOSURE AGREEMENT

This Non-Disclosure Agreement ("Agreement") is entered into as of {{effective_date}}.

BETWEEN:
Disclosing Party: {{company_name}}, represented by {{disclosing_party_title}}
Receiving Party: {{receiving_party}}

1. DEFINITION OF CONFIDENTIAL INFORMATION
   "Confidential Information" means all non-public information disclosed by the Disclosing Party, including but not limited to:
   - Business plans, strategies, and financial data
   - Customer and vendor lists and related information
   - Technical data, software, algorithms, and processes
   - Employee information and organizational structures
   - Marketing plans and product roadmaps

2. OBLIGATIONS OF RECEIVING PARTY
   2.1 {{receiving_party}} agrees to hold all Confidential Information in strict confidence.
   2.2 {{receiving_party}} shall not disclose Confidential Information to any third party without prior written consent.
   2.3 {{receiving_party}} shall use Confidential Information solely for the purpose for which it was disclosed.
   2.4 {{receiving_party}} shall protect Confidential Information using the same degree of care used to protect their own confidential information.

3. EXCLUSIONS
   This Agreement does not apply to information that:
   a) Is or becomes publicly available through no fault of the Receiving Party
   b) Was known to the Receiving Party prior to disclosure
   c) Is independently developed without use of Confidential Information
   d) Is required to be disclosed by law or court order

4. TERM
   This Agreement shall remain in effect for {{duration}} from the Effective Date.

5. RETURN OF MATERIALS
   Upon termination or request, {{receiving_party}} shall promptly return or destroy all materials containing Confidential Information.

6. REMEDIES
   {{receiving_party}} acknowledges that breach may cause irreparable harm and that {{company_name}} may seek injunctive relief in addition to other remedies.

7. GOVERNING LAW
   This Agreement shall be governed by the laws of {{jurisdiction}}.

SIGNATURES

{{company_name}}
By: _________________________
Title: {{disclosing_party_title}}
Date: _________________________

{{receiving_party}}
Signature: _________________________
Date: _________________________""",
    },
    {
        "name": "Employee Onboarding Checklist",
        "category": "onboarding",
        "description": "Structured onboarding checklist for new employee first-week setup.",
        "variables": ["employee_name", "start_date", "department", "manager", "it_contact", "buddy_name", "company_name"],
        "content": """EMPLOYEE ONBOARDING CHECKLIST
{{company_name}}

Employee: {{employee_name}}
Start Date: {{start_date}}
Department: {{department}}
Manager: {{manager}}
Onboarding Buddy: {{buddy_name}}

═══════════════════════════════════════════════════
PRE-ARRIVAL (Complete before {{start_date}})
═══════════════════════════════════════════════════

[ ] Signed offer letter and employment contract received
[ ] Background check completed and cleared
[ ] Workstation and equipment ordered
[ ] Email account created (contact {{it_contact}})
[ ] Building access card prepared
[ ] Welcome email sent to {{employee_name}}
[ ] First-week schedule prepared by {{manager}}
[ ] Onboarding buddy {{buddy_name}} notified

═══════════════════════════════════════════════════
DAY 1 — Welcome & Setup
═══════════════════════════════════════════════════

[ ] Welcome meeting with {{manager}}
[ ] Office tour and team introductions
[ ] Collect building access card and keys
[ ] IT setup: laptop, email, VPN, software (contact {{it_contact}})
[ ] Review employee handbook and company policies
[ ] Complete tax forms and payroll enrollment
[ ] Set up direct deposit
[ ] Emergency contact information collected
[ ] Company org chart review

═══════════════════════════════════════════════════
WEEK 1 — Orientation
═══════════════════════════════════════════════════

[ ] HR orientation session
[ ] Benefits enrollment walkthrough
[ ] Department-specific training with {{manager}}
[ ] Safety and compliance training
[ ] Introduction to key stakeholders
[ ] Access to required systems and tools
[ ] Review 30-60-90 day expectations
[ ] Lunch with onboarding buddy {{buddy_name}}

═══════════════════════════════════════════════════
FIRST 30 DAYS
═══════════════════════════════════════════════════

[ ] Complete all mandatory training modules
[ ] 1:1 check-in with {{manager}} (weekly)
[ ] Attend team meetings and standups
[ ] Review and understand team processes
[ ] Set initial performance goals
[ ] Probation period expectations reviewed

NOTES:
_____________________________________________
_____________________________________________

Completed by: _________________________
Date: _________________________""",
    },
    {
        "name": "Probation Completion Letter",
        "category": "offer_letter",
        "description": "Confirmation letter upon successful completion of probationary period.",
        "variables": ["employee_name", "position", "probation_end_date", "revised_salary", "company_name", "manager_name"],
        "content": """{{company_name}}
Human Resources Department

Date: {{probation_end_date}}

Dear {{employee_name}},

RE: SUCCESSFUL COMPLETION OF PROBATIONARY PERIOD

We are pleased to confirm that you have successfully completed your probationary period as {{position}} at {{company_name}}.

CONFIRMATION DETAILS
- Employee: {{employee_name}}
- Position: {{position}}
- Probation End Date: {{probation_end_date}}
- Employment Status: Confirmed as permanent employee

PERFORMANCE SUMMARY
During your probation period, your manager {{manager_name}} has assessed your performance and confirmed that you have met the required standards in the following areas:

1. Job Knowledge & Technical Skills — Satisfactory
2. Quality of Work — Satisfactory
3. Attendance & Punctuality — Satisfactory
4. Team Collaboration — Satisfactory
5. Adherence to Company Policies — Satisfactory

REVISED COMPENSATION
Effective {{probation_end_date}}, your revised annual salary will be {{revised_salary}}.

GOING FORWARD
As a confirmed employee, you are now entitled to full benefits as outlined in the employee handbook, including:
- Full health insurance coverage
- Annual leave entitlement
- Professional development budget
- Performance bonus eligibility

We appreciate your contributions and look forward to your continued growth with {{company_name}}.

Sincerely,

_________________________
HR Manager
{{company_name}}

cc: {{manager_name}} (Department Manager)""",
    },
    {
        "name": "Experience / Relieving Letter",
        "category": "termination",
        "description": "Letter confirming employment tenure and relieving the employee from duties.",
        "variables": ["employee_name", "position", "department", "joining_date", "last_working_day", "company_name"],
        "content": """{{company_name}}
Human Resources Department

Date: {{last_working_day}}

TO WHOM IT MAY CONCERN

EXPERIENCE AND RELIEVING LETTER

This is to certify that {{employee_name}} was employed with {{company_name}} from {{joining_date}} to {{last_working_day}} in the capacity of {{position}} in our {{department}} department.

EMPLOYMENT DETAILS
- Full Name: {{employee_name}}
- Designation: {{position}}
- Department: {{department}}
- Date of Joining: {{joining_date}}
- Date of Relieving: {{last_working_day}}

PERFORMANCE
During the tenure at {{company_name}}, {{employee_name}} demonstrated professionalism, dedication, and competence. Key responsibilities included:

- Fulfilling all duties associated with the role of {{position}}
- Contributing to team objectives and departmental goals
- Maintaining professional conduct and adherence to company policies

RELIEVING STATEMENT
{{employee_name}} is hereby relieved from all duties and responsibilities at {{company_name}} effective {{last_working_day}}. All company property has been returned and all clearance procedures have been completed.

SETTLEMENT
All dues including final salary, leave encashment, and any applicable benefits have been settled as per company policy.

We wish {{employee_name}} all the best in future endeavors.

This letter is issued upon request for whatever purpose it may serve.

Sincerely,

_________________________
HR Manager
{{company_name}}

(This is a system-generated letter and is valid without signature when verified through the company HR department.)""",
    },
    {
        "name": "Employee Warning Letter",
        "category": "policy",
        "description": "Formal written warning for policy violations or performance issues.",
        "variables": ["employee_name", "position", "department", "incident_date", "incident_description", "manager_name", "company_name", "warning_level"],
        "content": """{{company_name}}
Human Resources Department

CONFIDENTIAL

Date: {{incident_date}}

To: {{employee_name}}
Position: {{position}}
Department: {{department}}

RE: {{warning_level}} — FORMAL WARNING NOTICE

Dear {{employee_name}},

This letter serves as a formal {{warning_level}} regarding the following matter:

INCIDENT DETAILS
- Date of Incident: {{incident_date}}
- Description: {{incident_description}}
- Reported by: {{manager_name}}

COMPANY POLICY REFERENCE
The above conduct is in violation of the company's policies as outlined in the employee handbook. All employees are expected to maintain professional standards of behavior and performance.

EXPECTED CORRECTIVE ACTION
You are required to:
1. Immediately cease the behavior described above.
2. Demonstrate consistent improvement in the identified area.
3. Meet with {{manager_name}} weekly for the next 30 days to review progress.
4. Adhere to all company policies going forward.

CONSEQUENCES
Please be advised that failure to correct this behavior may result in further disciplinary action, up to and including termination of employment.

EMPLOYEE ACKNOWLEDGMENT
Your signature below indicates that you have received and understood this warning. It does not necessarily indicate agreement with the contents.

Employee: {{employee_name}}
Signature: _________________________
Date: _________________________

Manager: {{manager_name}}
Signature: _________________________
Date: _________________________

HR Representative: _________________________
Signature: _________________________
Date: _________________________

cc: Employee personnel file""",
    },
    {
        "name": "Performance Review Form",
        "category": "performance_review",
        "description": "Structured performance review form with competency ratings and goal setting.",
        "variables": ["employee_name", "position", "department", "review_period", "reviewer_name", "company_name"],
        "content": """{{company_name}}
PERFORMANCE REVIEW FORM

═══════════════════════════════════════════════════
EMPLOYEE INFORMATION
═══════════════════════════════════════════════════
Employee Name: {{employee_name}}
Position: {{position}}
Department: {{department}}
Review Period: {{review_period}}
Reviewer: {{reviewer_name}}
Review Date: _______________

═══════════════════════════════════════════════════
RATING SCALE
═══════════════════════════════════════════════════
5 — Exceptional: Consistently exceeds expectations
4 — Exceeds: Frequently exceeds expectations
3 — Meets: Consistently meets expectations
2 — Developing: Partially meets expectations
1 — Below: Does not meet expectations

═══════════════════════════════════════════════════
CORE COMPETENCIES
═══════════════════════════════════════════════════

1. JOB KNOWLEDGE & TECHNICAL SKILLS        Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

2. QUALITY OF WORK                          Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

3. PRODUCTIVITY & EFFICIENCY                Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

4. COMMUNICATION SKILLS                     Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

5. TEAMWORK & COLLABORATION                 Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

6. INITIATIVE & PROBLEM SOLVING             Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

7. RELIABILITY & ATTENDANCE                 Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

8. LEADERSHIP (if applicable)               Rating: [ ] / 5
   Comments: ________________________________________
   ________________________________________________

OVERALL RATING:                             [ ] / 5

═══════════════════════════════════════════════════
KEY ACHIEVEMENTS THIS PERIOD
═══════════════════════════════════════════════════
1. ________________________________________________
2. ________________________________________________
3. ________________________________________________

═══════════════════════════════════════════════════
AREAS FOR IMPROVEMENT
═══════════════════════════════════════════════════
1. ________________________________________________
2. ________________________________________________

═══════════════════════════════════════════════════
GOALS FOR NEXT PERIOD
═══════════════════════════════════════════════════
1. ________________________________________________
   Target Date: ___________
2. ________________________________________________
   Target Date: ___________
3. ________________________________________________
   Target Date: ___________

═══════════════════════════════════════════════════
TRAINING & DEVELOPMENT RECOMMENDATIONS
═══════════════════════════════════════════════════
________________________________________________
________________________________________________

═══════════════════════════════════════════════════
SIGNATURES
═══════════════════════════════════════════════════

Employee: {{employee_name}}
Signature: _________________________  Date: ___________
Comments: ________________________________________________

Reviewer: {{reviewer_name}}
Signature: _________________________  Date: ___________

HR Approval: _________________________  Date: ___________""",
    },
    {
        "name": "Remote Work Policy Agreement",
        "category": "policy",
        "description": "Agreement outlining remote work terms, expectations, and responsibilities.",
        "variables": ["employee_name", "position", "department", "remote_work_days", "effective_date", "manager_name", "company_name"],
        "content": """{{company_name}}
REMOTE WORK POLICY AGREEMENT

This Remote Work Agreement ("Agreement") is entered into between {{company_name}} ("the Company") and {{employee_name}} ("the Employee").

Effective Date: {{effective_date}}

═══════════════════════════════════════════════════
EMPLOYEE DETAILS
═══════════════════════════════════════════════════
Name: {{employee_name}}
Position: {{position}}
Department: {{department}}
Manager: {{manager_name}}
Approved Remote Days: {{remote_work_days}}

═══════════════════════════════════════════════════
1. WORK SCHEDULE
═══════════════════════════════════════════════════
1.1 {{employee_name}} is approved to work remotely {{remote_work_days}} per week.
1.2 Core working hours remain 9:00 AM to 5:00 PM in the company's local time zone.
1.3 The Employee must be available and responsive during core hours.
1.4 Any changes to the remote schedule must be approved by {{manager_name}}.

═══════════════════════════════════════════════════
2. WORKSPACE REQUIREMENTS
═══════════════════════════════════════════════════
2.1 The Employee shall maintain a dedicated, safe, and ergonomic workspace.
2.2 Reliable internet connection (minimum 25 Mbps) is required.
2.3 The workspace must allow for confidential conversations and video meetings.

═══════════════════════════════════════════════════
3. EQUIPMENT AND EXPENSES
═══════════════════════════════════════════════════
3.1 Company-provided equipment remains property of {{company_name}}.
3.2 The Employee is responsible for the care and security of all company equipment.
3.3 Home office stipend (if applicable) will be processed per company policy.

═══════════════════════════════════════════════════
4. SECURITY AND CONFIDENTIALITY
═══════════════════════════════════════════════════
4.1 All company data must be accessed only through approved VPN and tools.
4.2 Company devices must have up-to-date security software.
4.3 Physical documents must be stored securely and shredded when no longer needed.
4.4 Public Wi-Fi must not be used for accessing company systems.

═══════════════════════════════════════════════════
5. COMMUNICATION
═══════════════════════════════════════════════════
5.1 Daily check-in with {{manager_name}} or team as required.
5.2 Camera must be on during video meetings unless otherwise agreed.
5.3 Response time to messages: within 30 minutes during core hours.

═══════════════════════════════════════════════════
6. PERFORMANCE
═══════════════════════════════════════════════════
6.1 Remote work does not change performance expectations.
6.2 Regular performance reviews will continue as scheduled.
6.3 {{company_name}} reserves the right to revoke remote work privileges if performance declines.

═══════════════════════════════════════════════════
7. TERMINATION OF AGREEMENT
═══════════════════════════════════════════════════
7.1 Either party may terminate this remote work arrangement with 14 days written notice.
7.2 {{company_name}} may revoke remote work immediately if policy violations occur.

═══════════════════════════════════════════════════
SIGNATURES
═══════════════════════════════════════════════════

Employee: {{employee_name}}
Signature: _________________________
Date: _________________________

Manager: {{manager_name}}
Signature: _________________________
Date: _________________________

HR Representative: _________________________
Date: _________________________""",
    },
]


@router.post("/seed")
async def seed_templates(
    user: dict = Depends(get_current_user),
    _=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db),
):
    count = (await db.execute(select(func.count()).select_from(DocumentTemplate))).scalar_one()
    if count > 0:
        return {"message": f"Templates already exist ({count}). Seed skipped.", "seeded": 0}

    for tpl in SEED_TEMPLATES:
        t = DocumentTemplate(
            name=tpl["name"],
            category=tpl["category"],
            description=tpl["description"],
            content=tpl["content"],
            variables=tpl["variables"],
            created_by=int(user["sub"]),
        )
        db.add(t)
    await db.commit()
    return {"message": f"Seeded {len(SEED_TEMPLATES)} templates.", "seeded": len(SEED_TEMPLATES)}


# ---------------------------------------------------------------------------
# Single template
# ---------------------------------------------------------------------------

@router.get("/{template_id}")
async def get_template(
    template_id: int,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    return _serialize(t)


# ---------------------------------------------------------------------------
# Render
# ---------------------------------------------------------------------------

@router.post("/{template_id}/render")
async def render_template(
    template_id: int,
    body: RenderRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    rendered = t.content
    for key, value in body.variables.items():
        rendered = rendered.replace("{{" + key + "}}", value)

    await log_action(
        db,
        user_id=int(user["sub"]),
        user_email=user.get("email"),
        action="template_rendered",
        resource_type="document_template",
        resource_id=str(t.id),
        details=json.dumps({
            "template_id": t.id,
            "template_name": t.name,
            "variables_used": list(body.variables.keys()),
        }),
    )

    return {"rendered_content": rendered}


# ---------------------------------------------------------------------------
# PDF generation
# ---------------------------------------------------------------------------

@router.post("/{template_id}/pdf")
async def generate_pdf(
    template_id: int,
    body: RenderRequest,
    user: dict = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    # Variable substitution
    rendered = t.content
    for key, value in body.variables.items():
        rendered = rendered.replace("{{" + key + "}}", value)

    # Build PDF
    buf = BytesIO()
    doc = SimpleDocTemplate(
        buf,
        pagesize=A4,
        leftMargin=72,
        rightMargin=72,
        topMargin=72,
        bottomMargin=72,
    )

    styles = getSampleStyleSheet()
    title_style = ParagraphStyle(
        "DocTitle",
        parent=styles["Heading1"],
        fontName="Helvetica-Bold",
        fontSize=16,
        spaceAfter=20,
    )
    body_style = ParagraphStyle(
        "DocBody",
        parent=styles["Normal"],
        fontName="Helvetica",
        fontSize=11,
        leading=15,
    )

    story: list = []
    story.append(Paragraph(t.name, title_style))
    story.append(Spacer(1, 12))

    for line in rendered.split("\n"):
        if line.strip():
            # Escape XML special characters for reportlab
            safe = (
                line.replace("&", "&amp;")
                .replace("<", "&lt;")
                .replace(">", "&gt;")
            )
            story.append(Paragraph(safe, body_style))
        else:
            story.append(Spacer(1, 12))

    doc.build(story)
    buf.seek(0)

    safe_name = re.sub(r"[^\w\s\-]", "", t.name).strip().replace(" ", "_")

    await log_action(
        db,
        user_id=int(user["sub"]),
        user_email=user.get("email"),
        action="template_pdf_generated",
        resource_type="document_template",
        resource_id=str(t.id),
        details=json.dumps({
            "template_id": t.id,
            "template_name": t.name,
            "variables_used": list(body.variables.keys()),
        }),
    )

    return StreamingResponse(
        buf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": f'attachment; filename="{safe_name}.pdf"',
        },
    )


# ---------------------------------------------------------------------------
# Duplicate
# ---------------------------------------------------------------------------

@router.post("/duplicate/{template_id}")
async def duplicate_template(
    template_id: int,
    user: dict = Depends(get_current_user),
    _=Depends(is_admin_or_hr_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")

    copy = DocumentTemplate(
        name=t.name + " (Copy)",
        category=t.category,
        description=t.description,
        content=t.content,
        variables=t.variables,
        created_by=int(user["sub"]),
    )
    db.add(copy)
    await db.commit()
    await db.refresh(copy)

    await log_action(
        db,
        user_id=int(user["sub"]),
        user_email=user.get("email"),
        action="template_duplicated",
        resource_type="document_template",
        resource_id=str(copy.id),
        details=json.dumps({
            "source_template_id": t.id,
            "new_template_id": copy.id,
            "template_name": copy.name,
        }),
    )

    return _serialize(copy)


# ---------------------------------------------------------------------------
# Create / Update / Delete
# ---------------------------------------------------------------------------

@router.post("")
async def create_template(
    body: TemplateCreate,
    user: dict = Depends(get_current_user),
    _=Depends(is_admin_or_hr_user),
    db: AsyncSession = Depends(get_db),
):
    t = DocumentTemplate(
        name=body.name,
        category=body.category,
        description=body.description,
        content=body.content,
        variables=body.variables,
        created_by=int(user["sub"]),
    )
    db.add(t)
    await db.commit()
    await db.refresh(t)

    await log_action(
        db,
        user_id=int(user["sub"]),
        user_email=user.get("email"),
        action="template_created",
        resource_type="document_template",
        resource_id=str(t.id),
        details=json.dumps({
            "template_name": t.name,
            "category": t.category,
        }),
    )

    return _serialize(t)


@router.put("/{template_id}")
async def update_template(
    template_id: int,
    body: TemplateUpdate,
    _=Depends(is_admin_or_hr_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    for k, v in body.model_dump(exclude_none=True).items():
        setattr(t, k, v)
    await db.commit()
    await db.refresh(t)
    return _serialize(t)


@router.delete("/{template_id}")
async def delete_template(
    template_id: int,
    user: dict = Depends(get_current_user),
    _=Depends(is_admin_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(DocumentTemplate).where(DocumentTemplate.id == template_id)
    )
    t = result.scalar_one_or_none()
    if not t:
        raise HTTPException(status_code=404, detail="Template not found")
    template_name = t.name
    await db.delete(t)
    await db.commit()

    await log_action(
        db,
        user_id=int(user["sub"]),
        user_email=user.get("email"),
        action="template_deleted",
        resource_type="document_template",
        resource_id=str(template_id),
        details=json.dumps({
            "template_name": template_name,
        }),
    )

    return {"message": "Template deleted"}
