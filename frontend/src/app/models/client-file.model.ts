// client-file.model.ts
export interface ClientFile {
  id?: number;
  clientId: number;
  nom: string;
  nomFichier: string;
  chemin: string;
  type: string;
  taille?: number;
  remarque?: string;
  createdAt?: string;
}