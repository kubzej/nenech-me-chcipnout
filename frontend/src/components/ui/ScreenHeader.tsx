import "./screen-header.css";

type ScreenHeaderProps = {
  title: string;
  subtitle?: string;
};

export function ScreenHeader({ subtitle, title }: ScreenHeaderProps) {
  return (
    <header className="screen-header">
      <h1>{title}</h1>
      {subtitle ? <p>{subtitle}</p> : null}
    </header>
  );
}
