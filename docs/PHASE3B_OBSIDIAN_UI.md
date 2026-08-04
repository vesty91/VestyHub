# Phase 3B — Fondation UI Obsidian

## Objectif

Moderniser l’interface de VestyHub en reprenant les meilleures idées visuelles de `sysctrl-home`, sans migrer vers TanStack Start, Supabase, Bun, Nitro ou Recharts.

VestyHub conserve comme socle :

- Next.js App Router ;
- PostgreSQL 17 et Drizzle ORM ;
- authentification serveur et RBAC ;
- connecteurs NAS/Docker réels ;
- Docker Compose durci ;
- Vitest, Playwright et GitHub Actions ;
- ECharts, GridStack, React Flow et TanStack Table.

## Périmètre de la première livraison

### 1. Cohérence de version

- remplacer les mentions visibles `Phase 2` par `Phase 3A · v0.3.0` ;
- remplacer les tags d’image Docker par défaut basés sur `phase2` par une valeur cohérente avec `v0.3.0` ;
- ne pas modifier la version `0.3.0` du package pendant cette phase.

### 2. Système de thèmes

Créer une fondation compatible avec `next-themes` et les variables CSS existantes.

Thèmes prévus :

- Obsidian ;
- Midnight ;
- Graphite ;
- Carbon Gold ;
- Light.

Contraintes :

- aucun flash de thème au chargement ;
- préférence persistée côté navigateur ;
- contraste accessible ;
- respect de `prefers-reduced-motion` ;
- aucune couleur métier codée directement dans les composants lorsque des tokens sémantiques conviennent.

### 3. Primitives visuelles

Créer des composants VestyHub natifs inspirés de la structure de `sysctrl-home`, sans recopier son architecture :

- `PageHeader` ;
- `Panel` ;
- `PanelHeader` ;
- `StatCard` ;
- `StatusDot`.

Ces composants doivent utiliser les composants UI et tokens déjà présents dans VestyHub.

### 4. Migration du dashboard

Refactoriser progressivement `/dashboard` avec les nouvelles primitives, tout en conservant :

- les vraies requêtes PostgreSQL ;
- le connecteur Docker NAS ;
- les contrôles d’accès serveur ;
- les états d’erreur et d’indisponibilité ;
- le responsive actuel.

Aucune donnée fictive ne doit être introduite.

### 5. Sélecteur de thème

Ajouter dans `/settings` un sélecteur visuel des cinq thèmes avec :

- aperçu compact ;
- nom du thème ;
- indication du thème actif ;
- navigation clavier ;
- persistance immédiate.

## Hors périmètre

Cette première livraison ne doit pas :

- remplacer Next.js ;
- introduire Supabase ;
- remplacer PostgreSQL/Drizzle ;
- intégrer `demo-data.ts` ;
- ajouter Nitro ou une dépendance bêta ;
- remplacer ECharts par Recharts ;
- réécrire les pages Docker/NAS fonctionnelles ;
- activer des actions Docker destructives.

## Qualité obligatoire

Avant tout commit :

```powershell
pnpm format
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
docker compose config --quiet
```

Le travail doit rester sur la branche :

```text
feat/phase3b-obsidian-ui-foundation
```

Aucune fusion dans `main` avant validation visuelle locale et CI verte.

## Critères d’acceptation

- les cinq thèmes fonctionnent et persistent après rechargement ;
- le dashboard utilise les nouvelles primitives sans perdre de données réelles ;
- l’affichage clair/sombre reste lisible ;
- les tests existants restent verts ;
- le build Docker reste fonctionnel ;
- aucun secret, donnée Docker brute ou donnée Supabase n’est ajouté ;
- la CI GitHub est entièrement verte.
