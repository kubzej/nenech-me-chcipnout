import { LogOut } from "lucide-react";
import { Button } from "../../components/ui/Button";
import "./screen.css";

type SettingsScreenProps = {
  onLogout: () => void;
};

export function SettingsScreen({ onLogout }: SettingsScreenProps) {
  return (
    <section className="screen screen--settings" aria-label="Nastavení">
      <Button icon={<LogOut aria-hidden="true" size={18} />} onClick={onLogout}>
        Odhlásit
      </Button>
    </section>
  );
}
