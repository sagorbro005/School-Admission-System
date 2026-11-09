export interface ClassInfo {
  id: string;
  name: string;
  totalSeats: number;
  heldSeats: number;
  confirmedSeats: number;
  availableSeats: number;
}
export interface Application {
  holdId: string;
  className: string;
  classId: string;
  expiresAt: string;
  status: "HELD" | "CONFIRMED" | "EXPIRED" | "CANCELLED";
}
export const validStudent = (id: string) => /^[0-9]{17}$/.test(id);
const baseUrl = (
  import.meta.env.VITE_API_URL || "http://localhost:8080"
).replace(/\/$/, "");

interface RequestOptions {
  method?: "GET" | "POST" | "DELETE";
  student?: string;
  body?: { name: string; totalSeats: number };
}

async function request(
  path: string,
  { method = "GET", student, body }: RequestOptions = {},
): Promise<Response> {
  let response: Response;
  try {
    response = await fetch(baseUrl + path, {
      method,
      headers: {
        ...(student ? { "X-Student-Id": student } : {}),
        ...(body ? { "Content-Type": "application/json" } : {}),
      },
      body: JSON.stringify(body),
      signal: AbortSignal.timeout(20000),
    });
  } catch {
    throw new Error(
      "Could not reach the admissions server. Check your connection and try again.",
    );
  }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || "The request failed. Please try again.");
  }
  return response;
}

export const admissionsApi = {
  async classes(): Promise<ClassInfo[]> {
    return (await request("/classes")).json();
  },
  async history(student: string): Promise<Application[]> {
    return (await request("/me/holds", { student })).json();
  },
  createClass(name: string, totalSeats: number) {
    return request("/classes", { method: "POST", body: { name, totalSeats } });
  },
  apply(classId: string, student: string) {
    return request(`/classes/${classId}/holds`, { method: "POST", student });
  },
  confirm(holdId: string, student: string) {
    return request(`/holds/${holdId}/confirm`, { method: "POST", student });
  },
  cancel(holdId: string, student: string) {
    return request(`/holds/${holdId}`, { method: "DELETE", student });
  },
};
