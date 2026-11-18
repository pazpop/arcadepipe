# Changelog

Changements notables (gameplay, visuel, audio, infra), plus récent en premier. Le numéro de version est `3.<nombre de commits git>` : `tools/build_itch.py` le calcule et l'écrit dans l'archive d'itch.io. Une entrée porte donc le numéro du commit qui l'ajoute : `git fetch`, puis le résultat de `git rev-list --count origin/main`, plus le rang du commit parmi ceux qui ne sont pas encore poussés.

## [3.30] - 2026-11-18
- **Sans serveur** : le classement et le compteur de parties sont gardés dans le navigateur du joueur (ses 10 meilleures parties). Le jeu n'envoie plus rien. Fin du backend, des images Docker et du site `arcadepipe.pazpop.net` : le jeu se joue sur [itch.io](https://pazpop.itch.io/arcadepipe), adresse reprise par la carte de partage et son QR code.

## [3.1] - 2026-10-17
- **Refonte complète**, le jour de la sortie sur itch.io : nouvel historique Git, nouvelle série de versions. L'ancien changelog n'est pas repris.
