import Link from "next/link";

import { MONITORING_RANGES, type MonitoringRange } from "@/connectors/monitoring/types";
import { cn } from "@/lib/utils";

interface TimeRangeSelectorProps {
  value: MonitoringRange;
  pathname?: string;
  allowedRanges?: readonly MonitoringRange[];
}

export function TimeRangeSelector({
  value,
  pathname = "/monitoring",
  allowedRanges = MONITORING_RANGES,
}: TimeRangeSelectorProps) {
  return (
    <nav
      className="bg-secondary/65 border-border inline-flex rounded-xl border p-1"
      aria-label="Période des métriques"
    >
      {allowedRanges.map((range) => (
        <Link
          key={range}
          href={{ pathname, query: { range } }}
          aria-current={range === value ? "page" : undefined}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-medium transition",
            range === value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {range}
        </Link>
      ))}
    </nav>
  );
}
