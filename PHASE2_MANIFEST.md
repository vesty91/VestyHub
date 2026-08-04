# VestyHub Phase 2.1 — manifeste

## Contenu fonctionnel

- authentification locale Argon2id ;
- sessions PostgreSQL sécurisées ;
- rôles `ADMIN`, `USER`, `VIEWER` ;
- login, logout, limitation des échecs et audit ;
- layout responsive du centre de contrôle ;
- widgets horloge, favoris et statut ;
- groupes et CRUD des favoris ;
- bibliothèque de plus de 80 icônes Lucide avec recherche et catégories ;
- inventaire Docker en lecture seule ;
- pages NAS, monitoring et paramètres ;
- scripts de validation et de déploiement Phase 2.

## Compatibilité Phase 1

- aucune migration SQL supplémentaire ;
- aucune nouvelle dépendance ;
- lockfile conservé ;
- volume PostgreSQL existant réutilisable ;
- `.env` volontairement absent de l'archive.

## Contrôles réalisés avant archivage

- analyse syntaxique TypeScript/TSX ;
- résolution des imports locaux ;
- validation JSON et YAML ;
- recherche de secrets courants ;
- vérification des invariants Docker en lecture seule ;
- exclusion de `.env`, `.git`, `.next`, `node_modules` et `copilot-worktrees`.

Le build Next.js, ESLint, Vitest et Docker doivent être exécutés sur la machine cible avec `scripts/validate-phase2.ps1`, car les dépendances npm et Docker ne sont pas disponibles dans l'environnement ayant produit cette archive.
