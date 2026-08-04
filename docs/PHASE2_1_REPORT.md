# Rapport Phase 2.1 — bibliothèque d’icônes

## Périmètre

Cette mise à niveau finalise le choix des icônes avant la Phase 3. Elle ne modifie ni la base PostgreSQL, ni l’authentification, ni Docker.

## Modifications

- remplacement du `<select>` HTML natif par un sélecteur visuel cohérent avec VestyHub ;
- ajout de plus de 80 icônes Lucide ;
- catégories dédiées aux téléchargements, Docker, NAS/stockage, réseau, sécurité, monitoring, multimédia, développement/IA et outils ;
- recherche sans sensibilité aux accents ;
- aperçu de l’icône sélectionnée et de sa clé persistée ;
- sélection au clavier, fermeture par Échap et clic extérieur ;
- compatibilité avec les anciennes clés `globe`, `globe-2`, `key`, `refresh`, `restore` et `message` ;
- test de cohérence du catalogue : unicité, registre et présence des icônes de téléchargement.

## Données

La colonne existante `favorites.icon_value` continue de stocker une chaîne de caractères. Aucune migration Drizzle n’est requise.

## Validation recommandée

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```
