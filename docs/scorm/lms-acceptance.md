# External LMS acceptance — not yet executed

No SCORM Cloud or Cornerstone credentials/staging access were configured. The application does not require these credentials to export ZIPs. Do not put LMS secrets into source, ZIPs, screenshots or chat. Any future API integration must use securely supplied environment bindings and the authorized destination.

## SCORM Cloud

Use a private SCORM Cloud sandbox account. Import each file in `deliverables/scorm` as a separate course, keeping the ZIP intact with `imsmanifest.xml` at its root. Select a new registration for each test/attempt. Record the import report, format detected, registration/attempt reference (redact identifiers as needed), browser and date.

For **each of the four packages**:

1. Import and inspect the manifest/launch diagnostics. Confirm 1.2 or **2004 4th Edition**, a single SCO and relative asset paths. Resolve any import warning before acceptance.
2. Launch. Verify life 100%, correct theme/fonts/images, all exported slides and no Admin-server/CDN requests. A level ZIP must not expose excluded levels.
3. Before completing mandatory questions, inspect the Cloud debug log: status must remain incomplete. In 2004, completion and success must be separate. Merely navigating to the last slide must not complete the course.
4. Submit one wrong answer: expect a configured penalty (demo 25%, resulting in 75%). Repeat that submission: no additional penalty in that level attempt. Inspect raw score and status.
5. Close the launch window without using Save and exit. Relaunch the **same registration**. Verify the bookmarked slide, 75% life, prior penalty and competencies resume. Also try tab hide and forced interruption after a successful commit; note whether final termination/time is delivered.
6. Pass the question, visit the other slides, and choose Finish learning. Confirm raw score 100. For 1.2 expect lesson_status passed. For 2004 expect completion_status completed, success_status passed, score.scaled 1 and progress_measure 1.
7. Use Save and exit. Confirm LMSFinish or Terminate once, appropriate exit value, and valid session-time formatting. Verify completion in the registration report after relaunch.
8. In a separately authored fixture, make the question optional, choose a failing answer and finish after visiting all slides. Confirm failed reporting while required competencies are satisfied. Mandatory questions must never be bypassed by high life/score.
9. Use a multi-level fixture with recovery slides: check shared life, earned stars, configured restoration, zero-life current-level retry and retention of earlier stars. Confirm standalone level exports start their own life/completion.
10. Inspect browser console and Cloud API debug logs for unsupported data elements, truncation, sequencing, commit and termination errors. Record exact symptoms without credentials or raw learner suspend data.

Cloud result table — **all currently Not run**:

| Package               | Import  | Launch  | Incomplete/completed | Pass/fail/score | Resume/close | Debug errors  |
| --------------------- | ------- | ------- | -------------------- | --------------- | ------------ | ------------- |
| Level 01, 1.2         | Not run | Not run | Not run              | Not run         | Not run      | Not inspected |
| Level 01, 2004 4th    | Not run | Not run | Not run              | Not run         | Not run      | Not inspected |
| Full course, 1.2      | Not run | Not run | Not run              | Not run         | Not run      | Not inspected |
| Full course, 2004 4th | Not run | Not run | Not run              | Not run         | Not run      | Not inspected |

The repository's strict version-specific mocks and standalone browser server are **automated simulations**, not entries in this table. Do not promote their results to Cloud acceptance.

## Cornerstone staging checklist

Do not claim compatibility until a learning administrator completes this checklist in the intended Cornerstone tenant/staging environment:

- [ ] Confirm tenant supports the intended SCORM versions and 2004 edition; record enabled content and launch settings.
- [ ] Import each of the four ZIPs separately; inspect import and schema diagnostics and package limits.
- [ ] Confirm one SCO, correct launch item, popup/iframe behavior, API discovery and cross-origin parent/opener constraints.
- [ ] Execute every Cloud scenario above using isolated test learners/attempts, including close/relaunch and realistic corporate browser restrictions.
- [ ] Confirm transcript completion, passed/failed semantics, score rounding/threshold policy, bookmark and suspend data sizes. Some LMS policies can override content statuses; record them explicitly.
- [ ] Confirm repeated attempts/reset policy and current-level retry do not cross-contaminate different registrations or courses.
- [ ] Test shared life, recovery and stars in a course with at least two authored levels; the seeded demo contains only one level.
- [ ] Inspect browser/API/debug/server reports for failed commits, unsupported elements or sequencing errors.
- [ ] Verify no dependencies on the Admin server, secrets or private administrator data in the uploaded archive.
- [ ] Record product/tenant version, browser/date, test administrator approval, evidence and unresolved defects before accepting compatibility.

Current Cornerstone status: **Not run; compatibility unverified**.
