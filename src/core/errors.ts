export class RbacError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

export class ValidationError extends RbacError {
  constructor(message: string = 'Invalid request payload') {
    super(message, 400);
  }
}

export class InvalidTokenError extends RbacError {
  constructor(message: string = 'Invalid, revoked, or expired token') {
    super(message, 401);
  }
}

export class AccessDeniedError extends RbacError {
  constructor(message: string = 'Access denied: insufficient permissions') {
    super(message, 403);
  }
}

export class RoleNotFoundError extends RbacError {
  constructor(message: string = 'Specified role not found') {
    super(message, 404);
  }
}

export class EntityNotFoundError extends RbacError {
  constructor(message: string = 'Requested resource not found') {
    super(message, 404);
  }
}

export class ConflictError extends RbacError {
  constructor(message: string = 'Resource already exists') {
    super(message, 409);
  }
}
