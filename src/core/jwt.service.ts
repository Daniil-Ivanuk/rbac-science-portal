import jwt from 'jsonwebtoken';
import {InvalidTokenError} from './errors.js';

const JWT_SECRET = process.env.JWT_SECRET;

if (!JWT_SECRET) {
  throw new Error('Critical error: JWT_SECRET environment variable is not set');
}
const SECRET_KEY: string = JWT_SECRET;

export interface JwtPayload {
  userId: string;
  username: string;
  name: string;
  roles: string[];
  permissions: string[];
  [key: string]: unknown;
}

export class JwtService {
  public static generateToken(
    payload: JwtPayload,
    expiresIn: string = '1h',
  ): string {
    return jwt.sign(payload, SECRET_KEY, {expiresIn} as jwt.SignOptions);
  }

  public static verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, SECRET_KEY);
      return decoded as JwtPayload;
    } catch {
      throw new InvalidTokenError('Invalid or expired JWT token');
    }
  }
}
