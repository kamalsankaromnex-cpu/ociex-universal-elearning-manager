# Phase 2 — Publishing Management acceptance review

4 November 2026. Base: `eec126d` on `scorm-publishing`. Phase 3 authoring features are excluded.

## Delivered behavior

| Requirement | Implementation and evidence |
| --- | --- |
| Preserve working shared publishing | One `PackageBuilder`, canonical learner/game engine and version-specific adapters. All four level/course and 1.2/2004 combinations remain covered. |
| Immutable export history | `PublishedExport` archives the exact ZIP, SHA-256, selected content snapshot, source revision identifier, format/scope, timestamp, ready/failed status, metadata and validation results. History paginates by 20; authenticated downloads check ownership and SHA-256. Later edits cannot change an older download. |
| Concurrent publication | The final archive insert holds a PostgreSQL share lock on the owned course and rechecks its revision. A stale export fails rather than being mislabeled as current. Failed attempts after a valid snapshot are recorded without private exception text. Invalid/unauthorized/stale initial requests do not create spurious history. |
| Pre-export validation | Saved Zod-validated content; answer keys/options; question prompts; empty levels/content; embedded media presence and file signatures; settings; unique IDs; control characters; resume capacity. Every built manifest is validated against the pinned XSDs before ZIP creation. |
| Explicit scoring | Editable passing threshold; include/exclude optional questions; per-question scored/unscored setting; unanswered optional questions count as zero or are excluded. Default behavior preserves old saved courses. Mandatory competency, score, life and completion remain separate. |
| LMS acceptance records | Platform, SCORM edition, tested LMS version/build, tester, test date, result, evidence and import/launch/debug attestations. Records are append-only and bound to an immutable artifact ID and checksum. A recorded pass requires all three attestations and descriptive evidence; edition must match the ZIP. |
| Shared Admin design | Existing white/blue tokens, local shadcn-style Button wrappers, Radix dialog/tabs and Lucide icons. Long evidence dialogs scroll at mobile/short viewport sizes. |
| Learner tracking | Separate 1.2 and 2004 completion/success/score, bookmarks, compact resume, optional 2004 uninitialized-field handling, time/exit, completed review and failed-save handling remain covered. Named 2004 primary objective reporting is retained. |

## Phase 1 verification and corrections

- The original false-saved-state and unload-warning corrections were already present at the base. Delayed-save edits, unsaved reload/sign-out warnings, stale writes and preview preservation were rerun successfully.
- Save failures previously surfaced the generic Studio error whose retry loaded `/api/courses` instead of retrying the save. Save errors now belong to the editor; retry issues the failed PUT. Revision conflicts offer draft download and an explicitly confirmed reopen of the latest saved revision, rather than repeated unsafe saves.
- Tab-scoped session storage recovers valid unsaved drafts after accepted/forced reload. Recovery never silently applies a draft against a newer revision. Older or invalid drafts remain downloadable as JSON before discard. Browser quota/storage failure is surfaced; this is not cross-device backup.
- Tab triggers now retain matching hidden/inactive panel containers as well as a labeled, populated active panel. Pointer and arrow-key navigation and `aria-controls`/`aria-labelledby` relationships were checked in Playwright. The base already had an active Radix content wrapper; the historical missing-panel report is not presented as a newly reproduced base defect.
- The course-list retry was already implemented at the base; the new browser regression forces a 503 and verifies that Try again makes another GET.
- Browser testing reproduced an off-screen submit button in the new long acceptance dialog. The shared modal now has a viewport-bound height and internal scrolling. The test passes at 390px width.

## Scoring contract

Only single-choice questions participate in assessment. `mandatory` defaults to true, `scored` defaults to true, optional scoring defaults to include, and unanswered scoring defaults to zero. Correcting a wrong answer earns credit; a later wrong submission does not remove already-earned correct credit. Wrong-answer life penalties remain independent and idempotent per level attempt. Retry resets only the current level's state.

Unscored questions never enter the denominator. With `exclude-optional`, an unanswered optional question is removed from the denominator until submitted. Excluding optional questions removes them regardless of answer. Unanswered mandatory questions cannot complete the course even when excluded from scoring. With no scored questions, score is explicitly 100%; validation warns about this policy. Completion still requires all slides visited, all mandatory questions correct and positive life. Changing the passing threshold does not bypass those gates.

## Validation results

- **84 unit/integration tests passed**, including snapshot races, sanitized failure history, scoring policies, required competencies, genuine schema validation and independent 1.2/2004 runtimes.
- **26 browser tests passed** against the production build and local PostgreSQL. They cover persistence/concurrency, reload recovery, stale drafts, effective retries, tab accessibility, all four SCORM combinations, canonical two-level QA, immutable history/download hashes, ownership/CSRF, failure history, mobile evidence entry and evidence guards.
- The final six delivered ZIPs were regenerated; the SCORM-only browser suite was rerun against those exact delivered files. Schema/integrity reports accompany the ZIPs.
- Production build, lint and type checking passed.
- `npm run test:migrations` passed in a disposable database: full migration chain, immutable UPDATE rules, evidence constraints and cascade cleanup. The existing course database is never reset by this check.
- Existing Daimler EHS data/revision is checked against a pre-migration checksum. Browser fixtures and their archives/acceptance records are cleaned up. The four final demo exports are intentionally retained in that course's history; QA fixtures do not create user courses.
- Configured-credential scans and ZIP hash verification are run before delivery. Private environment files, browser traces and test-results remain ignored.

## External LMS evidence and remaining acceptance

The user supplied real SCORM Cloud reports for the pre-Phase-2 2004 baseline: Daimler EHS complete/passed/100%, and a resumed two-level QA attempt complete/failed/67% with matching course-level rollup. These are user-provided registration reports, not an assistant-executed import/launch/debug sign-off. They do not establish every resume/life/star/review step or compatibility of newly generated artifacts.

No SCORM Cloud or Cornerstone account was used by this implementation. All newly generated Phase 2 ZIPs remain **externally unverified** until the exact immutable artifact is imported, launched and debug-inspected. No acceptance pass was auto-inserted from old screenshots. Browser test records are explicitly synthetic/unverified and deleted with their temporary course. See [SCORM Cloud instructions and Cornerstone checklist](../scorm/lms-acceptance.md).

The earlier unpublished `exitAll`/`suspendAll` candidate remains in a separate Git stash, excluded from this branch. The later successful user Cloud report did not justify treating that candidate as the proven fix. No new multi-SCO sequencing or Phase 3 authoring was added.

## Limitations and operational notes

- Archives use PostgreSQL `bytea`, with embedded raster assets. There is no external object storage, retention worker, background export queue or automatic pruning. Monitor database growth and include archives in backups. Export requests are synchronous.
- Completed exports and acceptance records cannot be updated (PostgreSQL UPDATE rules affect zero rows). Add a new record to correct evidence. Explicit course deletion cascades to its archives and acceptance records; immutability is not an indefinite retention promise. There is no separate artifact-delete API.
- History pages show 20 exports; each artifact shows its latest 50 acceptance records. Older acceptance records remain in the database but have no dedicated pagination UI yet.
- Evidence is protected, plain text (including references to separately secured screenshots/logs), not uploaded evidence attachments or an independent LMS API integration. Testers attest to import/launch/debug checks; the application cannot independently authenticate third-party evidence.
- Local drafts are per browser tab, not a server backup. Closing the tab, browser storage eviction or storage denial can lose uncommitted work; save explicitly. An invalid draft can be downloaded but cannot be directly restored. There is no automatic field merge after a revision conflict.
- Validation checks asset type signatures, not a complete image-decoder or corporate content approval. Answer keys and provisional branding still require review.
- Phase 3 multi-select, sequencing activities, advanced canvas/templates/maps and a media library are deliberately excluded. SCORM 1.2 and Cornerstone external compatibility remain unverified.
- GitHub API requests to `api.github.com` are blocked by the managed environment's network policy. The branch, comparison link and [prepared PR description](pull-request.md) are provided; actual PR creation requires that access or the GitHub browser form. No PR number is fabricated.

## Screenshots

- [Export history, immutable revision and unverified LMS evidence](screenshots/publishing-history.png)
- [Mobile acceptance dialog](screenshots/acceptance-mobile.png)
