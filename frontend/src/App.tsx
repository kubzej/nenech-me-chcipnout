import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { Leaf, LogOut, MapPin, Settings, Sprout } from "lucide-react";
import { apiGetAuthed } from "./lib/api";
import { apiBaseUrl, hasSupabaseConfig } from "./lib/env";
import { supabase } from "./lib/supabase";

const navItems = [
  { label: "Dnes", icon: Sprout },
  { label: "Kytky", icon: Leaf },
  { label: "Místa", icon: MapPin },
  { label: "Nastavení", icon: Settings },
];

type Workspace = {
  id: string;
  name: string;
  timezone: string;
  role: string;
  created_at: string;
};

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [workspace, setWorkspace] = useState<Workspace | null>(null);
  const [isLoading, setIsLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [debugStatus, setDebugStatus] = useState<string>("čekám");
  const hasAccessToken = Boolean(session?.access_token);

  useEffect(() => {
    let isActive = true;

    async function loadSession() {
      if (!supabase) {
        setIsLoading(false);
        return;
      }

      const { data, error: sessionError } = await supabase.auth.getSession();
      if (!isActive) {
        return;
      }

      if (sessionError) {
        setError(sessionError.message);
        setIsLoading(false);
        return;
      }

      setSession(data.session);
      setDebugStatus(data.session?.access_token ? "session token: ano" : "session token: ne");
      if (data.session) {
        await loadActiveWorkspace();
      }
      setIsLoading(false);
    }

    loadSession().catch((loadError: unknown) => {
      if (!isActive) {
        return;
      }
      setError(loadError instanceof Error ? loadError.message : "Něco se rozbilo.");
      setIsLoading(false);
    });

    return () => {
      isActive = false;
    };
  }, []);

  async function loadActiveWorkspace() {
    try {
      const activeWorkspace = await apiGetAuthed<Workspace>("/api/workspaces/active");
      setWorkspace(activeWorkspace);
    } catch (workspaceError) {
      setWorkspace(null);
      throw workspaceError;
    }
  }

  async function handleLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!supabase) {
      setError("Supabase env není nastavené.");
      return;
    }

    setError(null);
    setIsLoading(true);

    const { data, error: loginError } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (loginError || !data.session) {
      setError(loginError?.message ?? "Přihlášení selhalo.");
      setIsLoading(false);
      return;
    }

    setSession(data.session);
    setDebugStatus(data.session.access_token ? "session token: ano" : "session token: ne");
    try {
      await loadActiveWorkspace();
    } catch (workspaceError) {
      setError(
        workspaceError instanceof Error
          ? workspaceError.message
          : "Workspace není připravený.",
      );
    } finally {
      setPassword("");
      setIsLoading(false);
    }
  }

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setSession(null);
    setWorkspace(null);
    setDebugStatus("odhlášeno");
  }

  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Nenech mě chcípnout!</p>
        <h1>{session ? "Hlídač kytek je vzhůru." : "Přihlaš se, vrahu muškátů."}</h1>
        <p className="intro">
          {session
            ? "Backend tě pustil dovnitř. Teď začneme zakládat skutečné místo a první Kytku."
            : "Aplikace bez přihlášení nic nehlídá. Kytky zatím právem panikaří."}
        </p>
      </section>

      <section className="auth-panel" aria-label="Přihlášení">
        {session ? (
          <div className="session-box">
            <div>
              <span className="label">Workspace</span>
              <strong>{workspace?.name ?? "není založený"}</strong>
              <small>{workspace ? `${workspace.role} · ${workspace.timezone}` : "ruční seed chybí"}</small>
            </div>
            <button className="icon-button" onClick={handleLogout} type="button">
              <LogOut aria-hidden="true" size={18} />
              <span>Odhlásit</span>
            </button>
          </div>
        ) : (
          <form className="login-form" onSubmit={handleLogin}>
            <label>
              <span>Email</span>
              <input
                autoComplete="email"
                disabled={isLoading || !hasSupabaseConfig}
                onChange={(event) => setEmail(event.target.value)}
                required
                type="email"
                value={email}
              />
            </label>
            <label>
              <span>Heslo</span>
              <input
                autoComplete="current-password"
                disabled={isLoading || !hasSupabaseConfig}
                onChange={(event) => setPassword(event.target.value)}
                required
                type="password"
                value={password}
              />
            </label>
            <button disabled={isLoading || !hasSupabaseConfig} type="submit">
              {isLoading ? "Chvilku..." : "Pustit ke kytkám"}
            </button>
          </form>
        )}
        {error ? <p className="error-text">{error}</p> : null}
      </section>

      <nav className="bottom-nav" aria-label="Hlavní navigace">
        {navItems.map((item) => (
          <button className="nav-button" key={item.label} type="button">
            <item.icon aria-hidden="true" size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <section className="status-panel" aria-label="Technický stav">
        <div>
          <strong>API</strong>
          <span>{apiBaseUrl}</span>
        </div>
        <div>
          <strong>Supabase</strong>
          <span>
            {hasSupabaseConfig
              ? hasAccessToken
                ? "session + token"
                : "env připravené"
              : "čeká na env"}
          </span>
        </div>
        <div>
          <strong>Debug</strong>
          <span>{debugStatus}</span>
        </div>
      </section>
    </main>
  );
}
