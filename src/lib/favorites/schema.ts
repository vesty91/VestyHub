import { z } from "zod";

const optionalHttpUrl = z
  .string()
  .trim()
  .max(2048, "L’URL est trop longue.")
  .transform((value) => (value.length ? value : undefined))
  .refine((value) => {
    if (!value) return true;
    try {
      const url = new URL(value);
      return (
        (url.protocol === "http:" || url.protocol === "https:") &&
        !url.username &&
        !url.password
      );
    } catch {
      return false;
    }
  }, "Utilise une URL HTTP ou HTTPS valide, sans identifiants intégrés.");

export const favoriteFormSchema = z
  .object({
    name: z.string().trim().min(1, "Le nom est obligatoire.").max(80),
    description: z
      .string()
      .trim()
      .max(300, "La description est trop longue.")
      .transform((value) => value || undefined),
    internalUrl: optionalHttpUrl,
    externalUrl: optionalHttpUrl,
    groupId: z
      .string()
      .trim()
      .transform((value) => value || undefined)
      .refine((value) => !value || z.string().uuid().safeParse(value).success, {
        message: "Groupe invalide.",
      }),
    iconValue: z
      .string()
      .trim()
      .max(64)
      .transform((value) => value || "globe-2"),
    openMode: z.enum(["same_tab", "new_tab"]),
    tags: z
      .string()
      .max(500)
      .transform((value) =>
        [
          ...new Set(
            value
              .split(",")
              .map((tag) => tag.trim())
              .filter(Boolean),
          ),
        ].slice(0, 12),
      ),
    healthCheckEnabled: z.boolean(),
    healthCheckUrl: optionalHttpUrl,
    isFavorite: z.boolean(),
  })
  .superRefine((value, ctx) => {
    if (!value.internalUrl && !value.externalUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["internalUrl"],
        message: "Renseigne au moins une URL interne ou externe.",
      });
    }
    if (value.healthCheckEnabled && !value.healthCheckUrl) {
      ctx.addIssue({
        code: "custom",
        path: ["healthCheckUrl"],
        message: "L’URL de contrôle est obligatoire lorsque le suivi est activé.",
      });
    }
  });

export const favoriteGroupSchema = z.object({
  name: z.string().trim().min(1, "Le nom est obligatoire.").max(60),
  description: z
    .string()
    .trim()
    .max(200)
    .transform((value) => value || undefined),
  icon: z
    .string()
    .trim()
    .max(64)
    .transform((value) => value || "server"),
});

export type FavoriteFormInput = z.infer<typeof favoriteFormSchema>;
