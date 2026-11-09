# School Admission System

A school admission portal for allocating seats by class and shift. Administrators set capacity. Students use a 17-digit birth registration number to hold a seat, confirm admission through a simulated payment, or cancel before the deadline.

## Quick start

From the project root, start the entire stack using Docker Compose (Docker Engine with Linux containers and Docker Compose v2 required). No local .NET, PostgreSQL, or Node installations are needed:

```sh
# Start in foreground (to view live logs):
docker compose up --build

# Or start in detached background mode:
docker compose up --build -d
```

| Service | Address | Description |
| :--- | :--- | :--- |
| **Admission Portal** | [http://localhost:3000](http://localhost:3000) | React single-page application |
| **Backend API** | [http://localhost:8080/classes](http://localhost:8080/classes) | ASP.NET Core REST API |
| **Health Check** | [http://localhost:8080/health](http://localhost:8080/health) | Readiness & database connectivity check |

The database container starts first. The API automatically runs pending PostgreSQL migrations before serving traffic, and the frontend becomes ready after the backend health check passes.

### Stop the application

```sh
docker compose down
```
*(All records are stored in the persistent Docker volume `admission-data` and survive container restarts).*

### Try one admission

1. Open **Create class (Admin)**. Enter **Class 6 - Morning Shift** and a capacity of **1**.
2. Save the example student number **20152691234567890** in the registration field.
3. Choose **Apply for admission**. **My applications** shows the application ID, payment deadline, and remaining time.
4. Select **Pay admission fee**. The application becomes confirmed. Return to **Classes** to see the seat count, or reopen the portal to view the saved student's history.
5. To try cancellation or expiry, create a second shift and apply again. Cancelling or waiting until the deadline releases that seat.

Use `docker compose down` to stop the stack. The named `admission-data` volume survives shutdown and is reused by the next startup. Adding `-v` deletes the volume and its admissions.

## Configuration

The defaults work without a local environment file. To customize them, copy [.env.example](.env.example) to `.env` in the project root and rebuild the stack.

| Variable | Default or use |
| --- | --- |
| `HOLD_DURATION_SECONDS` | Hold lifetime in positive whole seconds. Defaults to **600**. |
| `VITE_API_URL` | API address as reached by the browser. Defaults to `http://localhost:8080`. Changing it requires rebuilding the frontend. |
| `ADMISSIONS_CONNECTION` | Npgsql connection string passed to the API as `ConnectionStrings__Admissions`. Defaults to host `db`, database and user `admissions`, and a maximum pool size of 32 per API process. |
| `POSTGRES_HOST_AUTH_METHOD` | PostgreSQL authentication for a fresh volume. Defaults to `trust` for the local evaluation stack. |
| `POSTGRES_PASSWORD` | Supply a password and set the authentication method to `scram-sha-256` for password-based initialization. Include the same password in the API connection string. |

## Repository layout

| Path | Responsibility |
| --- | --- |
| `backend/Api/Program.cs` | ASP.NET Core startup, configuration, and dependency registration |
| `backend/Api/Http/` | REST routes, identity header validation, and JSON error responses |
| `backend/Api/Admissions/` | Admission models, seat allocation, and transactional state changes |
| `backend/Api/Data/` | EF Core database context, migration execution, and expiry worker |
| `backend/Api/Migrations/` | Ordered PostgreSQL schema and data migrations |
| `backend/Tests/` | xUnit integration tests against a real database |
| `frontend/src/` | React entry point, dashboard, API client, screens, shared components, and polling logic |
| `frontend/tests/` | Playwright browser tests |
| `compose.tests.yml` | Isolated database and two API processes for integration testing |

The frontend uses React 18, TypeScript, and Vite. The API uses .NET 8, EF Core, and Npgsql. PostgreSQL 16 stores classes and applications. Database locking and lifecycle decisions are documented in [ASSUMPTIONS.md](ASSUMPTIONS.md).

## HTTP API

The base URL is `http://localhost:8080`. Send JSON bodies with `Content-Type: application/json`. Student-scoped operations require an `X-Student-Id` header containing exactly 17 ASCII digits, including any leading zeros.

| Method and path | Input | Successful response |
| --- | --- | --- |
| `POST /classes` | JSON with `name` and positive integer `totalSeats` | **201** with `id`, `name`, `totalSeats` |
| `GET /classes` | None | **200** with an array of class statistics |
| `GET /classes/{classId}` | Class ID | **200** with `id`, `name`, `totalSeats`, `heldSeats`, `confirmedSeats`, `availableSeats` |
| `POST /classes/{classId}/holds` | Student header | **201** with `holdId`, `classId`, `studentId`, `status`, `expiresAt` |
| `GET /holds/{holdId}` | Application ID | **200** with `holdId`, `classId`, `status`, `expiresAt` |
| `POST /holds/{holdId}/confirm` | Student header | **200** with `holdId` and `status` |
| `DELETE /holds/{holdId}` | Student header | **204** with an empty body |
| `GET /me/holds` | Student header | **200** with an array containing `holdId`, `classId`, `className`, `status`, `expiresAt` |

Input and business errors return JSON Problem Details with a readable `detail` field. Typical responses are **400** for malformed input, **403** for another student's application, **404** for unknown records, and **409** for duplicate classes, full classes, duplicate active applications, or incompatible state changes.

## Testing

### Backend integration suite

Run from the root. The test project starts PostgreSQL and two API processes that share it. The test runner's exit code reports the suite result.

```sh
docker compose -p admission-tests -f compose.tests.yml up --build --abort-on-container-exit --exit-code-from tests
docker compose -p admission-tests -f compose.tests.yml down -v
```

Coverage includes payment, cancellation, ownership, expiry without an API call, class-name uniqueness, idempotent confirmation, and competition for the last seats through one or both API processes.

### Browser suite

Browser tests create classes and applications. Use a separate database for them. From the root, the following command starts a disposable API with a 15-second hold on port 18080. Compose also starts its database dependency.

```sh
docker compose -p admission-browser -f compose.tests.yml run -d --build -p 127.0.0.1:18080:8080 api-a
```

With Node.js 22 installed, run the following from `frontend/`. This example uses PowerShell. In a POSIX shell, use `export` to set the same two variables.

```powershell
npm ci
npx playwright install chromium
$env:VITE_API_URL = "http://127.0.0.1:18080"
$env:TEST_SHORT_HOLDS = "1"
npx playwright test
```

The suite starts a frontend on port 5173. It checks student identification, class creation, payment, persistence across refresh, mobile layout, live expiry, and connection recovery. Set `BROWSER_CHANNEL=chrome` to use an installed Chrome browser. From the root, run `docker compose -p admission-browser -f compose.tests.yml down -v --remove-orphans` to remove the browser test stack.

## Development notes

Add database changes as new scripts in `backend/Api/Migrations/`. The migration runner records embedded resource names in `schema_versions`; published script names and contents should remain stable. For the frontend production build, run `npm ci` followed by `npm run build` in `frontend/`.

[AI_USAGE.md](AI_USAGE.md) records AI contributions, issues found during development, and the checks used to verify them.
