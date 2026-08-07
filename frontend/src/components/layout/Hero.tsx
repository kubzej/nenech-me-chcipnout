import { Text } from "../ui/Text";
import "./hero.css";

type HeroProps = {
  title: string;
};

export function Hero({ title }: HeroProps) {
  return (
    <section className="hero">
      <Text variant="display">{title}</Text>
    </section>
  );
}
