import { betterAuth } from "better-auth";
import { drizzleAdapter } from "better-auth/adapters/drizzle";
import { drizzle } from "drizzle-orm/d1";
import * as schema from "./schema";
export type Env = {
  DB: D1Database;
  ASSETS?: Fetcher;
  BETTER_AUTH_SECRET?: string;
  BETTER_AUTH_URL?: string;
  GITHUB_CLIENT_ID?: string;
  GITHUB_CLIENT_SECRET?: string;
  GOOGLE_CLIENT_ID?: string;
  GOOGLE_CLIENT_SECRET?: string;
};
export function providerAvailability(env: Env) {
  const base = Boolean(env.DB && env.BETTER_AUTH_SECRET && env.BETTER_AUTH_URL);
  return {
    googleLogin:
      base && Boolean(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    githubLogin:
      base && Boolean(env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET),
  };
}
export const authReady = (env: Env) =>
  Object.values(providerAvailability(env)).some(Boolean);
export function createAuth(env: Env) {
  if (!authReady(env)) throw new Error("OAuth configuration is incomplete");
  return betterAuth({
    appName: "Mandalart",
    secret: env.BETTER_AUTH_SECRET!,
    baseURL: env.BETTER_AUTH_URL!,
    trustedOrigins: [new URL(env.BETTER_AUTH_URL!).origin],
    database: drizzleAdapter(drizzle(env.DB, { schema }), {
      provider: "sqlite",
      schema,
    }),
    socialProviders: {
      ...(providerAvailability(env).githubLogin
        ? {
            github: {
              clientId: env.GITHUB_CLIENT_ID!,
              clientSecret: env.GITHUB_CLIENT_SECRET!,
              scope: ["user:email"],
            },
          }
        : {}),
      ...(providerAvailability(env).googleLogin
        ? {
            google: {
              clientId: env.GOOGLE_CLIENT_ID!,
              clientSecret: env.GOOGLE_CLIENT_SECRET!,
              prompt: "select_account" as const,
            },
          }
        : {}),
    },
    emailAndPassword: { enabled: false },
    session: { expiresIn: 60 * 60 * 24 * 7, updateAge: 60 * 60 * 24 },
    advanced: { database: { generateId: () => crypto.randomUUID() } },
  });
}
