# MCP pour Cursor

## Recommandés

- **Context7** : documentation correspondant aux versions du projet.
- **Playwright MCP** : validation de l’interface, console, réseau, responsive et accessibilité.
- **GitHub MCP** : dépôt, PR, issues et CI, de préférence en lecture seule.
- **Grafana MCP** : uniquement avec un service account Viewer.

## Interdits pour la production

- MCP PostgreSQL connecté à la base VestyHub de production.
- MCP disposant de `/var/run/docker.sock`.
- Token GitHub, Grafana ou DSM enregistré dans `.cursor/mcp.json` commité.

La règle `.cursor/rules/mcp-usage.mdc` formalise ces restrictions. La configuration MCP peut rester globale dans Cursor afin d’éviter les doublons et les secrets dans le dépôt.
