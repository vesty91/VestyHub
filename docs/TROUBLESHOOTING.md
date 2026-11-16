# Dépannage

## `migrate` échoue

```bash
docker compose logs --tail=200 migrate postgres
docker compose run --rm migrate
```

Vérifier `DATABASE_URL`, le mot de passe encodé dans l’URL et la santé PostgreSQL. Un caractère spécial du mot de passe doit être encodé en URL dans `DATABASE_URL`.

## `/api/health/live` répond mais readiness retourne 503

Le processus Next.js fonctionne, mais PostgreSQL n’est pas joignable ou la requête de contrôle dépasse trois secondes.

```bash
docker compose ps
docker compose logs --tail=100 postgres app
```

## Test de récupération de session en vrai navigateur

Depuis le dépôt, sur une machine équipée de Docker, pnpm et Chromium Playwright :

```bat
pnpm exec tsx scripts/test-postgres-browser-recovery.ts
```

Le test démarre un PostgreSQL 17 **jetable en tmpfs** sur un port loopback
aléatoire, exécute migrations et seed sur cette seule base, démarre un Next.js
de développement avec son propre répertoire de compilation, puis ouvre Chromium.
Il vérifie l'authentification, la page de panne, `ready=503`, le retour
`ready=200`, le lien de reprise et la persistance de la session et d'une donnée.
La CI Playwright exécute également ce scénario **après** les tests ordinaires.

Les lectures de session et du dashboard disposent d'une deadline côté rendu
(8 et 12 secondes). Cette limite ne remplace pas une annulation SQL : une
requête de lecture interrompue côté HTTP peut finir plus tard sur le serveur.
Ne pas appliquer ce mécanisme de `Promise.race` aux écritures ni aux migrations.

## Exercice de panne PostgreSQL totalement isolé

Depuis le dépôt sur un poste équipé de Docker et de pnpm :

```bat
pnpm exec tsx scripts/test-postgres-outage.ts
```

Le script lance **son propre PostgreSQL 17** sur un port local attribué
aléatoirement, avec des données exclusivement en `tmpfs` (aucun volume nommé),
puis vérifie : disponibilité initiale, détection d'une panne réelle par
`docker pause`, reprise après `docker unpause` et conservation d'un enregistrement
de test. Le conteneur jetable est supprimé à la fin, y compris après échec
normal du scénario. La CI répète cet exercice après la restauration isolée.

**Ne jamais faire cette manipulation sur le conteneur de développement
`vestyhub-windows-local-postgres-1` ou sur la production NAS.**

## PostgreSQL temporairement indisponible dans l'interface

Si une requête de session ou de dashboard échoue et que
`GET /api/health/ready` répond HTTP **503**, la page d'erreur affiche
« PostgreSQL est indisponible ».

- Le bouton **Réessayer** est désactivé tant que le contrôle renvoie 503 :
  il n'y a pas de boucle de rechargement ni de recréation de session.
- Le navigateur contrôle automatiquement la disponibilité toutes les
  **15 secondes** lorsque l'onglet est visible. Le bouton **Vérifier PostgreSQL**
  permet aussi de tester immédiatement.
- Quand le service répond **200**, le lien **Reprendre VestyHub** apparaît.
  Il effectue une nouvelle navigation HTTP vers `/dashboard` ; l'authentification
  existante est vérifiée normalement. Aucun compte ou cookie n'est supprimé par le contrôle.
- Si la base est saine mais qu'une autre erreur apparaît, la page présente
  une erreur générique et laisse le bouton **Réessayer** accessible.
- Le diagnostic ne retourne **ni SQL, ni identifiants, ni URL de base**.

Sur le poste Windows local, lire uniquement l'état du service :

```bat
cd /d D:\Dev\VestyHub
curl.exe -i http://127.0.0.1:3200/api/health/live
curl.exe -i http://127.0.0.1:3200/api/health/ready
docker compose --env-file .env.local -f compose.local.yml ps postgres
docker compose --env-file .env.local -f compose.local.yml logs --tail=50 postgres
```

Le statut `live=200` et `ready=503` indique une application Next.js
opérationnelle mais une base indisponible. **Ne pas supprimer le volume**,
ne pas relancer de seed ni de migrations pour « réparer » une simple panne
réseau ou un conteneur momentanément arrêté.

## Le reverse proxy DSM retourne 502

1. Tester `curl http://127.0.0.1:3000/api/health/live` depuis le NAS.
2. Vérifier `APP_PORT`.
3. Vérifier que la destination DSM est `127.0.0.1`, protocole HTTP, port 3000.
4. Vérifier que le conteneur `app` est healthy.

## Le proxy Docker est unhealthy

```bash
docker compose logs --tail=100 docker-socket-proxy
```

Vérifier l’existence de `/var/run/docker.sock` et ses permissions. Ne pas résoudre le problème en publiant le port 2375.

## Validation d’environnement refusée

Les booléens acceptent uniquement `true` ou `false` en minuscules. Une valeur comme `treu`, `yes` ou `1` est volontairement refusée.

## Le seed refuse de démarrer

En production ou hors mode démo, renseigner `SEED_ADMIN_PASSWORD` avec au moins 12 caractères, puis :

```bash
docker compose --profile seed run --rm seed
```

## La page de connexion indique qu'aucun compte n'existe

Renseigner un mot de passe d'au moins 12 caractères dans `.env` :

```env
SEED_ADMIN_EMAIL=admin@vestyhub.local
SEED_ADMIN_PASSWORD=mot-de-passe-long-et-unique
```

Puis lancer une seule fois :

```bash
docker compose --profile seed run --rm seed
```

Le seed ne remplace pas le mot de passe d'un compte déjà présent.

## La connexion est temporairement bloquée

Cinq échecs dans une fenêtre de quinze minutes déclenchent un blocage de quinze minutes pour la combinaison IP et adresse e-mail. Attendre l'expiration du délai. Le redémarrage de l'application vide également ce limiteur mémoire, mais ne doit pas servir de méthode normale de déblocage.

## Réponse HTTP incomplète (Docker NAS et monitoring)

Les clients HTTP Docker NAS et monitoring (Prometheus, Loki, Alertmanager)
appliquent **un seul délai maximal couvrant les en-têtes et la lecture
intégrale du corps JSON/texte**.

- Docker NAS lecture seule (et vérification d'identité du proxy de contrôle) :
  **5 secondes** maximum, y compris si le proxy commence à envoyer du JSON
  sans jamais l'achever.
- Monitoring : les délais configurés pour chaque source couvrent désormais
  également la réception des données après les en-têtes.
- Une réponse qui envoie lentement des fragments est interrompue au même
  titre qu'un serveur qui ne répond pas. Le timeout est classé comme tel
  (notamment `TIMEOUT` dans le monitoring), et peut alimenter la protection
  du circuit breaker.
- Une annulation demandée par l'appelant est distincte d'un dépassement
  de délai ; les réponses rapides et complètes restent acceptées.
- Les actions Docker POST sans lecture de corps continuent de vérifier leur
  réponse HTTP ; elles ne sont pas modifiées par cette amélioration.

Les tests utilisent uniquement des serveurs HTTP **éphémères sur
`127.0.0.1`**, sans connexion à un NAS réel ni changement de
configuration Docker.

## Connecteur NAS / monitoring temporairement isolé (circuit breaker)

Pour limiter les délais et requêtes inutiles lorsqu'une source distante est
durablement en panne, les connecteurs **DSM, Docker NAS lecture seule,
Prometheus, Loki et Alertmanager** utilisent un circuit breaker en mémoire du
processus Next.js :

- Après **trois échecs transitoires consécutifs** (réseau, timeout, HTTP 5xx),
  les nouvelles requêtes sont refusées immédiatement pendant **30 secondes**.
- Passé ce délai, une **seule requête de reprise** est autorisée simultanément :
  une réponse valide ferme le circuit et un nouvel échec le rouvre pour 30 s.
- Les erreurs HTTP 4xx, les identifiants invalides et les réponses de
  configuration incorrecte **ne déclenchent pas** cette protection.
- Les connexions sont indépendantes : une panne Loki ne bloque pas Prometheus ;
  un DSM injoignable ne bloque pas la supervision Windows.
- Les requêtes DSM possèdent aussi un délai maximal absolu égal à
  `SYNOLOGY_TIMEOUT_MS`, même lorsque le serveur envoie des données lentement.

Un circuit ouvert **ne redémarre aucun conteneur**, ne modifie aucun NAS et
n'efface aucune métrique ou volume. Le compteur est temporaire et se
réinitialise au redémarrage du serveur VestyHub. Le délai d'isolement n'est pas
une preuve de panne définitive : le prochain contrôle après 30 s peut confirmer
la reprise.

## Monitoring et Docker « non configurés »

Une source **non configurée** (variable `PROMETHEUS_URL`, `LOKI_URL`,
`ALERTMANAGER_URL` ou `DOCKER_PROXY_URL` absente) est volontairement facultative :

- aucune alerte de panne ni avertissement « données partielles » n'est créé pour
  ce seul motif ;
- le widget de monitoring affiche « Monitoring non configuré » si les trois
  sources sont absentes, et n'effectue pas de polling en continu dans cet état ;
- les nombres d'alertes restent « — » tant qu'Alertmanager n'a pas répondu :
  **zéro** signifierait une valeur réellement mesurée, et non une absence de données ;
- la page Docker affiche un état neutre « Docker du NAS non configuré » et
  n'interroge pas le réseau.

Pour activer une source, renseigner son URL interne dans la configuration,
**redémarrer l'application** et vérifier le résultat. Les sources configurées
mais injoignables conservent un signalement d'erreur et les timeouts habituels.

## Docker apparaît indisponible dans le dashboard

```bash
docker compose ps docker-socket-proxy
docker compose logs --tail=100 docker-socket-proxy app
```

Vérifier que `DOCKER_PROXY_URL=http://docker-socket-proxy:2375` dans l'environnement du conteneur. Ne pas publier le port 2375 sur le LAN et ne pas monter directement le socket Docker dans l'application.
