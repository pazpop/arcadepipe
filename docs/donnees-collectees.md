# Données collectées

Version destinée aux joueurs, en français et en anglais : [`frontend/privacy.html`](../frontend/privacy.html). Les deux
doivent rester d'accord.

- **Rien ne quitte l'appareil** : le jeu n'a pas de serveur et n'envoie aucune requête. Seule la langue choisie avec le
  bouton de langue apparaît dans l'adresse de la page (`?lang=fr`).
- **Pas de mesure d'audience** : aucun script de mesure, aucun cookie. Sur itch.io, la page qui accueille le jeu suit
  les règles d'itch.io.
- **Sur l'appareil du joueur** (`localStorage`) : le classement (pseudo, score, vague, ennemis abattus des 10
  meilleures parties), le nombre de parties jouées, les préférences (volumes, son coupé, dernière piste, tir
  automatique, vitesse, filtre CRT, panneau replié, dernier pseudo, langue), le record personnel, l'aide déjà vue.
