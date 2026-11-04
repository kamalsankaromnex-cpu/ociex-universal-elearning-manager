# Coursecraft — Universal eLearning Course Manager

A working authoring studio with Phase 2 publishing management. Courses are independent projects; Daimler EHS is editable demonstration content, not a platform restriction.

**Current milestone:** Universal Slide Composer adds ordered versioned blocks, multiple independent interactions/feedback, regions/layers and configurable completion/navigation through the existing player and game engine. See the [inspection, implementation report and limitations](docs/composer/implementation-report.md). Existing courses remain supported without a SQL migration.

## Run locally

Requires Node **24.x**, npm **11.x**, Docker (or PostgreSQL 17), and Chromium for browser tests.

```sh
npm ci
cp .env.example .env
# Edit .env: set a random SESSION_SECRET (32+ characters), ADMIN_EMAIL,
# a strong ADMIN_PASSWORD (12+ characters), and your DATABASE_URL.
# For the provided Docker database, set the same password in your shell:
export POSTGRES_PASSWORD='your-local-database-password'
docker compose up -d --wait
npm run db:generate
npm run db:migrate
npm run db:seed
npm run dev
```

Sign in at port 3000 using the administrator credentials in your **local `.env`**. No default administrator password is embedded in source. In the prepared cloud instance, `.env` already contains a generated password and session secret; keep this ignored file private. Database credentials in the example are local development examples only.

`APP_ORIGIN` must match the browser origin (including scheme and port). For deployment set it to the public HTTPS origin. Production cookies require HTTPS; localhost is suitable for local browser validation. `npm run build && npm start` runs the production build. Put production PostgreSQL behind appropriate access controls and backups; use a dedicated least-privilege application database role.

Migrations and seed are repeatable. Seed creates an administrator if missing and creates Daimler EHS only if no course of that name belongs to that administrator; it never overwrites saved work or resets existing passwords. Change `ADMIN_EMAIL` and seed again to provision another independent administrator. Public signup is intentionally absent. See `scripts/set-admin-password.ts` for an explicit password reset command.

### Cloud runtime

The current instance uses the persistent Docker volume `elearning-pgdata` and container `elearning-postgres`. Start that existing container with `docker start elearning-postgres`, rather than also starting Compose on the same port. Compose is the reproducible alternative for a new checkout. Application processes must be restarted in new tasks. Work in the existing isolated checkout; no worktree is needed.

Native Prisma CLI downloads may be restricted in managed environments. `db:generate` invokes the official, version-pinned Prisma JavaScript generator. `db:migrate` uses Prisma's matching WebAssembly schema engine and PostgreSQL adapter; it generates standard SQL and maintains `_prisma_migrations`, including checksums. All packages are integrity-checked through `package-lock.json`; no TLS or checksum bypass is used. Keep Prisma packages in sync when upgrading. In an environment permitting `binaries.prisma.sh`, the normal `npx prisma migrate deploy` is also compatible with these migrations.

## Validate

```sh
npm run db:migrate
npm run db:seed
npm run typecheck
npm run lint
npm test
npm run test:migrations # uses a disposable database; requires CREATE DATABASE privilege
npm run build
# Use installed Chromium in the prepared cloud environment:
PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e
# Else install Playwright Chromium first: npx playwright install chromium
```

The browser test starts the development server if none is running. It creates, edits, themes, saves, reopens, previews and deletes a real PostgreSQL course. It verifies 100% → 75% life, no duplicate penalty, correct feedback, preview reset, cross-administrator isolation, unauthenticated rejection, CSRF rejection, stale-write protection, and mobile navigation. It writes the screenshots below. Tests require the seeded administrator's environment variables and a development database. Browser traces may contain submitted credentials: `test-results/` is ignored; keep local diagnostic artifacts private.

## Implemented

- White/blue responsive authoring shell, sidebar/drawer, breadcrumbs, dashboard, search and sorting, course statistics, guide and provisional theme library.
- Administrator login with bcrypt password hashes, hashed opaque server-side sessions, 8-hour expiry, HttpOnly/SameSite cookies, production Secure cookies, database-backed login throttling, same-origin mutation checks and logout revocation.
- Course create/rename/edit/delete; delete confirmation. Ownership enforced on every API query. Revision checks prevent stale saves overwriting another editor.
- Ordered, named levels and slides with add, rename, reorder, duplicate slide and confirmed deletion. Empty/loading/error/success states.
- Text, raster image upload (300 KB per image), background override/reset, reusable single-choice options, configurable answer key and feedback.
- Course color tokens, font/size/radius, background imagery, logo and configurable header. Inherited theme values update learner elements; explicit slide backgrounds stay overridden. Admin styling is separate.
- Temporary preview with navigation, correct/incorrect feedback, 100% initial life, one 25% penalty per question for the first incorrect submission, clamping at zero and restart. Preview does not save progress or discard the editor draft.
- PostgreSQL/Prisma persistence, migration SQL, repeatable seed and shared Zod validation.

## Intentionally incomplete / future milestones

Advanced freeform canvas, a full authored six-level course, sequencing activities, advanced multi-SCO sequencing and course maps are not implemented. Basic recovery, level stars and shared multi-level life are now implemented. There is no standalone learner authentication, standalone server-side learner-progress storage, hosted public course URL, collaboration, password recovery, arbitrary external media URLs, rich-text HTML editor or cloud asset storage. Raster images are embedded in course JSON for this MVP; large media libraries should use object storage. Preview does not enforce a pedagogical progression lock. The application does not imply content or corporate brand approval.

## Architecture and extension points

`src/lib/course.ts` is the canonical validated course document, stored as a JSONB snapshot on an owned `Course` record. Content (`levels/slides`) and presentation (`theme/header`) are separate. Slide arrays determine order; UUIDs are stable identities. `src/lib/game.ts` owns the canonical pure game-state transitions independently of maps, headers and persistence. New interaction kinds can extend the discriminant and renderer; publishing adapters consume the course document without reading editor UI state.

`src/app/api` enforces authentication, ownership, input validation and optimistic revisions. `src/components/editor.tsx` edits the canonical document and `learner.tsx` renders it using only learner tokens. `src/components/ui` contains the shared shadcn-style cva/Tailwind/Radix primitives; `components.json` configures shadcn/ui conventions. See [component usage](docs/components.md).

## Screenshots

Generated from the real application by Playwright:

- [Administrator login](public/screenshots/login.png)
- [Dashboard](public/screenshots/dashboard.png)
- [Slide editor](public/screenshots/slide-editor.png)
- [Theme manager](public/screenshots/theme-manager.png)
- [Course header](public/screenshots/course-header.png)
- [Learner preview](public/screenshots/learner-preview.png)
- [Mobile dashboard](public/screenshots/mobile-dashboard.png)

Daimler EHS content, example answer keys, illustrative pillars and both brand presets are explicitly **demonstration/provisional** and require qualified approval before training use.

## Dual SCORM publishing

**SCORM Cloud startup error 403:** the uninitialized bookmark fix is included in the regenerated ZIPs. See [the correction and re-import steps](docs/scorm/fix-uninitialized-bookmark.md).

Open a course, save it, then use **Publishing**. Choose an individual level or full course and SCORM 1.2 or SCORM 2004 4th Edition. Validate the saved revision, then export the ZIP. Unsaved drafts cannot export; stale revisions return a conflict. Both versions reuse the same learner/game model. Questions can be mandatory or optional with a configured life penalty; recovery slides and course defaults are editable. Mandatory competencies must be passed before completion.

Regenerate the four seeded demo packages, two multi-level QA packages and XSD report with `npm run export:demo`. Packages are in [deliverables/scorm](deliverables/scorm). The seeded full course currently has one level; tests separately exercise two-level shared life, stars, recovery and retry. Deploy packaging with the source player/CSS/vendor directory and installed fonts/esbuild available, not only the Next build output. No LMS account is needed to generate packages.

`npm test` runs 142 unit/integration checks. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH=/usr/bin/chromium npm run test:e2e` runs 36 browser checks, including an independent HTTP server that serves only ZIP contents with simulated LMS APIs. **These are not real SCORM Cloud launches.** See [schema/runtime review and limitations](docs/scorm/phase-reviews.md) and [SCORM Cloud instructions / Cornerstone checklist](docs/scorm/lms-acceptance.md).

SCORM 1.2 resume state is bounded to 4096 characters (1024-slide ceiling; multi-select state may require fewer slides); 2004 uses the 64000-character limit. Missing API and failed writes are explicit, and all assets use local relative paths. Completed learning and mandatory competencies are tracked separately from life. Previously saved course documents remain valid with legacy scoring defaults. Apply the additive Phase 2 database migration to create archive and acceptance tables; course JSON and revisions are preserved.

Latest reliability fixes and the ready-to-import two-level QA packages are documented in [remaining SCORM checks](docs/scorm/remaining-checks.md). Completed registrations reopen in read-only review; failed saves warn before reload. The user supplied real SCORM Cloud Level 01 completion/passed/100% evidence; broader external LMS acceptance remains separate.

SCORM 2004 primary-objective reporting correction: [evidence, validation and retest steps](docs/scorm/fix-primary-objective.md).

## Phase 2 publishing workflow

1. Save the course. In Course settings choose the passing threshold, optional-question scoring and unanswered-question policy; each question also has a scored/unscored control independent of mandatory completion.
2. Open Publishing, choose level/full course and the SCORM edition, then validate the saved revision and export. Every archive records its immutable artifact ID, source revision, format/scope, timestamp, status, metadata, validation and SHA-256. A final database lock/check prevents publication under a changed revision.
3. Re-download that exact ZIP from Export history after any later edits. A failed request after a valid snapshot is retained as a failed history entry. History is authenticated and scoped to the course owner.
4. Import the exact archived ZIP into the target LMS. Record platform, edition, LMS version/build, tester/date, result and redacted evidence with Record LMS test. A reported pass requires actual import, launch and debug verification. Add a new append-only record to correct an earlier entry.

`npm run export:demo` now archives the four saved Daimler EHS outputs and includes their artifact IDs in the generated reports. The two QA ZIPs remain standalone fixtures and do not insert course projects. `npm run test:migrations` checks the complete migration chain and immutability/evidence constraints in a disposable database. The ordinary migration does not require permission to create a database.

Archives use PostgreSQL bytea and are retained until their course is explicitly deleted. Include them in backups and monitor storage growth. Acceptance evidence is plain text, not uploaded attachments or independently verified LMS integration. See the full [Phase 2 acceptance report](docs/phase2/acceptance-report.md) for remaining limits and the [prepared PR description](docs/phase2/pull-request.md).

## Multi-select authoring (Phase 3.1)

In Content & slides, choose **Multi-Select Question**. Add/edit/reorder answer options, mark one or more correct, choose **All or nothing** or **Partial credit**, and configure feedback, optional images/alternative text and mandatory/scored flags. Save, reopen and use Preview to test the same player used by both SCORM exports.

Partial credit is `max(0, (correct selections - incorrect selections) / correct answers)`. Best credit is retained per attempt. Mandatory questions still need the exact answer set; a partial or wrong submission costs at most one configured life penalty per question per level attempt. Empty submission is disabled and ignored by the engine. Only submitted selections are saved for SCORM resume.

Use **Add machine-guarding sample** to append an explicitly provisional demonstration. `npm run export:multi-select` produces its [canonical JSON and two standalone SCORM samples](deliverables/multi-select), with hashes, schema validation and credential-scan results. No existing course is seeded over, and no SQL migration is needed. Existing single-choice payloads keep resume v1; multi-select uses a compact, validated v2 extension. See the [full implementation report](docs/phase3-1/implementation-report.md) for acceptance tests, screenshots and unverified external LMS/device checks. No other Phase 3 module is implemented.

## Universal Slide Composer

Choose Universal Slide Composer in the slide-type selector to convert a legacy slide explicitly in the editor draft. Add/reorder content, media, questions, feedback, buttons and recovery blocks; assign layout regions; attach each feedback block to its own activity/condition. Configure required/optional slides, completion controls and forward-navigation gates. Save/reopen, preview and publish use the same model and renderer.

The rule system is a bounded event/action allowlist with validated references and reachability. It cannot run scripts, recursively emit events or bypass mandatory competencies. The game engine owns all scores and life. Existing resume v1/v2 is preserved; composers use compact v3 within the same SCORM limits. Existing saved projects are not automatically rewritten, and archived packages remain immutable.

Run `npm run export:composer` for the [composer demonstration JSON, SCORM 1.2/2004 ZIPs and reports](deliverables/composer). See [the implementation report](docs/composer/implementation-report.md) for tests, failed-test corrections and deferred features. New artifacts require external LMS acceptance; no animation timeline or freeform canvas is included.
