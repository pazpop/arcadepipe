# Gameplay — arcadepipe

Liste de ce qui est implémenté dans le jeu, organisée par système. Deux objectifs :

1. Garder une trace de ce qui a été construit — la "todo list" de départ, cochée au fil du développement plutôt que jetée une fois faite.
2. Servir de checklist de référence pour démarrer un nouveau petit jeu d'arcade en JS/Canvas : copie cette liste, décoche tout, coche au fur et à mesure. Les items sont formulés en général plutôt qu'en langage spécifique à ce jeu, pour rester réutilisables ailleurs.

Détail technique (stack, déploiement, sécurité) : voir le [README à la racine](../README.md). Ce fichier-ci ne couvre que le *gameplay*.

## Boucle de jeu & rendu

- [x] Boucle `requestAnimationFrame` avec delta-time borné (évite les gros sauts après un onglet en arrière-plan)
- [x] Résolution interne fixe, agrandie à l'écran avec un rendu net (`image-rendering: pixelated`, pas de flou)
- [x] Sprites pixel art générés par code (matrice de caractères → couleur), aucun fichier image
- [x] Machine à états explicite pour les écrans (menu, jeu, pause, game over...)

## Vaisseau joueur & contrôles

- [x] Suivi progressif de la cible souris/tactile (pas de snap brutal)
- [x] Contrôle tactile décalé pour ne pas cacher la zone de jeu sous le doigt
- [x] Tir manuel (maintenir) + option tir automatique, préférence persistée
- [x] Invulnérabilité brève après un coup, avec clignotement visuel
- [x] Vies limitées, game over à la dernière perdue

## Armes & bonus

- [x] Tir de base
- [x] Bonus temporaires à minuteur, un seul actif à la fois (pas de cumul — évite la micro-gestion)
- [x] Variantes d'arme avec un vrai compromis, pas juste "plus fort" : dégâts renforcés/cadence lente, cadence rapide/dégâts réduits, cône multi-projectiles à dégâts décroissants avec la distance
- [x] Bonus indépendant du minuteur (coups fixes absorbés), actif en même temps qu'un bonus d'arme
- [x] Effet instantané qui nettoie l'écran, volontairement plus rare que les autres (poids de tirage)
- [x] Pool d'objets à taille fixe pour les projectiles (pas d'allocation par frame)

## Ennemis

- [x] Plusieurs types avec stats différentes (vie, vitesse, points, comportement de tir)
- [x] Type plus rare/plus fort, dont la fréquence d'apparition augmente avec la difficulté
- [x] Variante de tir sur le type de base, débloquée à un palier de progression
- [x] Confinement de la zone d'apparition (lisibilité sur petit écran), trajectoire libre une fois en vol
- [x] Pool d'objets à taille fixe

## Boss

- [x] Combat à points faibles multiples (pas juste une barre de vie globale)
- [x] Patterns de tir qui varient et se densifient à mesure que le boss est endommagé
- [x] Premier combat adouci (le joueur découvre le mécanisme pour la première fois)
- [x] Récompense de victoire (vie bonus, score)
- [x] Variabilité visuelle d'un combat à l'autre (teinte, taille) sans redessiner de sprite

## Vagues & difficulté

- [x] Objectif de kills qui augmente par vague
- [x] Cadence d'apparition des ennemis qui augmente par vague (plafonnée)
- [x] Vitesse des tirs ennemis qui augmente par vague (plafonnée, reste esquivable)
- [x] Boss périodique (une vague sur N)
- [x] Transition animée entre deux vagues (pas un simple cut)
- [x] Bonus de score pour une vague terminée sans perdre de vie

## Effets ("game feel")

- [x] Particules (explosions, étincelles, éclats) via pool réutilisable
- [x] Tremblement d'écran dosé selon l'impact (pas systématique)
- [x] Micro-gel d'impact (hit-stop) sur les coups marquants
- [x] Ralenti cinématique à la mort du joueur
- [x] Flash plein écran sur les moments forts
- [x] Vibration mobile, silencieuse si indisponible/refusée
- [x] Respect de `prefers-reduced-motion` (coupe le tremblement d'écran)

## Décor

- [x] Fond étoilé multi-couches en parallaxe
- [x] Éléments de décor occasionnels et discrets (variation visuelle, pas de gameplay)
- [x] Décor spécifique aux combats de boss, qui s'efface proprement à la victoire

## Audio

- [x] Effets sonores 100% synthétisés (Web Audio API), aucun fichier son
- [x] Musique : vraie playlist de fichiers, lecture aléatoire sans répétition immédiate
- [x] Contexte audio partagé entre musique et bruitages (pas de double contexte)
- [x] Réglages de volume séparés (musique / bruitages), coupure du son, préférences persistées
- [x] Transition sans clic audible entre deux pistes (fondu)

## Interface & menus

- [x] Écrans titre, pause, confirmation de sortie, aide, crédits, game over, saisie du nom, classement
- [x] Survol/sélection au clavier et à la souris avec retour sonore
- [x] Aide affichée automatiquement à la première partie, accessible ensuite à la demande
- [x] Saisie de nom qui fonctionne aussi sans clavier virtuel (mobile)
- [x] Numéro de version affiché (voir plus bas)

## Classement

- [x] Scores envoyés/lus depuis un backend (pas seulement local)
- [x] Compteur global de parties jouées
- [x] Écran classement qui tolère un backend indisponible (dégrade proprement, pas d'erreur bloquante)

## Accessibilité & mobile

- [x] `prefers-reduced-motion` respecté
- [x] Contrôle tactile pensé séparément de la souris (pas un simple événement générique)
- [x] Interface responsive (canvas redimensionné en gardant le ratio)
- [x] Pause automatique quand l'onglet/l'app passe en arrière-plan

## Persistance locale

- [x] Préférences (volume, mute, piste, CRT, tir auto, panneau replié, dernier pseudo) en `localStorage`, repli silencieux si indisponible (navigation privée)

## Suivi de version

- [x] Numéro de version affiché en jeu (menu + crédits), dérivé automatiquement du nombre de commits
- [ ] Changelog détaillé (pas encore fait)

## Tests

- [x] Tests unitaires sur la logique pure (aucune dépendance au DOM)
- [x] Tests bout-en-bout (vrai navigateur) sur les scénarios lents à atteindre normalement (bonus, boss), via injection de constantes le temps d'un test
