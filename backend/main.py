"""
ArcadePipe — API backend

Endpoints:
  GET  /api/health         -> vérifie que l'API tourne
  GET  /api/scores         -> top scores (leaderboard)
  POST /api/scores         -> enregistre un nouveau score
  GET  /api/games/count    -> nombre total de parties jouées
  POST /api/games          -> enregistre qu'une partie vient de se terminer
"""
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, StringConstraints
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import database


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield


# Pas de documentation interactive : seules les routes /api/* sont exposées.
app = FastAPI(lifespan=lifespan, docs_url=None, redoc_url=None, openapi_url=None)

# Origines autorisées à appeler l'API depuis un navigateur, configurables
# sans reconstruire l'image (ALLOWED_ORIGINS="https://arcadepipe.example.com,https://autre.example.com").
# Par défaut : uniquement le frontend en dev local — jamais "*" par défaut.
_allowed_origins = os.environ.get("ALLOWED_ORIGINS", "http://localhost:5500")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in _allowed_origins.split(",")],
    allow_methods=["GET", "POST"],
    allow_headers=["Content-Type"],
)


def get_client_ip(request: Request) -> str:
    # On lit la DERNIÈRE IP de X-Forwarded-For : c'est celle que le reverse-proxy
    # de confiance (Traefik en prod, Caddy en autonome) a ajoutée ou imposée,
    # jamais une valeur envoyée par le client. Sans proxy devant (accès direct
    # au port 8000), cette fonction n'est pas fiable — déploiement non supporté.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class ScoreIn(BaseModel):
    # Mêmes règles que la saisie du jeu (setNameEntryText, states/endOfRun.js) :
    # 1 à 8 lettres majuscules, chiffres ou espaces, espaces autour retirés.
    # Un appel direct à l'API ne peut pas afficher autre chose au classement.
    player_name: Annotated[str, StringConstraints(strip_whitespace=True, pattern=r"^[A-Z0-9 ]{1,8}$")]
    # Borne haute large mais réaliste : filtre les valeurs absurdes envoyées
    # à la main sans prétendre empêcher la triche (le score vient du client,
    # rien ne le garantit authentique — voir docs/securite.md).
    score: int = Field(ge=0, le=999_999)
    wave: int = Field(default=1, ge=1, le=9_999)
    kills: int = Field(default=0, ge=0, le=999_999)


class ScoreOut(BaseModel):
    id: int
    player_name: str
    score: int
    wave: int
    kills: int
    created_at: str


class GamesCountOut(BaseModel):
    count: int


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/scores", response_model=list[ScoreOut])
@limiter.limit("60/minute")
def list_scores(request: Request, limit: int = Query(default=10, ge=1, le=database.MAX_SCORES)):
    return database.get_top_scores(limit=limit)


@app.post("/api/scores", response_model=ScoreOut, status_code=201)
@limiter.limit("5/minute")
def create_score(request: Request, payload: ScoreIn):
    return database.insert_score(payload.player_name, payload.score, payload.wave, payload.kills)


@app.get("/api/games/count", response_model=GamesCountOut)
@limiter.limit("60/minute")
def games_count(request: Request):
    return {"count": database.count_games_played()}


# Une partie vient de se terminer, quel que soit son score. Pas de payload.
@app.post("/api/games", status_code=201)
@limiter.limit("10/minute")
def create_game(request: Request):
    database.record_game_played()
    return {"status": "ok"}
