import { useEffect, useState } from "react";

import { readSession, SESSION_UPDATED_EVENT } from "@/utils/session";
export function useSession() {
  const [session, setSession] = useState(readSession);

  useEffect(() => {
    const sync = () => setSession(readSession());

    window.addEventListener(SESSION_UPDATED_EVENT, sync);
    window.addEventListener("storage", sync);

    return () => {
      window.removeEventListener(SESSION_UPDATED_EVENT, sync);
      window.removeEventListener("storage", sync);
    };
  }, []);

  return session;
}
