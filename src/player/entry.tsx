import { createRoot } from "react-dom/client";
import { useState } from "react";
import { Learner } from "../components/learner";
import { courseSchema, type CourseData } from "../lib/course";
import type { ScormVersion } from "../lib/scorm/types";
declare global {
  interface Window {
    __COURSECRAFT_PACKAGE__: {
      course: unknown;
      version: ScormVersion;
      fingerprint: string;
    };
  }
}
function Player({ course }: { course: CourseData }) {
  const [closed, setClosed] = useState(false);
  const payload = window.__COURSECRAFT_PACKAGE__;
  return closed ? (
    <main>
      <h1>Session ended</h1>
      <p>You may close this LMS window.</p>
    </main>
  ) : (
    <Learner
      course={course}
      tracking={{ version: payload.version, fingerprint: payload.fingerprint }}
      onClose={() => setClosed(true)}
    />
  );
}
try {
  createRoot(document.getElementById("root")!).render(
    <Player
      course={courseSchema.parse(window.__COURSECRAFT_PACKAGE__.course)}
    />,
  );
} catch {
  document.getElementById("root")!.textContent =
    "This learning package could not be loaded. Contact your LMS administrator.";
}
