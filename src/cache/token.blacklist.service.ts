import {RbacContext} from '../index.js';
import {redisClient} from './redis.client.js';

export class TokenBlacklistService {
  private static getClient() {
    return RbacContext && RbacContext.redis ? RbacContext.redis : redisClient;
  }

  private static getTokenKey(token: string): string {
    return `auth:blacklist:${token}`;
  }

  public static async blacklistToken(
    token: string,
    expiresInSeconds: number,
  ): Promise<void> {
    if (expiresInSeconds <= 0) return;
    try {
      const client = this.getClient();
      await client.setex(this.getTokenKey(token), expiresInSeconds, 'revoked');
    } catch (error) {
      console.warn(
        '[TokenBlacklistService] Failed to blacklist token due to Redis error:',
        error instanceof Error ? error.message : error,
      );
    }
  }

  public static async isBlacklisted(token: string): Promise<boolean> {
    try {
      const client = this.getClient();
      const result = await client.get(this.getTokenKey(token));
      return result !== null;
    } catch (error) {
      console.warn(
        '[TokenBlacklistService] Redis unavailable during blacklist check. Degrading gracefully:',
        error instanceof Error ? error.message : error,
      );
      return false;
    }
  }
}
