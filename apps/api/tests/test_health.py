"""Tests for health.py routes."""


def test_health_check(client):
    r = client.get("/health")
    assert r.status_code == 200
    data = r.json()
    assert data["status"] in ("ok", "degraded")
    assert data["service"] == "ANAC Data Insight API"
    assert "checks" in data
    assert "timestamp" in data


def test_health_check_has_version(client):
    r = client.get("/health")
    assert r.status_code == 200
    assert "version" in r.json()


def test_health_check_database_key(client):
    r = client.get("/health")
    assert r.status_code == 200
    checks = r.json()["checks"]
    assert "database" in checks


def test_health_check_filesystem_key(client):
    r = client.get("/health")
    assert r.status_code == 200
    checks = r.json()["checks"]
    assert "filesystem" in checks
