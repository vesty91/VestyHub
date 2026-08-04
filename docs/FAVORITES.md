# Favoris

## Données

Chaque favori appartient à un utilisateur et peut être associé à un groupe. Il peut contenir :

- une URL interne ;
- une URL externe ;
- une description ;
- une icône Lucide sélectionnée dans une bibliothèque visuelle catégorisée ;
- des tags ;
- un mode d’ouverture ;
- une URL de contrôle de santé ;
- un état épinglé pour le dashboard.

Au moins une URL HTTP ou HTTPS est obligatoire lors de la création ou de la modification.

## Permissions

Les rôles `ADMIN` et `USER` peuvent créer, modifier, épingler et supprimer leurs propres favoris. `VIEWER` reste en lecture seule.

Les identifiants de groupe et de favori sont validés puis vérifiés contre l’utilisateur connecté. Un identifiant appartenant à un autre utilisateur n’est jamais accepté.

## Données de seed

Le seed crée plusieurs services de démonstration sans inventer d’URL réelle. Ils apparaissent avec la mention « URL à configurer » et peuvent ensuite être modifiés depuis l’interface.

## Bibliothèque d’icônes

Le formulaire utilise un sélecteur visuel et non plus un menu HTML natif. Il propose plus de 80 icônes organisées par catégories : navigation, serveurs, Docker, stockage, téléchargements, réseau, sécurité, monitoring, multimédia, développement/IA et outils.

Le sélecteur prend en charge :

- la recherche par nom, catégorie et mots-clés ;
- l’aperçu graphique avant enregistrement ;
- la navigation clavier, la touche Échap et la fermeture au clic extérieur ;
- la conservation des anciennes valeurs d’icônes déjà enregistrées ;
- l’enregistrement d’une simple chaîne dans `favorites.icon_value`.

Aucune migration PostgreSQL n’est nécessaire pour cette évolution.
