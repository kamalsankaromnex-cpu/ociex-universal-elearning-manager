import { NextResponse } from "next/server";
/** Bound request memory before parsing, including chunked requests without Content-Length. */
export async function readJson(
  req: Request,
  maxBytes = 8 * 1024 * 1024,
): Promise<
  { ok: true; data: unknown } | { ok: false; response: NextResponse }
> {
  const fail = (error: string, status: number) => ({
    ok: false as const,
    response: NextResponse.json({ error }, { status }),
  });
  if (!req.headers.get("content-type")?.includes("application/json"))
    return fail("Send JSON content.", 415);
  if (Number(req.headers.get("content-length")) > maxBytes)
    return fail("Request is too large. Use fewer or smaller images.", 413);
  const reader = req.body?.getReader();
  if (!reader) return fail("JSON body is required.", 400);
  let bytes = 0;
  const chunks: Uint8Array[] = [];
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      bytes += value.byteLength;
      if (bytes > maxBytes) {
        await reader.cancel();
        return fail("Request is too large. Use fewer or smaller images.", 413);
      }
      chunks.push(value);
    }
    const data = JSON.parse(Buffer.concat(chunks).toString("utf8"));
    return { ok: true, data };
  } catch {
    return fail("Invalid JSON body.", 400);
  } finally {
    reader.releaseLock();
  }
}
