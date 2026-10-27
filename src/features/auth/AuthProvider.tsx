import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Session } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "../../lib/supabase";
import type { Profile } from "../../lib/types";
import { demoProfile } from "../journal/demo";
import { disconnectCurrentPush } from "../../lib/push";

interface AuthState {
  session: Session | null;
  profile: Profile | null;
  demo: boolean;
  loading: boolean;
  error: string;
  enterDemo: () => void;
  leave: () => Promise<void>;
  reloadProfile: () => Promise<void>;
}
const AuthContext = createContext<AuthState | null>(null);
export function AuthProvider({ children }: { children: ReactNode }) {
  const client = useQueryClient();
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [demo, setDemo] = useState(
    sessionStorage.getItem("fitlog-demo") === "true",
  );
  const [loading, setLoading] = useState(Boolean(supabase));
  const [error, setError] = useState("");
  const currentIdentity = useRef<string | undefined>(undefined);
  useEffect(() => {
    if (!supabase) return;
    let alive = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (alive) {
        setSession(data.session);
        currentIdentity.current = data.session?.user.id;
        if (error) setError(error.message);
        setLoading(false);
      }
    });
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      if (alive) {
        if (next?.user.id !== currentIdentity.current) {
          client.clear();
          setProfile(null);
          currentIdentity.current = next?.user.id;
        }
        setSession(next);
        if (next) {
          setDemo(false);
          sessionStorage.removeItem("fitlog-demo");
        }
      }
    });
    return () => {
      alive = false;
      data.subscription.unsubscribe();
    };
  }, []);
  useEffect(() => {
    let alive = true;
    if (!session) {
      setProfile(null);
      return;
    }
    setLoading(true);
    supabase!
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (alive) {
          setProfile(data as Profile | null);
          setError(
            error
              ? "ยังอ่านโปรไฟล์ไม่ได้ กรุณาตรวจการติดตั้งฐานข้อมูล"
              : data
                ? ""
                : "บัญชีนี้ยังไม่ได้รับอนุมัติ โปรดติดต่อผู้ดูแล",
          );
          setLoading(false);
        }
      });
    return () => {
      alive = false;
    };
  }, [session?.user.id]);
  const reloadProfile = async () => {
    if (!session || !supabase) return;
    const { data, error } = await supabase
      .from("profiles")
      .select("*")
      .eq("user_id", session.user.id)
      .single();
    if (error) throw error;
    setProfile(data as Profile);
  };
  const leave = async () => {
    if (session && supabase) {
      await disconnectCurrentPush(session.user.id);
      const { error } = await supabase.auth.signOut({ scope: "local" });
      if (error) throw error;
    }
    sessionStorage.removeItem("fitlog-demo");
    setDemo(false);
    setSession(null);
    setProfile(null);
    client.clear();
  };
  return (
    <AuthContext.Provider
      value={{
        session,
        profile: demo ? demoProfile : profile,
        demo,
        loading,
        error,
        enterDemo: () => {
          client.clear();
          sessionStorage.setItem("fitlog-demo", "true");
          setDemo(true);
        },
        leave,
        reloadProfile,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}
export function useAuth() {
  const state = useContext(AuthContext);
  if (!state) throw new Error("AuthProvider required");
  return state;
}
