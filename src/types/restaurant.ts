// src/types/restaurant.ts

export interface Table {
  id: number;
  numero: string;
  capacite: number;
  statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE';
}

export interface TableRestaurant {
  id: number;
  numero: string;
  capacite: number;
  statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'HORS_SERVICE';
}

export interface Product {
  id: number;
  code: string;
  nom: string;
  unite: string;
  prix_vente: number;
  category_id: number;
  type_produit: 'MATIERE_PREMIERE' | 'PRODUIT_FINI' | 'CONSOMMABLE' | 'SERVICE';
  actif: boolean;
  couleur?: string;
}

export interface MenuItem extends Product {
  category_nom: string;
  recipe_id?: number;
  recipe_nom?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantite: number;
  prix_unitaire: number;
  product_nom?: string;
  product_code?: string;
  product_unite?: string;
  cuisson?: string;
}

export interface Order {
  id: number;
  client_id: number;
  source_module: string;
  montant_total: number;
  statut: string;
  created_at: string;
  client_nom?: string;
  client_prenom?: string;
  items?: OrderItem[];
  notes?: string;
  location_type?: string;
  special_person_name?: string;
}

export interface RestaurantHistoryPayment {
  payment_id: number;
  order_id: number;
  date_paiement: string;
  montant: number;
  moyen_paiement: string | null;
  table_numero: string | null;
  items: Array<{
    id: number;
    quantite: number;
    prix_unitaire: number;
    product_nom: string;
    category_nom: string | null;
  }>;
}

export interface RecipeIngredient {
  id: number;
  recipe_id: number;
  ingredient_id: number;
  quantite: number;
  ingredient_nom?: string;
  ingredient_code?: string;
  ingredient_unite?: string;
}

export interface Recipe {
  id: number;
  product_id: number;
  nom: string;
  product_nom?: string;
  ingredients?: RecipeIngredient[];
}

export interface Cashier {
  id: number;
  nom: string;
  statut: 'OUVERTE' | 'FERMEE';
  current_session?: CashierSession;
}

export interface CashierSession {
  id: number;
  cashier_id: number;
  user_id: number;
  ouverture_at: string;
  fermeture_at?: string;
  fond_initial: number;
  fond_final?: number;
  ecart?: number;
}

export interface RestaurantStats {
  general: {
    total_commandes: number;
    chiffre_affaires: number;
    panier_moyen: number;
    clients_uniques: number;
  };
  top_products: Array<{
    id: number;
    nom: string;
    category_nom: string;
    quantite_vendue: number;
    montant_total: number;
  }>;
  ventes_par_categorie: Array<{
    id: number;
    nom: string;
    total_commandes: number;
    montant_total: number;
  }>;
}

export interface ApiResponse<T> {
  success: boolean;
  message?: string;
  data: T;
  count?: number;
}