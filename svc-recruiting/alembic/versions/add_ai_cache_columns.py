"""add AI cache JSONB columns

Revision ID: add_ai_cache_001
"""
from alembic import op
import sqlalchemy as sa
from sqlalchemy.dialects.postgresql import JSONB

revision = 'add_ai_cache_001'
down_revision = None  # Set to the latest revision if chaining migrations
branch_labels = None
depends_on = None


def upgrade():
    op.add_column('job_descriptions', sa.Column('ai_generated_jd', JSONB, nullable=True))
    op.add_column('job_descriptions', sa.Column('ai_bias_check', JSONB, nullable=True))
    op.add_column('job_descriptions', sa.Column('ai_salary_estimate', JSONB, nullable=True))
    op.add_column('candidate_job_entries', sa.Column('ai_fit_summary', JSONB, nullable=True))
    op.add_column('candidate_job_entries', sa.Column('ai_ranking_score', JSONB, nullable=True))
    op.add_column('candidate_job_entries', sa.Column('ai_skills_gap', JSONB, nullable=True))
    op.add_column('interview_schedules', sa.Column('ai_suggested_questions', JSONB, nullable=True))


def downgrade():
    op.drop_column('interview_schedules', 'ai_suggested_questions')
    op.drop_column('candidate_job_entries', 'ai_skills_gap')
    op.drop_column('candidate_job_entries', 'ai_ranking_score')
    op.drop_column('candidate_job_entries', 'ai_fit_summary')
    op.drop_column('job_descriptions', 'ai_salary_estimate')
    op.drop_column('job_descriptions', 'ai_bias_check')
    op.drop_column('job_descriptions', 'ai_generated_jd')
