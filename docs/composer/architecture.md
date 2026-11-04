# Universal Slide Composer architecture

Inspection before implementation (base `50732fc`, 4 November 2026):

- Course.data is JSONB, revision-checked by the existing course APIs. One saved EHS course currently contains legacy content/single-choice slides. Checksums were recorded before changes.
- Existing slide fields support a single text/image/question/recovery kind and a fixed ordering. Multiple questions, independent feedback, regions, layers and configurable per-slide completion do not exist.
- Preview and SCORM already use Learner; normalized submissions, best-credit scoring, one-time penalties and retry are in the shared game engine. Keep those boundaries.
- Existing option editor, media upload, Radix dialogs/tabs, white/blue tokens, export history, schema validation and both SCORM adapters are reusable.
- Legacy resume v1/v2 uses physical slide indices. New compositions need independent interaction IDs, visibility, feedback, content-read and manual-completion state.

Migration: add an optional, versioned composition on the existing slide JSON and an explicit editor conversion. No SQL migration or automatic rewrite of saved projects. Preserve the legacy reader/player and resume formats; introduce compact resume v3 only when composer runtime state exists. New exports have a new publisher version/fingerprint.

A composition separates an ordered, stable-ID/versioned block collection; named regions/layout; presentation layers; completion/navigation policy; and allowlisted event/action rules. Supported block types: content, media, question, feedback, button and recovery. Feedback references its question ID and correct/incorrect/partial/retry condition; multiple independent feedback blocks may exist. Layout variants are stacked, equal columns, left-wide and right-wide, with mobile stacking in configured region order.

The engine owns question submission, best credit, life/recovery, activity completion, visibility and navigation guards. Renderers emit events; they do not award points or life. Rules have no arbitrary JavaScript, recursion, timers or emitted events. Showing a block does not fire another rule. Navigation rules are forward-only and require an explicit learner event. Mandatory/required content cannot be bypassed by completion actions.

Validation checks block/rule/region references and versions, unique IDs, feedback ownership, allowed trigger/action pairs, reachable required content/questions, manual-completion controls, and forward navigation references. Reachability is computed from initial visibility and reachable explicit button/question events. Navigation edges are acyclic by construction. Invalid author drafts may be edited but cannot be saved/exported.
