"use client";

import { useEffect, useRef } from "react";
import * as echarts from "echarts";

import type { TimeSeries } from "@/connectors/monitoring/types";

interface TimeSeriesChartProps {
  title: string;
  series: TimeSeries[];
  height?: number;
}

function unitLabel(series: TimeSeries[]): string {
  const unit = series[0]?.unit;
  switch (unit) {
    case "percent":
      return "%";
    case "bytes":
      return "octets";
    case "bytes_per_second":
      return "o/s";
    case "count":
      return "nombre";
    case "seconds":
      return "secondes";
    default:
      return "";
  }
}

export function TimeSeriesChart({ title, series, height = 280 }: TimeSeriesChartProps) {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const chart = echarts.init(container, undefined, { renderer: "canvas" });
    const styles = getComputedStyle(document.documentElement);
    const foreground = styles.getPropertyValue("--foreground").trim();
    const muted = styles.getPropertyValue("--muted-foreground").trim();
    const border = styles.getPropertyValue("--border").trim();
    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

    chart.setOption({
      animation: !reducedMotion,
      aria: {
        enabled: true,
        description: `${title}. ${series.length} série${series.length > 1 ? "s" : ""} temporelle${series.length > 1 ? "s" : ""}.`,
      },
      grid: { left: 46, right: 20, top: 20, bottom: 34, containLabel: true },
      tooltip: {
        trigger: "axis",
        valueFormatter: (value: unknown) =>
          typeof value === "number" ? value.toLocaleString("fr-FR", { maximumFractionDigits: 2 }) : String(value),
      },
      legend: {
        show: series.length > 1,
        top: 0,
        textStyle: { color: muted || foreground },
      },
      xAxis: {
        type: "time",
        axisLine: { lineStyle: { color: border } },
        axisLabel: { color: muted },
        splitLine: { show: false },
      },
      yAxis: {
        type: "value",
        name: unitLabel(series),
        nameTextStyle: { color: muted },
        axisLabel: { color: muted },
        splitLine: { lineStyle: { color: border, type: "dashed" } },
      },
      series: series.map((item) => ({
        id: item.id,
        name: item.label,
        type: "line",
        showSymbol: false,
        smooth: false,
        sampling: "lttb",
        emphasis: { focus: "series" },
        data: item.points.map((point) => [point.timestamp * 1000, point.value]),
      })),
    });

    const observer = new ResizeObserver(() => chart.resize());
    observer.observe(container);

    return () => {
      observer.disconnect();
      chart.dispose();
    };
  }, [series, title]);

  if (series.length === 0) {
    return (
      <div
        className="border-border bg-muted/20 text-muted-foreground grid min-h-56 place-items-center rounded-xl border border-dashed px-6 text-center text-sm"
        role="status"
      >
        Aucune série disponible pour cette période.
      </div>
    );
  }

  return <div ref={containerRef} style={{ height }} className="w-full" role="img" aria-label={title} />;
}
