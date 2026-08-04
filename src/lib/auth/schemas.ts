import { z } from "zod";

export const loginSchema = z.object({
  email: z
    .string()
    .trim()
    .toLowerCase()
    .email("Saisis une adresse e-mail valide.")
    .max(254),
  password: z
    .string()
    .min(1, "Saisis ton mot de passe.")
    .max(256, "Le mot de passe est trop long."),
});

export type LoginInput = z.infer<typeof loginSchema>;
