export interface LigneBL {
  id?: number;
  produitId: number;
  produitNom?: string;
  produitRef?: string;
  produitUnite?: string;
  nbUnites?: number;
  poidsUnitaire?: number;
  quantite: number;
  prix: number;
  total?: number;
  produit?: any;
}

export interface BonLivraison {
  id: number;
  numero: string;
  clientId: number;
  factureId?: number;
  clientNom?: string;
  date: string;
  total: number;
  statut: string;
  lignes: LigneBL[];
  client?: any;
}
