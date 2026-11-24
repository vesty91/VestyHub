# VestyHub — Windows 11 local development

This setup is **separate from Synology and all existing Docker projects**.

- Git branch: `feat/windows-local-development` (based on `fix/security-hardening-2026-11-15`)
- App: http://127.0.0.1:3200
- PostgreSQL: 127.0.0.1:15432 (isolated and bound to loopback)
- Docker Compose project: `vestyhub-windows-local`
- Network: existing Docker `bridge` (no new subnet or network created)
- Docker volume: `vestyhub-windows-local_vestyhub_windows_dev_data`
- No NAS, Prometheus, Loki, Docker socket proxy, or container control enabled

## First start (Windows CMD)

```bat
cd /d D:\Dev\VestyHub
node scripts\setup-local-env.mjs
pnpm install --frozen-lockfile
docker compose --env-file .env.local -f compose.local.yml config --quiet
docker compose --env-file .env.local -f compose.local.yml up -d postgres
docker compose --env-file .env.local -f compose.local.yml ps
pnpm db:migrate
pnpm db:seed
pnpm exec next dev --hostname 127.0.0.1 --port 3200
```

Local administrator email: `admin@vestyhub.local`. The initial random password is
saved as `SEED_ADMIN_PASSWORD` in the gitignored `.env.local` on this PC. It is
not sent to GitHub and must not be printed in logs. After first login, change
the password in the application if supported. If you edit the seed password
later, the seed does not overwrite an existing account password.

For following sessions, run `scripts\start-local.cmd` (or double-click it).
It starts only VestyHub's PostgreSQL, applies migrations/seed, and opens
Next.js in a dedicated CMD window. Close that window with Ctrl+C to stop
Next.js. Use `scripts\stop-local-db.cmd` to stop only PostgreSQL, keeping
the development database volume intact.

In PowerShell, use `Set-Location D:\Dev\VestyHub` in place of `cd /d`.

## Dashboard local V2 — ressources Windows

Le dashboard affiche automatiquement quatre cartes : **CPU**, **RAM**, **Stockage**
et **Services locaux**. Les données sont réelles et actualisées toutes les 15 secondes
(ou immédiatement via le bouton Actualiser).

- CPU : pourcentage mesuré sur 250 ms via les compteurs Windows de Node.js.
- RAM : mémoire utilisée/libre rapportée par Windows, sans agent supplémentaire.
- Stockage : lecteurs système et projet, avec le disque D: prioritaire à l'affichage.
- Services : état HTTP de Next.js et PostgreSQL (2/2 lorsque les deux répondent).

La route `GET /api/local/resources` requiert une session authentifiée et est
**désactivée en production, sur Linux et lorsque le Synology est activé**.
Aucun Docker socket, accès NAS, Prometheus ni collecte de fichiers n'est requis.
Aucun secret ou chemin personnel n'est retourné à la page.

Les anciens widgets **Statut général** et **Diagnostic local** ont été masqués
pour le compte de développement afin d'éviter les doublons. Ils ne sont **pas supprimés** :
cliquer sur _Modifier la disposition_ pour les réactiver. En mode local, le panneau
Docker NAS est masqué plutôt que présenté comme un incident.

Le widget historique Diagnostic local reste disponible pour les autres déploiements.

### Historique CPU / RAM (5 minutes)

Le dashboard affiche un graphique **CPU et RAM** construit uniquement à partir des
mesures réelles du service Windows `/api/local/resources`. Les relevés restent dans la
**mémoire de l'onglet** (aucun localStorage, base de données, fichier, conteneur
ni agent). Le graphique conserve au maximum les cinq dernières minutes et
64 points, en rejetant les mesures erronées, anciennes ou renvoyées plusieurs
fois depuis le cache serveur. Il n'émet **aucune requête supplémentaire**.

L'historique est réinitialisé au rechargement de la page ; un onglet fermé ou
masqué ne collecte pas de données en arrière-plan. Le graphique est purement
informatif et n'est pas un enregistreur de supervision permanente.

### Alertes locales CPU et RAM

La V2 affiche un panneau **Alertes ressources locales**, sous les cartes CPU/RAM.
Les seuils sont réglables depuis le navigateur : **70, 75, 80, 85, 90 ou 95 %**.
Valeurs initiales : **CPU 90 % et RAM 85 %**.

- Une alerte apparaît seulement après **deux relevés réels distincts** atteignant
  le seuil. Un rafraîchissement manuel qui récupère la même mesure mise en cache
  n'est jamais compté deux fois.
- Elle se résout après deux relevés inférieurs d'au moins **5 points** au seuil ;
  une mesure indisponible ne simule pas un retour à la normale.
- Le relevé est effectué toutes les 15 secondes lorsque l'onglet est visible ;
  il est repris à la réouverture de l'onglet.
- Le réglage du seuil est **temporaire (onglet courant)** : aucun paramètre
  serveur ou base de données n'est écrit. Une modification du seuil réinitialise
  les compteurs de confirmation.
- Pas de notification système, d'arrêt de processus ni d'action automatique.
  Le panneau est **informatif**, non prévu pour l'astreinte permanente.

### Processus Windows (Top 5 RAM)

Le dashboard V2 inclut un tableau des 5 processus les plus gourmands en RAM,
avec leur **nom**, **PID**, **mémoire résidente** (working set) et une barre de
comparaison. La route `GET /api/local/processes` est réservée aux sessions
authentifiées, en développement local Windows uniquement, et désactivée sur
le NAS ainsi qu'en production. Elle exécute uniquement `tasklist.exe /FO CSV /NH`
avec des paramètres fixes, sans shell et sans commande de modification.

Le relevé est mis en cache pendant 30 secondes afin de préserver les ressources
Windows, et n'est pas rafraîchi en permanence lorsqu'un onglet est masqué.
Attention : le working set inclut des pages partagées ; ne pas additionner les
valeurs pour obtenir la RAM consommée globalement. Les lignes ne permettent
**pas de terminer un processus**.

## Health checks

```bat
curl.exe --fail http://127.0.0.1:3200/api/health/live
curl.exe --fail http://127.0.0.1:3200/api/health/ready
```

## Stop only the local VestyHub database

```bat
docker compose --env-file .env.local -f compose.local.yml stop postgres
```

Stop Next.js in its own terminal with Ctrl+C. Do not use
`docker compose down --volumes`: this deletes the VestyHub development database.
Do not run `docker compose down` in any other project.

## Diagnostics

```bat
git status --short --branch
docker compose --env-file .env.local -f compose.local.yml ps
docker compose --env-file .env.local -f compose.local.yml logs --tail=50 postgres
pnpm lint
pnpm typecheck
pnpm test:unit
```

On Windows, Next dev may use significant RAM. Keep the terminal process open
only while using the development server. The CI on GitHub already runs the
complete production build.
