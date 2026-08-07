"use client";

import { useEffect, useState } from "react";
import { Clock3 } from "lucide-react";

export function ClockWidget() {
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

  return (
    <div className="flex h-full flex-col justify-between rounded-2xl border border-white/[0.08] bg-[linear-gradient(135deg,rgba(34,211,238,0.10),rgba(255,255,255,0.025))] p-5">
      <div className="flex items-center justify-between pr-10">
        <p className="text-sm text-zinc-400">Heure locale</p>
        <Clock3 className="size-4 text-cyan-300" />
      </div>

      <div>
        <p className="font-mono text-4xl font-semibold tracking-tight text-white">
          {now
            ? new Intl.DateTimeFormat("fr-FR", {
                hour: "2-digit",
                minute: "2-digit",
                second: "2-digit",
              }).format(now)
            : "--:--:--"}
        </p>

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
      </div>
    </div>
  );
}
