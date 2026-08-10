function daysSince(iso: string | null): number | null {
  if (!iso) {
    return null;
  }

  const then = new Date(iso);
  if (Number.isNaN(then.getTime())) {
    return null;
  }

  const startOfThen = new Date(then.getFullYear(), then.getMonth(), then.getDate());
  const startOfNow = new Date();
  const startOfToday = new Date(
    startOfNow.getFullYear(),
    startOfNow.getMonth(),
    startOfNow.getDate(),
  );

  return Math.round(
    (startOfToday.getTime() - startOfThen.getTime()) / (1000 * 60 * 60 * 24),
  );
}

export function formatLastWatered(iso: string | null): string {
  const diffDays = daysSince(iso);

  if (diffDays === null) {
    return "Ještě nezalito";
  }
  if (diffDays <= 0) {
    return "Zalito dnes";
  }
  if (diffDays === 1) {
    return "Zalito včera";
  }
  return `Zalito před ${diffDays} dny`;
}

export function isWateredToday(iso: string | null): boolean {
  const diffDays = daysSince(iso);
  return diffDays !== null && diffDays <= 0;
}
