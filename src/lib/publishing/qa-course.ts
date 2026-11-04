import { newCourse, newSlide, type CourseData } from "../course";
/** Stable, non-safety fixture for external LMS acceptance. Never inserted into user projects. */
export function trackingQaCourse(): CourseData {
  const course = newCourse("SCORM Tracking QA — not training content");
  course.description =
    "Two-level test fixture for life, recovery, mandatory competencies, pass/fail, resume and retry. Not safety guidance.";
  course.header.subtitle = "QA ONLY · A is the demonstration correct option";
  course.rules = { penalty: 25, recovery: 10, passScore: 80 };
  course.levels = [
    {
      id: "qa-level-1",
      title: "QA Level 01",
      slides: [
        {
          ...newSlide("First competency"),
          id: "qa-first",
          kind: "single-choice",
          mandatory: true,
          lifePenalty: 25,
          text: "QA only. A is correct. Submit B once to reduce life from 100% to 75%, then A to satisfy this competency.",
        },
        {
          ...newSlide("Recovery"),
          id: "qa-recovery",
          kind: "recovery",
          lifeRecovery: 10,
          text: "QA only. Collect recovery once to restore 10 percentage points. After a wrong answer this restores 75% to 85%.",
        },
      ],
    },
    {
      id: "qa-level-2",
      title: "QA Level 02",
      slides: [
        {
          ...newSlide("Second competency"),
          id: "qa-second",
          kind: "single-choice",
          mandatory: true,
          lifePenalty: 100,
          text: "QA only. A is correct. B exhausts life; retry this level and verify the earlier level star remains.",
        },
        {
          ...newSlide("Optional reporting check"),
          id: "qa-optional",
          kind: "single-choice",
          mandatory: false,
          lifePenalty: 0,
          text: "QA only. Choose A for a 100% passing aggregate score. Choose B for 67% and a failed assessment while both mandatory competencies remain satisfied. Life is unchanged.",
        },
      ],
    },
  ];
  return course;
}
