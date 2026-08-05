# Phase 3E — Observabilité Synology par SNMPv3

## Objectif

Compléter les données DSM accessibles au compte de service `vestyhub` sans lui accorder de privilèges administrateur. Les informations système restent collectées via DSM WebAPI ; les disques, volumes et états RAID sont collectés via SNMPv3, puis exposés à Prometheus par `snmp_exporter`.

## Architecture

```text
DSM WebAPI
├── identité et version DSM
├── disponibilité
├── CPU
└── mémoire

Synology SNMPv3 (UDP/161, authPriv)
└── snmp_exporter
    └── Prometheus job synology-snmp
        ├── système
        ├── disques
        ├── RAID / volumes
        └── I/O stockage
```

Le conteneur `snmp-exporter` appartient à deux réseaux :

- `backend`, réseau interne utilisé par Prometheus ;
- `monitoring-egress`, réseau dédié permettant uniquement au collecteur SNMP de joindre le NAS sur le LAN.

Aucun port HTTP de `snmp-exporter` n’est publié sur l’hôte.

## Versions

- `prom/snmp-exporter:v0.30.1` ;
- module officiel `synology` fourni dans l’image ;
- authentification séparée dans `deploy/snmp-exporter/auth.yml`.

## Configuration DSM

Dans **Panneau de configuration → Terminal et SNMP → SNMP** :

1. activer le service SNMP ;
2. activer SNMPv3 ;
3. créer un identifiant SNMP dédié ;
4. sélectionner le protocole d’authentification **SHA** ;
5. activer la confidentialité SNMP ;
6. sélectionner le protocole de confidentialité **AES** ;
7. utiliser deux mots de passe longs et distincts ;
8. appliquer la configuration.

Les mots de passe doivent respecter les contraintes DSM : 8 à 127 caractères, sans espace ni les caractères `"`, `'` ou `\`.

## Variables locales

```dotenv
SNMPV3_USERNAME=
SNMPV3_AUTH_PASSWORD=
SNMPV3_PRIV_PASSWORD=
```

Ces variables sont transmises uniquement au conteneur `snmp-exporter`. Elles ne sont pas transmises à l’application Next.js et ne doivent jamais être committées.

## Cible

Le job Prometheus `synology-snmp` cible actuellement le NAS local :

```text
192.168.1.5:161/udp
```

La cible est définie dans `deploy/prometheus/prometheus.yml`. Le scrape HTTP s’effectue vers `snmp-exporter:9116`, qui agit comme proxy SNMP.

## Démarrage

```powershell
docker compose --profile monitoring up -d snmp-exporter prometheus
```

Ne pas exécuter `docker compose config` après avoir chargé les secrets dans l’environnement si la sortie doit être copiée ou partagée : Compose développe les variables d’environnement dans sa sortie.

## Validation

### Conteneurs

```powershell
docker compose --profile monitoring ps snmp-exporter prometheus
docker compose logs --tail=100 snmp-exporter
docker compose logs --tail=100 prometheus
```

### Cibles Prometheus

Depuis le conteneur Prometheus :

```powershell
docker exec vestyhub-prometheus-1 wget -qO- `
  "http://127.0.0.1:9090/api/v1/targets?state=active"
```

La cible `synology-snmp` doit avoir `health: "up"`.

### Métriques Synology

```powershell
docker exec vestyhub-prometheus-1 wget -qO- `
  "http://127.0.0.1:9090/api/v1/query?query=up%7Bjob%3D%22synology-snmp%22%7D"
```

La valeur attendue est `1`.

Les premières métriques à inspecter sont :

```text
systemStatus
 temperature
 diskStatus
 diskTemperature
 diskHealthStatus
 raidStatus
 raidFreeSize
 raidTotalSize
 storageIOLA
 spaceIOLA
```

## Sécurité

- SNMPv1 et SNMPv2c ne sont pas nécessaires ;
- SNMPv3 utilise `authPriv` avec SHA et AES ;
- aucun secret SNMP dans Prometheus ou VestyHub ;
- aucun port `9116` publié sur l’hôte ;
- aucun accès aux dossiers partagés DSM ;
- aucune permission supplémentaire accordée au compte WebAPI `vestyhub` ;
- collecte en lecture seule uniquement.

## Étape suivante

Après validation réelle des noms de métriques retournés par le DS920+, VestyHub pourra normaliser les séries `disk*` et `raid*` en objets `NasDisk`, `NasVolume` et `NasStoragePool` dans le mode `hybrid`.
