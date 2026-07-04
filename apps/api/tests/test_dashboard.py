"""Tests for dashboard.py routes."""


def test_dashboard_summary_authenticated(client, viewer_token):
    r = client.get(
        "/api/v1/dashboard/summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    # Key fields present
    assert "total_analyses" in data
    assert "total_activities" in data
    assert "activities_by_status" in data


def test_dashboard_summary_unauthenticated(client):
    r = client.get("/api/v1/dashboard/summary")
    assert r.status_code == 401


def test_dashboard_summary_with_analysis_id(client, admin_token):
    r = client.get(
        "/api/v1/dashboard/summary?analysis_id=all",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


def test_dashboard_summary_with_date_filters(client, admin_token):
    r = client.get(
        "/api/v1/dashboard/summary?date_from=2026-01-01&date_to=2026-12-31",
        headers={"Authorization": f"Bearer {admin_token}"},
    )
    assert r.status_code == 200


def test_dashboard_summary_has_expected_structure(client, viewer_token):
    """Summary should always return valid structure."""
    r = client.get(
        "/api/v1/dashboard/summary",
        headers={"Authorization": f"Bearer {viewer_token}"},
    )
    assert r.status_code == 200
    data = r.json()
    assert "total_activities" in data
    assert "realizadas" in data
    assert isinstance(data["activities_by_status"], list)


def test_dashboard_summary_analyst(client, analyst_token):
    r = client.get(
        "/api/v1/dashboard/summary",
        headers={"Authorization": f"Bearer {analyst_token}"},
    )
    assert r.status_code == 200
