# Phase 1 acceptance review — 4 November 2026

> Historical review of commit `ee5682c`. F01–F04 are addressed in the subsequent publishing work. See the [current phase reviews](scorm/phase-reviews.md); the historical browser reproducer is not the current acceptance suite.

**Decision: conditional acceptance for demonstration/development; reliable-authoring sign-off is blocked by F01.** The ordinary Phase 1 workflows pass, but a reproducible P1 save-state defect can falsely report that newer edits are persisted. Resolve F01 in a separately authorized Phase 1 correction before relying on the editor for real course production or building Phase 2 on its save lifecycle.

**P0 defects verified: 0. Application fixes made: 0. Phase 2 features added: 0.** The requested P0-only limit was respected. Application source, migrations and existing setup helpers were checked against a pre-review SHA-256 manifest and left unchanged. Review changes comprise this report, review evidence/screenshots, the independent walkthrough and documentation links. Existing browser tests regenerate their original screenshots.

P0 here means an immediate release-stopping compromise or broad failure: exploitable cross-owner access, exposed administrator/session secrets, or general inability to authenticate/persist courses. P1 means significant localized correctness/data-loss risk. P2 means a narrower usability, accessibility or hardening gap. No missing Phase 2 feature is classified as a Phase 1 defect.

## What was inspected and executed

Reviewed actual files under `src`, the Prisma schema/migration, seed/password scripts, package/lock/configuration files, existing tests, and live PostgreSQL. The source had **no Git commits** when review began; the delivery commit therefore necessarily includes the already implemented application as its initial tracked baseline, together with this review. It is not a Phase 2 implementation.

| Check                                                                    | Current result                                                                 |
| ------------------------------------------------------------------------ | ------------------------------------------------------------------------------ |
| `npm run build`                                                          | Passed, Next.js 15.5.29 production build                                       |
| `npm run lint`                                                           | Passed, no errors/warnings in application baseline                             |
| `npm run typecheck`                                                      | Passed                                                                         |
| `npm test`                                                               | 10 passed across 2 files; none failed or skipped                               |
| `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` | 4 passed against the **production server**; none failed or skipped             |
| `node --env-file=.env docs/phase1-review/run-review.mjs`                 | Independent browser walkthrough completed; 4 defects reproduced and recorded   |
| `npm audit --omit=dev --audit-level=high`                                | 0 reported vulnerabilities; production dependency audit only                   |
| Live DB inspection                                                       | Migration checksum matches disk, no orphan courses, valid owned seed document  |
| Credential checks                                                        | See security assessment below; no admin password/session-secret exposure found |

The independent walkthrough uses explicit browser actions and controlled delayed/failed HTTP responses. It is separate from the four existing automated tests. Its observations are in [evidence.json](phase1-review/evidence.json); the intentionally reproduced defects are **findings, not passing assertions of correct application behavior**. One initial walkthrough stopped on an ambiguous alert selector (Next also renders an alert announcer); the helper selector was corrected and the full walkthrough then completed. No application change was needed for that harness issue.

Reproduce only against a test/development database, with a seeded administrator, production build and server running. The helper loads credentials from the local environment, generates temporary review courses/principal, and deletes those exact records in `finally`. No credentials are embedded in the helper or report. It simulates a delayed save and a list failure to reproduce F01/F03; it does not change application files or the saved demonstration course.

## Verified Phase 1 behavior

| Capability                   | Assessment and evidence                                                                                                                                                                                                                 |
| ---------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication               | Login and logout work. Production session cookie is HttpOnly, Secure and SameSite=Strict; opaque tokens are HMAC-hashed in the DB; passwords use bcrypt cost 12. Anonymous course list returns 401.                                     |
| Multiple independent courses | Browser created courses A/B; editing A did not change B or Daimler EHS. No fixed course/level count or branded renderer restriction found.                                                                                              |
| Course CRUD                  | Create, rename, edit, save, reopen and confirmed delete work on normal paths. Persistence remains subject to F01.                                                                                                                       |
| Levels/slides                | Existing browser suite adds/reorders levels, duplicates/reorders slides, reopens saved content and cancels a destructive dialog. Text, image upload and single-choice configuration persist.                                            |
| Themes/header                | Independent course color/font/header settings persist after reopening. Global card theme inheritance and explicit slide background overrides work. Presets/content remain marked provisional/demonstration.                             |
| Learner interaction          | Initial life 100%; first incorrect choice yields 75%; repeated wrong submission does not deduct again; correct feedback and restart work.                                                                                               |
| Temporary preview            | Closing/reopening resets life to 100%. Preview issued **zero mutating API requests** and left the complete course DB record unchanged. Unsaved editor content survives a preview round trip.                                            |
| Ownership isolation          | Every course query is scoped to `adminId`; create derives ownership from the session. A second administrator saw an empty list, foreign PUT returned 409, foreign DELETE returned 404. These attempts left the target course unchanged. |
| Concurrency                  | Stale revision writes return 409; UI handling of edits made during an in-flight save is defective (F01).                                                                                                                                |
| Responsive UI                | Desktop 1440px, tablet 1024px and mobile 390px were checked; mobile drawer works without horizontal dashboard overflow. This is not a complete device/accessibility certification.                                                      |

### Actual database

Baseline tables: `Admin`, `Course`, `Session`, `LoginAttempt`, `_prisma_migrations`. There was 1 administrator, 1 owned Daimler EHS course and 15 session rows at initial inspection. No password hashes, raw session tokens or connection strings were exported.

Daimler EHS has revision 1, one level and the three requested editable slides. The title column matches the JSON document title, no `game`, `life` or `progress` state is present in the course document, and the applied initial migration's SHA-256 matches the SQL file. The independent walkthrough confirms original course documents/revisions remained unchanged and **zero temporary review courses remained** after cleanup. Authentication tests can add session history; pre-existing sessions were not deleted.

## Admin design-system assessment

**Shared white/blue palette and Lucide usage: confirmed. Full standard shadcn component coverage: partial.**

- The root CSS tokens match primary `#2563EB`, hover `#1D4ED8`, background `#F8FAFC`, white surfaces, and the requested text/border/status colors. Browser-computed primary buttons stayed `rgb(37, 99, 235)` and panels stayed white on dashboard, slide editor, theme manager and header screens, even while the course theme was changed to purple/Georgia. Theme library and guide share the same shell/tokens.
- AppShell/Sidebar/Topbar/PageHeader, forms, cards, toolbar, property panels, media upload and status components are shared. Inter is bundled locally. Lucide React imports and rendered `svg.lucide` icons were verified; the base icon size/stroke is centralized.
- `ui/button.tsx` is a **local shadcn/ui-style adaptation** using Radix Slot, cva and shared class merging, with `components.json` configured for shadcn. Dialog/Drawer/Tabs use actual Radix primitives. Inputs/selects/cards are custom wrappers, not a complete vendored canonical shadcn suite. There is no separate `shadcn/ui` runtime dependency, which is normal for its source-copy model; do not claim every control is an official generated shadcn component.
- Consistency is not perfect: unsaved-navigation prompts use native `window.confirm` rather than the shared dialog; mobile stat captions are 10px and some labels 11px, below the requested 12–14px caption scale (`globals.css:2675`). The stylesheet has multiple late overrides and a literal button-shadow color outside root tokens. These are P2/P3 design debt, not reasons to replace the UI during this review.
- Learner colors are scoped to `--l-*` variables and course content remains independent of presentation. Browser observation confirmed a purple learner submit button, Georgia 20px lesson body and a yellow explicit slide override while Admin controls stayed blue/white. The learner still shares generic global resets/type rules; this is palette isolation, not an entirely separate CSS bundle.

## Verified defects — left unfixed under the P0-only instruction

### F01 — P1: a save response falsely marks later edits as saved

**Source:** `src/components/editor.tsx:214` (`save` unconditionally clears dirty after awaiting `onSave`); inputs remain editable while only the Save button is disabled.

1. Edit a slide to “Snapshot submitted to server”. Click Save.
2. Hold the PUT response after the server has saved that snapshot.
3. Change the same field to “Edit made while save response is pending”. Release the response.
4. The editor now says **All changes saved**, although the DB still contains the first title. Returning to the library does not warn because `dirty` is false; reopening loses the newer edit.

Evidence: [false saved screenshot](phase1-review/screenshots/07-save-race-false-saved.png) and the UI/stored values in `evidence.json`. This blocks reliable-authoring acceptance. Recommended correction for a later authorized fix: track the submitted document version and clear dirty only if the current draft still matches it, or prevent editing during save; preserve optimistic revision handling.

### F02 — P2: reload discards unsaved content without warning

**Source:** editor-local dirty state; there is no `beforeunload` guard or draft recovery.

Edit an unsaved slide and reload the page. No dialog fires, the dashboard opens, and the reopened course contains the previous saved text. The dedicated All courses button does warn, so navigation behavior is inconsistent. Native/manual unsaved text is not promised to autosave, but the UI should warn consistently or explicitly communicate the loss risk. The review does not add autosave or recovery.

### F03 — P2: “Try again” does not retry a failed course-list request

**Source:** `src/components/studio.tsx:298` passes `retry={() => setError("")}` instead of retrying the failing operation.

Force a GET `/api/courses` to return 503, then click Try again. The alert disappears, but GET count remains **1 before and 1 after**; the library is not refreshed. Evidence: [list failure](phase1-review/screenshots/08-list-error.png) and request counts in `evidence.json`. Keep the failed operation available for a real retry.

### F04 — P2: tabs reference absent tab panels

**Source:** `src/components/ui/index.tsx:150` renders Radix `Tabs.Trigger`, but the editor conditionals are not wrapped in `Tabs.Content`.

The active Theme manager trigger's `aria-controls` points to an ID absent from the DOM (`hasPanel: false` in evidence). Pointer navigation works, but tab/panel relationships are incomplete for assistive technology. Provide matching tab panels/labels in an authorized accessibility correction.

## Missing essentials and technical debt

All 13 core Phase 1 modules have a working normal path; **persistence correctness is incomplete under F01**. The broad styling requirements are only partially realized: per-element overrides are limited to slide background; typography exposes a single body-size/font setting rather than independent element sizes, and border/icon controls expose colors/global radius rather than comprehensive per-element styles. Star color is stored for future extension; stars are not implemented and are outside this phase.

Additional debt, not changed:

- Monolithic `editor.tsx` (830 lines), `studio.tsx` (729), a 2,721-line global stylesheet and broad shared UI barrel make state/CSS behavior harder to audit. Late typography overrides should be consolidated.
- Prisma generation/migration helpers use version-matched internal/WASM APIs and import some transitive packages directly. Pinning the lockfile helps, but upgrades need targeted migration/generation tests and explicit dependency ownership. The `--generate-initial` maintenance option can overwrite an existing migration; do not use it on applied history.
- Whole-course JSONB snapshots and embedded base64 images are fetched for the dashboard, with no pagination/asset store. Per-image UI size is 300 KB, schema accepts up to 500,000 encoded characters, and aggregate request size is 8 MiB. Limits are not fully aligned or surfaced in the editor.
- Login throttling is account-keyed, with no global/IP controls or retention job. Session rows are expiry-checked on read but not periodically removed. No database row-level security is configured; isolation is enforced by application queries/FKs and requires continued regression testing.
- `.gitignore` protects `.env` but **does not cover `.env.local` or other environment-file variants**. There is no verified leak from such a file now; adding one later could accidentally expose secrets in Git. Failed Playwright traces can contain credentials; they are ignored and must remain private.
- `APP_ORIGIN` was absent in this local runtime, so mutation checks use the incoming host/protocol. The production cookie flags were verified locally; real HTTPS/proxy deployment, explicit public origin and environment restoration were not tested in this review.
- Seed/login allow long passwords without an explicit bcrypt 72-byte policy; retention, password policy and deployment hardening deserve a focused security pass. Existing functional checks do not establish resistance to every abuse pattern.
- No complete WCAG audit, load test, backup/restore test or external production deployment test was run. Existing automated tests did not catch F01–F04; their green result is not complete acceptance.

SCORM 1.2 publishing, advanced freeform canvas, recovery, stars, course maps, multi-select, sequencing, the full six-level game and persistent learner progress remain intentionally deferred. None was added or treated as a missing Phase 1 core workflow.

## Environment variables and credential exposure

- `.env` is mode **0600**, ignored by Git, and excluded from the delivery commit. Required variable **presence only** was inspected; no values were printed. No `NEXT_PUBLIC_*` secret binding, secret interpolation in Next config, or direct client import of the DB/auth module was found.
- Exact configured administrator password/session-secret checks found **no matches in application/review source or 76 public production-build files**. Browser API response bodies likewise contained none of the configured secret values. Password hashes/token hashes are not returned by the API.
- Requests for `/.env`, `/.env.local`, `/prisma/schema.prisma` and `/test-results/trace.zip` returned **404**. These probes do not claim that every possible path/deployment configuration has been audited.
- **Important exception:** the local development `DATABASE_URL` matches the documented example. It is a disposable, publicly known development credential, not a confidential production credential. The DB is bound to `127.0.0.1:5432`; do not reuse this credential or role in production. No remotely reachable DB exposure was demonstrated, so this is not classified P0 or changed under the review scope.
- The localhost login password necessarily travels in the login request. For real use, deploy with HTTPS, an explicit origin and secure environment settings. Production `Secure` cookies were confirmed, not disabled to make tests pass.

## Screenshots

Screenshots are real captures of this review, using seeded or disposable demonstration content. Review screenshots are under `docs` rather than public application routes.

| Screen/evidence       | Capture                                                                                |
| --------------------- | -------------------------------------------------------------------------------------- |
| Administrator login   | [01-login.png](phase1-review/screenshots/01-login.png)                                 |
| Course dashboard      | [02-dashboard.png](phase1-review/screenshots/02-dashboard.png)                         |
| Level/slide editor    | [03-slide-editor.png](phase1-review/screenshots/03-slide-editor.png)                   |
| Theme manager         | [04-theme-manager.png](phase1-review/screenshots/04-theme-manager.png)                 |
| Header configuration  | [05-header.png](phase1-review/screenshots/05-header.png)                               |
| Learner life at 75%   | [06-learner-75-percent.png](phase1-review/screenshots/06-learner-75-percent.png)       |
| F01 false saved state | [07-save-race-false-saved.png](phase1-review/screenshots/07-save-race-false-saved.png) |
| F03 list failure      | [08-list-error.png](phase1-review/screenshots/08-list-error.png)                       |
| Theme library         | [09-theme-library.png](phase1-review/screenshots/09-theme-library.png)                 |
| Guide                 | [10-guide.png](phase1-review/screenshots/10-guide.png)                                 |
| Mobile                | [11-mobile.png](phase1-review/screenshots/11-mobile.png)                               |
| Tablet                | [12-tablet.png](phase1-review/screenshots/12-tablet.png)                               |

The server was started with `npm start` against the reviewed build and local PostgreSQL. No publish/deploy/Phase 2 work was performed. The Git commit is the local review deliverable; no remote push or PR is claimed.
