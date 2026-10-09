"""
Jeu de données de départ pour ArcadePipe : peuple la table 'scores' si elle
est vide (relancer le script ne crée pas de doublons).

Usage: python seed.py
"""
import database

# Scores volontairement bas : faciles à dépasser dès les premières parties.
# Pseudos au format du jeu (1 à 8 lettres majuscules, chiffres ou espaces).
# PATRIOTE / MAD JACK / NUKEPUNK : clin d'œil à des amis.
SEED_SCORES = [
    ("ALEX", 220),
    ("MAD JACK", 180),
    ("CENTAURI", 150),
    ("NUKEPUNK", 130),
    ("GRIG", 100),
    ("PATRIOTE", 90),
    ("MAGGIE", 60),
    ("KO DAN", 30),
]

if __name__ == "__main__":
    database.init_db()
    if database.get_top_scores(1):
        print(f"{database.DB_PATH} contient déjà des scores : rien à faire")
    else:
        for player_name, score in SEED_SCORES:
            database.insert_score(player_name, score)
        print(f"{len(SEED_SCORES)} scores insérés dans {database.DB_PATH}")
