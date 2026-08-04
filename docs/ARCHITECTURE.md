# Architecture VestyHub Phase 2

## Vue générale

```text
Navigateur
   |
Reverse proxy DSM / HTTPS
   |
127.0.0.1:3000
   |
Next.js standalone
   |-- PostgreSQL 17
   |-- Docker socket proxy GET/HEAD
   |-- Prometheus / Loki / Alertmanager optionnels
```

## Routage applicatif

- `(auth)/login` : page publique de connexion.
- `(dashboard)` : segment protégé par le Data Access Layer de session.
- `/dashboard` : agrégation des statistiques et rendu des widgets.
- `/favorites` : catalogue personnel et Server Actions CRUD.
- `/docker` : inventaire réel via le proxy Docker.
- `/nas` et `/monitoring` : état de configuration des futurs connecteurs.

## Authentification

La table `sessions` stocke l’empreinte SHA-256 d’un jeton aléatoire. Le jeton brut reste uniquement dans un cookie `HttpOnly`. Le layout protégé appelle `requireUser()` avant de rendre le shell.

Les Server Actions ne se fient jamais au layout : chaque mutation rappelle `requireRole()` et vérifie l’appartenance de la ressource à l’utilisateur.

## Dashboard

La disposition initiale est conservée dans `dashboards` et `dashboard_widgets`. La Phase 2 rend trois types de widgets :

- `clock` ;
- `favorites` ;
- `system-status`.

Le rendu utilise une grille CSS responsive. L’édition visuelle GridStack viendra ensuite sans changer le modèle de données.

## Démarrage Docker

1. PostgreSQL devient healthy.
2. `migrate` exécute `tsx src/db/migrate.ts` avec le migrateur Drizzle programmatique.
3. `app` démarre uniquement si la migration se termine avec le code 0.
4. Le seed reste un profil volontaire séparé.

## Réseaux

- `frontend` : application et accès sortant nécessaire.
- `backend` : réseau `internal` pour PostgreSQL, proxy Docker et monitoring.
- Aucun port PostgreSQL ou Docker API n’est publié sur l’hôte.

## Données

PostgreSQL conserve les utilisateurs, sessions, dashboards, widgets, favoris, connecteurs, secrets chiffrés, healthchecks et événements d’audit. Les métriques historiques restent dans Prometheus et les logs dans Loki.
