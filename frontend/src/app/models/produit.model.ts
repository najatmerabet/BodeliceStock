export interface Produit {
  id?: number;
  reference?: string;
  nom: string;
  categorie?: string;
  unite: string;
  poidsUnitaire: number;
  quantite: number;
  prixUnitaire: number;
  tva?: number;
}
