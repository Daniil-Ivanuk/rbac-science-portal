import sql from 'mssql';

const DB_USER = process.env.DB_USER;
const DB_PASSWORD = process.env.DB_PASSWORD;
const DB_NAME = process.env.DB_NAME;
const DB_SERVER = process.env.DB_SERVER;

if (!DB_USER || !DB_PASSWORD || !DB_NAME || !DB_SERVER) {
  throw new Error(
    'Критическая ошибка: Не заданы параметры подключения к БД в переменных окружения (DB_USER, DB_PASSWORD, DB_NAME, DB_SERVER).',
  );
}

const dbConfig: sql.config = {
  user: DB_USER,
  password: DB_PASSWORD,
  database: DB_NAME,
  server: DB_SERVER,
  options: {
    encrypt: true,
    trustServerCertificate: true,
  },
};

export const poolPromise = new sql.ConnectionPool(dbConfig)
  .connect()
  .then((pool) => {
    console.log('Connected to MS SQL Server');
    return pool;
  })
  .catch((err) => {
    console.error('Database Connection Failed! Bad Config: ', err);
    process.exit(1);
  });
