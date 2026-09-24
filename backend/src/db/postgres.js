import pg from "pg";

const { Pool } = pg;

export const pool = new Pool({
  host: process.env.POSTGRES_HOST || "localhost",
  port: process.env.POSTGRES_PORT || 5432,
  user: process.env.POSTGRES_USER || "margai",
  password: process.env.POSTGRES_PASSWORD || "margai_dev_password",
  database: process.env.POSTGRES_DB || "margai",
});

export const query = (text, params) => pool.query(text, params);
