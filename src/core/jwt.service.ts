import jwt from 'jsonwebtoken';
import {RbacContext} from './context.js';
import {InvalidTokenError} from './errors.js';

export interface JwtPayload {
  userId: string;
  username: string;
  name: string;
  roles: string[];
  permissions: string[];
  [key: string]: unknown;
}

export class JwtService {
  private static getSecret(): string {
    const secret = RbacContext.jwtSecret || process.env.JWT_SECRET;
    if (!secret) {
      throw new Error(
        'Critical error: JWT_SECRET environment variable is not set',
      );
    }
    return secret;
  }

  public static generateToken(
    payload: JwtPayload,
    expiresIn: string = '1h',
  ): string {
    return jwt.sign(payload, this.getSecret(), {expiresIn} as jwt.SignOptions);
  }

  public static verifyToken(token: string): JwtPayload {
    try {
      const decoded = jwt.verify(token, this.getSecret());
      return decoded as JwtPayload;
    } catch {
      throw new InvalidTokenError('Invalid or expired JWT token');
    }
  }
}
