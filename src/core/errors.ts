export class RbacError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
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
