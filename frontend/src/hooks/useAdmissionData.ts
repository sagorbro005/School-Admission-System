import { useCallback, useEffect, useRef, useState } from "react";
import { Application, ClassInfo, admissionsApi } from "../api";

export function useAdmissionData(student: string) {
  const [classes, setClasses] = useState<ClassInfo[]>([]);
  const [holds, setHolds] = useState<Application[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState("");
  const generation = useRef(0);
  const refresh = useCallback(async () => {
    // Ignore a slower response after a mutation or student switch.
    const current = ++generation.current;
    try {
      const [list, applications] = await Promise.all([
        admissionsApi.classes(),
        student ? admissionsApi.history(student) : Promise.resolve([]),
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
  function clearApplications() {
    generation.current++;
    setHolds([]);
    setLoaded(false);
  }
  return { classes, holds, loaded, error, refresh, clearApplications };
}
