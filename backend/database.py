"""
Gestion de la base de données SQLite pour ArcadePipe.

On utilise le module sqlite3 natif de Python (pas d'ORM) exprès :
l'objectif est de VOIR ce qui se passe (le fichier .db, les requêtes SQL brutes),
pas de le cacher derrière une couche d'abstraction.
"""
import os
import sqlite3
from contextlib import contextmanager

# Où vit le fichier de la base. En local : ./arcadepipe.db ; en Docker : sur
# un volume monté (/data/arcadepipe.db, voir Dockerfile).
DB_PATH = os.environ.get("DB_PATH", "./arcadepipe.db")

# Maximum de scores renvoyés par GET /api/scores.
MAX_SCORES = 100

# Nombre de scores gardés en base : les meilleurs seulement, sinon la table
# grossirait sans fin. Bien plus que MAX_SCORES : si de faux scores inondent
# le classement, les vrais restent en base et reviennent une fois les faux supprimés.
MAX_STORED_SCORES = 10_000


def init_db():
    """Crée les tables et l'index s'ils n'existent pas déjà."""
    with get_connection() as conn:
        # WAL plutôt que le mode par défaut : les lectures (leaderboard) ne
        # bloquent pas derrière une écriture (nouveau score) en cours.
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("""
            CREATE TABLE IF NOT EXISTS scores (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                player_name TEXT NOT NULL,
                score INTEGER NOT NULL,
                wave INTEGER NOT NULL DEFAULT 1,
                kills INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC)"
        )
        # Une ligne par partie terminée, quel que soit son score : sert
        # uniquement au total affiché dans le classement ("N parties jouées").
        conn.execute("""
            CREATE TABLE IF NOT EXISTS games (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                created_at TEXT NOT NULL DEFAULT (datetime('now'))
            )
        """)
        conn.commit()


@contextmanager
def get_connection():
    """Ouvre une connexion SQLite et la ferme proprement après usage."""
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row  # pour récupérer des résultats type dict
    # Deux écritures simultanées (deux scores soumis au même instant) : la
    # seconde attend jusqu'à 5 s que le verrou se libère, au lieu d'échouer
    # aussitôt avec "database is locked".
    conn.execute("PRAGMA busy_timeout = 5000")
    try:
        yield conn
    finally:
        conn.close()


def insert_score(player_name: str, score: int, wave: int = 1, kills: int = 0) -> dict:
    with get_connection() as conn:
        row = conn.execute(
            "INSERT INTO scores (player_name, score, wave, kills) VALUES (?, ?, ?, ?) "
            "RETURNING player_name, score, wave, kills",
            (player_name, score, wave, kills),
        ).fetchone()
        # Ne garde que les MAX_STORED_SCORES meilleurs (le nouveau score compris, s'il en fait partie).
        conn.execute(
            "DELETE FROM scores WHERE id NOT IN "
            "(SELECT id FROM scores ORDER BY score DESC, id LIMIT ?)",
            (MAX_STORED_SCORES,),
        )
        conn.commit()
        return dict(row)


def get_top_scores(limit: int) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT player_name, score, wave, kills FROM scores "
            "ORDER BY score DESC, id LIMIT ?",  # à égalité : le premier arrivé reste devant
            (limit,),
        ).fetchall()
        return [dict(row) for row in rows]


def record_game_played() -> None:
    with get_connection() as conn:
        conn.execute("INSERT INTO games DEFAULT VALUES")
        conn.commit()


def count_games_played() -> int:
    with get_connection() as conn:
        row = conn.execute("SELECT COUNT(*) AS n FROM games").fetchone()
        return row["n"]
