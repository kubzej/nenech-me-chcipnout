import appIcon from "../../assets/brand/app-icon.png";
import "./brand-mark.css";

type BrandMarkProps = {
  label?: string;
};

export function BrandMark({ label = "Nenech mě chcípnout!" }: BrandMarkProps) {
  return (
    <div className="brand-mark" aria-label={label}>
      <img className="brand-mark__icon" src={appIcon} alt="" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}
