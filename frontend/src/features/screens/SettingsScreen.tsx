import { useState } from "react";
import { ChevronRight, LogOut, Sprout } from "lucide-react";
import { CareProfilesSection } from "../settings/CareProfilesSection";
import { Button } from "../../components/ui/Button";
import { ScreenHeader } from "../../components/ui/ScreenHeader";
import { Text } from "../../components/ui/Text";
import "./screen.css";

type SettingsScreenProps = {
  onLogout: () => void;
};

type SettingsSection = "home" | "care-profiles";

export function SettingsScreen({ onLogout }: SettingsScreenProps) {
  const [activeSection, setActiveSection] = useState<SettingsSection>("home");

  if (activeSection === "care-profiles") {
    return <CareProfilesSection onBack={() => setActiveSection("home")} />;
  }

  return (
    <section className="screen screen--stack" aria-label="Nastavení">
      <ScreenHeader title="Nastavení" subtitle="Účet a výchozí hodnoty" />

      <div className="settings-menu">
        <button
          className="settings-menu__item"
          onClick={() => setActiveSection("care-profiles")}
          type="button"
        >
          <Sprout aria-hidden="true" size={18} />
          <Text as="span" variant="body">
            Care profily
          </Text>
          <ChevronRight aria-hidden="true" size={18} />
        </button>
      </div>

      <Button icon={<LogOut aria-hidden="true" size={18} />} onClick={onLogout}>
        Odhlásit
      </Button>
    </section>
  );
}
