import 'dotenv/config';
import sql from 'mssql';

function parseDatabaseConfig() {
  const databaseUrl = process.env.DATABASE_URL || '';
  const dbMatch = databaseUrl.match(/database=([^;]+)/i);
  const userMatch = databaseUrl.match(/user=([^;]+)/i);
  const passMatch = databaseUrl.match(/password=([^;]+)/i);
  const hostMatch = databaseUrl.match(/sqlserver:\/\/([^:;]+)/i);
  const portMatch = databaseUrl.match(/sqlserver:\/\/[^:]+:(\d+)/i);

  const server = process.env.DB_SERVER || hostMatch?.[1] || 'localhost';
  const port = Number(process.env.DB_PORT || portMatch?.[1] || 1433);
  const user = process.env.DB_USER || userMatch?.[1] || 'sa';
  const password = process.env.DB_PASSWORD || passMatch?.[1] || '';
  const targetDb = process.env.DB_NAME || dbMatch?.[1] || 'SciencePortalDb';

  if (!/^[a-zA-Z0-9_-]+$/.test(targetDb)) {
    throw new Error(`Invalid target database name: "${targetDb}"`);
  }

  return {server, port, user, password, targetDb};
}

async function bootstrapDatabase(): Promise<void> {
  const {server, port, user, password, targetDb} = parseDatabaseConfig();
  const maxAttempts = Number(process.env.DB_CONNECT_RETRIES || 20);
  const retryDelayMs = 3000;

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    let pool: sql.ConnectionPool | undefined;
    try {
      pool = await new sql.ConnectionPool({
        server,
        port,
        user,
        password,
        database: 'master',
        options: {
          encrypt: true,
          trustServerCertificate: true,
        },
      }).connect();

      await pool
        .request()
        .input('dbName', sql.NVarChar(128), targetDb)
        .query(
          `IF DB_ID(@dbName) IS NULL CREATE DATABASE [${targetDb}];`,
        );

      console.log(
        `[Bootstrap] SQL Server ready on ${server}:${port}. Database "${targetDb}" verified.`,
      );
      return;
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      console.warn(
        `[Bootstrap] Attempt ${attempt}/${maxAttempts} waiting for SQL Server (${server}:${port}): ${message}`,
      );
      if (attempt === maxAttempts) {
        throw error;
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs));
    } finally {
      if (pool) {
        await pool.close().catch(() => undefined);
      }
    }
  }
}

bootstrapDatabase().catch((error) => {
  console.error('[Bootstrap] Fatal database initialization error:', error);
  process.exit(1);
});
