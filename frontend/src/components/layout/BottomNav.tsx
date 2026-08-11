import type { LucideIcon } from "lucide-react";
import "./bottom-nav.css";

export type NavItem = {
  icon: LucideIcon;
  id: string;
  label: string;
};

type BottomNavProps = {
  activeItemId: string;
  items: NavItem[];
  onItemChange: (itemId: string) => void;
};

export function BottomNav({ activeItemId, items, onItemChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav" aria-label="Hlavní navigace">
      {items.map((item) => {
        const isActive = item.id === activeItemId;

        return (
          <button
            aria-label={item.label}
            aria-current={isActive ? "page" : undefined}
            className={isActive ? "bottom-nav__button is-active" : "bottom-nav__button"}
            key={item.id}
            onClick={() => onItemChange(item.id)}
            type="button"
          >
            <span className="bottom-nav__icon">
              <item.icon aria-hidden="true" size={24} strokeWidth={2.35} />
            </span>
          </button>
        );
      })}
    </nav>
  );
}
