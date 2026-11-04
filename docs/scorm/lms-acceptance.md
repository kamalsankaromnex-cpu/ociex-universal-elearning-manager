# External LMS acceptance — evidence and staging checklist

Phase 2 exports have new metadata/runtime/scoring policy fingerprints and require a new artifact-specific test. No SCORM Cloud or Cornerstone credentials/staging access were configured for this assistant. The user has supplied a real Level 01 registration screenshot showing complete/passed/100%; its exact package version is not visible. The expanded checks below still need external execution. The application does not require these credentials to export ZIPs. Do not put LMS secrets into source, ZIPs, screenshots or chat. Any future API integration must use securely supplied environment bindings and the authorized destination.

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

Patched-package Cloud result table — **Not run by this assistant**. User evidence separately confirms one Level 01 completion/passed/100% flow (exact version not visible). A user reported a failed earlier SCORM 2004 launch (scope not specified) with error 403. The [corrected packages](fix-uninitialized-bookmark.md) require a new Cloud registration test:

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

Ready-to-import two-level QA ZIPs for both standards and precise expected life/score outcomes are in [the current QA walkthrough](remaining-checks.md). They are not approved safety training and are not inserted into the saved EHS course.

## Record acceptance against Phase 2 artifacts

Use Publishing → Export history → Download ZIP. Keep the immutable artifact ID and SHA-256 with the test notes, then use Record LMS test on that same row. Record the LMS platform, detected SCORM edition, LMS version/build (or hosted-service test date), tester/date, result and protected evidence reference. Check import, actual launch and debug inspection only after each was performed. A registration screenshot alone is not full debug verification. Re-exporting creates a new artifact requiring its own acceptance record, even when the saved course revision did not change.

Historical user-provided reports showed the earlier SCORM 2004 Daimler EHS baseline complete/passed/100% and a resumed QA baseline complete/failed/67%, including course-level rollup. Those reports do not certify the new Phase 2 ZIPs, 1.2 packages, all game/review scenarios or Cornerstone. Current artifact-level external acceptance: **unverified**. See [the Phase 2 review](../phase2/acceptance-report.md).
