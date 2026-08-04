import {
  Activity,
  AppWindow,
  Archive,
  Bell,
  BookOpen,
  Bot,
  Box,
  Boxes,
  BrainCircuit,
  Braces,
  Cable,
  CalendarDays,
  Camera,
  ChartNoAxesCombined,
  ChartSpline,
  CircleDot,
  CircleGauge,
  Clock3,
  Cloud,
  CloudCog,
  CloudDownload,
  CloudUpload,
  Code2,
  Cog,
  Container,
  Cpu,
  Database,
  DatabaseBackup,
  Download,
  ExternalLink,
  File,
  FileArchive,
  FileDown,
  Film,
  Fingerprint,
  Folder,
  FolderOpen,
  Gamepad2,
  Gauge,
  GitBranch,
  Globe2,
  HardDrive,
  Headphones,
  HeartPulse,
  Home,
  Image,
  KeyRound,
  Laptop,
  Lightbulb,
  Link,
  Lock,
  Mail,
  MapPin,
  MessageSquare,
  Monitor,
  Music,
  Network,
  Package,
  Plug,
  Printer,
  Radio,
  RefreshCw,
  RotateCcw,
  Router,
  Search,
  Server,
  ServerCog,
  Settings,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Star,
  Tablet,
  Terminal,
  Thermometer,
  Tv,
  Upload,
  Users,
  Video,
  Webhook,
  Wifi,
  Workflow,
  Wrench,
  Zap,
  type LucideIcon,
  type LucideProps,
} from "lucide-react";

export const serviceIconRegistry = {
  activity: Activity,
  "app-window": AppWindow,
  archive: Archive,
  bell: Bell,
  "book-open": BookOpen,
  bot: Bot,
  box: Box,
  boxes: Boxes,
  "brain-circuit": BrainCircuit,
  braces: Braces,
  cable: Cable,
  "calendar-days": CalendarDays,
  camera: Camera,
  "chart-no-axes-combined": ChartNoAxesCombined,
  "chart-spline": ChartSpline,
  "circle-gauge": CircleGauge,
  "clock-3": Clock3,
  cloud: Cloud,
  "cloud-cog": CloudCog,
  "cloud-download": CloudDownload,
  "cloud-upload": CloudUpload,
  "code-2": Code2,
  cog: Cog,
  container: Container,
  cpu: Cpu,
  database: Database,
  "database-backup": DatabaseBackup,
  download: Download,
  "external-link": ExternalLink,
  file: File,
  "file-archive": FileArchive,
  "file-down": FileDown,
  film: Film,
  fingerprint: Fingerprint,
  folder: Folder,
  "folder-open": FolderOpen,
  "gamepad-2": Gamepad2,
  gauge: Gauge,
  github: GitBranch,
  "git-branch": GitBranch,
  globe: Globe2,
  "globe-2": Globe2,
  "hard-drive": HardDrive,
  headphones: Headphones,
  "heart-pulse": HeartPulse,
  home: Home,
  image: Image,
  key: KeyRound,
  "key-round": KeyRound,
  laptop: Laptop,
  lightbulb: Lightbulb,
  link: Link,
  lock: Lock,
  mail: Mail,
  "map-pin": MapPin,
  message: MessageSquare,
  "message-square": MessageSquare,
  monitor: Monitor,
  music: Music,
  network: Network,
  package: Package,
  plug: Plug,
  printer: Printer,
  radio: Radio,
  refresh: RefreshCw,
  "refresh-cw": RefreshCw,
  restore: RotateCcw,
  "rotate-ccw": RotateCcw,
  router: Router,
  search: Search,
  server: Server,
  "server-cog": ServerCog,
  settings: Settings,
  "shield-alert": ShieldAlert,
  "shield-check": ShieldCheck,
  smartphone: Smartphone,
  sparkles: Sparkles,
  star: Star,
  tablet: Tablet,
  terminal: Terminal,
  thermometer: Thermometer,
  tv: Tv,
  upload: Upload,
  users: Users,
  video: Video,
  webhook: Webhook,
  wifi: Wifi,
  workflow: Workflow,
  wrench: Wrench,
  zap: Zap,
} as const satisfies Record<string, LucideIcon>;

export type ServiceIconName = keyof typeof serviceIconRegistry;

export type ServiceIconOption = {
  name: ServiceIconName;
  label: string;
  keywords?: readonly string[];
};

export type ServiceIconCategory = {
  id: string;
  label: string;
  icons: readonly ServiceIconOption[];
};

export const serviceIconCategories: readonly ServiceIconCategory[] = [
  {
    id: "navigation",
    label: "Navigation et Web",
    icons: [
      { name: "globe-2", label: "Globe", keywords: ["web", "internet", "site"] },
      { name: "home", label: "Accueil", keywords: ["maison", "homepage"] },
      { name: "link", label: "Lien", keywords: ["url", "raccourci"] },
      { name: "external-link", label: "Lien externe", keywords: ["wan", "sortie"] },
      { name: "app-window", label: "Application Web", keywords: ["interface", "app"] },
      { name: "map-pin", label: "Localisation", keywords: ["lieu", "adresse"] },
    ],
  },
  {
    id: "servers",
    label: "Serveurs et appareils",
    icons: [
      { name: "server", label: "Serveur", keywords: ["hôte", "machine"] },
      { name: "server-cog", label: "Serveur administré", keywords: ["configuration"] },
      { name: "monitor", label: "Ordinateur", keywords: ["pc", "desktop"] },
      { name: "laptop", label: "Portable", keywords: ["notebook"] },
      { name: "smartphone", label: "Smartphone", keywords: ["mobile", "téléphone"] },
      { name: "tablet", label: "Tablette", keywords: ["ipad"] },
      { name: "cpu", label: "Processeur", keywords: ["cpu", "matériel"] },
      {
        name: "plug",
        label: "Équipement connecté",
        keywords: ["prise", "alimentation"],
      },
    ],
  },
  {
    id: "docker",
    label: "Docker et applications",
    icons: [
      { name: "container", label: "Conteneur Docker", keywords: ["docker", "container"] },
      { name: "boxes", label: "Pile de services", keywords: ["stack", "compose"] },
      { name: "package", label: "Paquet", keywords: ["image", "application"] },
      { name: "box", label: "Application", keywords: ["service"] },
      { name: "archive", label: "Archive", keywords: ["zip", "sauvegarde"] },
      { name: "file-archive", label: "Fichier archivé", keywords: ["zip", "rar"] },
    ],
  },
  {
    id: "storage",
    label: "Stockage et données",
    icons: [
      { name: "hard-drive", label: "Disque", keywords: ["nas", "stockage", "ssd"] },
      { name: "database", label: "Base de données", keywords: ["sql", "postgres"] },
      {
        name: "database-backup",
        label: "Sauvegarde de base",
        keywords: ["backup", "dump"],
      },
      { name: "folder", label: "Dossier", keywords: ["répertoire", "partage"] },
      {
        name: "folder-open",
        label: "Dossier ouvert",
        keywords: ["fichiers", "explorateur"],
      },
      { name: "file", label: "Fichier", keywords: ["document"] },
      { name: "cloud", label: "Cloud", keywords: ["nuage", "distant"] },
      {
        name: "cloud-cog",
        label: "Cloud administré",
        keywords: ["configuration", "saas"],
      },
    ],
  },
  {
    id: "downloads",
    label: "Téléchargements et transferts",
    icons: [
      {
        name: "download",
        label: "Téléchargement",
        keywords: ["download", "descendre"],
      },
      { name: "cloud-download", label: "Téléchargement cloud", keywords: ["nuage"] },
      { name: "file-down", label: "Fichier téléchargé", keywords: ["document"] },
      { name: "upload", label: "Envoi", keywords: ["upload", "transfert"] },
      {
        name: "cloud-upload",
        label: "Envoi cloud",
        keywords: ["nuage", "synchronisation"],
      },
      {
        name: "refresh-cw",
        label: "Synchronisation",
        keywords: ["sync", "mise Ò  jour"],
      },
      { name: "rotate-ccw", label: "Restauration", keywords: ["restore", "retour"] },
      {
        name: "workflow",
        label: "Flux de transfert",
        keywords: ["pipeline", "automatisation"],
      },
    ],
  },
  {
    id: "network",
    label: "Réseau",
    icons: [
      { name: "network", label: "Réseau", keywords: ["lan", "topologie"] },
      { name: "router", label: "Routeur", keywords: ["gateway", "box"] },
      { name: "wifi", label: "Wi-Fi", keywords: ["sans fil", "wlan"] },
      { name: "cable", label: "Câble réseau", keywords: ["ethernet", "rj45"] },
      { name: "webhook", label: "Webhook", keywords: ["api", "événement"] },
      { name: "globe", label: "Internet", keywords: ["wan", "public"] },
    ],
  },
  {
    id: "security",
    label: "Sécurité et identité",
    icons: [
      {
        name: "shield-check",
        label: "Sécurité validée",
        keywords: ["protection", "ok"],
      },
      {
        name: "shield-alert",
        label: "Alerte sécurité",
        keywords: ["danger", "incident"],
      },
      { name: "lock", label: "Verrouillage", keywords: ["privé", "sécurisé"] },
      {
        name: "key-round",
        label: "Clé d’accès",
        keywords: ["mot de passe", "token"],
      },
      {
        name: "fingerprint",
        label: "Empreinte",
        keywords: ["identité", "authentification"],
      },
      { name: "users", label: "Utilisateurs", keywords: ["comptes", "groupe"] },
    ],
  },
  {
    id: "monitoring",
    label: "Monitoring et alertes",
    icons: [
      { name: "activity", label: "Activité", keywords: ["monitoring", "métrique"] },
      { name: "heart-pulse", label: "État de santé", keywords: ["health", "uptime"] },
      { name: "gauge", label: "Jauge", keywords: ["performance", "vitesse"] },
      { name: "circle-gauge", label: "Tableau de bord", keywords: ["dashboard"] },
      {
        name: "chart-no-axes-combined",
        label: "Graphique",
        keywords: ["courbe", "statistiques"],
      },
      {
        name: "chart-spline",
        label: "Série temporelle",
        keywords: ["historique", "prometheus"],
      },
      { name: "bell", label: "Alerte", keywords: ["notification", "alarme"] },
      { name: "clock-3", label: "Temps et historique", keywords: ["horloge", "durée"] },
    ],
  },
  {
    id: "media",
    label: "Multimédia",
    icons: [
      { name: "film", label: "Films", keywords: ["cinéma", "plex"] },
      { name: "video", label: "Vidéo", keywords: ["streaming"] },
      { name: "music", label: "Musique", keywords: ["audio"] },
      { name: "headphones", label: "Audio", keywords: ["casque", "podcast"] },
      { name: "image", label: "Images", keywords: ["photo", "galerie"] },
      { name: "tv", label: "Télévision", keywords: ["iptv", "écran"] },
      { name: "radio", label: "Radio", keywords: ["diffusion"] },
      { name: "gamepad-2", label: "Jeux", keywords: ["gaming", "console"] },
    ],
  },
  {
    id: "development",
    label: "Développement et IA",
    icons: [
      { name: "code-2", label: "Code", keywords: ["développement", "source"] },
      { name: "terminal", label: "Terminal", keywords: ["shell", "console"] },
      { name: "github", label: "GitHub", keywords: ["git", "dépôt"] },
      { name: "git-branch", label: "Branche Git", keywords: ["version", "commit"] },
      { name: "braces", label: "API et JSON", keywords: ["code", "données"] },
      { name: "bot", label: "Robot", keywords: ["automatisation", "agent"] },
      {
        name: "brain-circuit",
        label: "Intelligence artificielle",
        keywords: ["ia", "llm"],
      },
      { name: "sparkles", label: "Génération IA", keywords: ["magie", "assistant"] },
    ],
  },
  {
    id: "tools",
    label: "Domotique et outils",
    icons: [
      { name: "camera", label: "Caméra", keywords: ["surveillance", "vidéo"] },
      { name: "lightbulb", label: "Éclairage", keywords: ["lumière", "domotique"] },
      { name: "thermometer", label: "Température", keywords: ["capteur", "climat"] },
      { name: "zap", label: "Énergie", keywords: ["électricité", "puissance"] },
      { name: "wrench", label: "Outils", keywords: ["maintenance", "réparation"] },
      { name: "settings", label: "Paramètres", keywords: ["configuration"] },
      { name: "cog", label: "Service système", keywords: ["processus", "réglage"] },
      { name: "printer", label: "Imprimante", keywords: ["impression"] },
      { name: "search", label: "Recherche", keywords: ["index", "scan"] },
      { name: "calendar-days", label: "Calendrier", keywords: ["planning", "agenda"] },
      { name: "book-open", label: "Documentation", keywords: ["wiki", "manuel"] },
      { name: "mail", label: "Messagerie", keywords: ["email", "courriel"] },
      { name: "message-square", label: "Discussion", keywords: ["chat", "message"] },
      { name: "star", label: "Favori", keywords: ["étoile", "important"] },
    ],
  },
];

export const serviceIconOptions: readonly ServiceIconOption[] =
  serviceIconCategories.flatMap((category) => category.icons);

const serviceIconAliases: Partial<Record<ServiceIconName, ServiceIconName>> = {
  globe: "globe-2",
  key: "key-round",
  message: "message-square",
  refresh: "refresh-cw",
  restore: "rotate-ccw",
};

export function normalizeServiceIconName(
  name?: string | null,
): ServiceIconName | undefined {
  if (!name || !(name in serviceIconRegistry)) return undefined;
  const registeredName = name as ServiceIconName;
  return serviceIconAliases[registeredName] ?? registeredName;
}

export function getServiceIconOption(name?: string | null) {
  const normalizedName = normalizeServiceIconName(name);
  return serviceIconOptions.find((option) => option.name === normalizedName);
}

type ServiceIconProps = Omit<LucideProps, "name"> & {
  name?: string | null;
};

export function ServiceIcon({ name, ...props }: ServiceIconProps) {
  const Icon =
    name && name in serviceIconRegistry
      ? serviceIconRegistry[name as ServiceIconName]
      : CircleDot;

  return <Icon aria-hidden="true" {...props} />;
}
