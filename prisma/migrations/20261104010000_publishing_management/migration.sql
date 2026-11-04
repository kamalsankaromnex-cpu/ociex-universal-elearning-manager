CREATE TABLE "PublishedExport" (
 "id" TEXT PRIMARY KEY, "courseId" TEXT NOT NULL REFERENCES "Course"("id") ON DELETE CASCADE,
 "revision" INTEGER NOT NULL CHECK ("revision" > 0), "revisionIdentifier" TEXT NOT NULL,
 "version" TEXT NOT NULL CHECK ("version" IN ('1.2','2004')),
 "scope" TEXT NOT NULL CHECK ("scope" IN ('level','course')), "levelId" TEXT, "levelTitle" TEXT,
 "fingerprint" TEXT NOT NULL, "status" TEXT NOT NULL CHECK ("status" IN ('ready','failed')),
 "error" TEXT, "snapshot" JSONB NOT NULL, "metadata" JSONB NOT NULL, "validation" JSONB NOT NULL,
 "zip" BYTEA, "sha256" TEXT, "bytes" INTEGER NOT NULL DEFAULT 0,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK (("status" = 'ready' AND "zip" IS NOT NULL AND "sha256" IS NOT NULL AND "bytes" > 0) OR ("status" = 'failed' AND "zip" IS NULL))
);
CREATE INDEX "PublishedExport_courseId_createdAt_idx" ON "PublishedExport"("courseId", "createdAt");
CREATE TABLE "LmsAcceptance" (
 "id" TEXT PRIMARY KEY, "exportId" TEXT NOT NULL REFERENCES "PublishedExport"("id") ON DELETE CASCADE,
 "platform" TEXT NOT NULL, "edition" TEXT NOT NULL, "testedVersion" TEXT NOT NULL,
 "tester" TEXT NOT NULL, "testedAt" TIMESTAMP(3) NOT NULL, "result" TEXT NOT NULL CHECK ("result" IN ('passed','failed','blocked','unverified')),
 "evidence" TEXT NOT NULL, "importVerified" BOOLEAN NOT NULL, "launchVerified" BOOLEAN NOT NULL, "debugVerified" BOOLEAN NOT NULL,
 "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 CHECK ("result" <> 'passed' OR ("importVerified" AND "launchVerified" AND "debugVerified" AND length("evidence") >= 20))
);
CREATE INDEX "LmsAcceptance_exportId_createdAt_idx" ON "LmsAcceptance"("exportId", "createdAt");
-- Terminal records are append-only. Even direct UPDATE attempts affect zero rows.
CREATE RULE immutable_export AS ON UPDATE TO "PublishedExport" DO INSTEAD NOTHING;
CREATE RULE immutable_acceptance AS ON UPDATE TO "LmsAcceptance" DO INSTEAD NOTHING;
