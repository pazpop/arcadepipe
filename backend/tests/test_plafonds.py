"""Les plafonds anti-triche de main.py (max_kills, max_score) recopient des
règles du jeu. Si le jeu change sans eux, l'API refuse en silence des scores
légitimes : ces tests relisent les valeurs dans le frontend et comparent."""
import re
from pathlib import Path

import main

JS = Path(__file__).resolve().parents[2] / "frontend" / "js"
CONFIG = (JS / "config.js").read_text(encoding="utf-8")
ENEMIES = (JS / "enemies.js").read_text(encoding="utf-8")


def valeur(source: str, nom: str) -> int:
    trouvees = re.findall(rf"\b{nom}\s*[:=]\s*(\d+)\b", source)
    assert len(trouvees) == 1, f"{nom} : {len(trouvees)} occurrences, une attendue"
    return int(trouvees[0])


def test_max_kills_suit_l_objectif_des_vagues_et_la_taille_du_pool():
    base = valeur(CONFIG, "baseWaveKills")
    pas = valeur(CONFIG, "waveKillsStep")
    pool = valeur(ENEMIES, "POOL_SIZE")
    for vague in range(1, 30):
        attendu = sum(base + pas * (w - 1) + pool for w in range(1, vague + 1))
        assert main.max_kills(vague) == attendu, f"vague {vague}"


def test_points_par_ennemi_egaux_au_plus_gros_ennemi():
    points = [int(p) for p in re.findall(r"\bpoints:\s*(\d+)", ENEMIES)]
    assert points, "aucun `points:` trouvé dans enemies.js"
    assert main.MAX_POINTS_PER_KILL == max(points)


def test_points_par_vague_hors_ennemis():
    attendu = (
        valeur(CONFIG, "noDamageWaveBonus")
        + valeur(CONFIG, "scoringPerWave") * valeur(CONFIG, "baseScore") * valeur(CONFIG, "maxChainMultiplier")
        + valeur(CONFIG, "weakPointsMax") * valeur(CONFIG, "weakPointScore")
        + valeur(CONFIG, "victoryScore")
    )
    assert main.MAX_OTHER_POINTS_PER_WAVE == attendu
