import { FormEvent, useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { AppShell } from "./components/layout/AppShell";
import { AuthenticatedApp } from "./features/app/AuthenticatedApp";
import { WelcomeScreen } from "./features/welcome/WelcomeScreen";
import { hasSupabaseConfig } from "./lib/env";
import { supabase } from "./lib/supabase";

export function App() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(hasSupabaseConfig);
  const [error, setError] = useState<string | null>(null);
  const [showIntro, setShowIntro] = useState(false);

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
    setShowIntro(true);
    setPassword("");
    setIsLoading(false);
  }

  async function handleLogout() {
    if (supabase) {
      await supabase.auth.signOut();
    }

    setSession(null);
  }

  return (
    <AppShell>
      {session ? (
        <AuthenticatedApp
          onLogout={handleLogout}
          showIntro={showIntro}
          onIntroDismiss={() => setShowIntro(false)}
        />
      ) : (
        <WelcomeScreen
          email={email}
          error={error}
          isDisabled={isLoading || !hasSupabaseConfig}
          isLoading={isLoading}
          onEmailChange={setEmail}
          onLogin={handleLogin}
          onPasswordChange={setPassword}
          password={password}
        />
      )}
    </AppShell>
  );
}
