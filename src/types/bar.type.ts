export interface BarEquipment {
  id: number;
  nom: string;
  categorie: string;
  description: string;
  quantite: number;
  etat: 'EN_SERVICE' | 'A_REPARER' | 'HORS_SERVICE';
  created_at?: string;
  updated_at?: string;
}
// ─── Métier (aligné sur la BDD) ──────────────────────────────

/** Correspond à products (type_produit = PRODUIT_FINI, source_module = BAR) */
export interface BarProduct {
  id: number;
  nom: string;
  ingredients: string;
  prix: number;
  categorie: string;
  alcool: boolean;
}

export type BarPaymentMethod =
  | 'ESPECES'
  | 'CREDIT'
  | 'TPE'
  | 'ORANGE_MONEY'
  | 'MVOLA'
  | 'GRATUIT';

/** Solde caisse du module bar (issu de financial_transactions + module = 'bar') */
export interface BarCaisseStats {
  solde: number;
  entrees: number;
  sorties: number;
}

/** Données agrégées pour les meilleures ventes */
export interface BestSeller {
  nom: string;
  ventes: number;
  montant: string;
}

export interface BarCommandeItem {
  product_id?: number;
  nom: string;
  quantite: number;
  prix: number;
}

export interface BarCommande {
  id: number;
  client: string;
  table: number;
  nombre_personnes?: number;
  moyen_paiement?: BarPaymentMethod;
  observation?: string;
  statut: 'En attente' | 'En préparation' | 'Prête' | 'Servie' | 'Encaissée';
  total: number;
  cloture_at?: string;
  items: BarCommandeItem[];
  created_at?: string;
}

// ==================== BAR LOUNGE ====================

export interface BarTable {
  id: number;
  numero: string;
  capacite: number;
  statut: 'LIBRE' | 'OCCUPEE' | 'RESERVEE' | 'EN_COURS';
}

export interface BarCashier {
  id: number;
  nom: string;
  statut: 'OUVERTE' | 'FERMEE';
  current_session?: BarSession;
}

export interface BarSession {
  id: number;
  cashier_id: number;
  user_id?: number;
  ouverture_at: string;
  fermeture_at?: string;
  fond_initial: number;
  fond_final?: number;
  ecart?: number;
}

export interface BarStockItem {
  id: number;
  product_id: number;
  location_id: number;
  quantite: number;
  unite: string;
  product_nom: string;
  product_categorie: string;
  location_nom: string;
}

// ==================== HISTORIQUE PRODUITS ====================

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