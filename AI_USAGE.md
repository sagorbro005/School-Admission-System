# AI assistance

OpenAI Codex read the assignment, implemented the PostgreSQL migration, .NET API, React UI, tests and Compose files, and wrote the project documentation. It used temporary local tooling to build and exercise the application.

The first frontend build rejected a spread of an unknown TypeScript value. The request helper now constructs headers from explicit objects. The first API startup failed because EF's raw SQL formatter interpreted a PostgreSQL regex quantifier as a format placeholder. Versioned migration scripts now execute as literal command text inside the migration transaction.

Review of the capacity boundary identified a payment that could overlap allocation just as a hold expired. Payments and cancellations now acquire the class lock before changing the hold.

Validation used a real PostgreSQL server and two separately running .NET processes. Six backend test cases and two Chrome browser tests passed. In a separate 1,200-request burst across both processes, 10 requests obtained the 10 available seats and 1,190 received HTTP 409. A confirmed admission survived restarting the database and both API processes. Docker Compose validated both configuration files. Container startup and volume persistence remain unverified because the host had no Docker engine.

During a second review, Codex found that the UI hid the payment button after expiry. It now shows a disabled payment button. All eight endpoints passed direct JSON contract checks, all six backend tests passed again, and the expanded four-test browser suite passed, including live expiry and recovery from a connection failure.
