export interface ClassInfo {
  id: string; name: string; totalSeats: number; heldSeats: number; confirmedSeats: number; availableSeats: number;
}
export interface Application {
  holdId: string; className: string; classId: string; expiresAt: string; status: 'HELD'|'CONFIRMED'|'EXPIRED'|'CANCELLED';
}
export const validStudent = (id: string) => /^[0-9]{17}$/.test(id);
export async function request<T>(path: string, method = 'GET', student = '', data?: unknown): Promise<T> {
  let response: Response;
  try {
    response = await fetch((import.meta.env.VITE_API_URL || 'http://localhost:8080').replace(/\/$/, '') + path, {
      method, headers: { ...(student ? {'X-Student-Id': student} : {}), ...(data !== undefined ? {'Content-Type':'application/json'} : {}) },
      body: data ? JSON.stringify(data) : undefined, signal: AbortSignal.timeout(20000)
    });
  } catch { throw new Error('Could not reach the admissions server. Check your connection and try again.'); }
  if (!response.ok) {
    const error = await response.json().catch(() => null);
    throw new Error(error?.detail || 'The request failed. Please try again.');
  }
  return response.status === 204 ? undefined : response.json();
}
