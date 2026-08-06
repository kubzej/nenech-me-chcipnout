import { Leaf, MapPin, Settings, Sprout } from "lucide-react";
import { apiBaseUrl, hasSupabaseConfig } from "./lib/env";

const navItems = [
  { label: "Dnes", icon: Sprout },
  { label: "Kytky", icon: Leaf },
  { label: "Místa", icon: MapPin },
  { label: "Nastavení", icon: Settings },
];

export function App() {
  return (
    <main className="app-shell">
      <section className="hero">
        <p className="eyebrow">Nenech mě chcípnout!</p>
        <h1>Reálný základ aplikace je připravený.</h1>
        <p className="intro">
          Další krok je napojit přihlášení, workspace a první skutečnou Kytku
          přes backend.
        </p>
      </section>

      <nav className="bottom-nav" aria-label="Hlavní navigace">
        {navItems.map((item) => (
          <button className="nav-button" key={item.label} type="button">
            <item.icon aria-hidden="true" size={20} />
            <span>{item.label}</span>
          </button>
        ))}
      </nav>

      <section className="status-panel" aria-label="Technický stav">
        <div>
          <strong>API</strong>
          <span>{apiBaseUrl}</span>
        </div>
        <div>
          <strong>Supabase</strong>
          <span>{hasSupabaseConfig ? "env připravené" : "čeká na env"}</span>
        </div>
      </section>
    </main>
  );
}

