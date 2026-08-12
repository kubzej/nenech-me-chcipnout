import { useState } from "react";
import { CalendarCheck, Leaf, MapPin, Settings } from "lucide-react";
import { BottomNav, type NavItem } from "../../components/layout/BottomNav";
import { SergeantIntroModal } from "../onboarding/SergeantIntroModal";
import { PlacesScreen } from "../screens/PlacesScreen";
import { PlantsScreen } from "../screens/PlantsScreen";
import { SettingsScreen } from "../screens/SettingsScreen";
import { TodayScreen } from "../screens/TodayScreen";
import "./authenticated-app.css";

type AppTab = "today" | "plants" | "places" | "settings";

type AuthenticatedAppProps = {
  onIntroDismiss: () => void;
  onLogout: () => void;
  showIntro: boolean;
};

const navItems: Array<NavItem & { id: AppTab }> = [
  { id: "today", label: "Dnes", icon: CalendarCheck },
  { id: "plants", label: "Kytky", icon: Leaf },
  { id: "places", label: "Místa", icon: MapPin },
  { id: "settings", label: "Nastavení", icon: Settings },
];

export function AuthenticatedApp({
  onIntroDismiss,
  onLogout,
  showIntro,
}: AuthenticatedAppProps) {
  const [activeTab, setActiveTab] = useState<AppTab>("today");
  const [visitedTabs, setVisitedTabs] = useState<Set<AppTab>>(() => new Set(["today"]));

  function renderScreen(tab: AppTab) {
    switch (tab) {
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

  function handleTabChange(itemId: string) {
    const nextTab = itemId as AppTab;
    setVisitedTabs((current) => {
      if (current.has(nextTab)) {
        return current;
      }

      const next = new Set(current);
      next.add(nextTab);
      return next;
    });
    setActiveTab(nextTab);
  }

  return (
    <div className="authenticated-app">
      {showIntro ? <SergeantIntroModal onDismiss={onIntroDismiss} /> : null}
      {navItems
        .filter((item) => visitedTabs.has(item.id))
        .map((item) => (
          <div
            className="authenticated-app__screen"
            hidden={item.id !== activeTab}
            key={item.id}
          >
            {renderScreen(item.id)}
          </div>
        ))}
      <BottomNav
        activeItemId={activeTab}
        items={navItems}
        onItemChange={handleTabChange}
      />
    </div>
  );
}
