export interface Client {
    id?: number;
    reference?: string;
    nom: string;
    adresse: string;
    telephone: string;
    email?: string;
    ville?: string;
    codepostal?: string;
    ice?: string;
    porteurId?: number | null;
    commissionRate?: number | null;
    porteur?: any;
}