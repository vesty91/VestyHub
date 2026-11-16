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
