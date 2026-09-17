"""Tests d'intégration HTTP (TestClient) pour les routes de main.py.

Contrairement à test_main.py (logique pure : ScoreIn, get_client_ip), ces
tests exercent les vraies routes FastAPI, avec une base SQLite temporaire
par test (fixture tmp_path) — jamais la vraie DB de dev."""
import pytest
from fastapi.testclient import TestClient

import database
from main import app, limiter


@pytest.fixture
def client(tmp_path, monkeypatch):
    # database.DB_PATH est lu une seule fois à l'import du module : changer
    # la variable d'environnement ne suffit pas une fois le module déjà
    # chargé, il faut patcher l'attribut directement.
    monkeypatch.setattr(database, "DB_PATH", str(tmp_path / "test.db"))
    # Rate limiting désactivé pour ces tests : le limiter (slowapi) garde son
    # compteur en mémoire pour tout le process pytest, pas par test — le
    # désactiver évite qu'une suite qui grandit un jour ne se mette à
    # dépasser les seuils (5/minute sur /api/scores) sans rapport avec ce
    # qui est réellement testé ici.
    limiter.enabled = False
    with TestClient(app) as c:
        yield c


def test_health(client):
    r = client.get("/api/health")
    assert r.status_code == 200
    assert r.json() == {"status": "ok"}


def test_scores_vide_au_depart(client):
    r = client.get("/api/scores")
    assert r.status_code == 200
    assert r.json() == []


def test_soumettre_et_relire_un_score(client):
    r = client.post("/api/scores", json={"player_name": "TEST", "score": 500, "wave": 3, "kills": 12})
    assert r.status_code == 201
    body = r.json()
    assert body["player_name"] == "TEST"
    assert body["score"] == 500
    assert body["wave"] == 3
    assert body["kills"] == 12

    r2 = client.get("/api/scores")
    assert len(r2.json()) == 1
    assert r2.json()[0]["kills"] == 12


def test_kills_par_defaut_a_0_si_absent(client):
    r = client.post("/api/scores", json={"player_name": "SANSKILLS", "score": 100})
    assert r.json()["kills"] == 0


def test_scores_tries_par_score_decroissant(client):
    client.post("/api/scores", json={"player_name": "A", "score": 100})
    client.post("/api/scores", json={"player_name": "B", "score": 900})
    r = client.get("/api/scores")
    scores = [s["score"] for s in r.json()]
    assert scores == [900, 100]


def test_score_avec_nom_vide_rejete(client):
    r = client.post("/api/scores", json={"player_name": "   ", "score": 100})
    assert r.status_code == 422


def test_score_hors_bornes_rejete(client):
    r = client.post("/api/scores", json={"player_name": "TEST", "score": 1_000_000})
    assert r.status_code == 422


def test_games_count_demarre_a_zero(client):
    r = client.get("/api/games/count")
    assert r.status_code == 200
    assert r.json() == {"count": 0}


def test_record_game_incremente_le_compteur(client):
    assert client.post("/api/games").status_code == 201
    assert client.post("/api/games").status_code == 201
    r = client.get("/api/games/count")
    assert r.json() == {"count": 2}


def test_games_et_scores_sont_independants(client):
    # Un score qualifiant ne devrait jamais être la seule façon de
    # comptabiliser une partie jouée (voir POST /api/games côté frontend,
    # appelé à chaque game over peu importe la qualification).
    client.post("/api/games")
    client.post("/api/scores", json={"player_name": "TEST", "score": 1})
    assert client.get("/api/games/count").json() == {"count": 1}
    assert len(client.get("/api/scores").json()) == 1
