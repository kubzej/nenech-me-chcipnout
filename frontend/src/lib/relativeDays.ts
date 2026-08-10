export function formatLastWatered(iso: string | null): string {
  if (!iso) {
    return "Ještě nezalito";
  }

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return "Ještě nezalito";
  }

  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const startOfNow = new Date();
  const startOfToday = new Date(
    startOfNow.getFullYear(),
    startOfNow.getMonth(),
    startOfNow.getDate(),
  );
  const diffDays = Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / (1000 * 60 * 60 * 24),
  );

  if (diffDays <= 0) {
    return "Zalito dnes";
  }
  if (diffDays === 1) {
    return "Zalito včera";
  }
  return `Zalito před ${diffDays} dny`;
}
