"""
Jeu de données de départ pour ArcadePipe.
Lance ce script une fois pour peupler la table 'scores'.

Usage: python seed.py
"""
import database

# Scores volontairement bas : faciles à dépasser dès les premières parties.
# Patriote.QC / Mad Jack / NukePunk : easter egg, clin d'œil à des amis.
SEED_SCORES = [
    ("Alex Rogan", 220),
    ("Mad Jack", 180),
    ("Centauri", 150),
    ("NukePunk", 130),
    ("Grig", 100),
    ("Patriote.QC", 90),
    ("Maggie", 60),
    ("Ko Dan", 30),
]

if __name__ == "__main__":
    database.init_db()
    for player_name, score in SEED_SCORES:
        database.insert_score(player_name, score)
    print(f"{len(SEED_SCORES)} scores insérés dans {database.DB_PATH}")
