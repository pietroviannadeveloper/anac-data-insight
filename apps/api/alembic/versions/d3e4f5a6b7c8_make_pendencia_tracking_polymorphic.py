"""make pendencia_tracking polymorphic (source_type + source_id)

Revision ID: d3e4f5a6b7c8
Revises: c2d3e4f5a6b7
Create Date: 2026-06-23 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'd3e4f5a6b7c8'
down_revision: Union[str, None] = 'c2d3e4f5a6b7'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.drop_constraint('pendencia_tracking_ciclo_activity_id_fkey', 'pendencia_tracking', type_='foreignkey')
    op.drop_constraint('pendencia_tracking_ciclo_activity_id_key', 'pendencia_tracking', type_='unique')

    with op.batch_alter_table('pendencia_tracking', schema=None) as batch_op:
        batch_op.alter_column('ciclo_activity_id', new_column_name='source_id')
        batch_op.add_column(sa.Column('source_type', sa.String(), nullable=False, server_default='ciclo'))
        batch_op.create_unique_constraint('pendencia_tracking_source_id_key', ['source_id'])


def downgrade() -> None:
    op.drop_constraint('pendencia_tracking_source_id_key', 'pendencia_tracking', type_='unique')
    with op.batch_alter_table('pendencia_tracking', schema=None) as batch_op:
        batch_op.drop_column('source_type')
        batch_op.alter_column('source_id', new_column_name='ciclo_activity_id')
    op.create_foreign_key(
        'pendencia_tracking_ciclo_activity_id_fkey', 'pendencia_tracking', 'ciclo_activities',
        ['ciclo_activity_id'], ['id'],
    )
    op.create_unique_constraint('pendencia_tracking_ciclo_activity_id_key', 'pendencia_tracking', ['ciclo_activity_id'])
