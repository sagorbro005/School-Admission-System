LOCK TABLE classes, holds IN SHARE ROW EXCLUSIVE MODE;
CREATE FUNCTION class_name_key(text) RETURNS text
LANGUAGE sql IMMUTABLE STRICT PARALLEL SAFE AS $$
    SELECT lower(trim(regexp_replace(regexp_replace($1, '[[:space:]]+', ' ', 'g'),
                                     ' *[-–—] *', '-', 'g')))
$$;
CREATE TEMP TABLE class_merge ON COMMIT DROP AS
SELECT id, first_value(id) OVER (
    PARTITION BY class_name_key(name) ORDER BY created_at, id
) AS original_id FROM classes;

-- Preserve every historical ID. If the same student already has two
-- confirmations, link the extra receipt to the one seat it represents.
ALTER TABLE holds ADD COLUMN same_admission_as text REFERENCES holds(id);
UPDATE holds SET status='EXPIRED' WHERE status='HELD' AND expires_at <= statement_timestamp();
WITH ranked AS (
    SELECT h.id, first_value(h.id) OVER (
        PARTITION BY m.original_id, h.student_id
        ORDER BY (h.status='CONFIRMED') DESC, h.created_at, h.id
    ) AS winner FROM holds h JOIN class_merge m ON h.class_id=m.id
    WHERE h.status IN ('HELD','CONFIRMED')
)
UPDATE holds h SET same_admission_as=r.winner,
    status=CASE WHEN h.status='HELD' THEN 'CANCELLED' ELSE h.status END,
    cancelled_at=CASE WHEN h.status='HELD' THEN statement_timestamp() ELSE h.cancelled_at END
FROM ranked r WHERE h.id=r.id AND r.id<>r.winner;
DROP INDEX one_active_application;
CREATE UNIQUE INDEX one_active_application ON holds(class_id, student_id)
    WHERE same_admission_as IS NULL AND status IN ('HELD','CONFIRMED');
UPDATE holds h SET class_id=m.original_id FROM class_merge m
WHERE h.class_id=m.id AND m.id<>m.original_id;
DELETE FROM classes c USING class_merge m WHERE c.id=m.id AND m.id<>m.original_id;
CREATE UNIQUE INDEX unique_class_name ON classes (class_name_key(name));

CREATE OR REPLACE VIEW class_statistics AS
SELECT c.id AS "Id", c.name AS "Name", c.total_seats AS "TotalSeats",
       counts.held AS "HeldSeats", counts.confirmed AS "ConfirmedSeats",
       c.total_seats - counts.held - counts.confirmed AS "AvailableSeats"
FROM classes c CROSS JOIN LATERAL (
    SELECT count(*) FILTER (WHERE status='HELD' AND expires_at > statement_timestamp())::int AS held,
           count(*) FILTER (WHERE status='CONFIRMED')::int AS confirmed
    FROM holds WHERE class_id=c.id AND same_admission_as IS NULL AND status IN ('HELD','CONFIRMED')
) counts;
DO $$
BEGIN
    IF EXISTS (SELECT FROM class_statistics WHERE "AvailableSeats"<0) THEN
        RAISE EXCEPTION 'Class consolidation would exceed the original capacity';
    END IF;
END $$;
