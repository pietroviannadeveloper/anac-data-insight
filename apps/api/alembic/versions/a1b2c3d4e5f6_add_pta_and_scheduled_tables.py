"""add pta and scheduled tables

Tracks tables that were created via create_all() but not yet in the Alembic history.
On fresh PostgreSQL databases these tables are created by create_all() and this
migration is stamped (not run). On existing properly-migrated databases this
migration applies the missing tables.

Revision ID: a1b2c3d4e5f6
Revises: 9ec62e95f1fa
Create Date: 2026-06-08 00:00:00.000000

"""
from typing import Sequence, Union

from alembic import op
import sqlalchemy as sa


revision: str = 'a1b2c3d4e5f6'
down_revision: Union[str, None] = '9ec62e95f1fa'
branch_labels: Union[str, Sequence[str], None] = None
depends_on: Union[str, Sequence[str], None] = None


def upgrade() -> None:
    op.create_table(
        'pta_snapshots',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('tipo_ciclo', sa.String(), nullable=False),
        sa.Column('source_file', sa.String(), nullable=True),
        sa.Column('indicators', sa.JSON(), nullable=True),
        sa.Column('total_rows', sa.Integer(), nullable=True),
        sa.Column('is_seed', sa.Integer(), nullable=True),
        sa.Column('loaded_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'pta_mensal_uploads',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('tipo', sa.String(), nullable=False),
        sa.Column('year', sa.Integer(), nullable=False),
        sa.Column('filename', sa.String(), nullable=True),
        sa.Column('stored_filename', sa.String(), nullable=True),
        sa.Column('total_rows', sa.Integer(), nullable=True),
        sa.Column('indicators', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'pta_mensal_activities',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('upload_id', sa.String(), nullable=False),
        sa.Column('item', sa.String(), nullable=True),
        sa.Column('atividade', sa.String(), nullable=True),
        sa.Column('gerencia', sa.String(), nullable=True),
        sa.Column('setor', sa.String(), nullable=True),
        sa.Column('regulado', sa.String(), nullable=True),
        sa.Column('cidade', sa.String(), nullable=True),
        sa.Column('servidor', sa.String(), nullable=True),
        sa.Column('mes', sa.String(), nullable=True),
        sa.Column('mes_agendado', sa.String(), nullable=True),
        sa.Column('mes_realizado', sa.String(), nullable=True),
        sa.Column('mes_num', sa.Integer(), nullable=True),
        sa.Column('mes_original_num', sa.Integer(), nullable=True),
        sa.Column('giaso', sa.String(), nullable=True),
        sa.Column('processo', sa.String(), nullable=True),
        sa.Column('pcdp', sa.String(), nullable=True),
        sa.Column('pcdp_tipo', sa.String(), nullable=True),
        sa.Column('prioridade', sa.String(), nullable=True),
        sa.Column('status', sa.String(), nullable=True),
        sa.Column('remanejado', sa.Integer(), nullable=True),
        sa.Column('sem_giaso', sa.Integer(), nullable=True),
        sa.Column('sem_pcdp_valida', sa.Integer(), nullable=True),
        sa.Column('sem_pcdp', sa.Integer(), nullable=True),
        sa.Column('sem_processo', sa.Integer(), nullable=True),
        sa.Column('local_indefinido', sa.Integer(), nullable=True),
        sa.Column('tipo_ciclo', sa.String(), nullable=True),
        sa.ForeignKeyConstraint(['upload_id'], ['pta_mensal_uploads.id']),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'pta_planejamentos',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=True),
        sa.Column('ano_referencia', sa.Integer(), nullable=False),
        sa.Column('tipos_carregados', sa.JSON(), nullable=True),
        sa.Column('resultado', sa.JSON(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )
    op.create_table(
        'scheduled_reports',
        sa.Column('id', sa.String(), nullable=False),
        sa.Column('label', sa.String(), nullable=False),
        sa.Column('cron_expression', sa.String(), nullable=False),
        sa.Column('gerencia_filter', sa.String(), nullable=True),
        sa.Column('recipient_emails', sa.JSON(), nullable=True),
        sa.Column('enabled', sa.Integer(), nullable=True),
        sa.Column('created_by', sa.String(), nullable=True),
        sa.Column('created_at', sa.DateTime(), nullable=True),
        sa.Column('last_run', sa.DateTime(), nullable=True),
        sa.PrimaryKeyConstraint('id'),
    )


def downgrade() -> None:
    op.drop_table('scheduled_reports')
    op.drop_table('pta_planejamentos')
    op.drop_table('pta_mensal_activities')
    op.drop_table('pta_mensal_uploads')
    op.drop_table('pta_snapshots')
