# Épinglé par digest (voir docs/deploiement.md) ; Dependabot propose les mises à jour.
FROM mirror.gcr.io/library/python:3.13-slim@sha256:70729b46c69b4f1e97c4822c1af3df53a1476cf5ddc6c087c0c10bc3a5678c2f

WORKDIR /app

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

# Utilisateur dédié plutôt que root. Seul /data (le volume de la base) lui
# appartient : il n'a pas à pouvoir modifier le code dans /app.
RUN useradd --create-home --uid 1000 appuser \
    && mkdir -p /data \
    && chown appuser:appuser /data
USER appuser

# La DB vit sur un volume monté, pas dans l'image — un rebuild ne doit pas
# effacer les scores.
ENV DB_PATH=/data/arcadepipe.db
VOLUME /data

EXPOSE 8000

HEALTHCHECK --interval=30s --timeout=3s --start-period=5s \
  CMD python -c "import urllib.request as u; u.urlopen('http://localhost:8000/api/health', timeout=2)" || exit 1

CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
