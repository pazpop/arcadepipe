"""Tests pour la validation Pydantic (ScoreIn) et get_client_ip() de main.py.

Ciblés sur la logique pure : pas de TestClient/base de données, ces deux
éléments sont testables directement sans dépendance externe."""
from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from main import ScoreIn, get_client_ip


def test_score_in_accepte_une_entree_valide():
    score = ScoreIn(player_name="S2FIX", score=1500, wave=3)
    assert score.player_name == "S2FIX"
    assert score.score == 1500
    assert score.wave == 3


def test_score_in_wave_par_defaut_a_1():
    score = ScoreIn(player_name="S2FIX", score=100)
    assert score.wave == 1


def test_score_in_kills_par_defaut_a_0():
    score = ScoreIn(player_name="S2FIX", score=100)
    assert score.kills == 0


def test_score_in_rejette_un_nombre_de_kills_negatif():
    with pytest.raises(ValidationError):
        ScoreIn(player_name="S2FIX", score=100, kills=-1)


@pytest.mark.parametrize("nom", ["", "   ", "\t\n"])
def test_score_in_rejette_un_nom_vide_ou_blanc(nom):
    """Field() ne vérifie que la longueur brute : "   " passerait sans le
    field_validator dédié (voir son commentaire dans main.py)."""
    with pytest.raises(ValidationError):
        ScoreIn(player_name=nom, score=100)


def test_score_in_nettoie_les_espaces_autour_du_nom():
    score = ScoreIn(player_name="  S2FIX  ", score=100)
    assert score.player_name == "S2FIX"


def test_score_in_rejette_un_nom_trop_long():
    with pytest.raises(ValidationError):
        ScoreIn(player_name="x" * 21, score=100)


@pytest.mark.parametrize("score_invalide", [-1, 1_000_000])
def test_score_in_rejette_un_score_hors_bornes(score_invalide):
    with pytest.raises(ValidationError):
        ScoreIn(player_name="S2FIX", score=score_invalide)


@pytest.mark.parametrize("wave_invalide", [0, 10_000])
def test_score_in_rejette_une_vague_hors_bornes(wave_invalide):
    with pytest.raises(ValidationError):
        ScoreIn(player_name="S2FIX", score=100, wave=wave_invalide)


def _requete_factice(x_forwarded_for: str | None) -> Mock:
    requete = Mock()
    requete.headers = {"x-forwarded-for": x_forwarded_for} if x_forwarded_for else {}
    return requete


def test_get_client_ip_lit_la_derniere_ip_de_la_chaine():
    """Invariant documenté dans main.py (get_client_ip) : peu importe le
    mécanisme exact du reverse-proxy devant l'API, la vraie IP observée est
    TOUJOURS en dernière position d'X-Forwarded-For, jamais en première.
      - Traefik (instance publique) : écrase la valeur entrante par la sienne.
      - Caddy (déploiement autonome) : AJOUTE la sienne à la fin sans toucher
        à une valeur déjà présente — donc "1.2.3.4" ici pourrait être une IP
        forgée par le client lui-même, "203.0.113.7" est systématiquement
        celle du dernier hop de confiance.
    Ce test protège contre une régression silencieuse si [-1] devient un jour
    [0] dans get_client_ip — c'est la vraie valeur de ce test, pas l'absence
    d'un bug déjà présent (vérifié empiriquement sur les deux topologies)."""
    requete = _requete_factice("1.2.3.4, 203.0.113.7")
    assert get_client_ip(requete) == "203.0.113.7"


def test_get_client_ip_ignore_une_seule_ip_forgee_sans_proxy():
    """Sans X-Forwarded-For du tout (ex: appel direct, hors Traefik), on ne
    doit jamais faire confiance à un en-tête auto-déclaré par le client."""
    requete = _requete_factice(None)
    requete.client = Mock(host="198.51.100.9")
    assert get_client_ip(requete) == "198.51.100.9"
