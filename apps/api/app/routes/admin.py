from __future__ import annotations

import io
import json
import shutil
import zipfile
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path
from typing import Optional

from fastapi import APIRouter, Body, Depends, HTTPException, Query
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.core.config import settings
from app.core.dependencies import require_admin
from app.core.security import get_password_hash
from app.db.database import get_db
from app.models.analysis import Analysis
from app.models.user import AccessLog, AuditLog, User

router = APIRouter()


def _audit(db: Session, username: str, action: str, entity_type: str | None = None,
           entity_id: str | None = None, meta: dict | None = None) -> None:
    user = db.query(User).filter(User.username == username).first()
    db.add(AuditLog(
        user_id=user.id if user else None,
        username=username,
        action=action,
        entity_type=entity_type,
        entity_id=entity_id,
        extra_data=json.dumps(meta) if meta else None,
    ))
    db.commit()


# ─── Schemas ──────────────────────────────────────────────────────────────────

class CreateUserBody(BaseModel):
    username: str
    password: str
    role: str = "user"


class ResetPasswordBody(BaseModel):
    password: str


# ─── User management ──────────────────────────────────────────────────────────

@router.get("/admin/users", tags=["Admin"])
async def list_users(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    users = db.query(User).order_by(User.created_at.asc()).all()
    return [
        {
            "id": u.id,
            "username": u.username,
            "role": u.role,
            "is_active": u.is_active,
            "created_at": u.created_at.isoformat() if u.created_at else None,
            "last_login": u.last_login.isoformat() if u.last_login else None,
        }
        for u in users
    ]


@router.post("/admin/users", tags=["Admin"], status_code=201)
async def create_user(
    body: CreateUserBody,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not body.username.strip():
        raise HTTPException(status_code=400, detail="Nome de usuário não pode ser vazio.")
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 6 caracteres.")
    if body.role not in ("admin", "analyst", "viewer"):
        raise HTTPException(status_code=400, detail="Perfil inválido. Use 'admin', 'analyst' ou 'viewer'.")
    if db.query(User).filter(User.username == body.username).first():
        raise HTTPException(status_code=409, detail="Usuário já existe.")
    user = User(
        username=body.username.strip(),
        password_hash=get_password_hash(body.password),
        role=body.role,
    )
    db.add(user)
    db.commit()
    db.refresh(user)
    _audit(db, current_user, "user_created", "user", user.id, {"username": user.username, "role": user.role})
    return {"id": user.id, "username": user.username, "role": user.role, "is_active": user.is_active}


@router.patch("/admin/users/{user_id}/status", tags=["Admin"])
async def toggle_user_status(
    user_id: str,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.username == current_user:
        raise HTTPException(status_code=400, detail="Não é possível desativar o próprio usuário.")
    user.is_active = not user.is_active
    db.commit()
    action = "user_activated" if user.is_active else "user_deactivated"
    _audit(db, current_user, action, "user", user_id, {"target": user.username})
    return {"id": user.id, "username": user.username, "is_active": user.is_active}


@router.patch("/admin/users/{user_id}/password", tags=["Admin"])
async def reset_user_password(
    user_id: str,
    body: ResetPasswordBody,
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if len(body.password) < 6:
        raise HTTPException(status_code=400, detail="A senha deve ter no mínimo 6 caracteres.")
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    user.password_hash = get_password_hash(body.password)
    db.commit()
    _audit(db, current_user, "password_reset", "user", user_id, {"target": user.username})
    return {"ok": True}


@router.delete("/admin/users/{user_id}", tags=["Admin"], status_code=204)
async def delete_user(
    user_id: str,
    current_user: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    user = db.query(User).filter(User.id == user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="Usuário não encontrado.")
    if user.username == current_user:
        raise HTTPException(status_code=400, detail="Não é possível deletar o próprio usuário.")
    _audit(db, current_user, "user_deleted", "user", user_id, {"target": user.username})
    db.delete(user)
    db.commit()


# ─── Access logs ──────────────────────────────────────────────────────────────

@router.get("/admin/access-logs", tags=["Admin"])
async def list_access_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    username: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AccessLog)
    if username:
        q = q.filter(AccessLog.username.ilike(f"%{username}%"))
    if action:
        q = q.filter(AccessLog.action == action)

    total = q.count()
    items = q.order_by(AccessLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [
            {
                "id": lg.id,
                "username": lg.username,
                "action": lg.action,
                "ip_address": lg.ip_address,
                "created_at": lg.created_at.isoformat() if lg.created_at else None,
            }
            for lg in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/admin/stats", tags=["Admin"])
async def get_admin_stats(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    total = db.query(Analysis).count()
    total_rows = db.query(func.sum(Analysis.total_rows)).scalar() or 0

    status_counts = db.query(Analysis.status, func.count(Analysis.id)).group_by(Analysis.status).all()
    by_status = {s: c for s, c in status_counts}

    type_counts = db.query(Analysis.detected_type, func.count(Analysis.id)).group_by(Analysis.detected_type).all()
    by_type = {t: c for t, c in type_counts}

    six_months_ago = datetime.now(timezone.utc) - timedelta(days=180)
    recent = db.query(Analysis.created_at).filter(Analysis.created_at >= six_months_ago).all()
    monthly: dict[str, int] = defaultdict(int)
    for (dt,) in recent:
        if dt:
            monthly[dt.strftime("%Y-%m")] += 1
    by_month = [{"month": k, "count": v} for k, v in sorted(monthly.items())]

    return {
        "total_analyses": total,
        "total_rows_processed": int(total_rows),
        "by_status": by_status,
        "by_type": by_type,
        "by_month": by_month,
    }


@router.get("/admin/analyses", tags=["Admin"])
async def admin_list_analyses(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    status: Optional[str] = Query(None),
    detected_type: Optional[str] = Query(None),
    data_inicio: Optional[str] = Query(None),
    data_fim: Optional[str] = Query(None),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(Analysis)
    if status:
        q = q.filter(Analysis.status == status)
    if detected_type:
        q = q.filter(Analysis.detected_type == detected_type)
    if data_inicio:
        try:
            q = q.filter(Analysis.created_at >= datetime.fromisoformat(data_inicio))
        except ValueError:
            pass
    if data_fim:
        try:
            q = q.filter(Analysis.created_at <= datetime.fromisoformat(data_fim))
        except ValueError:
            pass

    total = q.count()
    items = q.order_by(Analysis.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    # Lookup roles for all creators in one query
    usernames = {a.created_by for a in items if a.created_by}
    role_map: dict = {}
    if usernames:
        from app.models.user import User as UserModel
        role_map = {
            u.username: u.role
            for u in db.query(UserModel).filter(UserModel.username.in_(list(usernames))).all()
        }

    return {
        "items": [
            {
                "id": a.id,
                "original_filename": a.original_filename,
                "file_type": a.file_type,
                "detected_type": a.detected_type,
                "status": a.status,
                "total_rows": a.total_rows,
                "total_columns": a.total_columns,
                "description": a.description,
                "tags": a.tags or [],
                "created_by": a.created_by,
                "created_by_role": role_map.get(a.created_by) if a.created_by else None,
                "created_at": a.created_at.isoformat() if a.created_at else None,
                "completed_at": a.completed_at.isoformat() if a.completed_at else None,
                "error_message": a.error_message,
            }
            for a in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.delete("/admin/analyses/bulk", tags=["Admin"])
async def bulk_delete_analyses(
    ids: list[str] = Body(...),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    if not ids:
        raise HTTPException(status_code=400, detail="Nenhum ID fornecido.")

    analyses = db.query(Analysis).filter(Analysis.id.in_(ids)).all()
    deleted_names = [a.original_filename for a in analyses]
    for analysis in analyses:
        stored = Path(settings.upload_dir) / str(analysis.stored_filename)
        if stored.exists():
            stored.unlink()
        db.delete(analysis)

    db.commit()
    _audit(db, current_user, "bulk_analyses_deleted", "analysis", None,
           {"count": len(analyses), "filenames": deleted_names})
    return {"deleted": len(analyses)}


@router.delete("/admin/analyses/errors/cleanup", tags=["Admin"])
async def cleanup_old_errors(
    days: int = Query(30, ge=1),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Delete analyses with status 'error' older than `days` days."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=days)
    old_errors = (
        db.query(Analysis)
        .filter(Analysis.status == "error", Analysis.created_at < cutoff)
        .all()
    )
    for analysis in old_errors:
        stored = Path(settings.upload_dir) / str(analysis.stored_filename)
        if stored.exists():
            stored.unlink()
        db.delete(analysis)

    db.commit()
    return {"deleted": len(old_errors)}


@router.get("/admin/storage", tags=["Admin"])
async def get_storage_info(_: str = Depends(require_admin)):
    upload_dir = Path(settings.upload_dir)
    total_size = 0
    file_count = 0
    files: list[dict] = []

    if upload_dir.exists():
        for f in upload_dir.iterdir():
            if f.is_file():
                size = f.stat().st_size
                total_size += size
                file_count += 1
                files.append({"name": f.name, "size_bytes": size})

    files.sort(key=lambda x: x["size_bytes"], reverse=True)

    try:
        disk = shutil.disk_usage(str(upload_dir) if upload_dir.exists() else ".")
        available_bytes = disk.free
        total_disk_bytes = disk.total
    except Exception:
        available_bytes = 0
        total_disk_bytes = 0

    return {
        "used_bytes": total_size,
        "file_count": file_count,
        "available_bytes": available_bytes,
        "total_disk_bytes": total_disk_bytes,
        "top_files": files[:10],
    }


@router.get("/admin/system", tags=["Admin"])
async def get_system_info(_: str = Depends(require_admin), db: Session = Depends(get_db)):
    db_ok = False
    try:
        db.execute(__import__("sqlalchemy").text("SELECT 1"))
        db_ok = True
    except Exception:
        pass

    ai_available = bool(settings.openai_api_key and settings.ai_provider == "openai")

    return {
        "environment": settings.environment,
        "ai_provider": settings.ai_provider,
        "ai_available": ai_available,
        "database_url": _mask_db_url(settings.database_url),
        "database_ok": db_ok,
        "max_upload_size_mb": settings.max_upload_size_mb,
        "upload_dir": settings.upload_dir,
    }


@router.get("/admin/audit-logs", tags=["Admin"])
async def list_audit_logs(
    page: int = Query(1, ge=1),
    per_page: int = Query(20, ge=1, le=100),
    username: Optional[str] = Query(None),
    action: Optional[str] = Query(None),
    entity_type: Optional[str] = Query(None),
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    q = db.query(AuditLog)
    if username:
        q = q.filter(AuditLog.username.ilike(f"%{username}%"))
    if action:
        q = q.filter(AuditLog.action.ilike(f"%{action}%"))
    if entity_type:
        q = q.filter(AuditLog.entity_type == entity_type)

    total = q.count()
    items = q.order_by(AuditLog.created_at.desc()).offset((page - 1) * per_page).limit(per_page).all()

    return {
        "items": [
            {
                "id": lg.id,
                "username": lg.username,
                "action": lg.action,
                "entity_type": lg.entity_type,
                "entity_id": lg.entity_id,
                "extra_data": lg.extra_data,
                "created_at": lg.created_at.isoformat() if lg.created_at else None,
            }
            for lg in items
        ],
        "total": total,
        "page": page,
        "per_page": per_page,
    }


@router.get("/admin/analyses/export/zip", tags=["Admin"])
async def bulk_export_zip(
    _: str = Depends(require_admin),
    db: Session = Depends(get_db),
):
    """Cria um ZIP com todos os arquivos enviados e retorna para download."""
    upload_dir = Path(settings.upload_dir)
    analyses = db.query(Analysis).filter(Analysis.status == "completed").all()

    buf = io.BytesIO()
    with zipfile.ZipFile(buf, "w", zipfile.ZIP_DEFLATED) as zf:
        for a in analyses:
            path = upload_dir / str(a.stored_filename)
            if path.exists():
                arcname = f"{a.created_at.strftime('%Y%m') if a.created_at else 'nodate'}/{a.original_filename}"
                zf.write(path, arcname)
    buf.seek(0)

    ts = datetime.now(timezone.utc).strftime("%Y%m%d_%H%M%S")
    return StreamingResponse(
        buf,
        media_type="application/zip",
        headers={"Content-Disposition": f'attachment; filename="anac_analyses_{ts}.zip"'},
    )


def _mask_db_url(url: str) -> str:
    if "://" not in url:
        return url
    scheme, rest = url.split("://", 1)
    if "@" in rest:
        _, host_path = rest.rsplit("@", 1)
        return f"{scheme}://***:***@{host_path}"
    return url
