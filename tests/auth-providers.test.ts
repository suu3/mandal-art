import { expect, it } from "vitest";
import {
  authReady,
  providerAvailability,
  createAuth,
  type Env,
} from "../server/auth";
const base = {
  DB: {} as D1Database,
  BETTER_AUTH_SECRET: "long-test-secret-long-test-secret-123",
  BETTER_AUTH_URL: "http://localhost:5173",
};
it("supports Google-only deployment without requiring GitHub credentials", () => {
  const env: Env = {
    ...base,
    GOOGLE_CLIENT_ID: "google-id",
    GOOGLE_CLIENT_SECRET: "google-secret",
  };
  expect(authReady(env)).toBe(true);
  expect(providerAvailability(env)).toEqual({
    googleLogin: true,
    githubLogin: false,
  });
  expect(createAuth(env).options.socialProviders).toHaveProperty("google");
  expect(createAuth(env).options.socialProviders).not.toHaveProperty("github");
});
it("never advertises half-configured or unconfigured login providers", () => {
  expect(
    providerAvailability({ ...base, GOOGLE_CLIENT_ID: "missing-secret" }),
  ).toEqual({ googleLogin: false, githubLogin: false });
  expect(authReady(base)).toBe(false);
  expect(
    providerAvailability({
      ...base,
      GITHUB_CLIENT_ID: "id",
      GITHUB_CLIENT_SECRET: "secret",
    }),
  ).toEqual({ googleLogin: false, githubLogin: true });
});
