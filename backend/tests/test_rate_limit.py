"""Test isolé du rate limiting (slowapi) sur POST /api/scores (5/minute).

Séparé de test_api.py exprès : sa fixture `client` désactive délibérément le
limiter (`limiter.enabled = False`) pour ne pas polluer ses propres tests
avec des 429 sans rapport avec ce qu'ils vérifient. Ici, au contraire,
l'objectif est justement de vérifier que la limite s'applique pour de vrai —
jusqu'ici jamais couvert, seule différence entre "implémenté" et "vérifié"
pour ce garde-fou.
"""
import pytest
from fastapi.testclient import TestClient

import database
from main import app, limiter


@pytest.fixture
def client(tmp_path, monkeypatch):
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "test_ratelimit.db"))
    # `limiter` est un singleton partagé par tout le process pytest : si
    # test_api.py (qui le désactive pour ses propres tests) tourne avant ce
    # fichier, son `limiter.enabled = False` reste sinon en place ici aussi —
    # jamais restauré automatiquement entre modules de test. On le force
    # explicitement plutôt que de dépendre de l'ordre d'exécution.
    monkeypatch.setattr(limiter, "enabled", True)
    with TestClient(app) as c:
        yield c


def _post_score(client, ip):
    # IP forgée via X-Forwarded-For (voir get_client_ip dans main.py : lit
    # toujours la DERNIÈRE IP de la chaîne) — chaque test utilise une IP
    # dédiée, jamais réutilisée ailleurs, pour ne dépendre d'aucun état
    # laissé par d'autres tests qui, eux, désactivent le limiter.
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
