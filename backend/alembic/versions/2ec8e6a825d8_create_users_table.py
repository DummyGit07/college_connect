"""create users table

Revision ID: 2ec8e6a825d8
Revises: 
Create Date: 2026-11-23 14:35:19.671247

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


# revision identifiers, used by Alembic.
revision: str = '2ec8e6a825d8'
down_revision: Union[str, Sequence[str], None] = None
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    """Upgrade schema."""
    op.create_table('users',
        sa.Column('id', sa.Integer(), nullable=False),
        sa.Column('email', sa.String(), nullable=False),
        sa.Column('hashed_password', sa.String(), nullable=False),
        sa.Column('student_id', sa.String(), nullable=True),
        sa.Column('college_name', sa.String(), nullable=True),
        sa.Column('full_name', sa.String(), nullable=True),
        sa.Column('user_id', sa.String(), nullable=True),
        sa.Column('campus', sa.String(), nullable=True),
        sa.Column('course', sa.String(), nullable=True),
        sa.Column('branch', sa.String(), nullable=True),
        sa.Column('batch', sa.String(), nullable=True),
        sa.Column('avatar_url', sa.String(), nullable=True),
        sa.Column('bio', sa.String(), nullable=True),
        sa.Column('role', sa.String(), nullable=True, server_default='student'),
        sa.Column('is_active', sa.Boolean(), nullable=True, server_default=sa.text('1')),
        sa.Column('is_verified', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('is_onboarded', sa.Boolean(), nullable=True, server_default=sa.text('0')),
        sa.Column('created_at', sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=True),
        sa.PrimaryKeyConstraint('id')
    )
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.create_index(batch_op.f('ix_users_id'), ['id'], unique=False)
        batch_op.create_index(batch_op.f('ix_users_email'), ['email'], unique=True)
        batch_op.create_index(batch_op.f('ix_users_user_id'), ['user_id'], unique=True)
        batch_op.create_index(batch_op.f('ix_users_student_id'), ['student_id'], unique=False)
        batch_op.create_index(batch_op.f('ix_users_campus'), ['campus'], unique=False)


def downgrade() -> None:
    """Downgrade schema."""
    with op.batch_alter_table('users', schema=None) as batch_op:
        batch_op.drop_index(batch_op.f('ix_users_campus'))
        batch_op.drop_index(batch_op.f('ix_users_student_id'))
        batch_op.drop_index(batch_op.f('ix_users_user_id'))
        batch_op.drop_index(batch_op.f('ix_users_email'))
        batch_op.drop_index(batch_op.f('ix_users_id'))

    op.drop_table('users')
