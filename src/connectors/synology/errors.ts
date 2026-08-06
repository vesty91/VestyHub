import type { SynologyErrorCode } from "./types";

export class SynologyConnectorError extends Error {
  constructor(
    public readonly code: SynologyErrorCode,
    message: string,
    public readonly dsmCode?: number,
    options?: ErrorOptions,
  ) {
    super(message, options);
    this.name = "SynologyConnectorError";
  }
}

export function mapDsmErrorCode(code: number): SynologyErrorCode {
  switch (code) {
    case 400:
      return "AUTH_FAILED";
    case 401:
    case 402:
    case 105:
      return "PERMISSION_DENIED";
    case 403:
    case 404:
    case 406:
      return "TWO_FACTOR_REQUIRED";
    case 106:
    case 119:
      return "SESSION_EXPIRED";
    case 102:
    case 103:
    case 104:
      return "API_UNAVAILABLE";
    default:
      return "INVALID_RESPONSE";
  }
}

export function normalizeSynologyError(error: unknown): SynologyConnectorError {
  if (error instanceof SynologyConnectorError) return error;

  const message = error instanceof Error ? error.message : "";
  const code = (error as NodeJS.ErrnoException | undefined)?.code;

  if (error instanceof Error && error.name === "AbortError") {
    return new SynologyConnectorError(
      "TIMEOUT",
      "Le NAS a dépassé le délai de réponse autorisé.",
      undefined,
      { cause: error },
    );
  }

  if (
    code === "DEPTH_ZERO_SELF_SIGNED_CERT" ||
    code === "SELF_SIGNED_CERT_IN_CHAIN" ||
    code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE" ||
    code === "CERT_HAS_EXPIRED" ||
    code === "ERR_TLS_CERT_ALTNAME_INVALID"
  ) {
    return new SynologyConnectorError(
      "TLS_ERROR",
      "Le certificat TLS du NAS n’a pas pu être validé.",
      undefined,
      { cause: error },
    );
  }

  if (
    code === "ECONNREFUSED" ||
    code === "ECONNRESET" ||
    code === "EHOSTUNREACH" ||
    code === "ENETUNREACH" ||
    code === "ENOTFOUND"
  ) {
    return new SynologyConnectorError(
      "UNREACHABLE",
      "Le NAS ne répond pas actuellement.",
      undefined,
      { cause: error },
    );
  }

  if (message.toLowerCase().includes("timeout")) {
    return new SynologyConnectorError(
      "TIMEOUT",
      "Le NAS a dépassé le délai de réponse autorisé.",
      undefined,
      { cause: error },
    );
  }

  return new SynologyConnectorError(
    "INVALID_RESPONSE",
    "Le NAS a retourné une réponse inexploitable.",
    undefined,
    { cause: error },
  );
}

export function publicSynologyErrorMessage(code: SynologyErrorCode): string {
  switch (code) {
    case "DISABLED":
      return "Connecteur Synology désactivé.";
    case "NOT_CONFIGURED":
      return "Connecteur Synology incomplet.";
    case "INVALID_URL":
      return "Adresse DSM invalide.";
    case "TLS_ERROR":
      return "Le certificat TLS de DSM n’est pas approuvé.";
    case "TIMEOUT":
      return "Délai de réponse DSM dépassé.";
    case "UNREACHABLE":
      return "DSM est momentanément inaccessible.";
    case "HTTP_ERROR":
      return "DSM a refusé la requête HTTP.";
    case "AUTH_FAILED":
      return "Identifiants DSM refusés.";
    case "TWO_FACTOR_REQUIRED":
      return "DSM exige une validation à deux facteurs pour ce compte.";
    case "PERMISSION_DENIED":
      return "Le compte DSM ne possède pas les permissions nécessaires.";
    case "SESSION_EXPIRED":
      return "La session DSM a expiré.";
    case "API_UNAVAILABLE":
      return "L’API DSM demandée n’est pas disponible.";
    case "INVALID_RESPONSE":
      return "Réponse DSM invalide.";
  }
}
