/**
 * Error Handling Utilities
 * Standardized error handling and formatting
 */

/**
 * Custom application error class
 */
export class AppError extends Error {
  constructor(
    public message: string,
    public statusCode: number = 500,
    public code?: string
  ) {
    super(message);
    this.name = 'AppError';
  }
}

/**
 * Validation error class
 */
export class ValidationError extends AppError {
  constructor(
    message: string,
    public errors?: Record<string, string[]>
  ) {
    super(message, 400, 'VALIDATION_ERROR');
    this.name = 'ValidationError';
  }
}

/**
 * Not found error class
 */
export class NotFoundError extends AppError {
  constructor(resource: string) {
    super(`${resource} not found`, 404, 'NOT_FOUND');
    this.name = 'NotFoundError';
  }
}

/**
 * Unauthorized error class
 */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 401, 'UNAUTHORIZED');
    this.name = 'UnauthorizedError';
  }
}

/**
 * Forbidden error class
 */
export class ForbiddenError extends AppError {
  constructor(message: string = 'Forbidden') {
    super(message, 403, 'FORBIDDEN');
    this.name = 'ForbiddenError';
  }
}

/**
 * Conflict error class (e.g., duplicate resource)
 */
export class ConflictError extends AppError {
  constructor(message: string) {
    super(message, 409, 'CONFLICT');
    this.name = 'ConflictError';
  }
}

/**
 * Insufficient inventory error
 */
export class InsufficientInventoryError extends AppError {
  constructor(
    public productId: string,
    public available: number,
    public requested: number
  ) {
    super(
      `Insufficient inventory for product ${productId}. Available: ${available}, Requested: ${requested}`,
      400,
      'INSUFFICIENT_INVENTORY'
    );
    this.name = 'InsufficientInventoryError';
  }
}

/**
 * Invalid state error (e.g., order already completed)
 */
export class InvalidStateError extends AppError {
  constructor(resource: string, currentState: string, action: string) {
    super(
      `Cannot ${action} ${resource} in ${currentState} state`,
      400,
      'INVALID_STATE'
    );
    this.name = 'InvalidStateError';
  }
}

/**
 * Format error response for API
 */
export function formatErrorResponse(error: unknown) {
  if (error instanceof AppError) {
    return {
      message: error.message,
      statusCode: error.statusCode,
      code: error.code,
      ...(error instanceof ValidationError && { errors: error.errors }),
    };
  }

  if (error instanceof Error) {
    return {
      message: error.message,
      statusCode: 500,
      code: 'INTERNAL_SERVER_ERROR',
    };
  }

  return {
    message: 'An unknown error occurred',
    statusCode: 500,
    code: 'INTERNAL_SERVER_ERROR',
  };
}

/**
 * Check if error is a specific type
 */
export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}

/**
 * Check if error is a validation error
 */
export function isValidationError(error: unknown): error is ValidationError {
  return error instanceof ValidationError;
}

/**
 * Check if error is a not found error
 */
export function isNotFoundError(error: unknown): error is NotFoundError {
  return error instanceof NotFoundError;
}

/**
 * Check if error is an insufficient inventory error
 */
export function isInsufficientInventoryError(
  error: unknown
): error is InsufficientInventoryError {
  return error instanceof InsufficientInventoryError;
}
