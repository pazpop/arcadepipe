"""Test isolé du rate limiting (slowapi) sur POST /api/scores (5/minute).

Séparé de test_api.py, dont la fixture désactive le limiter.
"""
import pytest
from fastapi.testclient import TestClient

import database
from main import app, limiter


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "test_ratelimit.db"))
    monkeypatch.setattr(limiter, "enabled", True)
    with TestClient(app) as c:
        yield c


def _post_score(client, ip):
    # IP forgée via X-Forwarded-For (get_client_ip lit la dernière IP) : une IP
    # dédiée par test, les compteurs du limiter étant partagés.
    return client.post(
        "/api/scores",
        json={"player_name": "RATELIM", "score": 1},
        headers={"X-Forwarded-For": ip},
    )


def test_post_scores_bloque_au_dela_de_5_par_minute(client):
    ip = "203.0.113.42"
    for _ in range(5):
        assert _post_score(client, ip).status_code == 201
    r = _post_score(client, ip)
    assert r.status_code == 429


def test_post_scores_ip_differente_a_son_propre_quota(client):
    ip_a = "203.0.113.50"
    ip_b = "203.0.113.51"
    for _ in range(5):
        assert _post_score(client, ip_a).status_code == 201
    assert _post_score(client, ip_a).status_code == 429
    # Le quota épuisé de ip_a ne doit jamais affecter une IP différente.
    assert _post_score(client, ip_b).status_code == 201
