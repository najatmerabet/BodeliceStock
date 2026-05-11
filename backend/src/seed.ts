import prisma from './prisma';
import bcrypt from 'bcrypt';
async function main() {
  console.log('🌱 Seeding database...');

  const produits = [
    { reference: '0001', nom: 'MERGUEZ CRU 1KG', unite: 'sachet', poidsUnitaire: 1.0, quantite: 100, prixUnitaire: 65.00 },
    { reference: '0002', nom: 'SHAWARMA DE DINDE 15 KG', unite: 'boule', poidsUnitaire: 15.0, quantite: 50, prixUnitaire: 55.00 },
    { reference: '0003', nom: 'SHAWARMA DE DINDE 10 KG', unite: 'boule', poidsUnitaire: 10.0, quantite: 50, prixUnitaire: 55.00 },
    { reference: '0004', nom: 'TENDERS HOT 2.5 KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 80, prixUnitaire: 85.00 },
    { reference: '0005', nom: 'SHAWARMA DE DINDE 7 KG', unite: 'boule', poidsUnitaire: 7.0, quantite: 40, prixUnitaire: 55.00 },
    { reference: '0006', nom: 'MERGUEZ CUIT TRANCHE 3KG', unite: 'boite', poidsUnitaire: 3.0, quantite: 60, prixUnitaire: 75.00 },
    { reference: '0007', nom: 'SHAWARMA DE DINDE 20KG', unite: 'boule', poidsUnitaire: 20.0, quantite: 30, prixUnitaire: 55.00 },
    { reference: '0008', nom: 'MERGUEZ CUITE TRANCHEE 2.5KG', unite: 'boite', poidsUnitaire: 2.5, quantite: 45, prixUnitaire: 75.00 },
    { reference: '0009', nom: 'MERGUEZ CUITE TRANCHEE 1 KG', unite: 'boite', poidsUnitaire: 1.0, quantite: 40, prixUnitaire: 75.00 },
    { reference: '0010', nom: 'SHAWARMA POULET POIVRON 10 KG', unite: 'boule', poidsUnitaire: 10.0, quantite: 25, prixUnitaire: 60.00 },
    { reference: '0011', nom: 'Tenders Nature 1KG', unite: 'sachet', poidsUnitaire: 1.0, quantite: 100, prixUnitaire: 80.00 },
    { reference: '0012', nom: 'LAMELLES DE KEBAB CRU 1KG', unite: 'sachet', poidsUnitaire: 1.0, quantite: 120, prixUnitaire: 70.00 },
    { reference: '0013', nom: 'LAMELLES DE CURRY CUITES 1KG', unite: 'sachet', poidsUnitaire: 1.0, quantite: 90, prixUnitaire: 78.00 },
    { reference: '0014', nom: 'LAMELLES DE TEX-MEX CUITES 1KG', unite: 'sachet', poidsUnitaire: 1.0, quantite: 85, prixUnitaire: 78.00 },
    { reference: '0015', nom: 'CUBES DE FILET POULET MARINES 2.5 KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 60, prixUnitaire: 72.00 },
    { reference: '0016', nom: 'LAMELLES FILET POULET MARINES 2.5KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 55, prixUnitaire: 72.00 },
    { reference: '0017', nom: 'AILES DE POULET TEX-MEX 2.5KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 70, prixUnitaire: 68.00 },
    { reference: '0018', nom: 'CUBES FILET POULET TEX-MEX 2.5KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 50, prixUnitaire: 72.00 },
    { reference: 'SA01', nom: 'LAMELLES CURRY MARINE CUITE 2.5 KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 40, prixUnitaire: 82.00 },
    { reference: 'SA02', nom: 'LAMELLES TEX-MEX CUITE 2.5 KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 45, prixUnitaire: 82.00 },
    { reference: 'SA03', nom: 'MERGUEZ SURGELE CRU 800 G', unite: 'sachet', poidsUnitaire: 0.8, quantite: 100, prixUnitaire: 58.00 },
    { reference: 'SA04', nom: 'MERGUEZ CUITE TRANCHE 800 G', unite: 'sachet', poidsUnitaire: 0.8, quantite: 80, prixUnitaire: 65.00 },
    { reference: 'SA05', nom: 'LAMELLES DE KEBAB CRUE 800G', unite: 'sachet', poidsUnitaire: 0.8, quantite: 110, prixUnitaire: 68.00 },
    { reference: 'SA06', nom: 'LAMELLES DE KEBAB CUITE 800 G', unite: 'sachet', poidsUnitaire: 0.8, quantite: 95, prixUnitaire: 75.00 },
    { reference: 'SA07', nom: 'TENDERS NATURE 2.5 KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 75, prixUnitaire: 82.00 },
    { reference: 'SA09', nom: 'LAMELLES DE KEBAB CRUE 2.5 KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 65, prixUnitaire: 68.00 },
    { reference: 'SA10', nom: 'LAMELLES DE KEBAB CUITE 2.5 KG', unite: 'sachet', poidsUnitaire: 2.5, quantite: 60, prixUnitaire: 75.00 },
    { reference: 'SA11', nom: 'LAMELLES DE KEBAB CUITES 1KG', unite: 'sachet', poidsUnitaire: 1.0, quantite: 100, prixUnitaire: 75.00 },
    { reference: 'SH00', nom: 'SHAWARMA DE POULET 20 KG', unite: 'boule', poidsUnitaire: 20.0, quantite: 30, prixUnitaire: 58.00 },
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
    { nom: 'Snack Al Baraka', telephone: '0661-123456', adresse: 'Derb Omar', email: 'contact@albaraka.ma', ville: 'Casablanca', codepostal: '20000' },
    { nom: 'Restaurant Le Sultan', telephone: '0522-789012', adresse: 'Bd Zerktouni', email: 'reservation@lesultan.ma', ville: 'Casablanca', codepostal: '20100' },
    { nom: 'Mega Burger', telephone: '0677-345678', adresse: 'Hay Mohammadi', email: 'info@megaburger.ma', ville: 'Casablanca', codepostal: '20300' },
    { nom: 'Café Nour', telephone: '0655-901234', adresse: 'Quartier Gauthier', email: 'nour@gmail.com', ville: 'Casablanca', codepostal: '20050' },
    { nom: 'Snack La Perle', telephone: '0699-567890', adresse: 'Sidi Bernoussi', email: 'laperle@hotmail.com', ville: 'Casablanca', codepostal: '20600' },
    { nom: 'Hôtel Mansour', telephone: '0537-112233', adresse: 'Avenue de France', email: 'front@mansour-hotel.ma', ville: 'Rabat', codepostal: '10000' },
  ];

  for (const c of clients) {
    await prisma.client.upsert({
      where: { id: clients.indexOf(c) + 1 },
      update: c,
      create: c,
    });
  }
  console.log(`✅ ${clients.length} clients créés`);
  console.log('🎉 Seed terminé !');

  const users = [
  { email: 'admin@bodelicestock.com', password: '123456789' },
  { email: 'amina@bodelicestock.com', password: '123456789' },
  { email: 'oumaima@bodelicestock.com', password: '123456789' },
];
 for (const u of users) {
  const hashedPassword = await bcrypt.hash(u.password, 10);

  await prisma.user.upsert({
    where: { email: u.email },
    update: {
      password: hashedPassword,
    },
    create: {
      email: u.email,
      password: hashedPassword,
    },
  });
}
  
  console.log('✅ Utilisateur admin créé ou mis à jour');
  console.log('🎉 Seed terminé !');
}

main()
  .catch((e) => { console.error('❌ Erreur seed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
