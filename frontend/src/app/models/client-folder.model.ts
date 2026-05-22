export interface ClientFolder {
  id?: number;
  clientId: number;
  parentId?: number | null;
  nom: string;
  couleur: string;
  createdAt?: string;
  updatedAt?: string;
}

export interface ClientFileItem {
  id?: number;
  clientId: number;
  folderId?: number | null;
  nom: string;
  nomFichier: string;
  remarque?: string;
  chemin: string;
  type: string;
  taille?: number;
  createdAt?: string;
  updatedAt?: string;
}