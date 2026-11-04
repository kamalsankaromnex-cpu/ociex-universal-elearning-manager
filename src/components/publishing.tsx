"use client";
import { useState, useEffect } from "react";
import {
  Download,
  ShieldCheck,
  AlertTriangle,
  FileArchive,
  RefreshCw,
} from "lucide-react";
import { Button, SecondaryButton, SelectField, ErrorState } from "./ui";
import type { CourseData } from "@/lib/course";
import type { ScormVersion } from "@/lib/scorm/types";
export function PublishingManager({
  courseId,
  revision,
  course,
  dirty,
}: {
  courseId: string;
  revision: number;
  course: CourseData;
  dirty: boolean;
}) {
  const [scope, setScope] = useState<"level" | "course">("level"),
    [levelId, setLevelId] = useState(course.levels[0]?.id || ""),
    [version, setVersion] = useState<ScormVersion>("1.2"),
    [validation, setValidation] = useState<{
      revision: number;
      errors: string[];
      warnings: string[];
    } | null>(null),
    [error, setError] = useState(""),
    [busy, setBusy] = useState(false),
    [logs, setLogs] = useState<string[]>([]);
  useEffect(() => {
    setValidation(null);
    setError("");
  }, [scope, levelId, version, revision, dirty]);
  const request = {
    revision,
    scope,
    levelId: scope === "level" ? levelId : undefined,
    version,
  };
  async function run(download: boolean) {
    setBusy(true);
    setError("");
    try {
      const r = await fetch(`/api/courses/${courseId}/export`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ...request, validateOnly: !download }),
      });
      if (!r.ok) throw new Error((await r.json()).error || "Export failed");
      if (download) {
        const blob = await r.blob(),
          url = URL.createObjectURL(blob),
          a = document.createElement("a");
        a.href = url;
        a.download = `course-r${revision}-${scope}-scorm-${version === "1.2" ? "12" : "2004"}.zip`;
        a.click();
        URL.revokeObjectURL(url);
        setLogs((l) =>
          [
            `Exported saved revision ${r.headers.get("X-Course-Revision")} · ${r.headers.get("X-Export-Fingerprint")?.slice(0, 12)} · ${new Date().toLocaleTimeString()}`,
            ...l,
          ].slice(0, 10),
        );
      } else {
        const result = await r.json();
        setValidation(result);
        setLogs((l) =>
          [`Validated saved revision ${result.revision}`, ...l].slice(0, 10),
        );
      }
    } catch (e) {
      const message = (e as Error).message;
      setError(message);
      setLogs((l) => [`Failed: ${message}`, ...l].slice(0, 10));
    } finally {
      setBusy(false);
    }
  }
  return (
    <section className="property-panel">
      <h3>
        <FileArchive /> Publishing manager
      </h3>
      <p>
        Export a standalone, single-SCO HTML5 package using the learner player
        and saved content.
      </p>
      <div className="notice">
        Committed revision: <strong>{revision}</strong>.{" "}
        {dirty
          ? "Save your changes before validation or export."
          : "Export reads the validated database revision, never the editor draft."}
      </div>
      <div className="form-grid">
        <SelectField
          label="Export scope"
          value={scope}
          onChange={(e) => setScope(e.target.value as "level" | "course")}
        >
          <option value="level">Individual level</option>
          <option value="course">Full course</option>
        </SelectField>
        {scope === "level" && (
          <SelectField
            label="Level to export"
            value={levelId}
            onChange={(e) => setLevelId(e.target.value)}
          >
            {course.levels.map((l) => (
              <option key={l.id} value={l.id}>
                {l.title}
              </option>
            ))}
          </SelectField>
        )}
        <SelectField
          label="SCORM version"
          value={version}
          onChange={(e) => setVersion(e.target.value as ScormVersion)}
        >
          <option value="1.2">SCORM 1.2</option>
          <option value="2004">SCORM 2004 4th Edition</option>
        </SelectField>
      </div>
      <div className="actions">
        <SecondaryButton disabled={busy || dirty} onClick={() => run(false)}>
          <ShieldCheck />
          Validate saved revision
        </SecondaryButton>
        <Button
          disabled={
            busy || dirty || !validation || validation.errors.length > 0
          }
          onClick={() => run(true)}
        >
          <Download />
          {busy ? "Preparing…" : "Export ZIP"}
        </Button>
      </div>
      {error && <ErrorState message={error} retry={() => run(false)} />}{" "}
      {validation && (
        <div className="export-results" role="status">
          <h4>
            {validation.errors.length
              ? "Validation failed"
              : "Validation passed"}
          </h4>
          {validation.errors.map((e, i) => (
            <p key={`e${i}`} className="danger-text">
              <AlertTriangle />
              {e}
            </p>
          ))}
          {validation.warnings.map((w, i) => (
            <p key={`w${i}`}>
              <AlertTriangle />
              {w}
            </p>
          ))}
          <p>
            XML schemas and runtime tests are documented in the publishing
            report. An export is not an LMS compatibility certification.
          </p>
        </div>
      )}
      <details className="export-logs">
        <summary>
          <RefreshCw />
          Export log
        </summary>
        {logs.length ? (
          <ol>
            {logs.map((l, i) => (
              <li key={i}>{l}</li>
            ))}
          </ol>
        ) : (
          <p>No exports in this editor session.</p>
        )}
      </details>
    </section>
  );
}
