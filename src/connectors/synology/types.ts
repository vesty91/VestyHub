export type SynologyMode = "prometheus" | "dsm-api" | "hybrid";

export type SynologyErrorCode =
  | "DISABLED"
  | "NOT_CONFIGURED"
  | "INVALID_URL"
  | "TLS_ERROR"
  | "TIMEOUT"
  | "UNREACHABLE"
  | "HTTP_ERROR"
  | "AUTH_FAILED"
  | "TWO_FACTOR_REQUIRED"
  | "PERMISSION_DENIED"
  | "SESSION_EXPIRED"
  | "API_UNAVAILABLE"
  | "INVALID_RESPONSE";

export interface SynologyApiCapability {
  api: string;
  path: string;
  minVersion: number;
  maxVersion: number;
}

export interface SynologySourceStatus {
  enabled: boolean;
  configured: boolean;
  available: boolean;
  mode: SynologyMode;
  endpointHost?: string;
  latencyMs?: number;
  checkedAt: string;
  tlsVerified: boolean;
  errorCode?: SynologyErrorCode;
}

export interface NasSystemInfo {
  hostname?: string;
  model?: string;
  serial?: string;
  dsmVersion?: string;
  architecture?: string;
  uptimeSeconds?: number;
  temperatureCelsius?: number;
  memoryBytes?: number;
}

export interface NasUtilization {
  cpuPercent?: number;
  memoryPercent?: number;
  networkReceiveBytesPerSecond?: number;
  networkTransmitBytesPerSecond?: number;
}

export interface NasVolume {
  id: string;
  name: string;
  status?: string;
  filesystem?: string;
  totalBytes?: number;
  usedBytes?: number;
  freeBytes?: number;
  usagePercent?: number;
}

export interface NasStoragePool {
  id: string;
  name: string;
  status?: string;
  raidType?: string;
  totalBytes?: number;
  usedBytes?: number;
  freeBytes?: number;
  usagePercent?: number;
}

export interface NasDisk {
  id: string;
  name: string;
  model?: string;
  serial?: string;
  status?: string;
  smartStatus?: string;
  temperatureCelsius?: number;
  sizeBytes?: number;
  type?: string;
}

export interface SynologyWarning {
  code: SynologyErrorCode | "PARTIAL_DATA" | "TLS_VERIFICATION_DISABLED";
  message: string;
  api?: string;
}

export interface NasOverview {
  generatedAt: string;
  status: SynologySourceStatus;
  system: NasSystemInfo | null;
  utilization: NasUtilization | null;
  volumes: NasVolume[];
  storagePools: NasStoragePool[];
  disks: NasDisk[];
  capabilities: SynologyApiCapability[];
  warnings: SynologyWarning[];
}
