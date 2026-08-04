"use client";

import { useActionState } from "react";
import { ArrowRight, LockKeyhole, Mail } from "lucide-react";

import { loginAction } from "@/app/(auth)/login/actions";
import { initialLoginState } from "@/app/(auth)/login/state";
import { Button } from "@/components/ui/button";

export function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, initialLoginState);

  return (
    <form action={formAction} className="space-y-5" noValidate>
      <div className="space-y-2">
        <label htmlFor="email" className="text-sm font-medium text-zinc-200">
          Adresse e-mail
        </label>
        <div className="relative">
          <Mail className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="username"
            required
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pr-3 pl-10 text-sm text-white transition outline-none placeholder:text-zinc-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
            placeholder="admin@vestyhub.local"
            aria-describedby={state.fieldErrors?.email ? "email-error" : undefined}
          />
        </div>
        {state.fieldErrors?.email ? (
          <p id="email-error" className="text-xs text-red-300">
            {state.fieldErrors.email[0]}
          </p>
        ) : null}
      </div>

      <div className="space-y-2">
        <label htmlFor="password" className="text-sm font-medium text-zinc-200">
          Mot de passe
        </label>
        <div className="relative">
          <LockKeyhole className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-zinc-500" />
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            required
            className="h-12 w-full rounded-xl border border-white/10 bg-white/[0.04] pr-3 pl-10 text-sm text-white transition outline-none placeholder:text-zinc-600 focus:border-cyan-400/50 focus:ring-4 focus:ring-cyan-400/10"
            placeholder="••••••••••••"
            aria-describedby={state.fieldErrors?.password ? "password-error" : undefined}
          />
        </div>
        {state.fieldErrors?.password ? (
          <p id="password-error" className="text-xs text-red-300">
            {state.fieldErrors.password[0]}
          </p>
        ) : null}
      </div>

      {state.status === "error" ? (
        <div
          role="alert"
          className="rounded-xl border border-red-400/20 bg-red-400/10 px-4 py-3 text-sm text-red-200"
        >
          {state.message}
        </div>
      ) : null}

      <Button
        type="submit"
        size="lg"
        disabled={pending}
        className="h-12 w-full rounded-xl bg-cyan-400 text-zinc-950 hover:bg-cyan-300"
      >
        {pending ? "Connexion…" : "Ouvrir VestyHub"}
        <ArrowRight className="ml-1 size-4" />
      </Button>
    </form>
  );
}
