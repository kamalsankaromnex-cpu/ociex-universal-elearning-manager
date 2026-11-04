"use client";
import { useCallback, useEffect, useState } from "react";
import { Download, History, ClipboardCheck, RefreshCw } from "lucide-react";
import {
  Button,
  SecondaryButton,
  TextField,
  SelectField,
  ErrorState,
  LoadingState,
  EmptyState,
  Modal,
  StatusBadge,
} from "./ui";
type Acceptance = {
  id: string;
  platform: string;
  edition: string;
  testedVersion: string;
  tester: string;
  testedAt: string;
  result: string;
  evidence: string;
  importVerified: boolean;
  launchVerified: boolean;
  debugVerified: boolean;
};
type Artifact = {
  id: string;
  revision: number;
  revisionIdentifier: string;
  version: "1.2" | "2004";
  scope: string;
  levelTitle: string | null;
  fingerprint: string;
  status: string;
  error: string | null;
  createdAt: string;
  sha256: string | null;
  bytes: number;
  acceptances: Acceptance[];
};
export function PublishingHistory({
  courseId,
  refresh,
}: {
  courseId: string;
  refresh: number;
}) {
  const [records, setRecords] = useState<Artifact[]>([]),
    [cursor, setCursor] = useState<string | null>(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(""),
    [selected, setSelected] = useState<Artifact | null>(null);
  const load = useCallback(
    async (next?: string) => {
      setBusy(true);
      setError("");
      try {
        const response = await fetch(
          `/api/courses/${courseId}/exports${next ? `?cursor=${encodeURIComponent(next)}` : ""}`,
          { cache: "no-store" },
        );
        const data = await response.json();
        if (!response.ok)
          throw new Error(data.error || "History could not be loaded");
        setRecords((current) =>
          next ? [...current, ...data.records] : data.records,
        );
        setCursor(data.nextCursor);
      } catch (e) {
        setError((e as Error).message);
      } finally {
        setBusy(false);
      }
    },
    [courseId],
  );
  useEffect(() => {
    load();
  }, [load, refresh]);
  return (
    <section
      className="property-panel publishing-history"
      aria-label="Export history"
    >
      <div className="panel-heading">
        <h3>
          <History /> Export history
        </h3>
        <SecondaryButton disabled={busy} onClick={() => load()}>
          <RefreshCw />
          Refresh history
        </SecondaryButton>
      </div>
      <p>
        Each export has an immutable artifact ID, source revision and SHA-256
        checksum. Downloads always return the archived ZIP, even after the
        course changes. Deleting the course deletes its archives and acceptance
        records.
      </p>
      {error && <ErrorState message={error} retry={() => load()} />}
      {busy && !records.length ? (
        <LoadingState />
      ) : !records.length ? (
        <EmptyState
          title="No published exports yet"
          description="Validate and export a saved revision to create its permanent download record."
        />
      ) : (
        <div className="history-table-wrap">
          <table className="history-table">
            <caption className="sr-only">
              Archived SCORM packages for this course
            </caption>
            <thead>
              <tr>
                <th>Revision / artifact</th>
                <th>Format / scope</th>
                <th>Created / status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {records.map((record) => (
                <tr key={record.id}>
                  <td>
                    <strong>Revision {record.revision}</strong>
                    <code>{record.revisionIdentifier}</code>
                    <code>{record.id}</code>
                    {record.sha256 && (
                      <details>
                        <summary>SHA-256 checksum</summary>
                        <code>{record.sha256}</code>
                        <p>{record.bytes.toLocaleString()} bytes</p>
                      </details>
                    )}
                  </td>
                  <td>
                    SCORM{" "}
                    {record.version === "2004" ? "2004 4th Edition" : "1.2"}
                    <p>
                      {record.scope === "course"
                        ? "Full course"
                        : record.levelTitle}
                    </p>
                  </td>
                  <td>
                    {new Date(record.createdAt).toLocaleString()}
                    <p>
                      <StatusBadge>
                        {record.status === "ready" ? "Ready" : "Failed"}
                      </StatusBadge>
                    </p>
                    {record.error && (
                      <p className="danger-text">{record.error}</p>
                    )}
                  </td>
                  <td>
                    {record.status === "ready" && (
                      <div className="actions">
                        <a
                          className="btn btn-secondary"
                          href={`/api/courses/${courseId}/exports/${record.id}/download`}
                          download
                        >
                          <Download />
                          Download ZIP
                        </a>
                        <SecondaryButton onClick={() => setSelected(record)}>
                          <ClipboardCheck />
                          Record LMS test
                        </SecondaryButton>
                      </div>
                    )}
                    <details>
                      <summary>
                        LMS acceptance records ({record.acceptances.length}
                        {record.acceptances.length === 50 ? "+" : ""})
                      </summary>
                      <p>
                        Tester-reported results for this exact artifact. These
                        do not certify other editions, revisions or LMS
                        platforms. Latest 50 records shown.
                      </p>
                      {record.acceptances.length ? (
                        record.acceptances.map((a) => (
                          <article className="acceptance-record" key={a.id}>
                            <strong>
                              {a.platform} · SCORM {a.edition} · {a.result}
                            </strong>
                            <p>LMS version/build: {a.testedVersion}</p>
                            <p>
                              {a.tester} ·{" "}
                              {new Date(a.testedAt).toLocaleDateString()}
                            </p>
                            <p>
                              Import:{" "}
                              {a.importVerified ? "verified" : "unverified"};
                              launch:{" "}
                              {a.launchVerified ? "verified" : "unverified"};
                              debug:{" "}
                              {a.debugVerified ? "verified" : "unverified"}
                            </p>
                            <p className="evidence-text">{a.evidence}</p>
                          </article>
                        ))
                      ) : (
                        <p>No external LMS verification recorded.</p>
                      )}
                    </details>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      {cursor && (
        <SecondaryButton disabled={busy} onClick={() => load(cursor)}>
          Load older exports
        </SecondaryButton>
      )}
      <Modal
        open={!!selected}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Record LMS acceptance"
        description="Record an actual test against this archived ZIP. Results and evidence are append-only; add a new record to correct an earlier entry."
      >
        {selected && (
          <AcceptanceForm
            key={selected.id}
            courseId={courseId}
            artifact={selected}
            onSaved={() => {
              setSelected(null);
              load();
            }}
          />
        )}
      </Modal>
    </section>
  );
}
function AcceptanceForm({
  courseId,
  artifact,
  onSaved,
}: {
  courseId: string;
  artifact: Artifact;
  onSaved: () => void;
}) {
  const [form, setForm] = useState({
      platform: "SCORM Cloud",
      testedVersion: "",
      tester: "",
      testedAt: new Date().toISOString().slice(0, 10),
      result: "unverified",
      evidence: "",
      importVerified: false,
      launchVerified: false,
      debugVerified: false,
    }),
    [busy, setBusy] = useState(false),
    [error, setError] = useState("");
  return (
    <form
      onSubmit={async (e) => {
        e.preventDefault();
        setBusy(true);
        setError("");
        try {
          const response = await fetch(
            `/api/courses/${courseId}/exports/${artifact.id}/acceptance`,
            {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                ...form,
                edition: artifact.version,
                testedAt: new Date(form.testedAt + "T00:00:00Z").toISOString(),
              }),
            },
          );
          const result = await response.json();
          if (!response.ok)
            throw new Error(
              result.error || "Acceptance record could not be saved",
            );
          onSaved();
        } catch (error) {
          setError((error as Error).message);
        } finally {
          setBusy(false);
        }
      }}
    >
      <p>
        Artifact <code>{artifact.id}</code> · revision {artifact.revision} ·
        SCORM {artifact.version}
      </p>
      <TextField
        required
        label="LMS platform"
        maxLength={120}
        value={form.platform}
        onChange={(e) => setForm({ ...form, platform: e.target.value })}
      />
      <TextField
        required
        label="LMS version / build tested"
        maxLength={160}
        placeholder="Build number, or hosted service with test date"
        value={form.testedVersion}
        onChange={(e) => setForm({ ...form, testedVersion: e.target.value })}
      />
      <div className="form-grid">
        <TextField
          required
          label="Tester"
          maxLength={120}
          value={form.tester}
          onChange={(e) => setForm({ ...form, tester: e.target.value })}
        />
        <TextField
          required
          type="date"
          label="Test date"
          max={new Date().toISOString().slice(0, 10)}
          value={form.testedAt}
          onChange={(e) => setForm({ ...form, testedAt: e.target.value })}
        />
      </div>
      <SelectField
        label="Test result"
        value={form.result}
        onChange={(e) => setForm({ ...form, result: e.target.value })}
      >
        <option value="unverified">Unverified</option>
        <option value="passed">Passed</option>
        <option value="failed">Failed</option>
        <option value="blocked">Blocked</option>
      </SelectField>
      {(
        [
          ["importVerified", "Actual package import verified"],
          ["launchVerified", "Actual learner launch verified"],
          ["debugVerified", "LMS debug log inspected"],
        ] as const
      ).map(([key, label]) => (
        <label className="check-field" key={key}>
          <input
            type="checkbox"
            checked={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.checked })}
          />
          {label}
        </label>
      ))}
      <label className="field">
        <span>Evidence and observations</span>
        <textarea
          required
          maxLength={8000}
          rows={5}
          value={form.evidence}
          onChange={(e) => setForm({ ...form, evidence: e.target.value })}
        />
      </label>
      <p className="hint">
        Include test steps, outcomes and a protected evidence reference. Remove
        learner identifiers, credentials and raw suspend data. A pass requires
        all three verification checks and descriptive evidence.
      </p>
      {error && <ErrorState message={error} />}
      <Button type="submit" disabled={busy}>
        {busy ? "Recording…" : "Save acceptance record"}
      </Button>
    </form>
  );
}
