CREATE TABLE classes (
    id text PRIMARY KEY, name varchar(160) NOT NULL CHECK (length(trim(name)) > 0),
    total_seats integer NOT NULL CHECK (total_seats > 0),
    created_at timestamptz NOT NULL DEFAULT statement_timestamp()
);
CREATE TABLE holds (
    id text PRIMARY KEY, class_id text NOT NULL REFERENCES classes(id),
    student_id varchar(17) NOT NULL CHECK (student_id ~ '^[0-9]{17}$'),
    status text NOT NULL CHECK (status IN ('HELD','CONFIRMED','EXPIRED','CANCELLED')),
    created_at timestamptz NOT NULL DEFAULT statement_timestamp(),
    expires_at timestamptz NOT NULL, confirmed_at timestamptz, cancelled_at timestamptz
);
CREATE UNIQUE INDEX one_active_application ON holds(class_id, student_id)
    WHERE status IN ('HELD','CONFIRMED');
CREATE INDEX student_history ON holds(student_id, created_at DESC);
CREATE INDEX due_holds ON holds(expires_at) WHERE status='HELD';
CREATE VIEW class_statistics AS
SELECT c.id AS "Id", c.name AS "Name", c.total_seats AS "TotalSeats",
       counts.held AS "HeldSeats", counts.confirmed AS "ConfirmedSeats",
       c.total_seats - counts.held - counts.confirmed AS "AvailableSeats"
FROM classes c CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE status='HELD' AND expires_at > statement_timestamp())::int AS held,
           count(*) FILTER (WHERE status='CONFIRMED')::int AS confirmed
    FROM holds WHERE class_id=c.id AND status IN ('HELD','CONFIRMED')
) counts;
CREATE VIEW application_history AS
SELECT h.id AS "HoldId", h.class_id AS "ClassId", c.name AS "ClassName", h.student_id AS "StudentId",
       CASE WHEN status='HELD' AND expires_at <= statement_timestamp() THEN 'EXPIRED' ELSE status END AS "Status",
       expires_at AS "ExpiresAt", h.created_at AS "CreatedAt"
FROM holds h JOIN classes c ON c.id=h.class_id;
