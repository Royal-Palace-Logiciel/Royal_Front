// types/product.types.ts
export interface Product {
  id: number;
  category_id: number | null;
  code: string | null;
  nom: string | null;
  unite: string | null;
  prix_achat: number | null;
  prix_vente: number | null;
  actif: boolean;
  type_produit: 'MATIERE_PREMIERE' | 'PRODUIT_FINI' | 'CONSOMMABLE' | 'SERVICE';
}

export interface Category {
  id: number;
  nom: string | null;
}

export interface Unit {
  id: number;
  code: string | null;
  nom: string | null;
}