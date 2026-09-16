FROM python:3.11-slim

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
