import { createContext, useContext, type ReactNode } from "react";
import { authClient } from "../api/authClient";
type SessionState = {
  user: { id: string; name: string; email: string } | null;
  pending: boolean;
};
const Context = createContext<SessionState>({ user: null, pending: true });
export function SessionProvider({ children }: { children: ReactNode }) {
  const { data, isPending } = authClient.useSession();
  return (
    <Context.Provider value={{ user: data?.user ?? null, pending: isPending }}>
      {children}
    </Context.Provider>
  );
}
export const useSession = () => useContext(Context);
