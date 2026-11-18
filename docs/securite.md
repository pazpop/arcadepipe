# Sécurité

Le jeu n'a pas de serveur : des fichiers statiques, servis par itch.io. Rien n'est envoyé nulle part.

## En place

- **Aucune surface XSS** : le pseudo n'est jamais inséré dans du HTML (rendu Canvas). Il est limité à ce que le jeu
  saisit : 1 à 8 lettres majuscules, chiffres ou espaces.
- **Stockage du navigateur lu avec prudence** : un classement illisible (modifié à la main) donne un classement vide,
  sans erreur (`scores.js`).
- **Aucune ressource externe** : ni script, ni police, ni mesure d'audience. La bibliothèque du QR code est copiée dans
  le dépôt (`frontend/lib/`).
- **CI** : actions GitHub épinglées par SHA de commit ; un audit `npm` hebdomadaire
  ([déploiement](deploiement.md#cicd)).

## Non fait volontairement

- **Classement modifiable par le joueur** : il est sur son appareil, il peut l'éditer. Il ne trompe que lui : personne
  d'autre ne le voit.
