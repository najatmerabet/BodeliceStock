import prisma from './prisma';

async function main() {
  console.log('🌱 Seeding database...');

  const produits = [
    { reference: 'SHW-001', nom: 'Shawarma Poulet',       unite: 'boule',  poidsUnitaire: 0.15, quantite: 500, prixUnitaire: 45.00 },
    { reference: 'SHW-002', nom: 'Shawarma Viande',       unite: 'boule',  poidsUnitaire: 0.18, quantite: 400, prixUnitaire: 60.00 },
    { reference: 'SHW-003', nom: 'Shawarma Mixte',        unite: 'boule',  poidsUnitaire: 0.17, quantite: 300, prixUnitaire: 52.00 },
    { reference: 'TAC-001', nom: 'Tacos Poulet',          unite: 'boule',  poidsUnitaire: 0.20, quantite: 250, prixUnitaire: 48.00 },
    { reference: 'TAC-002', nom: 'Tacos Viande',          unite: 'boule',  poidsUnitaire: 0.22, quantite: 200, prixUnitaire: 62.00 },
    { reference: 'TAC-003', nom: 'Tacos Mixte',           unite: 'boule',  poidsUnitaire: 0.21, quantite: 150, prixUnitaire: 55.00 },
    { reference: 'PAN-001', nom: 'Pain Shawarma',         unite: 'pièce',  poidsUnitaire: 0.08, quantite: 2000, prixUnitaire: 1.50 },
    { reference: 'PAN-002', nom: 'Pain Tacos',            unite: 'pièce',  poidsUnitaire: 0.12, quantite: 1500, prixUnitaire: 2.00 },
    { reference: 'SAU-001', nom: 'Sauce Blanche',         unite: 'litre',  poidsUnitaire: 1.00, quantite: 100, prixUnitaire: 15.00 },
    { reference: 'SAU-002', nom: 'Sauce Piquante',        unite: 'litre',  poidsUnitaire: 1.00, quantite: 100, prixUnitaire: 15.00 },
    { reference: 'SAU-003', nom: 'Sauce Algérienne',      unite: 'litre',  poidsUnitaire: 1.00, quantite: 80,  prixUnitaire: 18.00 },
    { reference: 'VIA-001', nom: 'Poulet Mariné',         unite: 'kg',     poidsUnitaire: 1.00, quantite: 200, prixUnitaire: 45.00 },
    { reference: 'VIA-002', nom: 'Viande Hachée',         unite: 'kg',     poidsUnitaire: 1.00, quantite: 150, prixUnitaire: 60.00 },
    { reference: 'ING-001', nom: 'Fromage Cheddar',       unite: 'kg',     poidsUnitaire: 1.00, quantite: 100, prixUnitaire: 55.00 },
    { reference: 'ING-002', nom: 'Frites Surgelées',      unite: 'kg',     poidsUnitaire: 1.00, quantite: 500, prixUnitaire: 12.00 },
    { reference: 'ING-003', nom: 'Oignons',               unite: 'kg',     poidsUnitaire: 1.00, quantite: 300, prixUnitaire: 5.00  },
    { reference: 'ING-004', nom: 'Tomates',               unite: 'kg',     poidsUnitaire: 1.00, quantite: 250, prixUnitaire: 6.00  },
    { reference: 'ING-005', nom: 'Laitue',                unite: 'kg',     poidsUnitaire: 1.00, quantite: 200, prixUnitaire: 8.00  },
    { reference: 'ING-006', nom: 'Cornichons',            unite: 'kg',     poidsUnitaire: 1.00, quantite: 100, prixUnitaire: 20.00 },
    { reference: 'EMB-001', nom: 'Emballage Alu',         unite: 'rouleau',poidsUnitaire: 1.00, quantite: 50,  prixUnitaire: 25.00 },
  ];

  for (const p of produits) {
    await prisma.produit.upsert({
      where: { reference: p.reference },
      update: p,
      create: p,
    });
  }
  console.log(`✅ ${produits.length} produits créés`);

  const clients = [
    { nom: 'Snack Al Baraka',       telephone: '0661-123456', adresse: 'Derb Omar, Casablanca' },
    { nom: 'Restaurant Le Sultan',  telephone: '0522-789012', adresse: 'Bd Zerktouni, Casablanca' },
    { nom: 'Fast Food Mega Burger', telephone: '0677-345678', adresse: 'Hay Mohammadi, Casablanca' },
    { nom: 'Café Nour',             telephone: '0655-901234', adresse: 'Quartier Gauthier, Casablanca' },
    { nom: 'Snack La Perle',        telephone: '0699-567890', adresse: 'Sidi Bernoussi, Casablanca' },
  ];

  for (const c of clients) {
    await prisma.client.upsert({
      where: { id: clients.indexOf(c) + 1 },
      update: {},
      create: c,
    });
  }
  console.log(`✅ ${clients.length} clients créés`);
  console.log('🎉 Seed terminé !');
}

main()
  .catch((e) => { console.error('❌ Erreur seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
