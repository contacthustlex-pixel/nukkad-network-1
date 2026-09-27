export const CATEGORY_ICONS: Record<string, string> = {
  Cafe: "☕",
  Salon: "✂️",
  Laundry: "👕",
  Gym: "💪",
  Xerox: "📄",
};

export function categoryIcon(name: string) {
  return CATEGORY_ICONS[name] ?? "🏪";
}
