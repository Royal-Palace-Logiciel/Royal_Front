const STORAGE_KEY = 'hda_product_colors';

export interface RestaurantProductColorKey {
  id: number;
  nom: string;
}

const normalizeName = (name: string) => name.trim().toLowerCase();

export const getRestaurantProductColors = (): Record<string, string> => {
  const saved = localStorage.getItem(STORAGE_KEY);
  return saved ? JSON.parse(saved) as Record<string, string> : {};
};

export const getRestaurantProductColor = (
  product: RestaurantProductColorKey,
  colors = getRestaurantProductColors()
) => colors[String(product.id)] || colors[normalizeName(product.nom)] || '';

export const saveRestaurantProductColor = (
  product: RestaurantProductColorKey,
  color: string
) => {
  const colors = getRestaurantProductColors();
  delete colors[String(product.id)];
  delete colors[normalizeName(product.nom)];
  if (color) {
    colors[String(product.id)] = color;
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
};

export const removeRestaurantProductColor = (product: RestaurantProductColorKey) => {
  const colors = getRestaurantProductColors();
  delete colors[String(product.id)];
  delete colors[normalizeName(product.nom)];
  localStorage.setItem(STORAGE_KEY, JSON.stringify(colors));
};
