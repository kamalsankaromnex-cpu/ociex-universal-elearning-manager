# SCORM 2004 startup read 403 — corrected

## Report and root cause

The user reported `LMS read cmi.location failed (code 403)` and provided SCORM Cloud launch history with completion, success and score still unknown at launch end. This stopped the player before its first progress/status commit; LMS-collected session time alone did not demonstrate successful course tracking.

In SCORM 2004, read error **403** means **Data Model Element Value Not Initialized**. An unset bookmark is normal on a fresh registration. The original adapter treated every nonzero read result as fatal, and session startup unnecessarily read bookmark/suspend data even on a non-resume entry. Our original mock returned an empty string with code 0 for these reads, so the initial tests missed the real behavior.

## Correction

- Fresh entries read `cmi.entry` and start a new canonical game without reading resume-only fields.
- On resume, an empty `cmi.location` or `cmi.suspend_data` with error 403 is accepted as an empty/uninitialized optional field **only for SCORM 2004**.
- Valid suspend data still restores life, visited slides and competencies if the separate bookmark is unset.
- SCORM 1.2 code 403, code 401, other data elements, nonempty erroneous values and every failed write/commit still cause a visible error. Missing/corrupt saved game data with a nonempty bookmark remains fail-closed.
- Demo export now regenerates its integrity hashes and scans every package member for configured credential values whenever ZIPs are regenerated.

No SVG rendering change was needed; the user clarified that “svg” was a typo.

## Verification

- Added failing regressions that reproduced the exact exception before the fix, then passed after it.
- Tightened the version-specific browser mock so unset SCORM 2004 bookmark/suspend fields return 403.
- Added `scorm-again@3.5.0` as **developer-only independent runtime validation**. Its real SCORM 2004 data model reproduces `cmi.location` read 403. The corrected player/session commits incomplete/score 0 on fresh launch, then completed/passed/score 100 after the mandatory assessment.
- Browser assertions now require initial incomplete status and score 0 in all four exported package combinations, not just visible player UI.
- New browser regression resumes 75% life at the question slide with an unset LMS bookmark and valid canonical suspend data; it must have no tracking error.
- Current automated totals: **50 unit/integration tests and 14 browser tests**. XML schema validation, production build, lint and type checks are rerun with the regenerated ZIPs.

These independent-runtime/browser checks are **not a patched-package SCORM Cloud launch**. The user’s original Cloud launch exposed the defect; a new Cloud launch is still needed to accept the correction in that account.

## Retest in SCORM Cloud

1. Download the latest ZIP from the `scorm-publishing` branch, not an earlier local copy. For this error, use the regenerated **SCORM 2004 4th Edition** package.
2. Import it as a **new test course** and create a **new registration** first. This avoids cached old JavaScript and ambiguous state from the failed attempt.
3. Launch and exit before finishing. In the **launch-end** report, expect completion **incomplete** and score **0**. Success **unknown** before assessment is intentional; initial launch-start fields can also be unknown before the SCO runs.
4. Relaunch the same registration, complete the required question and visit all slides, then choose **Finish learning** and **Save and exit**. Expect completion **completed**, success **passed**, score **100**.
5. For bookmark verification, use a separate registration: answer incorrectly (75% life), close/relaunch, and confirm the same slide and life restore. Keep real LMS debug logs if another error appears; do not include credentials or raw learner suspend data in shared evidence.
