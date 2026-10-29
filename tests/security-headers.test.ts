import { afterAll, beforeAll, expect, it } from "vitest";
import { Miniflare, convertV4MiniflareOptions } from "miniflare";
import { copyFileSync, cpSync, mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

let mf: Miniflare;
let directory: string;
beforeAll(async () => {
  directory = mkdtempSync(join(tmpdir(), "mandalart-assets-"));
  cpSync("public", directory, { recursive: true });
  copyFileSync("index.html", join(directory, "index.html"));
  mf = new Miniflare(
    convertV4MiniflareOptions({
      modules: true,
      script:
        "export default {fetch(request, env) { return env.ASSETS.fetch(request); }}",
      assets: {
        directory,
        binding: "ASSETS",
        assetConfig: { not_found_handling: "single-page-application" },
      },
    }),
  );
});
afterAll(async () => {
  await mf?.dispose();
  if (directory) rmSync(directory, { recursive: true, force: true });
});
it.each(["/", "/boards/local", "/privacy.html"])(
  "serves %s with browser security policy",
  async (path) => {
    const response = await mf.dispatchFetch(`http://localhost${path}`, {
      headers: { accept: "text/html", "sec-fetch-mode": "navigate" },
    });
    expect(response.status).toBe(200);
    expect(response.headers.get("x-frame-options")).toBe("DENY");
    expect(response.headers.get("x-content-type-options")).toBe("nosniff");
    expect(response.headers.get("referrer-policy")).toBe("no-referrer");
    const policy = response.headers.get("content-security-policy");
    expect(policy).toContain("script-src 'self'");
    expect(policy).toContain("frame-ancestors 'none'");
    expect(policy).toContain("object-src 'none'");
    expect(policy).not.toContain("'unsafe-eval'");
  },
);
