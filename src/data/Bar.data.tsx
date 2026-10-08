import type { BarProduct, BestSeller } from '../types/bar.type';

export const BAR_TABS = [
  { id: 'paf', label: 'Paf' },
  { id: 'commandes', label: 'Commandes' },
  { id: 'bar', label: 'Bar & Cocktails' },
  { id: 'equipement', label: 'Équipement' },
 
  { id: 'rapports', label: 'Rapports' },
  { id: 'caisse', label: 'Caisse' },
  { id: 'historique', label: 'Historique' },
  { id: 'historique-produits', label: 'Inventaire' },
] as const;
  
export type BarTabId = typeof BAR_TABS[number]['id'];

export const COCKTAIL_MENU: BarProduct[] = [
  { id: 1, nom: 'HDA Signature', ingredients: 'Champagne, cognac VSOP, bitter orange, gold leaf', prix: 48, categorie: 'Signature', alcool: true },
  { id: 2, nom: 'Negroni Prestige', ingredients: 'Gin premium, Campari, Vermouth rouge, orange', prix: 28, categorie: 'Classique', alcool: true },
  { id: 3, nom: 'Royal Mojito', ingredients: 'Rhum blanc, citron vert, menthe fraîche, sucre, perrier', prix: 22, categorie: 'Classique', alcool: true },
  { id: 4, nom: 'Whisky Sour Gold', ingredients: "Bourbon 18 ans, citron, blanc d'œuf, Angostura", prix: 35, categorie: 'Premium', alcool: true },
  { id: 5, nom: 'Coucher de Soleil', ingredients: "Jus d'orange, grenadine, tequila premium, sel fumé", prix: 24, categorie: 'Fruité', alcool: true },
  { id: 6, nom: 'Elixir Vert', ingredients: 'Concombre, basilic, citron vert, eau pétillante', prix: 18, categorie: 'Sans alcool', alcool: false },
  { id: 7, nom: 'Bellini Blanc', ingredients: 'Prosecco, pêche blanche fraîche, touches florales', prix: 26, categorie: 'Bulles', alcool: true },
  { id: 8, nom: 'Absinthe Rituel', ingredients: "Absinthe verte, louche d'eau glacée, cube de sucre", prix: 30, categorie: 'Tradition', alcool: true },
];

export const BEST_SELLERS: BestSeller[] = [
  { nom: 'Whisky 18Y', ventes: 42, montant: '7 560 MGA' },
  { nom: 'HDA Signature', ventes: 38, montant: '1 824 MGA' },
  { nom: 'Champagne Rosé', ventes: 29, montant: '2 755 MGA' },
];

export const BEST_SELLERS_MAX_VENTES = 50;

export const BAR_COMMANDES_ACTIONS = {
  newOrderLabel: 'Nouvelle commande',
  emptyTitle: 'Aucune commande active',
  emptyDescription: 'Créez une commande avec un client et une table pour commencer.',
} as const;
