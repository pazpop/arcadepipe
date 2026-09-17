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

from fastapi import FastAPI, Query, Request
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field, field_validator
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.util import get_remote_address

import database


@asynccontextmanager
async def lifespan(app: FastAPI):
    database.init_db()
    yield


app = FastAPI(title="ArcadePipe API", version="0.1.0", lifespan=lifespan)

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
    # Fiable seulement parce qu'un reverse-proxy de confiance se trouve TOUJOURS
    # devant cette API, quel que soit le déploiement :
    #  - Instance publique (repo infra séparé) : Traefik écrase X-Forwarded-For
    #    par défaut quand aucun trustedIPs n'est configuré (voir traefik.yml) —
    #    la valeur envoyée par le client est remplacée par l'IP qu'il observe
    #    réellement avant de transmettre la requête. Revalider ce point avant
    #    tout redéploiement si trustedIPs est un jour ajouté.
    #  - Déploiement autonome (docker-compose.yml de ce repo, Caddy en frontal) :
    #    mécanisme différent de Traefik mais résultat identique. Caddy n'écrase
    #    PAS un X-Forwarded-For déjà présent — il AJOUTE l'IP réellement
    #    observée à la fin de la liste (comportement documenté officiellement :
    #    caddyserver.com/docs/caddyfile/directives/reverse_proxy). Un client
    #    qui envoie son propre X-Forwarded-For voit donc sa valeur conservée
    #    en tête, mais c'est sans effet ici puisqu'on lit toujours la
    #    DERNIÈRE IP — celle que Caddy vient d'ajouter, jamais falsifiable.
    # Dans les deux cas, c'est pourquoi on lit la DERNIÈRE IP de la chaîne :
    # c'est celle ajoutée par le proxy de confiance, jamais celle envoyée par
    # le client. Sans reverse-proxy devant (accès direct au port 8000), cette
    # fonction ne serait plus fiable — ce n'est pas un déploiement supporté.
    forwarded = request.headers.get("x-forwarded-for")
    if forwarded:
        return forwarded.split(",")[-1].strip()
    return get_remote_address(request)


limiter = Limiter(key_func=get_client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


class ScoreIn(BaseModel):
    player_name: str = Field(min_length=1, max_length=20)
    # Borne haute large mais réaliste : filtre les valeurs absurdes envoyées
    # à la main sans prétendre empêcher la triche (le score vient du client,
    # rien ne le garantit authentique — voir Points d'attention du README).
    score: int = Field(ge=0, le=999_999)
    wave: int = Field(default=1, ge=1, le=9_999)
    kills: int = Field(default=0, ge=0, le=999_999)

    @field_validator("player_name")
    @classmethod
    def player_name_not_blank(cls, v: str) -> str:
        # Field() ne vérifie que la longueur brute : "   " (3 espaces) passe
        # sinon. Le .trim() côté client (game.js) ne protège pas un appel
        # direct à l'API.
        v = v.strip()
        if not v:
            raise ValueError("player_name ne peut pas être vide")
        return v


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
def list_scores(request: Request, limit: int = Query(default=10, ge=1, le=100)):
    return database.get_top_scores(limit=limit)


@app.post("/api/scores", response_model=ScoreOut, status_code=201)
@limiter.limit("5/minute")
def create_score(request: Request, payload: ScoreIn):
    return database.insert_score(payload.player_name, payload.score, payload.wave, payload.kills)


@app.get("/api/games/count", response_model=GamesCountOut)
@limiter.limit("60/minute")
def games_count(request: Request):
    return {"count": database.count_games_played()}


# Une partie sur deux ne bat aucun score qualifiant (voir handleGameOver
# côté frontend) : sans ce compteur séparé, la table 'scores' ne reflète
# jamais le vrai nombre de parties jouées, seulement celles qui ont un jour
# fait le top. Pas de payload — juste "une partie vient de se terminer".
@app.post("/api/games", status_code=201)
@limiter.limit("10/minute")
def create_game(request: Request):
    database.record_game_played()
    return {"status": "ok"}
