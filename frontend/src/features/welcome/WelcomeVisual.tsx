import mascotCutout from "../../assets/brand/plant-drill-sergeant-cutout.png";
import "./welcome-visual.css";

export function WelcomeVisual() {
  return (
    <div className="welcome-visual" aria-label="Kytky pod dohledem">
      <img
        className="welcome-visual__mascot"
        src={mascotCutout}
        alt="Naštvaný rostlinný hlídač"
      />
    </div>
  );
}
