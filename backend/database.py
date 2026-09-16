"""
Gestion de la base de données SQLite pour ArcadePipe.

On utilise le module sqlite3 natif de Python (pas d'ORM) exprès :
l'objectif est de VOIR ce qui se passe (le fichier .db, les requêtes SQL brutes),
pas de le cacher derrière une couche d'abstraction.
"""
import os
import sqlite3
from contextlib import contextmanager

# Où vit le fichier de la base. En local: ./arcadepipe.db
# En Docker: on pointera ça vers un volume monté (/data/arcadepipe.db)
DB_PATH = os.environ.get("DB_PATH", "./arcadepipe.db")


def init_db():
    """Crée la table 'scores' si elle n'existe pas déjà."""
    with get_connection() as conn:
        # WAL plutôt que le mode par défaut : les lectures (leaderboard) ne
        # bloquent plus derrière une écriture (nouveau score) en cours.
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
        # Migration pour une DB existante créée avant l'ajout de "kills" :
        # CREATE TABLE IF NOT EXISTS ne touche pas une table déjà là, et
        # SQLite n'a pas de "ADD COLUMN IF NOT EXISTS" — on vérifie donc
        # nous-mêmes avant d'ajouter la colonne.
        cols = {row["name"] for row in conn.execute("PRAGMA table_info(scores)").fetchall()}
        if "kills" not in cols:
            conn.execute("ALTER TABLE scores ADD COLUMN kills INTEGER NOT NULL DEFAULT 0")
        conn.execute(
            "CREATE INDEX IF NOT EXISTS idx_scores_score ON scores(score DESC)"
        )
        # Une ligne par partie terminée, peu importe si le score final
        # qualifie pour le top (voir record_game_played) — sert uniquement
        # au total affiché dans le classement ("N parties jouées"),
        # séparé de 'scores' qui ne contient que les scores qualifiants.
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
    try:
        yield conn
    finally:
        conn.close()


def insert_score(player_name: str, score: int, wave: int = 1, kills: int = 0) -> dict:
    with get_connection() as conn:
        cursor = conn.execute(
            "INSERT INTO scores (player_name, score, wave, kills) VALUES (?, ?, ?, ?)",
            (player_name, score, wave, kills),
        )
        conn.commit()
        new_id = cursor.lastrowid
        row = conn.execute(
            "SELECT id, player_name, score, wave, kills, created_at FROM scores WHERE id = ?",
            (new_id,),
        ).fetchone()
        return dict(row)


def get_top_scores(limit: int = 10) -> list[dict]:
    with get_connection() as conn:
        rows = conn.execute(
            "SELECT id, player_name, score, wave, kills, created_at FROM scores "
            "ORDER BY score DESC LIMIT ?",
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
