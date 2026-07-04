"""Tests for comments.py routes."""
import pytest


def _create_analysis(db_session):
    from app.models.analysis import Analysis
    analysis = Analysis(
        original_filename="test.xlsx",
        stored_filename="abc_test.xlsx",
        file_type="xlsx",
        detected_type="ciclos",
        status="completed",
        total_rows=0,
        total_columns=0,
    )
    db_session.add(analysis)
    db_session.commit()
    db_session.refresh(analysis)
    return analysis


def test_list_comments_empty(client, viewer_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.get(
        f"/api/v1/analyses/{analysis.id}/comments",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    assert r.json() == []


def test_list_comments_not_found(client, viewer_token):
    r = client.get(
        "/api/v1/analyses/nonexistent-id/comments",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 404


def test_list_comments_unauthenticated(client, db_session):
    analysis = _create_analysis(db_session)
    r = client.get(f"/api/v1/analyses/{analysis.id}/comments")
    assert r.status_code == 401


def test_add_comment(client, analyst_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/comments",
        json={"content": "Este é um comentário de teste."},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 201
    data = r.json()
    assert data["content"] == "Este é um comentário de teste."
    assert data["username"] == "analyst_test"


def test_add_comment_empty(client, analyst_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.post(
        f"/api/v1/analyses/{analysis.id}/comments",
        json={"content": "   "},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 400


def test_add_comment_analysis_not_found(client, analyst_token):
    r = client.post(
        "/api/v1/analyses/nonexistent-id/comments",
        json={"content": "Test"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_delete_comment_own(client, viewer_token, db_session):
    from app.models.analysis import Comment
    analysis = _create_analysis(db_session)
    comment = Comment(
        analysis_id=str(analysis.id),
        username="viewer_test",
        content="Meu comentário",
    )
    db_session.add(comment)
    db_session.commit()
    db_session.refresh(comment)

    r = client.delete(
        f"/api/v1/analyses/{analysis.id}/comments/{comment.id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 204


def test_delete_comment_admin_others(client, admin_token, db_session):
    from app.models.analysis import Comment
    analysis = _create_analysis(db_session)
    comment = Comment(
        analysis_id=str(analysis.id),
        username="some_other_user",
        content="Outro comentário",
    )
    db_session.add(comment)
    db_session.commit()
    db_session.refresh(comment)

    r = client.delete(
        f"/api/v1/analyses/{analysis.id}/comments/{comment.id}",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 204


def test_delete_comment_forbidden_other_user(client, viewer_token, db_session):
    from app.models.analysis import Comment
    analysis = _create_analysis(db_session)
    comment = Comment(
        analysis_id=str(analysis.id),
        username="analyst_test",  # belongs to analyst, not viewer
        content="Comentário do analyst",
    )
    db_session.add(comment)
    db_session.commit()
    db_session.refresh(comment)

    r = client.delete(
        f"/api/v1/analyses/{analysis.id}/comments/{comment.id}",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 403


def test_delete_comment_not_found(client, analyst_token, db_session):
    analysis = _create_analysis(db_session)
    r = client.delete(
        f"/api/v1/analyses/{analysis.id}/comments/nonexistent",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 404


def test_list_comments_shows_added(client, analyst_token, db_session):
    analysis = _create_analysis(db_session)
    # Add a comment
    client.post(
        f"/api/v1/analyses/{analysis.id}/comments",
        json={"content": "Comentário visível"},
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    r = client.get(
        f"/api/v1/analyses/{analysis.id}/comments",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
    items = r.json()
    assert len(items) >= 1
    assert any(c["content"] == "Comentário visível" for c in items)
