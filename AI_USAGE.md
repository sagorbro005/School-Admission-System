# AI usage

## Scope

OpenAI Codex assisted with requirements review, API and database implementation, the React interface, integration and browser tests, Docker configuration, and documentation. It also reorganized the code into separate HTTP, admission, and database responsibilities on the backend and feature screens on the frontend.

## Issues found and corrected

| Issue | How it was identified and resolved |
| --- | --- |
| The frontend request helper tried to spread an unknown TypeScript value into headers. | The production build caught the type error. Header construction now uses explicit objects. |
| EF interpreted a PostgreSQL regex quantifier as a format placeholder during migration. | Startup failed on the migration. The runner now executes embedded SQL as literal command text inside its transaction. |
| A payment near expiry could race a new allocation. | A review of transaction boundaries identified the gap. Confirmation and cancellation acquire the class lock before updating the application. |
| The expired payment action disappeared. | A requirement review identified the mismatch. The portal now displays a disabled payment button, covered by a browser test. |
| Duplicate class names produced separate seat pools. | Review of live data confirmed two records for the same shift. A migration consolidated historical records and added normalized class-name uniqueness. |

## Verification

The backend integration suite uses real PostgreSQL and sends HTTP requests through two separate API processes. The browser suite uses Chrome or Chromium to exercise the user-facing workflow and error handling. Commands for both suites are in [README.md](README.md).

An earlier load check sent 1,200 competing requests through two API processes for a class with ten seats. Ten requests received holds and 1,190 received HTTP 409. A restart check also verified that a confirmed admission survived restarting PostgreSQL and both API processes.
