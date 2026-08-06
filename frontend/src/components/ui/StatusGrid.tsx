import "./status-grid.css";

type StatusItem = {
  label: string;
  value: string;
};

type StatusGridProps = {
  items: StatusItem[];
};

export function StatusGrid({ items }: StatusGridProps) {
  return (
    <section className="status-grid" aria-label="Technický stav">
      {items.map((item) => (
        <div className="status-grid__item" key={item.label}>
          <strong>{item.label}</strong>
          <span>{item.value}</span>
        </div>
      ))}
    </section>
  );
}

