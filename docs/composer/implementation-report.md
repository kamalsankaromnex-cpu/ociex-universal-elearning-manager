# Universal Slide Composer implementation report

Base: `50732fc`. See [the pre-implementation inspection and architecture](architecture.md).

## Delivered architecture

| Stage | Implemented behavior |
| --- | --- |
| A — Schema | Optional versioned composition in existing Course.data JSONB. Blocks have stable IDs and individual version 1; layout, rules and completion are separate from content. Legacy slides remain supported. |
| B — Ordered blocks | Content, image/media, question, feedback, action-button and recovery blocks. Collection order is preserved within each named region; IDs survive reordering, saving and reopening. Duplication remaps internal references. |
| C — Shared rendering | Content-only, media-only, interaction-only, repeated sections and content before/after questions render through the same Learner component in preview and standalone packages. No fixed content/question/feedback order in composer slides. |
| D — Independent feedback | Each feedback block references its interaction and correct/incorrect/partial/retry condition. Multiple inline blocks can coexist; popup/overlay blocks queue independently with Escape, focus trapping and return to the source activity, including resumed dialogs. |
| E — Completion/navigation | Required or optional slides, required revealed content, mandatory/exact activity checks, additional referenced activities and explicit completion actions. Forward navigation can be free or gated by completion. Back navigation/re-entry preserves submitted state. |
| F — Multiple interactions | Single-choice and multi-select blocks have independent selections, best credit, mastery, one-time penalties and feedback. Optional/unscored policies still use the existing aggregate game engine and SCORM adapters. |
| G — Layouts | Stacked, equal columns, wide-left and wide-right layouts. Region order is explicit; collection order is preserved inside regions. Columns stack on mobile. Base and overlay presentation layers are validated. |

The editor uses existing shared white/blue components, Lucide controls, the answer-options editor, image picker, Radix dialogs and course save APIs. The renderer emits events; game-engine transitions own scoring, life, recovery, visibility, completion and navigation. Runtime data never enters course content, header or theme configuration.

## Migration and compatibility

**No SQL migration is required.** Existing course JSON/revisions are not automatically rewritten. Select Universal Slide Composer in the existing slide-type selector for an explicit draft conversion, then Save. Content, media, question configuration, inherited penalties/recovery and feedback are converted into blocks. Legacy envelope fields remain compatibility carriers; composed rendering uses the composition, not those deprecated fields. Reverse conversion to one legacy interaction is intentionally not offered because it would discard blocks.

Legacy SCORM resume v1/v2 remains readable and is still used for legacy-only sessions. Composer state uses compact v3 with block/slide ordinals: independent answers, visibility overrides, seen content, completion-action flags, active feedback and consumed recovery blocks. The same SCORM session manager validates that restored state matches the immutable package and enforces the existing 4096/64000-character limits. Pre-export checks size a worst-case runtime state and reject oversized content without truncation. New publisher version: `composer.1`.

Previously archived ZIPs stay immutable. Regenerated packages and new composer packages require their own external LMS acceptance records.

## Constrained rule contract

Supported events: enter, button activation, correct, incorrect, partial and retry. Supported actions: show, hide, feedback, record-result, complete and forward navigation. Result recording reaffirms the normalized engine submission; authors cannot award arbitrary score or life through a rule. Repeated result rules cannot duplicate life penalties.

Rules execute in collection order, once per event. Actions never emit events, run JavaScript or schedule timers. An enter event runs once per slide per level attempt; re-entry restores state rather than replaying it. Retry activity retains best credit and the prior one-time penalty, clears its draft selection and selects retry feedback. Retry level resets only that level's runtime records.

Validation rejects missing/duplicate IDs and versions, broken region/action/completion references, invalid feedback ownership/layers, impossible partial events, hidden event sources, hiding mandatory work, action buttons without activation rules, missing completion controls and backward/self/missing navigation destinations. Required work must be reachable on an entry/button/correct/retry path; mistake-only branches can reveal optional hints but cannot be the sole route to required work. Navigation from an answer event cannot skip attached feedback; use an explicit navigation button after feedback instead.

Content being “seen” means rendered or revealed, not eye-tracking, scroll-depth proof or time on screen. Required questions always need exact mastery; a completion action cannot bypass them or positive-life requirements. There is no recursive reveal/navigation execution or animation timeline.

## Validation

- 142 unit/integration tests passed, including all previous single-choice, multi-select, publishing and persistence tests.
- **36 browser tests passed; zero final failures.** Final artifact checks are recorded in [verification.json](verification.json).
- New browser coverage includes authoring order/regions, save/reload, unreachable-rule rejection, media-only completion, content-only completion controls, independent questions/feedback, popup queues, keyboard operation, focus return, resumed popup focus, re-entry, mobile stacking, aggregate scoring and actual standalone ZIPs for both SCORM versions.
- Production build, lint and type checking passed. All 10 manifests and package hashes passed; configured-credential scans found zero matches.
- An initial browser test failed because select labels included their option text, making a content textarea label ambiguous. The shared SelectField now has an explicit accessible label. No failing assertion was removed to hide this defect.

## Demonstration and usage

Open Content & slides, select Universal Slide Composer, add/reorder blocks, assign regions and attach feedback to its interaction. Configure completion/navigation and allowlisted rules, then Save and Preview. The editor displays rule-validation errors and invalid data cannot be saved or exported. Preview is disabled for an invalid course document.

`npm run export:composer` generates a three-slide acceptance demonstration: a content-only reveal/completion slide; two independent questions in side-by-side regions with inline, popup and overlay feedback; and optional unscored practice. Its [JSON, two SCORM ZIPs and export report](../../deliverables/composer) are standalone fixtures and do not insert a user course. Existing training/QA and multi-select packages are also regenerated for regression verification.

## Deferred or externally unverified

- No animation timeline, freeform canvas, arbitrary JavaScript, timers, recursive triggers, custom scoring actions, backward rule navigation or SCORM multi-SCO sequencing was added.
- Raster images use the existing upload pipeline; video/audio hosting, an asset library, rich HTML editing and arbitrary custom layout regions are outside this delivery. The editor exposes the supported one-/two-region variants; stacked custom region arrays remain schema-level configuration.
- Submitted answers and runtime effects resume. Unsubmitted input drafts and exact focus positions are not persisted; dialogs return to their owning activity on close.
- Native semantics and keyboard/focus behavior are browser-tested. No physical NVDA/JAWS/VoiceOver audit was performed.
- New packages have not been imported, launched and debug-verified in SCORM Cloud or Cornerstone by this implementation. Mock and independent-runtime results are not external LMS certification.
- No generic JSON import screen, automatic saved-course rewrite or lossless universal-to-legacy reverse conversion was added.
