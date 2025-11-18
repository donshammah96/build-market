import postgres from 'postgres';

let sql: ReturnType<typeof postgres> | null = null;

/**
 * Get a singleton Postgres connection instance
 * Ensures we don't create multiple connections to the database
 */
export function getSqlClient() {
  const connectionString = process.env.POSTGRES_URL;
  if (!connectionString) {
    throw new Error('POSTGRES_URL environment variable is not set');
  }
  
  if (!sql) {
    sql = postgres(connectionString, { 
      ssl: 'require',
      max: 10, // Maximum number of connections in the pool
      idle_timeout: 20, // Close idle connections after 20 seconds
      connect_timeout: 10, // Connection timeout in seconds
    });
  }
  
  return sql;
}

/**
 * Close the database connection
 * Should be called when the application shuts down
 */
export async function closeSqlConnection() {
  if (sql) {
    await sql.end();
    sql = null;
  }
}
