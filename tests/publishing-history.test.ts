import { beforeEach, describe, expect, it, vi } from "vitest";
import { newCourse } from "../src/lib/course";
const mocks = vi.hoisted(() => ({
  snapshot: vi.fn(),
  export: vi.fn(),
  create: vi.fn(),
  query: vi.fn(),
  transaction: vi.fn(),
}));
vi.mock("../src/lib/publishing/service", () => ({
  ExportError: class extends Error {
    constructor(
      message: string,
      readonly status: number,
    ) {
      super(message);
    }
  },
  CourseExportService: class {
    snapshot = mocks.snapshot;
    export = mocks.export;
  },
}));
vi.mock("../src/lib/db", () => ({
  db: {
    publishedExport: { create: mocks.create },
    $transaction: mocks.transaction,
  },
}));
import { publishCourse } from "../src/lib/publishing/history";
const request = {
  revision: 7,
  version: "2004" as const,
  scope: "course" as const,
};
beforeEach(() => {
  vi.resetAllMocks();
  mocks.snapshot.mockResolvedValue({
    course: newCourse("Archived"),
    request,
    validation: { errors: [], warnings: [] },
  });
  mocks.export.mockResolvedValue({
    zip: new Uint8Array([1, 2, 3]),
    metadata: { fingerprint: "fingerprint", revision: 7 },
    validation: { errors: [], warnings: [] },
  });
  mocks.query.mockResolvedValue([{ revision: 7 }]);
  mocks.create.mockResolvedValue({ id: "immutable-artifact" });
  mocks.transaction.mockImplementation((callback) =>
    callback({
      $queryRaw: mocks.query,
      publishedExport: { create: mocks.create },
    }),
  );
});
describe("publication archive boundaries", () => {
  it("archives exact bytes and revision inside the final course lock", async () => {
    const result = await publishCourse("owner", "course", request);
    expect(result.record.id).toBe("immutable-artifact");
    expect(mocks.transaction).toHaveBeenCalledOnce();
    expect(mocks.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          revisionIdentifier: "course:r7",
          status: "ready",
          zip: new Uint8Array([1, 2, 3]),
          sha256:
            "039058c6f2c0cb492c533b0a4d14ef77cc0f78abccced5287d84a1a2011cfb81",
        }),
      }),
    );
  });
  it("refuses a revision changed before final archive insertion and records failure", async () => {
    mocks.query.mockResolvedValue([{ revision: 8 }]);
    await expect(
      publishCourse("owner", "course", request),
    ).rejects.toMatchObject({ status: 409 });
    expect(mocks.create).toHaveBeenCalledOnce();
    expect(mocks.create.mock.calls[0][0].data.status).toBe("failed");
  });
  it("does not store raw exception messages in failed export records", async () => {
    mocks.export.mockRejectedValue(new Error("private connection diagnostic"));
    await expect(publishCourse("owner", "course", request)).rejects.toThrow(
      "private connection diagnostic",
    );
    expect(JSON.stringify(mocks.create.mock.calls)).not.toContain(
      "private connection diagnostic",
    );
    expect(mocks.create.mock.calls[0][0].data.status).toBe("failed");
  });
  it("does not archive an unauthorized or unavailable source", async () => {
    mocks.snapshot.mockRejectedValue(new Error("Unavailable"));
    await expect(
      publishCourse("other-owner", "course", request),
    ).rejects.toThrow("Unavailable");
    expect(mocks.create).not.toHaveBeenCalled();
    expect(mocks.export).not.toHaveBeenCalled();
  });
});
