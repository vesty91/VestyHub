import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import { initialResourceAlertState } from "@/lib/local-system/alerts";

import { LocalThresholdAlerts } from "./local-threshold-alerts";

describe("LocalThresholdAlerts", () => {
  it("shows confirmed CPU/RAM alerts and editable thresholds", () => {
    const change = vi.fn();
    render(
      <LocalThresholdAlerts
        thresholds={{ cpu: 90, memory: 85 }}
        state={{
          ...initialResourceAlertState(),
          cpu: { active: true, highCount: 2, normalCount: 0 },
          memory: { active: true, highCount: 2, normalCount: 0 },
        }}
        metricsAvailable
        onThresholdChange={change}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Charge élevée confirmée : CPU et RAM.",
    );

    fireEvent.change(screen.getByLabelText("Seuil d’alerte CPU"), {
      target: { value: "80" },
    });
    expect(change).toHaveBeenCalledWith("cpu", 80);
  });

  it("does not report a fake recovery when measurements are unavailable", () => {
    render(
      <LocalThresholdAlerts
        thresholds={{ cpu: 90, memory: 85 }}
        state={{
          ...initialResourceAlertState(),
          memory: { active: true, highCount: 2, normalCount: 0 },
        }}
        metricsAvailable={false}
        onThresholdChange={vi.fn()}
      />,
    );
    expect(screen.getByRole("status")).toHaveTextContent(
      "Mesures indisponibles : aucune nouvelle alerte.",
    );
    expect(screen.queryByText(/Charge élevée confirmée/)).not.toBeInTheDocument();
  });
});
