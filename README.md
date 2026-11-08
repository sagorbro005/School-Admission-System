# School Admission System

A React and TypeScript admission portal backed by ASP.NET Core 8, Entity Framework Core, Npgsql and PostgreSQL. A student holds a seat, then pays a simulated fee to confirm admission before the hold expires.

## Start the application

Install Docker with Linux container support and Docker Compose v2. On Windows or macOS, start Docker Desktop. From the folder containing this README, run:

```sh
docker compose up --build
```

Open [the admission portal](http://localhost:3000). The [API class list](http://localhost:8080/classes) and [database readiness check](http://localhost:8080/health) are available separately. The database health check gates backend startup. The API applies versioned SQL migrations before accepting requests.

Use `docker compose down` to stop. The named PostgreSQL volume retains records for the next `docker compose up`. The `-v` option removes the volume and its records.

## Try the workflow

1. Open **Create class**, enter **Class 6 – Morning Shift** and a capacity of 1.
2. Save the example student number **20152691234567890** at the top of the page.
3. Choose **Apply for admission**. **My applications** shows the hold ID, deadline and countdown.
4. Select **Pay admission fee** and return to **Classes** to see the confirmed seat. Reopen the portal to see the saved identity and application.
5. To try cancellation or expiry, create a second class, apply and either cancel or wait for its deadline. Its seat becomes available again.

## Configuration

Defaults work without an environment file. Copy `.env.example` to `.env` to override them.

| Variable | Purpose |
| --- | --- |
| `HOLD_DURATION_SECONDS` | Positive whole seconds per new hold. Default 600. |
| `VITE_API_URL` | Browser-accessible backend URL, default `http://localhost:8080`. Rebuild the frontend after changing it. |
| `ADMISSIONS_CONNECTION` | Npgsql connection string. Compose passes it to the API as `ConnectionStrings__Admissions`. The default uses host `db`, database and user `admissions`, and a pool of 32 connections. |
| `POSTGRES_HOST_AUTH_METHOD`, `POSTGRES_PASSWORD` | PostgreSQL container initialization settings. For password authentication, set `scram-sha-256` and supply the matching password in the connection string. |

## REST API

Send JSON bodies using `Content-Type: application/json`. Student-scoped endpoints require `X-Student-Id` containing 17 digits. Business and input errors return a JSON problem with a readable `detail`.

| Method and path | Input | Success |
| --- | --- | --- |
| POST /classes | `{"name":"Class 6 - Morning Shift","totalSeats":120}` | 201 with id, name and totalSeats |
| GET /classes | — | 200 with class statistics array |
| GET /classes/{classId} | — | 200 with id, name, totalSeats, heldSeats, confirmedSeats, availableSeats |
| POST /classes/{classId}/holds | Student header | 201 with holdId, classId, studentId, status and expiresAt |
| GET /holds/{holdId} | — | 200 with holdId, classId, status and expiresAt |
| POST /holds/{holdId}/confirm | Student header | 200 with holdId and CONFIRMED status |
| DELETE /holds/{holdId} | Student header | 204 with empty body |
| GET /me/holds | Student header | 200 with this student's applications, class names, statuses and deadlines |

Invalid input returns 400, another student's mutation returns 403 and unknown IDs return 404. A full class, duplicate active application or incompatible state transition returns 409.

## Tests

Run the backend tests with a separate database and two API containers. This project has its own Compose name and uses no published ports:

```sh
docker compose -p admission-tests -f compose.tests.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p admission-tests -f compose.tests.yml down -v
```

The xUnit suite covers payment, duplicate applications, ownership, cancellation, automatic expiry and simultaneous allocations through one and two processes. The expiry test queries PostgreSQL directly before making another API request. To run outside Docker, start two API processes sharing a test database, set a short hold duration (15 seconds), set `API_A`, `API_B` and `TEST_DB`, then run `dotnet test backend/Tests/Admission.Tests.csproj`.

Optional browser tests use a running API at localhost:8080 and create records there. From `frontend/`, run `npm ci`, `npx playwright install chromium` and `npx playwright test`. The suite starts its own frontend and checks student identification, class creation, admission, payment, refresh and mobile layout. Set `BROWSER_CHANNEL=chrome` to use an installed Chrome.

## Project layout

| Location | Contents |
| --- | --- |
| backend/Api | Routes, admission rules, expiration worker and SQL migrations |
| backend/Tests | HTTP integration tests and direct database expiry check |
| frontend/src | React admission portal and typed API client |
| frontend/tests | Playwright browser checks |
| docker-compose.yml | Frontend, backend and persistent database |
| compose.tests.yml | Isolated multi-process test stack |

See [ASSUMPTIONS.md](ASSUMPTIONS.md) for lifecycle and locking decisions and [AI_USAGE.md](AI_USAGE.md) for assistance and verification notes.

## Evaluation checklist

- Create and inspect independent class and shift capacities through the UI and API.
- Identify a student with a 17-digit number, hold a seat, simulate payment, cancel and view their history.
- Release expired seats without user action and show current counts and countdowns after reopening.
- Verify ownership, idempotency, duplicate prevention and concurrent allocation across backend processes.
- Start the stack with Docker Compose, run integration tests against PostgreSQL and confirm volume persistence.
- Keep incremental Git history, document assumptions and AI assistance, and exclude the confidential assignment.
