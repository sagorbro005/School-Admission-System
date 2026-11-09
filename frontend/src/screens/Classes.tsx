import { ArrowRight, BookOpen, Sun, Sunrise } from "lucide-react";
import type { Application, ClassInfo } from "../api";

interface Props {
  classes: ClassInfo[];
  holds: Application[];
  now: number;
  busy: boolean;
  loaded: boolean;
  error: string;
  onCreate: () => void;
  onApply: (classId: string) => void;
}
export function Classes({
  classes,
  holds,
  now,
  busy,
  loaded,
  error,
  onCreate,
  onApply,
}: Props) {
  return (
    <section>
      <div className="heading">
        <h2>Available classes</h2>
      </div>
      {!loaded ? (
        <p>{error ? "Class data unavailable." : "Loading classes…"}</p>
      ) : classes.length === 0 ? (
        <div className="empty">
          <h3>No classes yet</h3>
          <p>Create the first class and set its seat capacity.</p>
          <button onClick={onCreate}>Create class (Admin)</button>
        </div>
      ) : (
        <div className="grid">
          {classes.map((c) => {
            const morning = /morning/i.test(c.name);
            const day = /day/i.test(c.name);
            const Icon = morning ? Sunrise : day ? Sun : BookOpen;
            return (
              <article
                key={c.id}
                className={
                  "class-card " +
                  (morning ? "morning" : day ? "day" : "general")
                }
              >
                <div className="card-cover" aria-hidden="true">
                  <span>
                    <Icon />
                  </span>
                  <i />
                </div>
                <div className="card-body">
                  <h3>{c.name}</h3>
                  <dl>
                    {[
                      ["Capacity", c.totalSeats],
                      ["Held", c.heldSeats],
                      ["Confirmed", c.confirmedSeats],
                      ["Available", c.availableSeats],
                    ].map(([key, val]) => (
                      <div key={key}>
                        <dt>{key}</dt>
                        <dd>{val}</dd>
                      </div>
                    ))}
                  </dl>
                  <button
                    disabled={
                      busy ||
                      !c.availableSeats ||
                      holds.some(
                        (h) =>
                          h.classId === c.id &&
                          (h.status === "CONFIRMED" ||
                            (h.status === "HELD" &&
                              Date.parse(h.expiresAt) > now)),
                      )
                    }
                    onClick={() => onApply(c.id)}
                  >
                    Apply for admission{" "}
                    <ArrowRight aria-hidden="true" size={17} />
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}
    </section>
  );
}
