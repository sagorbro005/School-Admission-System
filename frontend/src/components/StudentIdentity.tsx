import type { FormEventHandler } from "react";
import { Check, IdCard } from "lucide-react";
interface Props {
  student: string;
  draft: string;
  busy: boolean;
  onChange: (value: string) => void;
  onSubmit: FormEventHandler<HTMLFormElement>;
}
export function StudentIdentity({
  student,
  draft,
  busy,
  onChange,
  onSubmit,
}: Props) {
  return (
    <form onSubmit={onSubmit} className="identity">
      <span className="id-icon">
        <IdCard aria-hidden="true" />
      </span>
      <div className="id-caption">
        <label htmlFor="student">Student birth registration number</label>
        <span>
          {student
            ? "Selected student · ending in " + student.slice(-4)
            : "Enter your 17-digit number to apply."}
        </span>
      </div>
      <input
        id="student"
        inputMode="numeric"
        maxLength={17}
        placeholder="17-digit registration number"
        value={draft}
        disabled={busy}
        onChange={(e) => onChange(e.target.value)}
      />
      <button disabled={busy}>
        <Check size={16} aria-hidden="true" />
        Save ID
      </button>
    </form>
  );
}
