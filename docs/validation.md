# Validation — 4 November 2026

Historical implementation checks. For current acceptance findings and limitations, use the [Phase 1 acceptance review](phase1-acceptance.md).

Validated in the prepared cloud instance using Node 24.22.1, npm 11.9.0, PostgreSQL 17.6 and system Chromium.

| Check                                                            | Result                                                               |
| ---------------------------------------------------------------- | -------------------------------------------------------------------- |
| Clean `npm ci --strict-ssl=true` and Prisma JS client generation | Passed                                                               |
| Prisma WASM initial SQL generation and migration application     | Passed                                                               |
| Repeated migration run                                           | Passed; no unapplied migrations                                      |
| Repeated administrator/demo seed                                 | Passed; existing projects preserved                                  |
| TypeScript `npm run typecheck`                                   | Passed                                                               |
| ESLint `npm run lint`                                            | Passed                                                               |
| Vitest `npm test`                                                | 10 passed, 0 failed                                                  |
| Playwright `npm run test:e2e`                                    | 4 passed, 0 failed                                                   |
| Next.js production `npm run build`                               | Passed                                                               |
| `npm audit --omit=dev --audit-level=high`                        | 0 vulnerabilities reported                                           |
| Final live browser smoke                                         | Login, seeded course editing/preview, life 100% → 75%, logout passed |
| Final screenshots                                                | Seven real screenshots in `public/screenshots`                       |

Browser checks exercise create/edit/theme/save/reopen/delete, repeated incorrect submissions, correct feedback, preview reset, course ownership, unauthenticated access, same-origin protection, stale-write rejection, mobile navigation, level and slide ordering, unsaved preview round trips, image persistence, header configuration and destructive-action cancellation. Test-created records were cleaned; the seeded administrator retains only Daimler EHS.

Initial native Prisma downloads were denied by network policy. Setup now uses matching official Prisma JavaScript and WebAssembly packages from npm with integrity verification; no TLS or checksum checks were disabled. Browser testing found an origin-check mismatch for the all-interface Next.js listener; validation now uses APP_ORIGIN or the incoming host and protocol. A logo test selector was corrected to exclude the separate life icon.

The application and PostgreSQL are running in the current instance. `install_script` and `start_skill` were saved in the environment draft. Publication and restoration in a new task have not been performed or verified. Review/save the environment settings and publish when desired.
