import { neon } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-http";
import * as schema from "./schema";

export type Db = ReturnType<typeof createDb>;

function createDb() {
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL is not set. Neon 연결 문자열을 .env.local에 넣어주세요.");
  return drizzle(neon(url), { schema });
}

let cached: Db | null = null;

export function getDb(): Db {
  if (!cached) cached = createDb();
  return cached;
}

export const hasDbConfig = () => Boolean(process.env.DATABASE_URL);
