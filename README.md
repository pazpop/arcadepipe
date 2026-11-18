![ArcadePipe](assets/banner.svg)

# ArcadePipe 🚀

Shoot'em up spatial rétro (*The Last Starfighter*) jouable dans le navigateur : pixel art généré par code, musique originale de [mall-e](https://mall-e.bandcamp.com/), classement gardé dans le navigateur. Sans serveur. Conçu par [pazpop](https://github.com/pazpop).

▶ **Jouer : https://pazpop.itch.io/arcadepipe**

![Capture d'écran d'ArcadePipe en jeu](assets/screenshot.png)

## Lancer en local

Le jeu est fait de fichiers statiques : n'importe quel serveur web local suffit, par exemple celui de Python 3. Node 22 ou plus récent n'est nécessaire que pour les tests et le lint.

```bash
cd frontend && python -m http.server 5500   # http://localhost:5500
```

## Stack

JS vanilla (modules ES6) + Canvas 2D, sans build · classement dans le stockage du navigateur · musique MP3 (Web Audio) · CI GitHub Actions.

## Publication

Le jeu est publié sur itch.io, à la main : `python tools/build_itch.py` construit l'archive. Voir [déploiement](docs/deploiement.md).

## Aller plus loin

- **Traduire le jeu** : copier [`frontend/js/i18n/fr.js`](frontend/js/i18n/fr.js) (la référence) sous le code de la langue (`es.js`...), traduire les textes en gardant les `{paramètres}` tels quels, puis l'ajouter à `LANGS` dans [`frontend/js/i18n.js`](frontend/js/i18n.js) et dessiner son drapeau (clé `lang.flags` du fichier, classe `.flag-…` de [`frontend/css/style.css`](frontend/css/style.css)). La page de confidentialité ([`frontend/privacy.html`](frontend/privacy.html)) a une section par langue, à ajouter aussi : le jeu y renvoie par `privacy.html#<code>`. `node --test` (dans `frontend/js`) signale toute clé manquante.
- **Code** : [architecture du frontend](frontend/README.md) · [règles du jeu](frontend/GAMEPLAY.md) · [tests e2e](e2e/README.md)
- **Exploitation** : [déploiement](docs/deploiement.md) · [sécurité](docs/securite.md) · [données collectées](docs/donnees-collectees.md)
- **Suivi** : [changelog](CHANGELOG.md) · [roadmap](ROADMAP.md)
- **Presse** : [kit presse](frontend/press/) (présentation, images, vidéo) · [confidentialité](frontend/privacy.html)

## 🎓 Pourquoi ce projet ?

Réalisé avec l'aide d'assistants IA ([Claude](https://claude.com), [Lumo](https://lumo.proton.me)) pour explorer et accélérer, pas pour décider : je teste avant de faire confiance et je reste le décideur à chaque étape.

## Crédits et licence

- Musique : 5 morceaux de **[mall-e](https://mall-e.bandcamp.com/)**. Un grand merci à lui !
- QR code : [qrcode-generator](https://github.com/kazuhikoarase/qrcode-generator) (MIT).
- Code sous [MIT](LICENSE). La musique (`frontend/music/`) appartient à mall-e et n'est pas couverte par cette licence.
