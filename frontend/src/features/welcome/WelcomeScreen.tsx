import type { FormEvent } from "react";
import { Hero } from "../../components/layout/Hero";
import { Text } from "../../components/ui/Text";
import { AuthPanel } from "../auth/AuthPanel";
import "./welcome-screen.css";

type WelcomeScreenProps = {
  email: string;
  error: string | null;
  isDisabled: boolean;
  isLoading: boolean;
  password: string;
  onEmailChange: (value: string) => void;
  onLogin: (event: FormEvent<HTMLFormElement>) => void;
  onPasswordChange: (value: string) => void;
};

export function WelcomeScreen({
  email,
  error,
  isDisabled,
  isLoading,
  onEmailChange,
  onLogin,
  onPasswordChange,
  password,
}: WelcomeScreenProps) {
  return (
    <div className="welcome-screen">
      <div className="welcome-screen__content">
        <Hero title="Nenech mě chcípnout!" />
        <Text
          as="p"
          variant="body"
          tone="muted"
          className="welcome-screen__copy"
        >
          Appka pro lidi, kterým umírá i kaktus. Kytky nejsou
          samoobslužné, i když ses to roky snažil předstírat.
        </Text>
        <AuthPanel
          email={email}
          error={error}
          isDisabled={isDisabled}
          isLoading={isLoading}
          onEmailChange={onEmailChange}
          onLogin={onLogin}
          onPasswordChange={onPasswordChange}
          password={password}
        />
      </div>
    </div>
  );
}
