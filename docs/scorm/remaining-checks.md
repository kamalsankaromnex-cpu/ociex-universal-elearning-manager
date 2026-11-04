# Remaining SCORM checks — fixes and acceptance status

4 November 2026. The user's SCORM Cloud screenshot shows a **Level 01 registration complete, passed, score 100%**. The exact SCORM version is not visible in the screenshot. This is real user-provided completion evidence, not a simulated launch. It does not establish every resume/full-course/Cornerstone scenario.

## Verified defects fixed

| Defect                                                                                    | Correction / regression evidence                                                                                                                                                                                                                 |
| ----------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Completed registration could be reset when reopened with a normal/empty LMS entry         | Completed LMS status plus validated finished suspend state opens read-only review. No course-state/status/score writes occur; an explicit `ab-initio` fresh attempt still starts over. Both versions tested in browsers and independent runtime. |
| Completed game state could be mutated by engine actions                                   | Answer, recovery and retry transitions now leave finished game state untouched; review navigation may change only the viewed slide.                                                                                                              |
| Failed initialization left an opened LMS API active                                       | Resume/validation failures now terminate the initialized API without writing progress or changing the grade.                                                                                                                                     |
| Invalid finished resume could appear completed without mandatory competencies             | Finished state is rechecked against course competencies before use. Invalid completion fails closed without a progress write.                                                                                                                    |
| SCORM 2004 success stayed failed/unknown after a corrected assessment until course finish | Assessment success is now separate from course completion. A fully answered passing assessment reports passed while unvisited course content still keeps completion incomplete.                                                                  |
| Browser back/forward-cache pagehide terminated a session that would later resume          | Persisted pagehide commits without terminating; normal exit still saves/terminates. Browser tests simulate persisted pagehide/pageshow.                                                                                                          |
| Failed LMS save could be followed by a silent reload loss                                 | A pending failed save warns on unload/reload; retry clears the warning only after a successful save. Forced process termination can still lose uncommitted work.                                                                                 |
| Completion acknowledgement was optimistic                                                 | The player displays saving/not-saved until commit succeeds. Previously completed review explicitly says the saved LMS result is retained.                                                                                                        |

New regressions reproduced the completed-relaunch/session-cleanup/finished-state problems before correction. Independent runtime fixtures explicitly set empty entry fields (the library JSON loader skips empty strings); visitation comparisons respect bitset/set semantics rather than visit order. No assertions were removed to make a failing behavior pass.

## Runnable acceptance packages

The four Daimler EHS packages are regenerated from the unchanged **saved revision 1**. They remain a one-level demonstration course. Two additional, explicitly non-training QA packages provide real two-level acceptance content without altering or inserting user projects:

- [Two-level QA — SCORM 1.2](../../deliverables/scorm/SCORM-Tracking-QA-SCORM-1.2.zip)
- [Two-level QA — SCORM 2004 4th Edition](../../deliverables/scorm/SCORM-Tracking-QA-SCORM-2004-4th.zip)

`npm run export:demo` regenerates all six ZIPs, XSD validation results and integrity/credential-scan reports. The two-level browser tests now launch these actual delivered QA ZIPs, rather than an in-memory substitute.

## QA walkthrough in SCORM Cloud or staging

Use new isolated registrations. The QA course says **not training content** and A is always the demonstration correct answer.

1. First competency: answer B once → life **75%**. Repeat B → still 75%. Close/relaunch → same slide, life and prior penalty. Choose A to meet the competency.
2. Recovery slide: collect 10% → life **85%**. Recovery is available once per level attempt. Level 01 earns one star.
3. Second competency: answer B → life **0%**. Retry current level → life **100%**, earlier level star/competency retained. Choose A.
4. Optional reporting check: choose A for **100% / passed** after Finish learning. On a separate registration choose B for **67% / failed** with life unchanged and mandatory competencies satisfied. In 2004 completion is completed independently of failed success. In 1.2 the combined lesson_status is failed.
5. Leave any mandatory question unmet and try to finish → completion must remain incomplete regardless of life or score. Merely visiting the last slide must not complete the course.
6. Finish and Save and exit. Reopen the completed registration → completed grade retained, review controls read-only. Start a genuinely new attempt/registration → fresh life and incomplete state.
7. Inspect API/debug logs for failed commits, truncation, invalid session time and unsupported elements. Do not share raw learner suspend data or credentials.

## Validation and external boundary

- Unit/integration: **67 passed** including both independent SCORM runtimes.
- Browser: **22 passed**, including all four training package combinations, both delivered two-level QA packages, mandatory protection, optional failed assessment, completed review, fresh attempt, cache lifecycle and failed-save warning/retry.
- Build, lint and type checking passed. All six manifests validate against the pinned SCORM schemas; package hashes and configured-credential scans are recorded alongside ZIPs.
- Existing Daimler EHS data is preserved; no schema migration or safety content/answer-key change was made.
- **Real LMS boundary:** user evidence confirms one Level 01 completion flow. This assistant has not logged into SCORM Cloud or Cornerstone. Expanded scenarios and Cornerstone compatibility remain external acceptance items, not claimed successes. See [the full external checklist](lms-acceptance.md).
