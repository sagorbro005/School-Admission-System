# Admission rules and design decisions

## Classes and capacity

Each class-and-shift combination has its own ID and seat limit. The class name carries both parts, so administrators can enter the school's actual shifts. Morning and Day shifts may coexist. A database uniqueness rule ignores differences in case, extra spaces, and dash style. A duplicate request returns HTTP 409 and retains the existing capacity.

When upgrading older data with duplicate names, the earliest class keeps its ID and capacity. The migration moves application history to that class and links duplicate confirmations belonging to the same student. Both application IDs remain available, and the student occupies one seat. The migration rolls back if the consolidation would exceed the original capacity.

## Identity and access

A student number is a 17-character string of ASCII digits; leading zeros are meaningful. The browser stores the selected number locally and sends it in the student header. Switching students changes whose history is displayed. Ownership checks use this header, so knowledge of a number is sufficient to present that identity.

Class creation is available through the admin screen without credentials, as specified by the assignment. The default Compose database uses trusted connections within its container network and publishes no database port. The frontend and API use published host ports 3000 and 8080.

## Application lifecycle

| Starting state | Event | Result |
| --- | --- | --- |
| No active application in this class | Apply while a seat is available | A new **HELD** application receives a UTC deadline. |
| **HELD** | Owner confirms before the deadline | **CONFIRMED**. Simulated payment succeeds. |
| **HELD** | Owner cancels before the deadline | **CANCELLED**. The seat is available. |
| **HELD** | Deadline is reached | **EXPIRED**. The seat is available immediately. |
| **CONFIRMED** or **CANCELLED** | Owner repeats the same successful operation | The API returns success again. Seat counts stay the same. |

Confirmed admissions are final. Other incompatible transitions return HTTP 409. Expired and cancelled applications stay in history and allow a new application. A student may hold or confirm seats in different classes. Within a class, a student may have only one active admission.

The database clock determines expiry and eligibility to confirm. The browser countdown uses the device clock for display. The client polls after each refresh cycle, normally every four seconds, and refreshes both seat counts and student history after a mutation.

## Allocation under concurrency

1. The API starts a PostgreSQL transaction at the default READ COMMITTED isolation level and obtains a row lock on the requested class.
2. After acquiring the lock, a new statement sees previously committed allocations. The transaction marks expired holds, checks the student's active application, and evaluates the class's current capacity.
3. The transaction inserts the hold and commits. A partial unique index also enforces one active application per student per class.

The grant of the class lock determines first-come ordering between competing requests. Network arrival order can differ from lock acquisition order. Other classes allocate independently. Confirmation and cancellation lock the class before the application, using the same order across API processes.

Seat counts are derived from database records. Available seats equal capacity minus confirmed seats and unexpired held seats. Reads recognize an expired hold at its deadline. A background worker also persists expiry in batches of up to 500 every second, skipping locked rows so multiple workers can run together.

## Persistence and startup

Compose uses a named PostgreSQL volume. API startup applies pending SQL migrations in a transaction protected by a PostgreSQL advisory lock. Concurrent API startups serialize migration work, and a failed migration rolls back before the API serves traffic.
