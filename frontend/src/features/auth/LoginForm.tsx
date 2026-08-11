import type { FormEvent } from "react";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import "./login-form.css";

type LoginFormProps = {
  email: string;
  isDisabled: boolean;
  isLoading: boolean;
  password: string;
  onEmailChange: (value: string) => void;
  onPasswordChange: (value: string) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

export function LoginForm({
  email,
  isDisabled,
  isLoading,
  onEmailChange,
  onPasswordChange,
  onSubmit,
  password,
}: LoginFormProps) {
  return (
    <form className="login-form" onSubmit={onSubmit}>
      <TextField
        autoComplete="email"
        disabled={isDisabled}
        label="Email"
        name="email"
        onChange={(event) => onEmailChange(event.target.value)}
        required
        type="email"
        value={email}
      />
      <TextField
        autoComplete="current-password"
        disabled={isDisabled}
        label="Heslo"
        name="password"
        onChange={(event) => onPasswordChange(event.target.value)}
        required
        type="password"
        value={password}
      />
      <Button disabled={isDisabled} type="submit">
        {isLoading ? "Chvilku..." : "Pustit ke kytkám"}
      </Button>
    </form>
  );
}

