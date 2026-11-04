import { describe, it, expect } from "vitest";
import { readJson } from "../src/lib/http";
describe("bounded JSON requests", () => {
  it("accepts a valid JSON body", async () => {
    const result = await readJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: '{"title":"Example"}',
      }),
    );
    expect(result).toEqual({ ok: true, data: { title: "Example" } });
  });
  it("rejects malformed JSON with an actionable client error", async () => {
    const result = await readJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: "{bad",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(400);
  });
  it("bounds bodies even without a Content-Length header", async () => {
    const result = await readJson(
      new Request("http://localhost", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ text: "x".repeat(100) }),
      }),
      32,
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(413);
  });
  it("rejects form and text requests", async () => {
    const result = await readJson(
      new Request("http://localhost", {
        method: "POST",
        body: "title=Example",
      }),
    );
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.response.status).toBe(415);
  });
});
