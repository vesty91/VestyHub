"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useState } from "react";
import {
  Activity,
  ChevronRight,
  Container,
  HardDrive,
  LayoutDashboard,
  LogOut,
  Menu,
  MonitorCog,
  Search,
  Settings,
  Star,
  X,
} from "lucide-react";

import { logoutAction } from "@/app/(dashboard)/actions";
import { ThemeToggle } from "@/components/dashboard/theme-toggle";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { AuthenticatedUser } from "@/lib/auth/types";

const navigation = [
  { href: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { href: "/favorites", label: "Favoris", icon: Star },
  { href: "/docker", label: "Docker", icon: Container },
  { href: "/nas", label: "NAS", icon: HardDrive },
  { href: "/monitoring", label: "Monitoring", icon: Activity },
  { href: "/settings", label: "Paramètres", icon: Settings },
];

function Sidebar({
  pathname,
  onNavigate,
}: {
  pathname: string;
  onNavigate?: () => void;
}) {
  return (
    <div className="flex h-full flex-col">
      <div className="flex h-20 items-center gap-3 px-5">
        <div className="grid size-10 place-items-center rounded-2xl border border-cyan-300/20 bg-cyan-300/10">
          <MonitorCog className="size-5 text-cyan-300" />
        </div>
        <div>
          <p className="text-sm font-semibold tracking-[0.22em] text-cyan-300">
            VESTYHUB
          </p>
          <p className="text-[11px] text-zinc-500">CONTROL CENTER</p>
        </div>
      </div>

      <nav className="flex-1 space-y-1 px-3 py-4" aria-label="Navigation principale">
        {navigation.map((item) => {
          const active = pathname === item.href || pathname.startsWith(`${item.href}/`);
          return (
            <Link
              key={item.href}
              href={item.href}
              onClick={onNavigate}
              className={cn(
                "group flex h-11 items-center gap-3 rounded-xl px-3 text-sm transition",
                active
                  ? "bg-cyan-300/10 text-cyan-200 ring-1 ring-cyan-300/15"
                  : "text-zinc-500 hover:bg-white/[0.04] hover:text-zinc-200",
              )}
            >
              <item.icon className="size-4" />
              <span className="flex-1">{item.label}</span>
              {active ? <ChevronRight className="size-3.5" /> : null}
            </Link>
          );
        })}
      </nav>

      <div className="border-t border-white/[0.07] p-4">
        <div className="rounded-xl bg-white/[0.035] p-3">
          <div className="flex items-center gap-2 text-xs text-zinc-400">
            <span className="size-2 rounded-full bg-emerald-400 shadow-[0_0_12px_rgba(52,211,153,0.8)]" />
            Mode sécurisé
          </div>
          <p className="mt-2 text-[11px] leading-5 text-zinc-600">
            Docker reste strictement en lecture seule.
          </p>
        </div>
      </div>
    </div>
  );
}

export function DashboardShell({
  user,
  children,
}: {
  user: AuthenticatedUser;
  children: React.ReactNode;
}) {
  const pathname = usePathname();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="bg-background text-foreground min-h-screen">
      <aside className="fixed inset-y-0 left-0 z-30 hidden w-64 border-r border-white/[0.07] bg-[#080b10] lg:block">
        <Sidebar pathname={pathname} />
      </aside>

      {mobileOpen ? (
        <div className="fixed inset-0 z-50 lg:hidden">
          <button
            type="button"
            aria-label="Fermer la navigation"
            className="absolute inset-0 bg-black/70 backdrop-blur-sm"
            onClick={() => setMobileOpen(false)}
          />
          <aside className="relative h-full w-72 border-r border-white/10 bg-[#080b10] shadow-2xl">
            <button
              type="button"
              aria-label="Fermer le menu"
              className="absolute top-3 right-3 rounded-lg p-2 text-zinc-500 hover:bg-white/5 hover:text-white"
              onClick={() => setMobileOpen(false)}
            >
              <X className="size-4" />
            </button>
            <Sidebar pathname={pathname} onNavigate={() => setMobileOpen(false)} />
          </aside>
        </div>
      ) : null}

      <div className="lg:pl-64">
        <header className="bg-background/85 sticky top-0 z-20 flex h-16 items-center gap-3 border-b border-white/[0.07] px-4 backdrop-blur-xl sm:px-6">
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="lg:hidden"
            aria-label="Ouvrir le menu"
            onClick={() => setMobileOpen(true)}
          >
            <Menu className="size-5" />
          </Button>

          <Link
            href="/favorites"
            className="relative hidden h-9 max-w-md flex-1 items-center rounded-xl border border-white/[0.07] bg-white/[0.025] pr-3 pl-9 text-sm text-zinc-600 transition hover:border-cyan-400/20 hover:text-zinc-400 md:flex"
          >
            <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2" />
            Rechercher dans les favoris…
          </Link>

          <div className="ml-auto flex items-center gap-2">
            <ThemeToggle />
            <div className="hidden h-8 w-px bg-white/[0.07] sm:block" />
            <div className="hidden text-right sm:block">
              <p className="max-w-44 truncate text-sm font-medium">{user.name}</p>
              <p className="text-[11px] text-zinc-500">{user.role}</p>
            </div>
            <div className="grid size-9 place-items-center rounded-xl bg-cyan-300/10 text-sm font-semibold text-cyan-200 ring-1 ring-cyan-300/15">
              {user.name.slice(0, 1).toUpperCase()}
            </div>
            <form action={logoutAction}>
              <Button
                type="submit"
                variant="ghost"
                size="icon"
                aria-label="Se déconnecter"
                className="text-zinc-500 hover:text-red-300"
              >
                <LogOut className="size-4" />
              </Button>
            </form>
          </div>
        </header>

        <main className="min-h-[calc(100vh-4rem)] p-4 sm:p-6 xl:p-8">{children}</main>
      </div>
    </div>
  );
}
