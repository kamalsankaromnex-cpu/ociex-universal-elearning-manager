# Course-first delivery plan — Daimler EHS

**Decision date:** 2026-11-05  
**Status:** Course delivery prioritized; new Universal Course Manager feature work on hold.  
**Tracking issue:** [#1](../../issues/1)

## Why this change

Delivering the approved Daimler EHS training course should not depend on finishing a generalized visual authoring platform. Preserve the reusable technology already created, but reduce scope to a standalone course and proven LMS packages.

## Two tracks

| Track | Status | Responsibility |
| --- | --- | --- |
| Daimler EHS standalone course | **Active** | Build, validate and deliver the learner experience and SCORM ZIPs |
| Universal eLearning Course Manager | **On hold** | Preserve existing code/history; resume after delivery |

This decision **does not archive this repository, delete source code or undo the dual SCORM publisher**. The repository currently documents SCORM 1.2 and SCORM 2004 4th Edition support, with external LMS acceptance requiring distinct evidence.

## Implementation boundary

Prefer a separate course repository (such as `daimler-ehs-course`) or an isolated course branch. Use the existing repo as a source of reusable tested code, not a runtime dependency. Avoid ongoing work on the dashboard or Visual Composer. Keep content and answer keys in structured editable files instead of coupling them to UI or database tables.

### Initial milestone: Level 01

- **Level:** EHS Vision & Strategy.
- **Slides:** Welcome to Vision Zero; Three Pillars of Vision Zero; Vision Zero Challenge.
- **Activities:** a reusable single-choice component with correct/incorrect feedback and life penalty; add multi-select and accessible sequencing when required by approved course content.
- **Theme:** reusable course tokens, image/media assets and branded header/nav. Replace all provisional branding with approved assets before release.
- **Game:** 100% initial life, configurable -25% incorrect-submission penalty, reliable retry/reset, eventual recovery, competency checks and stars. Avoid hardcoding six levels/stars into shared code.
- **Content:** only safety-approved text, media and answer keys can be classified as production-ready. Demonstration placeholders remain labeled provisional.

### SCORM release targets

| Output | Initial Level 01 | Final six-level course |
| --- | --- | --- |
| SCORM 1.2 ZIP | Required | Required |
| SCORM 2004 4th Edition ZIP | Required | Required |
| Standalone HTML5 preview | Required | Recommended |

Each SCORM ZIP must include its manifest and local assets, launch without admin/database services, report scores and completion, and support LMS bookmarking/resume. Freeze approved revision inputs before export; never include secrets.

## Quality and acceptance gates

1. Save and source revision are reproducible, with content and answer keys checked.
2. All interactions pass unit and browser tests, including repeated retry, question-type changes, multiple levels and correct branding.
3. The two SCORM packages pass static manifest/schema and mock-runtime checks.
4. Real imports/launches in SCORM Cloud are recorded with debug evidence for both versions.
5. Cornerstone staging acceptance is recorded independently for the exact standards supported by the organization's LMS configuration.
6. Course owner and safety reviewers approve content, artwork, competency and completion requirements.
7. After Level 01 approval, complete the remaining five levels and test the combined-course packages.

## Existing risks to carry forward

- Question-type changes can retain obsolete correct answer IDs.
- Consecutive Retry actions can retain learner selections.
- Game-themed courses can display hardcoded DICV identity and six stars.
- Browser regression evidence for the reviewed visual-composer branch was pending.
- Any real LMS acceptance should be documented separately from automated simulated-LMS testing.

These should be resolved in any code reused for the standalone course; they do not justify continuing broad platform development now.

## Future reuse

Keep the learner renderer, interaction components, game state transitions, theme tokens, and version-specific SCORM runtime/packaging as separate modules wherever practical. Later, re-integrate them into the universal editor through documented interfaces. Do not assume Storyline source or packaged ZIP files can automatically be turned back into editable custom projects.

## Deferred work

Universal Admin Dashboard improvements, collaboration, advanced Visual Composer/freeform canvas, general-purpose media library, broad multi-course authoring UX, advanced theming UI, and optional gamification administration.

## Operational next step

Create the isolated course-delivery workspace; build, run, and test Level 01 first. Leave the existing platform's default branch unchanged until a reviewable PR is approved.
