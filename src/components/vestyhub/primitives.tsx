import type { ReactNode } from "react";

import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

const TONE_CLASSES = {
  neutral: "text-foreground",
  primary: "text-primary",
  success: "text-success",
  warning: "text-warning",
  danger: "text-destructive",
  info: "text-info",
} as const;

export type VestyHubTone = keyof typeof TONE_CLASSES;

interface PageHeaderProps {
  title: string;
  description?: string;
  eyebrow?: ReactNode;
  actions?: ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  eyebrow,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <header
      className={cn(
        "flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between",
        className,
      )}
    >
      <div className="min-w-0">
        {eyebrow ? <div className="mb-2 flex items-center gap-2">{eyebrow}</div> : null}
        <h1 className="text-3xl font-semibold tracking-tight sm:text-4xl">{title}</h1>
        {description ? (
          <p className="text-muted-foreground mt-2 max-w-3xl text-sm leading-6">
            {description}
          </p>
        ) : null}
      </div>
      {actions ? <div className="flex shrink-0 flex-wrap items-center gap-2">{actions}</div> : null}
    </header>
  );
}

interface PanelProps extends React.ComponentProps<typeof Card> {
  contentClassName?: string;
  interactive?: boolean;
}

export function Panel({
  children,
  className,
  contentClassName,
  interactive = false,
  ...props
}: PanelProps) {
  return (
    <Card
      className={cn(
        "overflow-hidden",
        interactive &&
          "hover:border-primary/35 transition-[border-color,box-shadow,transform] duration-200 hover:-translate-y-0.5 hover:shadow-lg",
        className,
      )}
      {...props}
    >
      <CardContent className={contentClassName}>{children}</CardContent>
    </Card>
  );
}

interface PanelHeaderProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  action?: ReactNode;
  className?: string;
}

export function PanelHeader({
  title,
  subtitle,
  icon,
  action,
  className,
}: PanelHeaderProps) {
  return (
    <div className={cn("mb-5 flex items-start justify-between gap-3", className)}>
      <div className="flex min-w-0 items-start gap-3">
        {icon ? (
          <span className="bg-primary/10 text-primary grid size-9 shrink-0 place-items-center rounded-xl">
            {icon}
          </span>
        ) : null}
        <div className="min-w-0">
          <h2 className="font-medium tracking-tight">{title}</h2>
          {subtitle ? <p className="text-muted-foreground mt-1 text-xs">{subtitle}</p> : null}
        </div>
      </div>
      {action ? <div className="shrink-0">{action}</div> : null}
    </div>
  );
}

interface StatusDotProps {
  tone?: VestyHubTone;
  label: string;
  pulse?: boolean;
  className?: string;
}

export function StatusDot({
  tone = "neutral",
  label,
  pulse = false,
  className,
}: StatusDotProps) {
  const toneClass = TONE_CLASSES[tone];

  return (
    <span
      className={cn("inline-flex items-center gap-2 text-xs font-medium", toneClass, className)}
      role="status"
    >
      <span className="relative flex size-2" aria-hidden="true">
        {pulse ? (
          <span className="absolute inline-flex size-full animate-ping rounded-full bg-current opacity-35 motion-reduce:animate-none" />
        ) : null}
        <span className="relative inline-flex size-2 rounded-full bg-current shadow-[0_0_0_3px_color-mix(in_oklch,currentColor_18%,transparent)]" />
      </span>
      {label}
    </span>
  );
}

interface StatCardProps {
  label: string;
  value: ReactNode;
  detail?: ReactNode;
  icon?: ReactNode;
  tone?: VestyHubTone;
  progress?: number;
  className?: string;
}

export function StatCard({
  label,
  value,
  detail,
  icon,
  tone = "neutral",
  progress,
  className,
}: StatCardProps) {
  const toneClass = TONE_CLASSES[tone];
  const normalizedProgress =
    typeof progress === "number" ? Math.min(100, Math.max(0, progress)) : undefined;

  return (
    <Panel className={className} interactive contentClassName="relative">
      {icon ? (
        <span
          className={cn(
            "bg-primary/10 absolute top-4 right-4 grid size-9 place-items-center rounded-xl",
            toneClass,
          )}
        >
          {icon}
        </span>
      ) : null}
      <p className="text-muted-foreground text-xs tracking-[0.16em] uppercase">{label}</p>
      <p className={cn("mt-3 text-3xl font-semibold tracking-tight", toneClass)}>{value}</p>
      {normalizedProgress !== undefined ? (
        <div className="bg-secondary mt-3 h-1.5 overflow-hidden rounded-full">
          <div
            className={cn("h-full rounded-full bg-current transition-[width]", toneClass)}
            style={{ width: `${normalizedProgress}%` }}
          />
        </div>
      ) : null}
      {detail ? <p className="text-muted-foreground mt-2 text-xs">{detail}</p> : null}
    </Panel>
  );
}
