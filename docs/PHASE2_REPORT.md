# Rapport Phase 2

## Périmètre livré

La Phase 2 ajoute les briques applicatives directement exploitables au-dessus de la fondation durcie :

- authentification locale Argon2id ;
- sessions PostgreSQL avec jeton opaque ;
- contrôle d'accès `ADMIN`, `USER`, `VIEWER` ;
- limitation des tentatives et audit ;
- shell responsive du dashboard ;
- widgets initiaux persistés ;
- CRUD des favoris et groupes ;
- inventaire Docker en lecture seule ;
- pages de préparation NAS et monitoring ;
- documentation et scripts de validation Phase 2.

## Choix d'architecture

La Phase 2 n'ajoute aucune dépendance et ne modifie pas le schéma SQL. Elle réutilise les tables `users`, `sessions`, `dashboards`, `dashboard_widgets`, `favorite_groups`, `favorites` et `audit_logs` créées en Phase 1.

L'intégration Authentik/OIDC reste réservée à une phase ultérieure. `AUTHENTIK_ENABLED` doit donc rester à `false` pour cette version.

## Sécurité

- cookie de session `HttpOnly`, `SameSite=Lax`, chemin `/` ;
- attribut `Secure` lorsque `APP_URL` est en HTTPS ;
- token aléatoire de 32 octets, jamais stocké en clair en base ;
- empreinte SHA-256 dans `sessions` ;
- actions sensibles protégées côté serveur ;
- vérification de propriété pour les groupes et favoris ;
- URLs limitées à HTTP/HTTPS et refus des identifiants intégrés ;
- aucun appel Docker en écriture ;
- journalisation sans mot de passe ni token.

## Validation à exécuter sur la machine cible

```powershell
pnpm install --frozen-lockfile
pnpm format
.\scripts\validate-phase2.ps1
```

Puis pour l'intégration Docker :

```powershell
docker compose build --no-cache
docker compose up -d --remove-orphans
docker compose ps -a
```

Le volume PostgreSQL existant doit être conservé. Ne jamais utiliser `docker compose down -v` lors de la mise à jour.

## Limites restantes

- pas encore de déplacement/redimensionnement GridStack dans l'interface ;
- pas encore de connecteur DSM réel ;
- pas encore de graphiques Prometheus, Loki ou Alertmanager ;
- pas encore d'OIDC Authentik ;
- pas d'action Docker en écriture.
