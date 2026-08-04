# Phase 3C — Monitoring et observabilité réels

## Statut

- Branche : `feat/phase3c-monitoring-observability`
- Base : `main`
- État : cadrage initial
- Version cible indicative : `v0.5.0`
- Fusion interdite avant validation locale, validation NAS et CI verte

## Objectif

Remplacer la page de préparation `/monitoring` par une interface d’observabilité réellement alimentée par les services du homelab :

- Prometheus pour les métriques ;
- Loki pour les journaux ;
- Alertmanager pour les alertes ;
- ECharts pour les graphiques ;
- les composants et thèmes VestyHub introduits en Phase 3B.

La Phase 3C ne doit introduire aucune donnée de démonstration et ne doit exposer aucune opération d’écriture sur l’infrastructure supervisée.

## Base technique existante

VestyHub possède déjà :

- les variables d’environnement et timeouts pour Prometheus, Loki et Alertmanager ;
- un profil Docker Compose `monitoring` avec Prometheus, node-exporter, cAdvisor, Loki, Alloy et Alertmanager ;
- un réseau `backend` interne ;
- ECharts, TanStack Query, Zod et Vitest ;
- une page `/monitoring` qui affiche actuellement uniquement l’état de configuration des sources.

## Principes obligatoires

1. **Lecture seule stricte**
   - requêtes HTTP `GET` uniquement vers Prometheus, Loki et Alertmanager ;
   - aucune modification de règles, silence, configuration ou cible ;
   - aucun endpoint proxy générique permettant de choisir librement une URL distante.

2. **Accès uniquement côté serveur**
   - les URL internes des services ne sont jamais envoyées au navigateur ;
   - le navigateur appelle uniquement les routes VestyHub ;
   - les connecteurs utilisent `assertServerOnly`.

3. **Pas de requête arbitraire fournie par le client**
   - catalogue de métriques et requêtes défini côté serveur ;
   - paramètres utilisateur limités à des identifiants connus, périodes, pagination et filtres validés ;
   - aucun PromQL ou LogQL libre transmis depuis le navigateur dans ce lot.

4. **Dégradation contrôlée**
   - Prometheus, Loki ou Alertmanager peuvent être indisponibles indépendamment ;
   - une source en panne ne doit pas faire tomber la page entière ;
   - affichage explicite des données périmées, partielles ou indisponibles.

5. **Aucun secret dans les logs**
   - ne jamais journaliser URL contenant des identifiants, headers d’autorisation ou contenu sensible ;
   - messages d’erreur normalisés côté client ;
   - détails techniques réservés aux logs serveur et sanitizés.

## Périmètre fonctionnel

### 1. Vue d’ensemble `/monitoring`

Afficher :

- état de Prometheus, Loki et Alertmanager ;
- CPU global ;
- mémoire utilisée ;
- occupation des systèmes de fichiers ;
- débit réseau entrant et sortant ;
- nombre de conteneurs actifs ;
- conteneurs consommant le plus de CPU et de RAM ;
- alertes actives par niveau ;
- volume de logs ou erreurs récentes lorsque les labels disponibles le permettent.

Périodes supportées :

- `1h` ;
- `6h` ;
- `24h` ;
- `7d`.

Les pas de requête sont calculés côté serveur pour limiter le nombre de points.

### 2. Journaux `/monitoring/logs`

Fonctions :

- lecture des logs depuis Loki ;
- période limitée ;
- pagination ou chargement progressif borné ;
- filtre par conteneur ou service à partir de labels connus ;
- niveaux `debug`, `info`, `warn`, `error` seulement si les labels ou le contenu permettent une normalisation fiable ;
- recherche textuelle limitée, échappée et bornée ;
- affichage du timestamp, de la source, du niveau et du message ;
- aucune exportation massive dans le premier lot.

Limites initiales recommandées :

- maximum 500 lignes par appel ;
- période maximale 24 heures pour une recherche textuelle ;
- taille maximale de filtre 200 caractères ;
- timeout issu de `LOKI_TIMEOUT_MS`.

### 3. Alertes `/monitoring/alerts`

Afficher :

- alertes `firing` et `pending` ;
- sévérité ;
- nom ;
- résumé ;
- source ;
- date de début ;
- labels utiles ;
- lien vers la ressource VestyHub concernée lorsque la correspondance est certaine.

Ne pas ajouter dans ce lot :

- création de silence ;
- acquittement ;
- modification de routes ;
- modification de règles.

### 4. API interne VestyHub

Routes proposées :

- `GET /api/monitoring/overview?range=1h`
- `GET /api/monitoring/metrics?metric=<catalog-id>&range=1h`
- `GET /api/monitoring/logs?range=1h&source=<label>&query=<text>&cursor=<cursor>`
- `GET /api/monitoring/alerts`
- `GET /api/monitoring/health`

Chaque route doit :

- exiger une session authentifiée ;
- valider les paramètres avec Zod ;
- imposer un timeout ;
- retourner un contrat JSON versionné et typé ;
- utiliser des erreurs publiques stables ;
- définir `Cache-Control: private, no-store` pour les données sensibles ou en temps réel.

## Architecture proposée

```text
src/connectors/monitoring/
  types.ts
  errors.ts
  http.ts
  range.ts
  prometheus/
    client.ts
    schemas.ts
    catalog.ts
    normalize.ts
  loki/
    client.ts
    schemas.ts
    normalize.ts
  alertmanager/
    client.ts
    schemas.ts
    normalize.ts

src/lib/monitoring/
  overview.ts
  service.ts
  cache.ts

src/app/api/monitoring/
  health/route.ts
  overview/route.ts
  metrics/route.ts
  logs/route.ts
  alerts/route.ts

src/app/(dashboard)/monitoring/
  page.tsx
  logs/page.tsx
  alerts/page.tsx

src/components/monitoring/
  monitoring-header.tsx
  source-status.tsx
  metric-card.tsx
  time-range-selector.tsx
  time-series-chart.tsx
  log-viewer.tsx
  alert-list.tsx
  partial-data-notice.tsx
```

Cette arborescence est indicative. Elle doit être adaptée aux conventions déjà utilisées dans le dépôt.

## Contrats de données

### État d’une source

```ts
type MonitoringSourceStatus = {
  source: "prometheus" | "loki" | "alertmanager";
  configured: boolean;
  available: boolean;
  latencyMs?: number;
  checkedAt: string;
  errorCode?: "NOT_CONFIGURED" | "TIMEOUT" | "UNREACHABLE" | "INVALID_RESPONSE";
};
```

### Série temporelle normalisée

```ts
type TimeSeries = {
  id: string;
  label: string;
  unit: "percent" | "bytes" | "bytes_per_second" | "count" | "seconds";
  points: Array<{ timestamp: number; value: number }>;
};
```

### Réponse partielle

```ts
type MonitoringOverview = {
  generatedAt: string;
  range: "1h" | "6h" | "24h" | "7d";
  sources: MonitoringSourceStatus[];
  metrics: Record<string, TimeSeries[]>;
  alerts: {
    firing: number;
    pending: number;
    bySeverity: Record<string, number>;
  } | null;
  warnings: Array<{
    source: "prometheus" | "loki" | "alertmanager";
    code: string;
    message: string;
  }>;
};
```

Les schémas réels doivent être validés par Zod à la frontière des connecteurs.

## Catalogue Prometheus

Les requêtes doivent être centralisées côté serveur et référencées par identifiant stable.

Catalogue initial suggéré :

- `host.cpu.usage`
- `host.memory.usage`
- `host.filesystem.usage`
- `host.network.receive`
- `host.network.transmit`
- `docker.containers.running`
- `docker.cpu.top`
- `docker.memory.top`
- `targets.up`

Le catalogue doit gérer l’absence de séries ou les différences de labels sans produire de valeurs fictives.

## Résilience et performance

### Timeouts

Utiliser strictement :

- `PROMETHEUS_TIMEOUT_MS` ;
- `LOKI_TIMEOUT_MS` ;
- `ALERTMANAGER_TIMEOUT_MS`.

Les requêtes utilisent `AbortController` et libèrent toujours leurs ressources.

### Cache

Cache serveur court et borné :

- santé des sources : 10 à 15 secondes ;
- vue d’ensemble : 10 à 30 secondes ;
- historique `7d` : jusqu’à 60 secondes ;
- aucune persistance de logs bruts en PostgreSQL dans ce lot.

Le cache ne doit pas mélanger des configurations ou des utilisateurs lorsque les réponses deviennent personnalisées.

### Circuit breaker

Un circuit breaker léger peut être ajouté si nécessaire :

- seuil d’échecs consécutifs ;
- fenêtre de récupération courte ;
- état local au processus ;
- aucune dépendance externe obligatoire.

Il ne doit jamais masquer indéfiniment le retour d’un service.

## Sécurité

- vérifier que les URL configurées sont des URL HTTP(S) valides ;
- ne jamais accepter une URL complète dans les paramètres d’API ;
- empêcher les redirections vers un autre hôte ;
- limiter taille et durée des réponses ;
- normaliser et borner tous les tableaux ;
- sanitiser les labels affichés ;
- ne pas rendre du HTML provenant des logs ;
- conserver `DOCKER_CONTROL_ENABLED=false` ;
- ne pas modifier le proxy Docker ;
- ne pas exposer les ports des services de monitoring sur l’hôte par défaut ;
- conserver le réseau `backend` interne.

## Interface utilisateur

Réutiliser :

- `PageHeader` ;
- `Panel` ;
- `PanelHeader` ;
- `StatCard` ;
- `StatusDot` ;
- les cinq thèmes VestyHub ;
- ECharts pour les séries temporelles.

Exigences :

- responsive ordinateur, tablette et mobile ;
- navigation clavier ;
- texte alternatif et libellés accessibles ;
- graphiques lisibles dans les cinq thèmes ;
- tableau ou résumé textuel accessible en complément des graphiques ;
- respect de `prefers-reduced-motion` ;
- états chargement, vide, partiel, périmé et erreur distincts ;
- aucune couleur cyan codée en dur.

## Tests obligatoires

### Unitaires

- validation des périodes et calcul du pas ;
- validation des réponses Prometheus ;
- normalisation des matrices et vecteurs ;
- absence de valeurs `NaN` ou infinies ;
- validation des réponses Loki ;
- échappement des filtres ;
- limites de lignes ;
- validation des alertes ;
- mapping des erreurs publiques ;
- timeout et annulation ;
- réponses partielles lorsque l’une des sources échoue.

### Routes API

- authentification obligatoire ;
- paramètres invalides rejetés ;
- aucune URL arbitraire acceptée ;
- réponse partielle correcte ;
- headers de cache corrects ;
- erreurs sans secret.

### Composants

- sélection de période accessible ;
- état indisponible ;
- état données partielles ;
- rendu sans série ;
- liste d’alertes ;
- viewer de logs sans injection HTML.

### Intégration

Utiliser MSW ou des fixtures locales pour simuler les réponses des trois services. Les tests CI ne doivent pas dépendre du NAS ni d’Internet.

## Validation locale obligatoire

Exécuter dans cet ordre :

```bash
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
docker compose config --quiet
```

Puis avec le profil monitoring :

```bash
docker compose --profile monitoring config --quiet
docker compose --profile monitoring up -d
```

Ne jamais utiliser `docker compose down -v`.

Vérifications manuelles :

- `/monitoring` ;
- `/monitoring/logs` ;
- `/monitoring/alerts` ;
- fonctionnement des quatre périodes ;
- persistance du thème ;
- comportement lorsque chaque source est arrêtée séparément ;
- absence d’URL interne dans le HTML ou le JSON navigateur ;
- responsive ;
- lecture seule confirmée.

## Critères d’acceptation

La Phase 3C est terminée lorsque :

- les trois sources utilisent des données réelles ;
- aucune donnée de démonstration n’est présente ;
- les métriques principales sont affichées avec ECharts ;
- les logs Loki sont consultables avec des limites strictes ;
- les alertes sont visibles sans action d’écriture ;
- une panne partielle est clairement affichée sans erreur globale ;
- tous les paramètres sont validés ;
- aucun secret ni endpoint interne n’est exposé au navigateur ;
- la CI est verte ;
- la validation locale sur le NAS est réussie ;
- la PR est relue puis explicitement autorisée à être fusionnée.

## Hors périmètre

- modification de règles Prometheus ;
- création de silences Alertmanager ;
- actions Docker ;
- terminal ou exécution de commandes ;
- ingestion directe de logs par VestyHub ;
- stockage durable des métriques dans PostgreSQL ;
- requêtes PromQL ou LogQL libres depuis le navigateur ;
- connecteur DSM détaillé, réservé à la Phase 3D ;
- drag-and-drop GridStack, réservé à une phase ultérieure.
