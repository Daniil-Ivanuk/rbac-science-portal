import jwt from 'jsonwebtoken';

// Секретный ключ для подписи (в продакшене берется из переменных окружения)
const JWT_SECRET =
  process.env.JWT_SECRET || 'super_secret_science_portal_key_2026';
const TOKEN_EXPIRES_IN = '15m'; // Короткоживущий access token

export interface JwtPayload {
  userId: string;
  username: string;
  roles: string[];
  permissions: string[];
}

export class JwtService {
  // Генерация JWT с включением ролей и прав в claims
  public static generateToken(payload: JwtPayload): string {
    return jwt.sign(payload, JWT_SECRET, {expiresIn: TOKEN_EXPIRES_IN});
  }

  // Верификация и парсинг токена
  public static verifyToken(token: string): JwtPayload {
    try {
      return jwt.verify(token, JWT_SECRET) as JwtPayload;
    } catch {
      throw new Error('Invalid or expired JWT token');
    }
  }
}
