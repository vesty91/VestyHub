import type {
  ConnectionTestResult,
  ConnectorCapability,
  ConnectorHealth,
  ConnectorSummary,
  ConnectorType,
} from "@/types/connectors";

export interface HomelabConnector {
  readonly id: string;
  readonly type: ConnectorType;
  testConnection(signal?: AbortSignal): Promise<ConnectionTestResult>;
  getSummary(signal?: AbortSignal): Promise<ConnectorSummary>;
  getHealth(signal?: AbortSignal): Promise<ConnectorHealth>;
  getCapabilities(): Promise<ConnectorCapability[]>;
}

export interface ConnectorRuntimeConfig {
  id: string;
  type: ConnectorType;
  baseUrl: string;
  timeoutMs: number;
  /** Must default to true. Disabling verification requires an explicit admin action. */
  verifyTls: boolean;
  /** Optional custom CA PEM for internal PKI without disabling TLS verification. */
  caCertificatePem?: string;
  secrets?: Record<string, string>;
}
