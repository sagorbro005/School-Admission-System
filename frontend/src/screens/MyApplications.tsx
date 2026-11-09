import type { Application } from "../api";
interface Props {
  student: string;
  holds: Application[];
  now: number;
  loaded: boolean;
  error: string;
  actionsDisabled: boolean;
  onBrowse: () => void;
  onConfirm: (id: string) => void;
  onCancel: (id: string) => void;
}
export function MyApplications({
  student,
  holds,
  now,
  loaded,
  error,
  actionsDisabled,
  onBrowse,
  onConfirm,
  onCancel,
}: Props) {
  return (
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
          {error ? "Application data unavailable." : "Loading applications…"}
        </p>
      ) : !holds.length ? (
        <div className="empty">
          <h3>No applications yet</h3>
          <button onClick={onBrowse}>Browse classes</button>
        </div>
      ) : (
        <div className="grid">
          {holds.map((h) => {
            const left = Math.max(
              0,
              Math.ceil((Date.parse(h.expiresAt) - now) / 1000),
            );
            const status = h.status === "HELD" && !left ? "EXPIRED" : h.status;
            return (
              <article className="application" key={h.holdId}>
                <span className={"status " + status}>{status}</span>
                <h3>{h.className}</h3>
                <small>
                  <b>Application ID:</b> {h.holdId}
                </small>
                <p>Hold deadline · {new Date(h.expiresAt).toLocaleString()}</p>
                {status === "EXPIRED" && (
                  <button disabled>Pay admission fee</button>
                )}
                {status === "HELD" && (
                  <>
                    <p className="timer">
                      {Math.floor(left / 60)}:
                      {String(left % 60).padStart(2, "0")} remaining
                    </p>
                    <div className="actions">
                      <button
                        disabled={actionsDisabled}
                        onClick={() => onConfirm(h.holdId)}
                      >
                        Pay admission fee
                      </button>
                      <button
                        className="secondary"
                        disabled={actionsDisabled}
                        onClick={() => onCancel(h.holdId)}
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
  );
}
