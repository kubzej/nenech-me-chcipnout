import "./hero.css";

type HeroProps = {
  title: string;
};

export function Hero({ title }: HeroProps) {
  return (
    <section className="hero">
      <h1>{title}</h1>
    </section>
  );
}
