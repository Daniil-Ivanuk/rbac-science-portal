import {redisClient} from './redis.client.js';

export class TokenBlacklistService {
  private static getTokenKey(token: string): string {
    return `auth:blacklist:${token}`;
  }

  public static async blacklistToken(
    token: string,
    expiresInSeconds: number,
  ): Promise<void> {
    if (expiresInSeconds <= 0) return;
    await redisClient.setex(
      this.getTokenKey(token),
      expiresInSeconds,
      'revoked',
    );
  }

  public static async isBlacklisted(token: string): Promise<boolean> {
    const result = await redisClient.get(this.getTokenKey(token));
    return result !== null;
  }
}
