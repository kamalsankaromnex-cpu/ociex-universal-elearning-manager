import { newSlide, newCourse, type Slide } from "./course";
/** Illustrative authoring fixture, not approved machine-specific safety training. */
export function machineGuardingSlide(): Slide {
  return {
    ...newSlide("Machine guarding — demonstration"),
    kind: "multi-select",
    mandatory: true,
    scoringMode: "partial-credit",
    correctIds: ["a", "b"],
    text: "Demonstration only — requires qualified safety/content-owner review before training use. On this illustrative machine-guarding card, select the two items that describe guarding controls. This is not an operating, servicing or lockout procedure.",
    options: [
      { id: "a", text: "Fixed protective barrier" },
      { id: "b", text: "Interlocked access gate" },
      { id: "c", text: "Production target" },
      { id: "d", text: "Machine paint color" },
    ],
    correctFeedback:
      "You selected both illustrative guarding controls and no distractors. Have the activity reviewed against the actual equipment and local requirements before training use.",
    partialFeedback:
      "You identified part of the illustrative answer set. Review the remaining choices; a mandatory question needs the exact set.",
    incorrectFeedback:
      "Review the distinction between guarding controls and the illustrative distractors. This demonstration is not approved safety guidance.",
  };
}
export function machineGuardingCourse() {
  const course = newCourse("Machine guarding — multi-select demonstration");
  course.description =
    "Phase 3.1 authoring and SCORM acceptance fixture, not approved safety training.";
  course.header.title = course.title;
  course.levels[0].id = "machine-guarding-demo-level";
  course.levels[0].title = "Machine guarding demonstration";
  course.levels[0].slides = [
    { ...machineGuardingSlide(), id: "machine-guarding-demo-question" },
  ];
  return course;
}
