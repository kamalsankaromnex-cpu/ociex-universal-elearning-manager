import { composerContext } from "../composer/model";
import { validateComposerResume } from "../composer/runtime";
import type { CourseData } from "../course";
import {
  assessment,
  validateMultiResume,
  flatten,
  initialGame,
  type LearnerGameState,
} from "../game";
import type { ScormAdapter } from "./types";
import { ResumeStateSerializer } from "./resume";
export function scorm12Time(ms: number) {
  const cs = Math.min(3599999999, Math.floor(Math.max(0, ms) / 10));
  const h = Math.floor(cs / 360000),
    m = Math.floor(cs / 6000) % 60,
    s = Math.floor(cs / 100) % 60;
  return `${String(h).padStart(4, "0")}:${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}.${String(cs % 100).padStart(2, "0")}`;
}
export function scorm2004Time(ms: number) {
  return `PT${(Math.max(0, ms) / 1000).toFixed(2)}S`;
}
export class ScormSessionManager {
  private started = Date.now();
  private initialized = false;
  private ended = false;
  private review = false;
  get isReviewOnly() {
    return this.review;
  }
  readonly logs: string[] = [];
  constructor(
    private adapter: ScormAdapter,
    private course: CourseData,
    private fingerprint: string,
  ) {}
  initialize() {
    this.adapter.initialize();
    try {
      this.started = Date.now();
      const entry = this.adapter.get(
        this.adapter.version === "1.2" ? "cmi.core.entry" : "cmi.entry",
      );
      let state = initialGame();
      let lmsCompleted = false;
      if (entry !== "ab-initio") {
        const status = this.adapter.get(
          this.adapter.version === "1.2"
            ? "cmi.core.lesson_status"
            : "cmi.completion_status",
        );
        lmsCompleted =
          this.adapter.version === "1.2"
            ? ["passed", "completed", "failed"].includes(status)
            : status === "completed";
      }
      if (entry === "resume" || lmsCompleted) {
        const data = this.adapter.get("cmi.suspend_data");
        const location = this.adapter.get(
          this.adapter.version === "1.2"
            ? "cmi.core.lesson_location"
            : "cmi.location",
        );
        if (data) {
          state = ResumeStateSerializer.deserialize(
            data,
            this.fingerprint,
            flatten(this.course).length,
            this.course.levels.length,
            this.adapter.version,
            composerContext(this.course),
          );
          if (
            location &&
            (!/^\d+$/.test(location) || Number(location) !== state.index)
          )
            throw new Error(
              "LMS bookmark and resume state disagree. Start a new attempt or contact your LMS administrator.",
            );
        } else if (location || lmsCompleted)
          throw new Error(
            "LMS resume state is missing. Start a new attempt or contact your LMS administrator.",
          );
        validateMultiResume(this.course, state);
        validateComposerResume(this.course, state);
        if (state.finished && !assessment(this.course, state).eligible)
          throw new Error(
            "Saved completion does not satisfy mandatory competency requirements. Contact your LMS administrator.",
          );
        if (lmsCompleted) {
          if (!state.finished || !assessment(this.course, state).eligible)
            throw new Error(
              "LMS completion and saved competency state disagree. Contact your LMS administrator.",
            );
          this.review = true;
        }
      }
      this.initialized = true;
      this.logs.push(
        this.review
          ? "Opened completed registration in read-only review"
          : `Initialized SCORM ${this.adapter.version}`,
      );
      return state;
    } catch (error) {
      this.initialized = false;
      this.ended = true;
      try {
        this.adapter.terminate();
      } catch {
        this.logs.push("Failed to close LMS API after initialization error");
      }
      throw error;
    }
  }
  save(state: LearnerGameState) {
    if (!this.initialized || this.ended)
      throw new Error("LMS session is not active");
    if (this.review) return;
    const result = assessment(this.course, state),
      complete = state.finished && result.eligible;
    const data = ResumeStateSerializer.serialize(
      state,
      this.fingerprint,
      flatten(this.course).length,
      this.course.levels.length,
      this.adapter.version,
      composerContext(this.course),
    );
    this.adapter.set("cmi.suspend_data", data);
    const elapsed = Date.now() - this.started;
    if (this.adapter.version === "1.2") {
      this.adapter.set("cmi.core.lesson_location", String(state.index));
      this.adapter.set("cmi.core.score.min", "0");
      this.adapter.set("cmi.core.score.max", "100");
      this.adapter.set("cmi.core.score.raw", String(result.score));
      this.adapter.set("cmi.core.session_time", scorm12Time(elapsed));
      this.adapter.set("cmi.core.exit", complete ? "" : "suspend");
      this.adapter.set(
        "cmi.core.lesson_status",
        complete ? (result.success ? "passed" : "failed") : "incomplete",
      );
    } else {
      this.adapter.set("cmi.location", String(state.index));
      this.adapter.set("cmi.score.min", "0");
      this.adapter.set("cmi.score.max", "100");
      this.adapter.set("cmi.score.raw", String(result.score));
      this.adapter.set("cmi.score.scaled", String(result.score / 100));
      this.adapter.set(
        "cmi.progress_measure",
        String(Math.min(1, result.progress)),
      );
      this.adapter.set("cmi.session_time", scorm2004Time(elapsed));
      this.adapter.set("cmi.exit", complete ? "normal" : "suspend");
      const success =
        complete || result.assessmentComplete
          ? result.success
            ? "passed"
            : "failed"
          : "unknown";
      // A named manifest primary objective is a separate runtime record. Updating
      // only the SCO's top-level CMI leaves its sequencing objective unknown.
      const count = Number(this.adapter.get("cmi.objectives._count"));
      if (!Number.isInteger(count) || count < 0 || count > 10000)
        throw new Error("LMS objective count is invalid");
      let slot = count;
      for (let i = 0; i < count; i++) {
        if (this.adapter.get(`cmi.objectives.${i}.id`) === "course_objective") {
          slot = i;
          break;
        }
      }
      const objective = `cmi.objectives.${slot}`;
      if (slot === count)
        this.adapter.set(`${objective}.id`, "course_objective");
      this.adapter.set(`${objective}.score.min`, "0");
      this.adapter.set(`${objective}.score.max`, "100");
      this.adapter.set(`${objective}.score.raw`, String(result.score));
      this.adapter.set(`${objective}.score.scaled`, String(result.score / 100));
      this.adapter.set(
        `${objective}.progress_measure`,
        String(Math.min(1, result.progress)),
      );
      this.adapter.set(`${objective}.success_status`, success);
      this.adapter.set(
        `${objective}.completion_status`,
        complete ? "completed" : "incomplete",
      );
      this.adapter.set("cmi.success_status", success);
      this.adapter.set(
        "cmi.completion_status",
        complete ? "completed" : "incomplete",
      );
    }
    this.adapter.commit();
    this.logs.push("Progress committed");
    if (this.logs.length > 50) this.logs.shift();
  }
  terminate(state: LearnerGameState) {
    if (this.ended) return;
    this.save(state);
    this.adapter.terminate();
    this.ended = true;
    this.logs.push("Session terminated");
  }
}
