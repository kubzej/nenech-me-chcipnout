import { useState } from "react";
import { CalendarCheck, Leaf, MapPin, Settings } from "lucide-react";
import { BottomNav, type NavItem } from "../../components/layout/BottomNav";
import { PlacesScreen } from "../screens/PlacesScreen";
import { PlantsScreen } from "../screens/PlantsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TodayScreen } from "../screens/TodayScreen";
import "./authenticated-app.css";

type AppTab = "today" | "plants" | "places" | "settings";

type AuthenticatedAppProps = {
  onLogout: () => void;
};

const navItems: Array<NavItem & { id: AppTab }> = [
  { id: "today", label: "Dnes", icon: CalendarCheck },
  { id: "plants", label: "Kytky", icon: Leaf },
  { id: "places", label: "Místa", icon: MapPin },
  { id: "settings", label: "Nastavení", icon: Settings },
];

export function AuthenticatedApp({ onLogout }: AuthenticatedAppProps) {
  const [activeTab, setActiveTab] = useState<AppTab>("today");

  function renderScreen() {
    switch (activeTab) {
      case "plants":
        return <PlantsScreen />;
      case "places":
        return <PlacesScreen />;
      case "settings":
        return <SettingsScreen onLogout={onLogout} />;
      case "today":
      default:
        return <TodayScreen />;
    }
  }

  return (
    <div className="authenticated-app">
      {renderScreen()}
      <BottomNav
        activeItemId={activeTab}
        items={navItems}
        onItemChange={(itemId) => setActiveTab(itemId as AppTab)}
      />
    </div>
  );
}
