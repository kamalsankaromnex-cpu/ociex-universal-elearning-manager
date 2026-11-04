# Dual SCORM publishing — phase reviews

4 November 2026. Scope: phases A–G from the supplied request. Reviews are sequential gates against actual source and runnable packages, not external LMS certifications. No migrations or changes to the saved Daimler EHS revision were required.

| Phase                      | Review outcome                                       | Evidence / limits                                                                                                                                                                                                                                                                                                                                                                    |
| -------------------------- | ---------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| A — authoring persistence  | Passed automated review                              | Submitted-snapshot comparison preserves dirty state for edits during an in-flight save. Reload/home/sign-out guard unsaved changes. Browser test verifies a later save/reopen and a stale-save conflict without overwriting the draft. Export requests require the current owned committed revision; tests reject stale requests before building and a revision change during build. |
| B — shared architecture    | Passed source and package review                     | CourseExportService → ExportValidator → PackageBuilder → version-specific ManifestGenerator. One existing React Learner, one game state, one ResumeStateSerializer and ScormSessionManager; adapters translate the LMS API/data model. No duplicate authoring/player implementation.                                                                                                 |
| C — SCORM 1.2              | Passed automated review                              | LMSInitialize/GetValue/SetValue/Commit/Finish and window.API discovery. lesson_status, score, lesson_location, suspend_data, exit and session time exercised. 4096-character bound enforced with bitsets. Both level/course ZIP manifests validate against distributed schemas.                                                                                                      |
| D — SCORM 2004 4th Edition | Passed automated review                              | API_1484_11; Initialize/GetValue/SetValue/Commit/Terminate. Distinct completion/success, raw/scaled scores, location, suspend_data, progress, ISO duration and exit. Actual 4th Edition ADL/IMS schemas, objectives/delivery controls and basic single-SCO sequencing validate. Not merely a version-string substitution. No claim of ADL certification.                             |
| E — publishing UI          | Passed browser review                                | Course editor Publishing tab provides scope/level/version, input validation, saved revision, ZIP download, errors and session export log/fingerprint. Dirty drafts cannot export; changing format/scope invalidates prior validation. Auth, CSRF and ownership checks protect the endpoint.                                                                                          |
| F — learner/game tracking  | Passed unit and browser review                       | 100% initial life; configured penalty/recovery; one penalty/recovery per slide per level attempt; shared life/stars for combined course; retry current level at zero; prior-level stars retained. Mandatory competencies gate completion independently of life and scoring. Preview remains temporary; LMS persistence belongs to the session adapter.                               |
| G — validation/delivery    | Automated checks passed; external acceptance pending | Four ZIPs generated and schema validated. Standalone browser launches use simulated LMS APIs and serve only package contents, without Admin requests. Resume/relaunch, missing API and failed writes tested. SCORM Cloud and Cornerstone were **not run** because no configured LMS credentials or staging access were available.                                                    |

## Final automated checks

- Unit/integration: **40 passed** (canonical model/game, both adapters, time formats, malformed/oversized resume, mandatory/optional pass/fail, schema/ZIP validation, stale exports).
- Browser: **13 passed** (existing authoring/isolation suite, save-race/conflict guards, publishing UI, four version/scope package combinations, two multi-level recovery/retry/write-failure simulations, missing API).
- `npm run build`, `npm run lint`, `npm run typecheck`: passed.
- Generated manifest report: [manifest-validation.json](../../deliverables/scorm/manifest-validation.json).
- Database: original owned Daimler EHS course remains revision 1; all temporary test courses are removed. A full-course export currently contains the same one seeded level, but the multi-level browser fixture exercises combined-course behavior.

## Self-review corrections made before delivery

- Removed the false Saved race and added page-unload/sign-out/home guards. Saves now use atomic update-and-return instead of a separate update/readback that could observe another writer’s later revision. Stale saves remain conflicts rather than overwrites.
- Restored actual failed-list retries and provided real Radix tab panels, addressing the earlier F03/F04 findings.
- Added per-question mandatory/penalty configuration, recovery slides and shared game rules without changing existing saved course JSON.
- Serializer rejects data from another package fingerprint or out-of-range/oversized state. Both bookmark fields and suspend data are read on resume; disagreement/missing saved game state fails closed with a visible error. Package media is extracted to relative, deduplicated raster assets; no external font/image/CDN dependency is needed.
- Legacy SCORM 1.2 `ims_xml.xsd` had an illegal default binding to the reserved XML namespace. Removed only that unused default declaration; target namespaces and validation constraints are unchanged. The exact provenance/correction and checksums are in [vendor/scorm](../../vendor/scorm/README.md). No schema assertions were disabled. A deliberately invalid manifest is rejected in tests.
- Replaced the initially selected ZIP library patch with fflate 0.8.3 after its advisory was reported. Native XML validation is developer tooling; it is not exposed as a public upload/parser endpoint.

## Known limitations / external gates

1. **No SCORM Cloud launch and no Cornerstone staging validation.** These are explicitly pending, not substituted by mock tests. Use [LMS acceptance instructions](lms-acceptance.md).
2. One SCO per ZIP. Level exports filter the canonical document to that level; full-course exports share one game session. Advanced multi-SCO sequencing, LMS-driven navigation, course maps and SCORM interaction/objective detail reporting are deferred.
3. SCORM 1.2 packages are limited to 1024 slides to guarantee compact resume capacity; SCORM 2004 supports the model's 10,000-slide limit. Limits are validated before export. A mismatched/corrupt resume blocks LMS tracking and shows an error instead of silently resetting prior progress.
4. Progress commits on state changes, periodically and when hidden; session termination is attempted on pagehide/save-and-exit. Hard browser/process termination cannot guarantee the final timing/termination call, but previous successful commits can be resumed. No client-only runtime can guarantee storage if the LMS refuses writes.
5. Missing LMS API allows clearly labeled practice; it never claims an LMS completion. Failed writes are visible and retryable. Completion is gated by mandatory competencies and nonzero life, even if the LMS score happens to be high.
6. Answer keys necessarily ship in browser-executed course content. This is not a tamper-proof/high-stakes assessment engine. Demo EHS answers, brand presets and content still need qualified approval.
7. Packaging runs in Node and requires the repository player/CSS/vendor resources plus esbuild and installed fonts at runtime. A deployment that copies only `.next` without these files will not support export. Packaging is synchronous in-memory ZIP work; background jobs/large-asset storage are future operational improvements.
8. Per-image uploads remain 300 KB in the editor and aggregate save bodies are limited to 8 MiB. No automatic LMS import, publishing credential storage or permanent export audit table was added. Export metadata travels inside the ZIP; the Admin export log is session-local.
9. Existing CSS typography/large-component technical debt remains. Current environment files and test traces are ignored; do not expose local development database credentials or reuse them for production.

## Security review

Export input contains only revision/scope/version/level ID. The service fetches the course using the authenticated administrator and never trusts client-supplied course content. Zod strips unrelated record fields. ZIPs contain only the selected canonical course, learner assets, schemas/licenses and nonsecret export metadata; no administrator record, cookie, database connection, process environment or server code is serialized. An exact-value scan of configured administrator/session/database secrets and explicit private-field checks are part of delivery verification. The documented development database URL remains a local example outside ZIPs, not a production credential.

## Screenshots

- [Publishing manager](screenshots/publishing-manager.png)
- [SCORM 1.2 Level 01](screenshots/player-1.2-Level-01.png)
- [SCORM 2004 Level 01](screenshots/player-2004-Level-01.png)
- [SCORM 1.2 full course](screenshots/player-1.2-Full-Course.png)
- [SCORM 2004 full course](screenshots/player-2004-Full-Course.png)

All LMS values in these screenshots came from explicit **simulated APIs**, not SCORM Cloud or Cornerstone.
