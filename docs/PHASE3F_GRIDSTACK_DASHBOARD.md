# Phase 3F — Dashboard GridStack personnalisable

## Objectif

La Phase 3F transforme la grille statique du dashboard VestyHub en disposition interactive tout en conservant le rendu serveur, PostgreSQL et les connecteurs réels déjà en place.

Les widgets peuvent être déplacés et redimensionnés sur desktop. Leur disposition est persistée dans `dashboard_widgets` et restaurée au prochain chargement.

## Architecture

Le Server Component `src/app/(dashboard)/dashboard/page.tsx` reste responsable du chargement :

- utilisateur authentifié ;
- dashboard PostgreSQL ;
- métadonnées des widgets ;
- favoris ;
- état Docker réel.

La couche cliente `src/components/dashboard/gridstack-dashboard.tsx` reçoit uniquement les métadonnées de placement et les contenus déjà construits par React.

GridStack utilise une grille desktop de 6 colonnes compatible avec les dimensions historiques de `dashboard_widgets`.

Le mode `float: true` est activé sur desktop afin de conserver une position verticale choisie par l'utilisateur et d'autoriser des espaces libres dans la grille, au lieu de forcer systématiquement les widgets à se compacter vers le haut après un déplacement.

## Responsive

- desktop : 6 colonnes ;
- tablette : 3 colonnes ;
- mobile : 1 colonne en liste verticale.

Les changements générés uniquement par le passage à 3 ou 1 colonne ne sont pas persistés. La disposition desktop reste la source de vérité enregistrée. GridStack conserve ses dispositions par nombre de colonnes afin de restaurer la grille large lors du retour sur desktop.

## Persistance

Endpoint :

```text
PATCH /api/dashboard/layout
```

Payload :

```json
{
  "dashboardId": "uuid",
  "widgets": [
    {
      "id": "uuid",
      "x": 0,
      "y": 0,
      "width": 2,
      "height": 1
    }
  ]
}
```

Le client :

1. normalise les valeurs GridStack ;
2. ignore les sauvegardes hors grille desktop 6 colonnes ;
3. calcule une empreinte stable de la disposition ;
4. ignore un état identique au dernier état enregistré ;
5. lit la disposition finale après `dragstop` ou `resizestop` ;
6. sérialise les écritures afin qu'une requête ancienne ne puisse pas écraser un déplacement plus récent ;
7. utilise `keepalive` pour réduire le risque qu'un rechargement immédiat interrompe la sauvegarde.

## Sécurité

La route de sauvegarde :

- exige une session locale valide ;
- valide le payload avec Zod ;
- borne les coordonnées, tailles, hauteur maximale et nombre de widgets ;
- refuse les identifiants dupliqués ;
- vérifie que le dashboard appartient à l'utilisateur courant ;
- vérifie que chaque widget appartient au dashboard ;
- vérifie les contraintes `minWidth` et `minHeight` stockées en base ;
- effectue les vérifications et mises à jour dans une transaction PostgreSQL ;
- met à jour `updatedAt` ;
- renvoie `Cache-Control: private, no-store`.

Aucune URL, configuration arbitraire ou propriété supplémentaire n'est enregistrée depuis le navigateur.

## UX et accessibilité

Chaque widget dispose d'une poignée dédiée avec une icône `GripVertical`. Le reste du contenu conserve ses interactions normales : liens, boutons et contrôles ne servent pas de surface de drag.

Un statut discret indique :

- `Enregistrement…` ;
- `Disposition enregistrée` ;
- une erreur en cas d'échec réseau.

Une erreur de sauvegarde ne remet pas immédiatement la grille visuelle à son ancienne position.

## Validation automatique

Les tests de `src/lib/dashboard/layout.test.ts` couvrent :

- payload valide ;
- dépassement des 6 colonnes ;
- coordonnées et tailles invalides ;
- widgets dupliqués ;
- nombre maximum de widgets ;
- normalisation GridStack ;
- empreinte stable de disposition.

Validation complète à exécuter :

```powershell
pnpm format
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test:unit
pnpm build
```

## Validation manuelle

Après déploiement Docker :

1. ouvrir `/dashboard` sur desktop ;
2. déplacer chaque widget depuis sa poignée ;
3. laisser volontairement une ligne libre au-dessus d'un widget et vérifier qu'il reste à la position choisie ;
4. redimensionner les widgets ;
5. attendre l'état `Disposition enregistrée` ;
6. recharger la page et vérifier la restauration exacte ;
7. passer en largeur tablette puis mobile ;
8. revenir en desktop et vérifier que la disposition desktop n'a pas été remplacée par la version mobile ;
9. tester les liens et boutons internes aux widgets ;
10. vérifier les cinq thèmes : Obsidian, Midnight, Graphite, Carbon Gold et Light ;
11. vérifier `/api/health/ready` après reconstruction Docker.

## Déploiement Docker

Une fois le commit validé sur la branche :

```powershell
docker compose build app
docker compose up -d --no-deps app
docker compose ps
```

Puis contrôler :

```powershell
Invoke-WebRequest http://127.0.0.1:3000/api/health/ready -UseBasicParsing
```

Cette phase ne nécessite pas de migration SQL : les colonnes de placement existent déjà dans `dashboard_widgets`.
