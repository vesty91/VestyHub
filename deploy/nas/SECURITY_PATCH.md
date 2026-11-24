# VestyHub NAS — correctifs de sécurité (2026-11-15)

Cette copie provient de `VestyHub-main.zip`. Les fichiers ont été modifiés **sans déploiement** sur le NAS. L'archive ne contient pas les secrets de production.

## Modifications apportées

- Dépendance `app -> migrate` conditionnée à `service_completed_successfully`, migration après PostgreSQL `service_healthy`.
- Healthcheck PostgreSQL et healthcheck applicatif dans `deploy/nas/compose.production.yml`.
- App NAS en `read_only`, `cap_drop: [ALL]`, `no-new-privileges`, `tmpfs` pour `/tmp` et le cache Next.js.
- Port 3001 lié à `${VESTYHUB_BIND_IP:-127.0.0.1}` au lieu de `0.0.0.0`.
- Détection des projets Compose VestyHub élargie à `vestyhub-nas-deploy` et `vestyhub-docker-proxy` ; toutes leurs charges sont protégées contre les actions Docker de l'application.
- Double contrôle d'identité des proxies Docker (lecture et écriture) avant une action `start`, `stop` ou `restart`. Nécessite `DOCKER_EXPECTED_HOSTNAME` et un endpoint `GET /info` accessible sur le proxy d'écriture. `docker-compose.yml` du dépôt active seulement `INFO=1` sur ce proxy.
- Correction du faux contrôle d'observabilité dû au stdin manquant : `docker exec -i ... node -`.
- Mutations du dashboard (POST/PATCH widgets, layout, settings) et réorganisation des favoris interdites au rôle `VIEWER` (403).
- Activation `AUTHENTIK_ENABLED=true` refusée tant que le flux OIDC n'est pas implémenté ; connexion locale exigée.
- Tests unitaires ajoutés ou adaptés pour la protection des stacks, la validation de l'environnement et les rôles.

## Avant de mettre à jour le NAS

1. **Sauvegarder** PostgreSQL et les fichiers de configuration `.env`, puis vérifier que le dump est lisible/restaurable dans une instance isolée. Ne pas supprimer les volumes existants.
2. Comparer le manifeste de production réel avec la copie livrée. En particulier, confirmer que le reverse proxy NPM est sur **le même hôte** ou **un autre hôte**.
3. Si NPM est sur un **autre hôte** (par exemple, la VM Docker du LAN), définir `VESTYHUB_BIND_IP=<adresse_LAN_du_NAS>` dans l'environnement Compose **et** filtrer TCP/3001 pour n'autoriser que l'adresse du reverse proxy. Sans cette étape, le nouveau bind en loopback peut couper l'accès HTTPS distant.
4. Conserver `DOCKER_CONTROL_ENABLED=false` par défaut. La présence et l'identité du proxy d'écriture doivent être vérifiées sur le réseau Docker ; la nouvelle protection rejette les actions si `/info` n'est pas exposé par ce proxy ou si les deux noms d'hôte divergent. La configuration NAS fournie n'inclut pas de proxy de contrôle d'écriture autonome.
5. Vérifier l'absence de `AUTHENTIK_ENABLED=true` et que `AUTH_LOCAL_ENABLED=true` dans `.env` avant toute mise en production.
6. Exécuter les tests avec les dépendances installées et Docker Compose, sur une **stack de staging**, avant bascule.

## Contrôles prévus en staging

```sh
pnpm install --frozen-lockfile
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build

docker compose -f deploy/nas/compose.production.yml config --quiet
sh -n deploy/nas/deploy-production.sh
```

`docker compose config` peut exiger un `.env` de staging et un réseau externe ; ne pas réutiliser les secrets de production dans les tests.

## Limitations restantes

- Aucun test Docker en conditions réelles n'a été effectué depuis cette archive.
- Le proxy Docker de lecture a une surface d'information importante ; un filtrage d'API plus strict reste à concevoir.
- Les sondes de favoris par URL méritent un contrôle SSRF avec résolution DNS et restrictions de destination adaptées aux accès LAN autorisés.
- `cadvisor` est encore `privileged: true` dans le manifeste ; son mode de collecte doit être étudié avant de retirer ce privilège.
- Il reste à tester sauvegarde **et restauration** des volumes d'observabilité, ainsi que les permissions de production et l'intégration NPM.
