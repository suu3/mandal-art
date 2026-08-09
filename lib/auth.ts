import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { getDb } from "@/lib/db";
import { account, session, user, verification } from "@/lib/db/schema";

type Auth = ReturnType<typeof createAuth>;

function createAuth() {
  return betterAuth({
    database: drizzleAdapter(getDb(), {
      provider: "pg",
      schema: { user, session, account, verification }
    }),
    secret: process.env.BETTER_AUTH_SECRET,
    baseURL: process.env.BETTER_AUTH_URL,
    emailAndPassword: {
      enabled: true
    }
  });
}

let cached: Auth | null = null;

export function getAuth(): Auth {
  if (!cached) cached = createAuth();
  return cached;
}
