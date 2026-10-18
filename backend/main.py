"""ArcadePipe — API du classement. Les routes sont décrites dans README.md."""
import os
from contextlib import asynccontextmanager
from typing import Annotated

from fastapi import FastAPI, Query, Request
from fastapi.exceptions import RequestValidationError
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from pydantic import BaseModel, Field, StringConstraints, model_validator
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
    # de confiance (celui de l'infra en prod, Caddy en autonome) a ajoutée ou imposée,
    # jamais une valeur envoyée par le client. Ce proxy doit être celui qui
    # reçoit les joueurs : sans proxy (accès direct au port 8000), l'en-tête est
    # falsifiable ; avec un second proxy devant le premier, tous les joueurs
    # partageraient la même adresse, donc le même quota. Non supportés.
    forwarded = request.headers.get("x-forwarded-for")
    # `or` : un en-tête vide ou terminé par une virgule ne donne pas de clé
    # vide, pour laquelle le limiteur ne compterait rien.
    last = forwarded.split(",")[-1].strip() if forwarded else ""
    return last or get_remote_address(request)


limiter = Limiter(key_func=get_client_ip)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


# Requête invalide : un refus sans détail. La réponse par défaut de FastAPI
# recopie la valeur refusée, et plante (erreur 500) sur un nombre que JSON ne
# sait pas écrire, comme 1e400 ou NaN.
@app.exception_handler(RequestValidationError)
async def invalid_request(request: Request, exc: RequestValidationError):
    return JSONResponse({"detail": "invalid request"}, status_code=422)


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

    # Refuse une partie impossible : plus d'ennemis abattus que les vagues n'en
    # contiennent, ou plus de points qu'ils n'en rapportent. Ne prouve pas qu'un
    # score est vrai : un tricheur qui annonce une vague assez haute passe.
    @model_validator(mode="after")
    def partie_possible(self):
        if self.kills > max_kills(self.wave) or self.score > max_score(self.wave, self.kills):
            raise ValueError("partie impossible")
        return self


# Plafonds tirés des règles du jeu (frontend/js/config.js et enemies.js) : à
# refaire si une règle du score change (tests/test_plafonds.py relit ces valeurs
# dans le frontend et échoue si elles divergent).
# Par vague : l'objectif d'ennemis abattus (10, puis 3 de plus à chaque vague),
# et jusqu'à 40 de plus d'un coup (NOVA sur un écran plein : POOL_SIZE).
def max_kills(wave: int) -> int:
    return sum(10 + 3 * (w - 1) + 40 for w in range(1, wave + 1))


# 300 points au plus par ennemi (l'élite). Par vague, hors ennemis : le bonus
# INTACT (500), 40 frôlements payés au multiplicateur maximal (40 x 15 x 20) et
# un boss (6 points faibles x 300, plus 1 000 pour la victoire).
MAX_POINTS_PER_KILL = 300
MAX_OTHER_POINTS_PER_WAVE = 500 + 40 * 15 * 20 + 6 * 300 + 1_000


def max_score(wave: int, kills: int) -> int:
    return kills * MAX_POINTS_PER_KILL + wave * MAX_OTHER_POINTS_PER_WAVE


class ScoreOut(BaseModel):
    player_name: str
    score: int
    wave: int
    kills: int


class GamesCountOut(BaseModel):
    count: int


@app.get("/api/health")
def health():
    return {"status": "ok"}


@app.get("/api/scores", response_model=list[ScoreOut])
@limiter.limit("60/minute")
def list_scores(request: Request, limit: int = Query(default=10, ge=1, le=database.MAX_SCORES)):
    return database.get_top_scores(limit=limit)


# La limite par jour protège les vrais scores d'un effacement par de faux
# scores envoyés en masse (voir docs/securite.md).
@app.post("/api/scores", response_model=ScoreOut, status_code=201)
@limiter.limit("5/minute;50/day")
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
