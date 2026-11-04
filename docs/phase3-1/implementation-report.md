# Phase 3.1 — Multi-Select Question Authoring

4 November 2026. Built on Phase 2 commit `2669ffd`. This delivery adds only multi-select authoring/tracking and its demonstration activity; no sequencing activity, canvas, media library or other Phase 3 module is included.

## Existing systems extended

The inspection covered `Course.data` JSONB persistence and revision checks; the shared slide editor, course schema, learner renderer and pure game engine; compact SCORM resume; package validation/building; both SCORM adapters; and the existing authoring/publishing/unit/browser tests. No alternative authoring system, player, game engine, upload pipeline or LMS adapter was introduced.

**No database migration is necessary.** New question configuration is stored in the existing course JSON. Existing course data/revisions are preserved; optional new state fields are absent from legacy single-choice-only sessions. Previously archived ZIPs remain immutable.

## Authoring and rendering

- Select **Multi-Select Question** in the existing Slide type selector. Existing text, slide image, feedback, mandatory/scored flags and life penalty controls apply.
- A shared `QuestionOptionsEditor` supports two to six options, text editing, stable-ID reordering, addition/removal and multiple correct-answer checkboxes. When converting back from single-choice, removed answer IDs are filtered out so an invisible stale answer key cannot block saving. At least one correct option is required. To remove the final marked-correct option, first mark another correct option; the minimum two-option constraint remains.
- Choose **All or nothing** or **Partial credit**. Correct, incorrect and optional partial-credit feedback are editable. Omitted scoring mode means all-or-nothing.
- Optional answer images reuse MediaPicker/FileUpload and the existing raster limits. Nonempty alternative text is required. The exporter validates and packages answer images as relative, content-addressed assets, just like existing slide imagery.
- Learner and preview share native checkboxes, associated labels, a fieldset/legend, descriptive instructions, keyboard Space/Tab interaction, disabled empty submission and a live feedback status. Correctness, submission credit and retained best credit are shown explicitly.
- Preview remains temporary and does not mutate saved course data. Completed review is read-only. Restart preview and Retry current level clear checkbox drafts as well as engine state.

## Scoring and submission contract

`normalizeSubmission` is the reusable interaction boundary. It accepts selected option IDs, deduplicates them, rejects empty/unknown selections and produces one result with slide ID, interaction kind, compact selection mask, exact-correct flag and normalized credit. The learner sends that one result to `submitQuestion`; the engine verifies it against the current immutable question and applies a single state transition. It never loops over selections applying individual life penalties. Existing `answerQuestion` remains a single-choice compatibility wrapper.

All-or-nothing earns 100% only for the exact correct set, otherwise 0%. Partial credit is:

`max(0, (number of correct selections − number of incorrect selections) / number of correct answers)`

For correct answers A and B with distractors C and D:

| Selection | All or nothing | Partial credit |
| --- | --- | --- |
| A | 0% | 50% |
| A + B | 100% | 100% |
| A + C | 0% | 0% |
| A + B + C | 0% | 50% |
| A + B + C + D | 0% | 0% |
| Empty | No submission | No submission |

One or several options may be correct, including all options if the content owner deliberately configures that answer key. Credit is stored as integer basis points (0..10000); repeating an option ID cannot create free credit. The best earned credit is retained within the current level attempt, consistent with Phase 2's best-correct policy. Last submitted selections are retained separately from that best credit. Aggregate course scores keep the existing integer-percentage rounding.

Any valid non-exact submission, including partial credit, applies the configured life penalty **at most once per question per level attempt**. Repeated clicks or different wrong selections do not deduct again. Correcting a selection can improve credit without restoring lost life. Empty/invalid submissions change neither score nor life. Retry clears only the current level's multi-select records and preserves prior levels.

A mandatory multi-select question requires an exact correct submission for competency/completion regardless of passing threshold or partial credit. Optional/unscored/unanswered policies from Phase 2 continue to determine the course score independently of that completion gate. Finished game results remain protected.

## SCORM integration and resume

Both existing adapters consume the same aggregate assessment result. SCORM 1.2 continues to report its combined lesson status/raw score; 2004 reports separate completion/success, raw/scaled score, progress and its named primary objective. Existing session time, exit, commit failure and completed-review behavior are retained.

Single-choice-only state still uses the original 12-element **v1** suspend payload. Submitted multi-select state uses **v2**, appending compact index/selection-mask/best-credit triples to the same base fields. Both readers are supported. Bookmark, life, prior penalty, exact mastery, stars and level progress retain their existing meaning. The player validates multi-select resume records against the package's actual options, scoring policy and mandatory mastery state before accepting them.

Only **submitted** selections are resumable; unsubmitted checkbox edits are temporary. The selected mask represents the last submission, while credit is the best earned result. The publisher version is now `phase3.1`; new artifacts have new fingerprints and should be accepted using fresh LMS registrations. Existing archived artifacts are not rewritten.

Resume size is checked before export using a worst-case multi-select state. The existing 4096/64000-character SCORM limits are enforced without truncation. Multi-select data can reduce SCORM 1.2's usable question count below the existing 1024-slide ceiling; the validation result explains when content exceeds capacity.

## Machine-guarding activity

**Add machine-guarding sample** appends a reusable, editable demonstration to the selected level; it does not replace content or seed over existing courses. The activity explicitly says it is illustrative, requires qualified review and is not an operating, servicing or lockout procedure. It is not approved safety training.

Standalone deliverables:

- [Canonical demonstration JSON](../../deliverables/multi-select/Machine-Guarding-Demonstration.json)
- [SCORM 1.2 sample](../../deliverables/multi-select/Machine-Guarding-Multi-Select-SCORM-1.2.zip)
- [SCORM 2004 4th Edition sample](../../deliverables/multi-select/Machine-Guarding-Multi-Select-SCORM-2004-4th.zip)
- [Schema, integrity and credential-scan report](../../deliverables/multi-select/export-report.json)

Generate these with `npm run export:multi-select`. This generator does not insert a user course or change the EHS project. The JSON is a sample artifact, not a new generic course-import feature. The four EHS and two earlier QA packages were also regenerated with the shared updated player for regression testing.

## Acceptance evidence

- **114 unit/integration tests passed**, including one/multiple correct answers, exact/partial/wrong/extra/empty selections, duplicate clicks, normalization, configured modes, mandatory completion, optional/unscored policies, best credit, finished state, retry retention, option ordering, image validation/packaging, v1/v2 resume, corrupt state and resume capacity. Independent SCORM runtimes verify partial-score resume and subsequent exact completion in both versions.
- **30 browser tests passed** against the production build and PostgreSQL, including the four new multi-select scenarios plus all existing single-choice, persistence, publishing and ownership regressions. Authoring tests save/reload/reopen options, reorder/delete options, preserve answer IDs/mode/feedback/images, exercise keyboard checkboxes, both scoring modes, one/multiple correct choices, question-type conversion after option removal, preview independence, duplicate-click penalties, fresh restart and zero-life retry. Both actual delivered sample ZIPs are served without the Admin server and test partial score, selected-mask resume, exact completion and completed read-only reopening.
- Production build, lint and type checking passed. All eight delivered manifests validate against the pinned schemas; generated hashes and configured-credential scans are recorded with the artifacts. Existing course JSON/revisions are checked against their pre-development checksums.
- The initial authoring timeout was an overly strict test selector for a select-field label; the harness was corrected without weakening the behavior assertions. A new restart assertion then reproduced a real retained-checkbox-draft issue against the prior build. Restart and retry handlers now clear that draft; final regression checks pass.

## Limits and unverified work

No new sample or regenerated ZIP was imported/launched/debug-verified in SCORM Cloud or Cornerstone by this implementation. The independent runtimes and mock-LMS browser fixtures are local automated verification, not external LMS certification. Historical user reports apply to older artifacts only. Use Phase 2's immutable export history and acceptance records for real import, launch and debug evidence.

Native checkbox semantics, accessible names, fieldset instructions, live feedback and keyboard behavior are tested in Playwright. An NVDA/JAWS/VoiceOver device audit was not performed. Only raster images are supported, using existing upload limits; no SVG, rich-media library or new asset service was added. No database schema migration, learner identity integration or generic JSON import screen was added.

## Screenshots

- [Multi-select authoring](screenshots/multi-select-authoring.png)
- [Learner preview, credit and feedback](screenshots/multi-select-preview.png)
- [SCORM 1.2 completed review](screenshots/multi-select-1.2-review.png)
- [SCORM 2004 completed review](screenshots/multi-select-2004-review.png)
