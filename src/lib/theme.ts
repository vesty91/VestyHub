export const THEMES = [
  {
    id: "obsidian",
    label: "Obsidian",
    description: "Noir minéral et accents cyan pour le centre de contrôle.",
  },
  {
    id: "midnight",
    label: "Midnight",
    description: "Bleu nuit profond avec une accentuation plus froide.",
  },
  {
    id: "graphite",
    label: "Graphite",
    description: "Palette neutre et monochrome à contraste élevé.",
  },
  {
    id: "carbon-gold",
    label: "Carbon Gold",
    description: "Carbone sombre et touches dorées plus chaleureuses.",
  },
  {
    id: "light",
    label: "Light",
    description: "Interface claire, nette et adaptée aux environnements lumineux.",
  },
] as const;

export type ThemeId = (typeof THEMES)[number]["id"];

export const THEME_IDS = THEMES.map((theme) => theme.id) as ThemeId[];
export const DEFAULT_THEME: ThemeId = "obsidian";

export function isThemeId(value: unknown): value is ThemeId {
  return typeof value === "string" && THEME_IDS.includes(value as ThemeId);
}

export function getThemeDefinition(value: unknown) {
  return THEMES.find((theme) => theme.id === value) ?? THEMES[0];
}
