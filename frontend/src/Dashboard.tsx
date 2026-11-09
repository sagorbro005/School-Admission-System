import { useEffect, useState, type FormEvent } from "react";
import {
  Building2,
  ClipboardList,
  GraduationCap,
  LayoutGrid,
  School,
  Ticket,
} from "lucide-react";
import { admissionsApi, validStudent } from "./api";
import { useAdmissionData } from "./hooks/useAdmissionData";
import { Campus } from "./components/Campus";
import { StudentIdentity } from "./components/StudentIdentity";
import { Classes } from "./screens/Classes";
import { MyApplications } from "./screens/MyApplications";
import { CreateClass } from "./screens/CreateClass";

const pageIcons = {
  Classes: LayoutGrid,
  "My applications": ClipboardList,
  "Create class (Admin)": Building2,
};
type Page = keyof typeof pageIcons;
const pages = Object.keys(pageIcons) as Page[];

export function Dashboard() {
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
  const { classes, holds, loaded, error, refresh, clearApplications } =
    useAdmissionData(student);
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);
  const [now, setNow] = useState(Date.now());
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
  function identify(e: FormEvent) {
    e.preventDefault();
    if (!validStudent(draft)) {
      setNotice("Enter exactly 17 digits for the birth registration number.");
      return;
    }
    clearApplications();
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

  const available = classes.reduce(
    (total, category) => total + category.availableSeats,
    0,
  );
  function apply(classId: string) {
    if (!identified) {
      setNotice(
        "Save your 17-digit registration number above before applying.",
      );
      document.getElementById("student")?.focus();
      return;
    }
    void act(async () => {
      await admissionsApi.apply(classId, student);
      setPage("My applications");
    }, "Seat held. Pay the admission fee before the timer ends.");
  }
  function createClass(name: string, totalSeats: number) {
    void act(async () => {
      await admissionsApi.createClass(name, totalSeats);
      setPage("Classes");
    }, "Class created.");
  }
  return (
    <>
      <header>
        <div className="brand">
          <span className="crest" aria-hidden="true">
            <GraduationCap />
          </span>
          School Admissions
        </div>
        <nav aria-label="Admission sections">
          {pages.map((p) => {
            const Icon = pageIcons[p];
            return (
              <button
                key={p}
                aria-current={page === p ? "page" : undefined}
                onClick={() => {
                  setPage(p);
                  setNotice("");
                }}
              >
                <Icon size={17} aria-hidden="true" />
                {p}
              </button>
            );
          })}
        </nav>
      </header>
      <main>
        <section className="intro">
          <div className="hero-copy">
            <h1>Admissions desk</h1>
            {loaded && (
              <div className="hero-stats">
                <span>
                  <School />
                  {classes.length} {classes.length === 1 ? "class" : "classes"}
                </span>
                <span>
                  <Ticket />
                  {available} open seats
                </span>
              </div>
            )}
          </div>
          <Campus />
        </section>
        <StudentIdentity
          student={student}
          draft={draft}
          busy={busy}
          onChange={setDraft}
          onSubmit={identify}
        />
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
          <Classes
            classes={classes}
            holds={holds}
            now={now}
            busy={busy}
            loaded={loaded}
            error={error}
            onCreate={() => setPage("Create class (Admin)")}
            onApply={apply}
          />
        )}
        {page === "My applications" && (
          <MyApplications
            student={student}
            holds={holds}
            now={now}
            loaded={loaded}
            error={error}
            actionsDisabled={busy || !identified}
            onBrowse={() => setPage("Classes")}
            onConfirm={(id) =>
              void act(
                () => admissionsApi.confirm(id, student),
                "Payment successful. Admission confirmed.",
              )
            }
            onCancel={(id) =>
              void act(
                () => admissionsApi.cancel(id, student),
                "Application cancelled.",
              )
            }
          />
        )}
        {page === "Create class (Admin)" && (
          <CreateClass busy={busy} onCreate={createClass} />
        )}
      </main>
    </>
  );
}
