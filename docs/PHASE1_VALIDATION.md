# Rapport de validation Phase 1

## Correctifs réalisés

- Publication de l'application limitée à `127.0.0.1:${APP_PORT}:3000`.
- Migration one-shot bloquante avant le démarrage de l'application.
- Seed explicite sous profil Compose, jamais automatique.
- Proxy Docker strictement en lecture seule avec `POST=0` et aucun port hôte.
- Remplacement de Promtail par Grafana Alloy.
- Images de services épinglées à des versions explicites.
- Validation stricte des booléens et des bornes numériques.
- TLS Synology vérifié par défaut ; identifiants conditionnels selon le mode.
- Redaction profonde des secrets et logger non bloquant.
- AES-256-GCM v2 avec AAD liée au connecteur et lecture des payloads v1.
- Contraintes, index et FK PostgreSQL ajoutés par une nouvelle migration.
- Seed transactionnel, email normalisé et mot de passe de production obligatoire.
- Timeout, annulation, retry, cache et circuit breaker durcis.
- ThemeProvider, réduction des animations et pages d'erreur minimales.
- Liveness et readiness séparées.
- CI GitHub Actions et scripts de validation locale.
- Documentation d'installation, Synology, Docker, sécurité, sauvegarde et MCP.

## Validation finale sur le poste de développement

Validation réalisée le **3 août 2026** sous Windows avec pnpm et Docker Desktop :

- `pnpm install --frozen-lockfile` : réussi.
- `pnpm format:check` : réussi.
- `pnpm lint` : réussi.
- `pnpm typecheck` : réussi.
- `pnpm test:unit` : **33 tests réussis sur 33**, sans rejet non géré.
- `pnpm build` : réussi avec Next.js ; routes `/api/health`, `/api/health/live` et
  `/api/health/ready` générées.
- `docker compose config --quiet` : réussi.
- Construction des images `vestyhub` et `vestyhub-tools` : réussie.
- PostgreSQL : `healthy`.
- Proxy Docker : `healthy`, interne et en lecture seule avec `POST=0`.
- Migration Drizzle : terminée avec le code `0`.
- Application : `healthy`, publiée uniquement sur `127.0.0.1:3000`.
- Page de fondation chargée avec succès dans le navigateur.

Le profil `monitoring` et le seed administrateur n'ont pas été activés pendant cette
validation. Ils restent optionnels et doivent être configurés explicitement.

## Contrôles exécutés dans l'environnement d'audit

- Analyse syntaxique de 52 fichiers TypeScript/TSX : réussie.
- Typecheck strict des modules autonomes de sécurité/connecteurs : réussi.
- Tests runtime autonomes du cache, retry, circuit breaker, redaction, logger et timeout : réussis.
- Validation JSON : réussie.
- Validation YAML des fichiers Compose/CI/monitoring : réussie.
- Vérification statique des invariants Compose et migration : réussie.
- `git diff --check` : réussi après normalisation LF.
- Recherche de secrets courants : aucun résultat.
- Recherche de `TODO`, `FIXME`, `@ts-ignore` et désactivations ESLint : aucun blocage détecté.

## Contrôles non réexécutés dans l'environnement de consolidation

L'archive finale ne contient ni `node_modules` ni métadonnées Git. L'environnement de
consolidation ne disposait pas de Docker et ne pouvait pas résoudre le registre npm. Les
commandes ci-dessous ont toutefois toutes été validées sur le poste de développement,
comme indiqué précédemment, et doivent être relancées après toute modification :

```bash
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
docker compose config
```

Utiliser `scripts/validate-phase1.ps1` sous Windows ou `scripts/validate-phase1.sh` sous Linux/DSM.

## Git

L'archive d'entrée ne contenait pas `.git`. Une branche temporaire `fix/phase1-foundation-hardening` a été utilisée pendant l'audit, mais le dossier `.git` est volontairement exclu de l'archive finale afin de ne jamais remplacer l'historique du dépôt réel.

## Migration

La migration ajoutée est :

```text
src/db/migrations/0001_phase1_foundation_hardening.sql
```

Elle n'altère pas la migration initiale. Le snapshot Drizzle associé a été mis à jour et validé comme JSON. Avant déploiement sur une base contenant des données, effectuer un dump vérifié.
