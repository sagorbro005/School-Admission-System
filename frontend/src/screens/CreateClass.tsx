import { Plus } from "lucide-react";
interface Props {
  busy: boolean;
  onCreate: (name: string, totalSeats: number) => void;
}
export function CreateClass({ busy, onCreate }: Props) {
  return (
    <section>
      <div className="heading">
        <h2>Create class (Admin)</h2>
      </div>
      <form
        className="admin"
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const data = new FormData(form);
          onCreate(String(data.get("name") ?? ""), Number(data.get("seats")));
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
        <button disabled={busy}>
          <Plus size={17} aria-hidden="true" />
          Create class (Admin)
        </button>
      </form>
    </section>
  );
}
