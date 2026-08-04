export abstract class AppError extends Error {
  abstract readonly code: string;
  abstract readonly httpStatus: number;
  readonly details?: unknown;

  constructor(message: string, details?: unknown) {
    super(message);
    this.name = this.constructor.name;
    this.details = details;
  }
}

export class ValidationError extends AppError {
  readonly code = "VALIDATION_ERROR";
  readonly httpStatus = 400;
}

export class UnauthorizedError extends AppError {
  readonly code = "UNAUTHORIZED";
  readonly httpStatus = 401;

  constructor(message = "Authentication is required.") {
    super(message);
  }
}

export class ForbiddenError extends AppError {
  readonly code = "FORBIDDEN";
  readonly httpStatus = 403;

  constructor(message = "You do not have permission to perform this action.") {
    super(message);
  }
}

export class NotFoundError extends AppError {
  readonly code = "NOT_FOUND";
  readonly httpStatus = 404;

  constructor(resource: string) {
    super(`${resource} not found.`);
  }
}

export class ConflictError extends AppError {
  readonly code = "CONFLICT";
  readonly httpStatus = 409;
}

export class RateLimitedError extends AppError {
  readonly code = "RATE_LIMITED";
  readonly httpStatus = 429;

  constructor(message = "Too many requests. Please try again later.") {
    super(message);
  }
}

export class ConnectorError extends AppError {
  readonly code: string = "CONNECTOR_ERROR";
  readonly httpStatus: number = 502;
}

export class ConnectorTimeoutError extends ConnectorError {
  override readonly code = "CONNECTOR_TIMEOUT";

  constructor(connectorName: string, timeoutMs: number) {
    super(`Connector "${connectorName}" timed out after ${timeoutMs}ms.`);
  }
}

export class ConnectorAbortedError extends ConnectorError {
  override readonly code = "CONNECTOR_ABORTED";
  override readonly httpStatus = 499;

  constructor(connectorName: string) {
    super(`Connector "${connectorName}" request was cancelled by the caller.`);
  }
}

export class SsrfBlockedError extends AppError {
  readonly code = "SSRF_BLOCKED";
  readonly httpStatus = 400;

  constructor(target: string) {
    super(`Request to "${target}" was blocked by SSRF protection.`);
  }
}

export class InternalServerError extends AppError {
  readonly code = "INTERNAL_SERVER_ERROR";
  readonly httpStatus = 500;

  constructor(message = "An unexpected error occurred.") {
    super(message);
  }
}
