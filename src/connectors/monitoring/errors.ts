import type { MonitoringErrorCode, MonitoringSource } from "./types";

export class MonitoringConnectorError extends Error {
  constructor(
    public readonly source: MonitoringSource,
    public readonly code: MonitoringErrorCode,
    message: string,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "MonitoringConnectorError";
  }
}

export function normalizeMonitoringError(
  source: MonitoringSource,
  error: unknown,
): MonitoringConnectorError {
  if (error instanceof MonitoringConnectorError) return error;

  const name = error instanceof Error ? error.name : "";
  const message = error instanceof Error ? error.message : "";

  if (name.includes("Timeout") || message.toLowerCase().includes("timeout")) {
    return new MonitoringConnectorError(
      source,
      "TIMEOUT",
      "La source a dépassé le délai de réponse autorisé.",
      { cause: error },
    );
  }

  if (error instanceof TypeError) {
    return new MonitoringConnectorError(
      source,
      "UNREACHABLE",
      "La source ne répond pas actuellement.",
      { cause: error },
    );
  }

  return new MonitoringConnectorError(
    source,
    "INVALID_RESPONSE",
    "La source a retourné une réponse inexploitable.",
    { cause: error },
  );
}

export function publicMonitoringErrorMessage(code: MonitoringErrorCode): string {
  switch (code) {
    case "NOT_CONFIGURED":
      return "Source non configurée.";
    case "TIMEOUT":
      return "Délai de réponse dépassé.";
    case "UNREACHABLE":
      return "Source momentanément inaccessible.";
    case "HTTP_ERROR":
      return "La source a refusé la requête.";
    case "INVALID_RESPONSE":
      return "Réponse de source invalide.";
  }
}
