# Phase 3A — Docker du NAS en lecture seule

## Objectif

VestyHub affiche exclusivement le moteur Docker du NAS Synology. Le moteur Docker du PC de développement ne doit jamais être utilisé comme source de secours.

## Architecture

- En production sur le NAS, `docker-socket-proxy` monte `/var/run/docker.sock` du NAS en lecture seule.
- L'application accède uniquement à `DOCKER_PROXY_URL`.
- `DOCKER_EXPECTED_HOSTNAME` doit correspondre au champ `Name` de `GET /info`.
- Une différence de nom bloque l'affichage des conteneurs.
- Le service `app` ne monte jamais le socket Docker.

## Endpoints utilisés

Uniquement des requêtes GET :

- `/version`
- `/info`
- `/containers/json?all=1`
- `/containers/{id}/json`
- `/containers/{id}/stats?stream=false`

Le proxy conserve `POST=0`, `EXEC=0` et toutes les actions de contrôle désactivées.

## Développement Windows

Démarrer le proxy sur le NAS avec `deploy/nas/docker-proxy.compose.yml`, puis ouvrir un tunnel :

```powershell
ssh -N -L 23750:127.0.0.1:2375 UTILISATEUR_DSM@IP_DU_NAS
```

Pour `pnpm dev` :

```env
DOCKER_PROXY_URL=http://127.0.0.1:23750
DOCKER_EXPECTED_HOSTNAME=nom-retourne-par-info
```

Pour VestyHub dans Docker Desktop :

```env
DOCKER_PROXY_URL=http://host.docker.internal:23750
DOCKER_EXPECTED_HOSTNAME=nom-retourne-par-info
```

## Données exposées

Le navigateur reçoit uniquement un modèle normalisé : nom, image, état, santé, ports publiés, projet/service Compose, uptime, redémarrages, CPU, mémoire et URL explicitement autorisée.

Ne sont jamais renvoyés : variables d'environnement, montages hôte, labels arbitraires, socket, secrets ou réponse Docker brute.

## Cache

- vue globale : 5 secondes ;
- inspection : 5 secondes ;
- statistiques : 3 secondes ;
- concurrence limitée à quatre conteneurs.

## Retour arrière

```powershell
git switch main
git reset --hard v0.2.1
```

Ne jamais exécuter `docker compose down -v` : cette commande supprimerait le volume PostgreSQL.
