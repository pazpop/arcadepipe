![ArcadePipe](assets/banner.svg)

# ArcadePipe 🚀

Shoot'em up spatial rétro (*The Last Starfighter*) jouable dans le navigateur : pixel art généré par code, musique tracker, classement en ligne. Conçu par [pazpop](https://github.com/pazpop).

▶ **Jouer : https://arcadepipe.pazpop.net**

![Capture d'écran d'ArcadePipe en jeu](assets/screenshot.png)

## Lancer en local

```bash
cd backend && python -m venv venv && source venv/bin/activate  # Windows : venv\Scripts\activate
pip install -r requirements.txt && python seed.py && uvicorn main:app --reload
```
```bash
cd frontend && python -m http.server 5500   # http://localhost:5500
```

Tout-en-un avec Docker : `docker compose up --build -d`, puis http://localhost.

## Stack

JS vanilla (modules ES6) + Canvas 2D, sans build · FastAPI + SQLite · musique `.xm` lue par libopenmpt (AudioWorklet) · Docker Compose · CI GitHub Actions. L'instance publique est déployée depuis [`terraform-infra-pazpop-hetzner`](https://github.com/pazpop/terraform-infra-pazpop-hetzner).

## Aller plus loin

- **Code** : [architecture du frontend](frontend/README.md) · [gameplay implémenté](frontend/GAMEPLAY.md) · [backend](backend/README.md) · [tests e2e](e2e/README.md)
- **Exploitation** : [déploiement](docs/deploiement.md) · [sécurité](docs/securite.md) · [données collectées](docs/donnees-collectees.md)
- **Suivi** : [changelog](CHANGELOG.md) · [roadmap](ROADMAP.md) · [la saga audio](docs/audio-saga.md)

## 🎓 Pourquoi ce projet ?

Réalisé avec l'aide d'assistants IA ([Claude](https://claude.com), [Lumo](https://lumo.proton.me)) pour explorer et accélérer, pas pour décider : je teste avant de faire confiance et je reste le décideur à chaque étape.

## Crédits et licence

- Musique : 5 morceaux de la scène keygen par **DEViANCE** et **h4x0r**, via [keygen.music](https://keygen.music/). Aucune licence explicite trouvée : utilisés sciemment pour un projet personnel non commercial.
- Lecture : [libopenmpt](https://lib.openmpt.org/libopenmpt/) (BSD-3-Clause) via [chiptune3.js](https://github.com/DrSnuggles/chiptune) (MIT). QR code : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
- Code sous [MIT](LICENSE). La musique (`frontend/music/`) n'est pas couverte par cette licence.
