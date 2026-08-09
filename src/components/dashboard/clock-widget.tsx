"use client";

import { Clock3 } from "lucide-react";
import { useEffect, useState } from "react";

import type { ClockWidgetConfiguration } from "@/lib/dashboard/widget-catalog";

export function ClockWidget({
  configuration,
}: {
  configuration: ClockWidgetConfiguration;
}) {
  const [now, setNow] = useState<Date | null>(null);

  useEffect(() => {
    const updateNow = () => setNow(new Date());

    const initialTimer = window.setTimeout(updateNow, 0);
    const intervalTimer = window.setInterval(updateNow, 1_000);

    return () => {
      window.clearTimeout(initialTimer);
      window.clearInterval(intervalTimer);
    };
  }, []);

  const timeParts = now
    ? new Intl.DateTimeFormat("fr-FR", {
        hour: "2-digit",
        minute: "2-digit",
        second: configuration.showSeconds ? "2-digit" : undefined,
        hour12: configuration.hour12,
      }).formatToParts(now)
    : [];
  const hours = timeParts.find((part) => part.type === "hour")?.value ?? "--";
  const minutes = timeParts.find((part) => part.type === "minute")?.value ?? "--";
  const seconds = timeParts.find((part) => part.type === "second")?.value ?? "--";
  const dayPeriod = timeParts.find((part) => part.type === "dayPeriod")?.value;

  const accessibleTime = [
    `${hours} heures`,
    `${minutes} minutes`,
    configuration.showSeconds ? `${seconds} secondes` : null,
    dayPeriod ?? null,
  ]
    .filter(Boolean)
    .join(" ");

  return (
    <div className="flex h-full flex-col rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(255,255,255,0.025))] p-5">
      <div className="flex items-center justify-between pr-10">
        <p className="text-sm text-zinc-400">Heure locale</p>
        <Clock3 className="size-4 text-cyan-300" />
      </div>

      <div className="flex flex-1 flex-col items-center justify-center text-center">
        <p
          className="font-mono text-4xl font-semibold tracking-tight"
          aria-label={accessibleTime}
        >
          <span className="bg-gradient-to-b from-sky-200 via-blue-400 to-blue-700 bg-clip-text text-transparent drop-shadow-sm">
            {hours}
          </span>
          <span className="px-1 text-zinc-400">:</span>
          <span className="bg-gradient-to-b from-white via-white to-zinc-300 bg-clip-text text-transparent drop-shadow-sm">
            {minutes}
          </span>
          {configuration.showSeconds ? (
            <>
              <span className="px-1 text-zinc-400">:</span>
              <span className="bg-gradient-to-b from-red-300 via-red-500 to-red-700 bg-clip-text text-transparent drop-shadow-sm">
                {seconds}
              </span>
            </>
          ) : null}
          {dayPeriod ? (
            <span className="ml-2 text-base font-medium text-zinc-400">{dayPeriod}</span>
          ) : null}
        </p>

        {configuration.showDate ? (
          <p className="mt-2 text-sm text-zinc-500 capitalize">
            {now
              ? new Intl.DateTimeFormat("fr-FR", {
                  weekday: "long",
                  day: "numeric",
                  month: "long",
                  year: "numeric",
                }).format(now)
              : "Synchronisation…"}
          </p>
        ) : null}
      </div>
    </div>
  );
}
