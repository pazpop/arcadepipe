# Épinglé par digest (pas juste par tag) : "3.11-slim" est un tag flottant —
# la même chaîne pointe vers une image différente à chaque republication en
# amont (patch de sécu, changement de base Debian...). Le digest, lui, ne
# change jamais pour un même contenu : reproductible, et impossible à
# remplacer silencieusement par une image compromise portant le même tag.
# Contrepartie assumée : plus de mise à jour automatique à chaque rebuild —
# Dependabot (.github/dependabot.yml, écosystème "docker") ouvre une PR
# quand une nouvelle version de digest existe pour ce tag, donc rien à
# traquer à la main.
FROM python:3.14-slim@sha256:cad9a2c871761c413caa6fdd6441c783451e740a48aaeba60ae62a8b53525ef6

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Utilisateur dédié plutôt que root : si l'API est un jour compromise,
# l'attaquant hérite des droits de cet utilisateur, pas de root dans le
# conteneur. /data appartient à cet utilisateur pour que le volume monté
# (backend_data) reste inscriptible une fois qu'on abandonne root.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /data \
    && chown -R appuser:appuser /app /data
USER appuser

# La DB vit sur un volume monté, pas dans l'image — un rebuild ne doit pas
# effacer les scores.
ENV DB_PATH=/data/arcadepipe.db
VOLUME /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8000/api/health', timeout=2)" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
