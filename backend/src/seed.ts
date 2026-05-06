import prisma from './prisma';

async function main() {
  console.log('🌱 Seeding database...');

  // Produits de l'usine Shawarma
  const produits = [
    { nom: 'Shawarma Poulet', prix: 8.00, stock: 500 },
    { nom: 'Shawarma Viande', prix: 10.00, stock: 400 },
    { nom: 'Shawarma Mixte', prix: 12.00, stock: 300 },
    { nom: 'Tacos Poulet', prix: 10.00, stock: 250 },
    { nom: 'Tacos Viande', prix: 12.00, stock: 200 },
    { nom: 'Tacos Mixte', prix: 14.00, stock: 150 },
    { nom: 'Pain Shawarma', prix: 1.50, stock: 2000 },
    { nom: 'Pain Tacos', prix: 2.00, stock: 1500 },
    { nom: 'Sauce Blanche (L)', prix: 15.00, stock: 100 },
    { nom: 'Sauce Piquante (L)', prix: 15.00, stock: 100 },
    { nom: 'Sauce Algérienne (L)', prix: 18.00, stock: 80 },
    { nom: 'Poulet Mariné (Kg)', prix: 45.00, stock: 200 },
    { nom: 'Viande Hachée (Kg)', prix: 60.00, stock: 150 },
    { nom: 'Fromage Cheddar (Kg)', prix: 55.00, stock: 100 },
    { nom: 'Frites Surgelées (Kg)', prix: 12.00, stock: 500 },
    { nom: 'Oignons (Kg)', prix: 5.00, stock: 300 },
    { nom: 'Tomates (Kg)', prix: 6.00, stock: 250 },
    { nom: 'Laitue (Kg)', prix: 8.00, stock: 200 },
    { nom: 'Cornichons (Kg)', prix: 20.00, stock: 100 },
    { nom: 'Emballage Alu (Rouleau)', prix: 25.00, stock: 50 },
  ];

  for (const p of produits) {
    await prisma.produit.upsert({
      where: { id: produits.indexOf(p) + 1 },
      update: {},
      create: p,
    });
  }
  console.log(`✅ ${produits.length} produits créés`);

  // Quelques clients
  const clients = [
    { nom: 'Snack Al Baraka', telephone: '0661-123456', adresse: 'Derb Omar, Casablanca' },
    { nom: 'Restaurant Le Sultan', telephone: '0522-789012', adresse: 'Bd Zerktouni, Casablanca' },
    { nom: 'Fast Food Mega Burger', telephone: '0677-345678', adresse: 'Hay Mohammadi, Casablanca' },
    { nom: 'Café Nour', telephone: '0655-901234', adresse: 'Quartier Gauthier, Casablanca' },
    { nom: 'Snack La Perle', telephone: '0699-567890', adresse: 'Sidi Bernoussi, Casablanca' },
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
  .catch((e) => {
    console.error('❌ Erreur seed:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
