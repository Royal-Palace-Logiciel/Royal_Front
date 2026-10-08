export interface TableRestaurant {
  id: number;
  numero: string;
  capacite: number;
  statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'HORS_SERVICE';
}

export interface Order {
  id: number;
  client_id: number | null;
  table_id: number | null;
  source_module: 'RESTAURANT' | 'BAR' | 'CASINO' | 'HOTEL';
  montant_total: number;
  statut: 'EN_ATTENTE' | 'EN_COURS' | 'SERVIE' | 'PAYE' | 'PAYEE' | 'ANNULEE';
  created_at: string;
  moyen_paiement?: string | null;
  table_numero?: string;
  table?: TableRestaurant;
  items?: OrderItem[];
  notes?: string;
  location_type?: string;
  special_person_name?: string;
}

export interface OrderItem {
  id: number;
  order_id: number;
  product_id: number;
  quantite: number;
  prix_unitaire: number;
  product_nom?: string;
  product?: Product;
  cuisson?: string;
}

export interface Product {
  id: number;
  category_id: number;
  code: string;
  nom: string;
  unite: string;
  prix_achat: number;
  prix_vente: number;
  actif: boolean;
  type_produit: 'MATIERE_PREMIERE' | 'PRODUIT_FINI' | 'CONSOMMABLE' | 'SERVICE';
  category?: Category;
  couleur?: string; // <-- Propriété de couleur ajoutée ici
}

export interface Category {
  id: number;
  nom: string;
}

export interface Client {
  id: number;
  code_client: string;
  nom: string;
  prenom: string;
  telephone: string;
  email: string;
  adresse?: string;
  date_naissance?: string;
  type_piece?: string;
  numero_piece?: string;
  statut?: string;
}

// ==================== INVENTAIRE ====================

export interface ProductHistoryItem {
  date_vente: string;      // 'YYYY-MM-DD'
  product_id: number;
  produit: string;
  categorie: string;
  quantite_totale: number;
  montant_total: number;
  nb_commandes: number;
}

export interface ProductHistoryGroup {
  date: string;
  totalArticles: number;
  totalMontant: number;
  items: ProductHistoryItem[];
}