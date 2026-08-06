import type { FormEvent } from "react";
import { Panel } from "../../components/ui/Panel";
import { LoginForm } from "./LoginForm";
import "./auth-panel.css";

type AuthPanelProps = {
  email: string;
  error: string | null;
  isDisabled: boolean;
  isLoading: boolean;
  password: string;
  onEmailChange: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onPasswordChange: (value: string) => void;
};

export function AuthPanel({
  email,
  error,
  isDisabled,
  isLoading,
  onEmailChange,
  onLogin,
  onPasswordChange,
  password,
}: AuthPanelProps) {
  return (
    <section className="auth-panel" aria-label="Přihlášení">
      <Panel className="auth-panel__surface">
        <LoginForm
          email={email}
          isDisabled={isDisabled}
          isLoading={isLoading}
          onEmailChange={onEmailChange}
          onPasswordChange={onPasswordChange}
          onSubmit={onLogin}
          password={password}
        />
      </Panel>
      {error ? <p className="auth-panel__error">{error}</p> : null}
    </section>
  );
}
