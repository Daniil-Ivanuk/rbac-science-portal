// Базовый класс для всех ошибок нашего модуля
export class RbacError extends Error {
  public statusCode: number;

  constructor(message: string, statusCode: number = 500) {
    super(message);
    this.name = this.constructor.name;
    this.statusCode = statusCode;
    Error.captureStackTrace(this, this.constructor);
  }
}

// Ошибка аутентификации (нет токена, токен в блеклисте или невалиден)
export class InvalidTokenError extends RbacError {
  constructor(message: string = 'Неверный, отозванный или просроченный токен') {
    super(message, 401);
  }
}

// Ошибка авторизации (пользователь распознан, но нет нужной роли)
export class AccessDeniedError extends RbacError {
  constructor(message: string = 'Доступ запрещен: недостаточно прав') {
    super(message, 403);
  }
}

// Ошибка логики (например, попытка назначить несуществующую роль)
export class RoleNotFoundError extends RbacError {
  constructor(message: string = 'Указанная роль не найдена') {
    super(message, 404);
  }
}
