"""Tests pour la validation Pydantic (ScoreIn) et get_client_ip() de main.py.

Ciblés sur la logique pure : pas de TestClient/base de données, ces deux
éléments sont testables directement sans dépendance externe."""
from unittest.mock import Mock

import pytest
from pydantic import ValidationError

from main import ScoreIn, get_client_ip
from seed import SEED_SCORES


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
    with pytest.raises(ValidationError):
        ScoreIn(player_name=nom, score=100)


@pytest.mark.parametrize("nom", ["alice", "ÉLODIE", "A.B", "A\u200bB", "<B>", "A\nB"])
def test_score_in_rejette_les_caracteres_que_le_jeu_ne_saisit_pas(nom):
    with pytest.raises(ValidationError):
        ScoreIn(player_name=nom, score=100)


def test_score_in_nettoie_les_espaces_autour_du_nom():
    score = ScoreIn(player_name="  S2FIX  ", score=100)
    assert score.player_name == "S2FIX"


def test_score_in_rejette_un_nom_trop_long():
    with pytest.raises(ValidationError):
        ScoreIn(player_name="A" * 9, score=100)


@pytest.mark.parametrize("score_invalide", [-1, 1_000_000])
def test_score_in_rejette_un_score_hors_bornes(score_invalide):
    with pytest.raises(ValidationError):
        ScoreIn(player_name="S2FIX", score=score_invalide)


@pytest.mark.parametrize("wave_invalide", [0, 10_000])
def test_score_in_rejette_une_vague_hors_bornes(wave_invalide):
    with pytest.raises(ValidationError):
        ScoreIn(player_name="S2FIX", score=100, wave=wave_invalide)


def test_les_scores_de_depart_respectent_les_regles_de_l_api():
    for player_name, score in SEED_SCORES:
        assert ScoreIn(player_name=player_name, score=score).player_name == player_name


def _requete_factice(x_forwarded_for: str | None) -> Mock:
    requete = Mock()
    requete.headers = {"x-forwarded-for": x_forwarded_for} if x_forwarded_for else {}
    return requete


def test_get_client_ip_lit_la_derniere_ip_de_la_chaine():
    """La dernière IP est celle posée par le reverse-proxy de confiance ; les
    précédentes ("1.2.3.4" ici) peuvent avoir été forgées par le client."""
    requete = _requete_factice("1.2.3.4, 203.0.113.7")
    assert get_client_ip(requete) == "203.0.113.7"


def test_get_client_ip_sans_en_tete_utilise_l_ip_de_connexion():
    requete = _requete_factice(None)
    requete.client = Mock(host="198.51.100.9")
    assert get_client_ip(requete) == "198.51.100.9"
