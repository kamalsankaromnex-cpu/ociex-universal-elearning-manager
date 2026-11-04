# Add revision-bound publishing history, scoring policies and LMS acceptance records

Publishing previously returned transient ZIP downloads without an archive or a way to associate LMS evidence with the exact tested artifact. This change stores immutable saved-revision exports with checksummed downloads, ready/failed history and append-only LMS acceptance records. The existing shared renderer continues to export individual levels and full courses in SCORM 1.2 and 2004 4th Edition.

The editor now retries failed saves directly, offers conflict-safe draft recovery/download after reload, and keeps tab/panel accessibility links intact. Scoring settings explicitly separate mandatory completion, optional/unscored questions, unanswered-answer policy and passing score. Pre-export content/media/settings checks and runtime XSD validation protect publication. Shared white/blue components and Lucide icons are retained; Phase 3 authoring is excluded.

Validation: 84 unit/integration tests; 26 production-browser tests; production build, lint and type checking; clean disposable-database migration/immutability checks; six generated ZIPs with schema, integrity and configured-credential reports. See docs/phase2/acceptance-report.md for evidence and limitations.

Deployment: run npm ci, npm run db:generate and npm run db:migrate before starting the upgraded app. The additive migration preserves existing course JSON and revisions. Archives are stored in PostgreSQL and grow with each export; course deletion removes its history. Local draft recovery is per browser tab. Evidence is tester-attested plain text, with the latest 50 acceptance entries displayed per artifact.

External acceptance: historical user-provided SCORM Cloud reports apply to the previous baseline only. New Phase 2 artifacts have not been imported/launched/debug-verified in SCORM Cloud or Cornerstone. Do not infer LMS compatibility from automated fixtures. The unrelated unpublished navigation candidate is excluded.
