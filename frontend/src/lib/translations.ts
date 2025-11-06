// Russian translations for UI elements
export const t = {
  item: {
    documents: "Документы",
    small: "Мелкие вещи",
  },
  weight: {
    envelope: "Конверт",
    le1kg: "До 1 кг",
    le3kg: "До 3 кг",
  },
  kind: {
    request: "Запрос",
    trip: "Поездка",
  },
};

export function formatItem(item: string): string {
  return t.item[item as keyof typeof t.item] || item;
}

export function formatWeight(weight: string): string {
  return t.weight[weight as keyof typeof t.weight] || weight;
}

export function formatKind(kind: string): string {
  return t.kind[kind as keyof typeof t.kind] || kind;
}



