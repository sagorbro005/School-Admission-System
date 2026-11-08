import React, { useCallback, useEffect, useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { Application, ClassInfo, request, validStudent } from "./api";
import "./style.css";

type Page = "Classes" | "My applications" | "Create class";
function Dashboard() {
  const [student, setStudent] = useState(() => {
    try {
      const id = localStorage.getItem("admission.student") || "";
      return validStudent(id) ? id : "";
    } catch {
      return "";
    }
  });
  const [draft, setDraft] = useState(student);
  const [page, setPage] = useState<Page>("Classes");
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [holds, setHolds] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    const current = ++generation.current;
    try {
      const [list, applications] = await Promise.all([
        request<ClassInfo[]>("/classes"),
        student
          ? request<Application[]>("/me/holds", "GET", student)
          : Promise.resolve([]),
      ]);
      if (current !== generation.current) return;
      setClasses(list);
      setHolds(applications);
      setLoaded(true);
      setError("");
    } catch (e) {
      if (current === generation.current) setError((e as Error).message);
    }
  }, [student]);
  useEffect(() => {
    let active = true;
    let timer: ReturnType<typeof setTimeout>;
    async function poll() {
      await refresh();
      if (active) timer = setTimeout(poll, 4000);
    }
    void poll();
    return () => {
      active = false;
      clearTimeout(timer);
      generation.current++;
    };
  }, [refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 500);
    return () => clearInterval(timer);
  }, []);
  async function act(work: () => Promise<unknown>, success: string) {
    setBusy(true);
    setNotice("");
    try {
      await work();
      setNotice(success);
    } catch (e) {
      setNotice((e as Error).message);
    } finally {
      await refresh();
      setBusy(false);
    }
  }
  function identify(e: React.FormEvent) {
    e.preventDefault();
    if (!validStudent(draft)) {
      setNotice("Enter exactly 17 digits for the birth registration number.");
      return;
    }
    generation.current++;
    setHolds([]);
    setLoaded(false);
    setStudent(draft);
    try {
      localStorage.setItem("admission.student", draft);
      setNotice("Student number saved.");
    } catch {
      setNotice(
        "Student number selected for this visit. Browser storage is unavailable.",
      );
    }
    if (draft === student) void refresh();
  }
  const identified = validStudent(student) && draft === student;
  const pages: Page[] = ["Classes", "My applications", "Create class"];
  const available = classes.reduce((n, c) => n + c.availableSeats, 0);
  return (
    <>
      <header>
        <div className="brand">
          <span className="crest" aria-hidden="true">
            A
          </span>{" "}
          School Admissions
        </div>
        <span className="portal">Admission portal</span>
      </header>
      <main>
        <section className="intro">
          <div>
            <div className="overline">STUDENT SERVICES</div>
            <h1>Admissions desk</h1>
          </div>
          <form onSubmit={identify} className="identity">
            <label htmlFor="student">Student birth registration number</label>
            <div>
              <input
                id="student"
                inputMode="numeric"
                maxLength={17}
                placeholder="17-digit registration number"
                value={draft}
                disabled={busy}
                onChange={(e) => setDraft(e.target.value)}
              />
              <button disabled={busy}>Save ID</button>
            </div>
          </form>
        </section>
        <nav aria-label="Admission sections">
          {pages.map((p) => (
            <button
              key={p}
              aria-current={page === p ? "page" : undefined}
              onClick={() => {
                setPage(p);
                setNotice("");
              }}
            >
              {p}
            </button>
          ))}
        </nav>
        {error && (
          <p className="alert" role="alert">
            {error}
          </p>
        )}
        {notice && (
          <p className="notice" role="status">
            {notice}
          </p>
        )}
        {page === "Classes" && (
          <section>
            <div className="heading">
              <h2>Available classes</h2>
              {loaded && (
                <span className="summary">{available} open seats</span>
              )}
            </div>
            {!loaded ? (
              <p>{error ? "Class data unavailable." : "Loading classes…"}</p>
            ) : classes.length === 0 ? (
              <div className="empty">
                <h3>No classes yet</h3>
                <p>Create the first class and set its seat capacity.</p>
                <button onClick={() => setPage("Create class")}>
                  Create class
                </button>
              </div>
            ) : (
              <div className="grid">
                {classes.map((c) => (
                  <article key={c.id}>
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
                            ["HELD", "CONFIRMED"].includes(h.status),
                        )
                      }
                      onClick={() => {
                        if (!identified) {
                          setNotice(
                            "Save your 17-digit registration number above before applying.",
                          );
                          document.getElementById("student")?.focus();
                          return;
                        }
                        void act(async () => {
                          await request(
                            "/classes/" + c.id + "/holds",
                            "POST",
                            student,
                          );
                          setPage("My applications");
                        }, "Seat held. Pay the admission fee before the timer ends.");
                      }}
                    >
                      Apply for admission
                    </button>
                  </article>
                ))}
              </div>
            )}
          </section>
        )}
        {page === "My applications" && (
          <section>
            <div className="heading">
              <h2>My applications</h2>
            </div>
            {!student ? (
              <div className="empty">
                Save your student number to view your applications.
              </div>
            ) : !loaded ? (
              <p>
                {error
                  ? "Application data unavailable."
                  : "Loading applications…"}
              </p>
            ) : !holds.length ? (
              <div className="empty">
                <h3>No applications yet</h3>
                <button onClick={() => setPage("Classes")}>
                  Browse classes
                </button>
              </div>
            ) : (
              <div className="grid">
                {holds.map((h) => {
                  const left = Math.max(
                    0,
                    Math.ceil((Date.parse(h.expiresAt) - now) / 1000),
                  );
                  const status =
                    h.status === "HELD" && !left ? "EXPIRED" : h.status;
                  return (
                    <article key={h.holdId}>
                      <span className={"status " + status}>{status}</span>
                      <h3>{h.className}</h3>
                      <small>{h.holdId}</small>
                      <p>
                        Hold deadline · {new Date(h.expiresAt).toLocaleString()}
                      </p>
                      {status === "HELD" && (
                        <>
                          <p className="timer">
                            {Math.floor(left / 60)}:
                            {String(left % 60).padStart(2, "0")} remaining
                          </p>
                          <div className="actions">
                            <button
                              disabled={busy || !identified}
                              onClick={() =>
                                void act(
                                  () =>
                                    request(
                                      "/holds/" + h.holdId + "/confirm",
                                      "POST",
                                      student,
                                    ),
                                  "Payment successful. Admission confirmed.",
                                )
                              }
                            >
                              Pay admission fee
                            </button>
                            <button
                              className="secondary"
                              disabled={busy || !identified}
                              onClick={() =>
                                void act(
                                  () =>
                                    request(
                                      "/holds/" + h.holdId,
                                      "DELETE",
                                      student,
                                    ),
                                  "Application cancelled.",
                                )
                              }
                            >
                              Cancel
                            </button>
                          </div>
                        </>
                      )}
                    </article>
                  );
                })}
              </div>
            )}
          </section>
        )}
        {page === "Create class" && (
          <section>
            <div className="heading">
              <h2>Create class</h2>
            </div>
            <form
              className="admin"
              onSubmit={(e) => {
                e.preventDefault();
                const form = e.currentTarget;
                const data = new FormData(form);
                void act(async () => {
                  await request("/classes", "POST", "", {
                    name: data.get("name"),
                    totalSeats: Number(data.get("seats")),
                  });
                  form.reset();
                  setPage("Classes");
                }, "Class created.");
              }}
            >
              <label>
                Class and shift name
                <input
                  name="name"
                  maxLength={160}
                  required
                  placeholder="Class 6 – Morning Shift"
                />
              </label>
              <label>
                Total seats
                <input
                  name="seats"
                  type="number"
                  min="1"
                  max="2147483647"
                  required
                  placeholder="120"
                />
              </label>
              <button disabled={busy}>Create class</button>
            </form>
          </section>
        )}
      </main>
    </>
  );
}
createRoot(document.getElementById("root")!).render(<Dashboard />);
