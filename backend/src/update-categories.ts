import prisma from './prisma';

async function main() {
  console.log('🔄 Mise à jour automatique des catégories...');
  const produits = await prisma.produit.findMany();
  
  let count = 0;
  for (const p of produits) {
    // Ne pas écraser si l'utilisateur a déjà mis une catégorie (sauf si c'est vide)
    if (p.categorie && p.categorie.trim() !== '') {
      continue;
    }

    let cat = 'AUTRES';
    const nom = p.nom.toUpperCase();
    
    if (nom.includes('SHAWARMA')) {
      if (nom.includes('POULET')) cat = 'SHAWARMA DE POULET';
      else if (nom.includes('DINDE')) cat = 'SHAWARMA DINDE';
      else cat = 'SHAWARMA';
    } else if (nom.includes('MERGUEZ')) {
      cat = 'MERGUEZ';
    } else if (nom.includes('TENDER')) {
      cat = 'TENDERS';
    } else if (nom.includes('KEBAB')) {
      if (nom.includes('CRU')) cat = 'LAMELLE KEBAB CRU';
      else if (nom.includes('CUIT')) cat = 'LAMELLE KEBAB CUIT';
      else cat = 'LAMELLES KEBAB';
    } else if (nom.includes('CURRY')) {
      cat = 'LAMELLE KEBAB CURRY';
    } else if (nom.includes('TEX-MEX') || nom.includes('TEX MEX')) {
      if (nom.includes('AILES')) cat = 'AILES DE POULET';
      else cat = 'LAMELLE KEBAB TEX MEX';
    } else if (nom.includes('CUBE') || nom.includes('FILET')) {
      cat = 'CUBES & FILETS';
    } else if (nom.includes('DONER') || nom.includes('HACHE')) {
      cat = 'DONER VIANDE HACHEE';
    }

    await prisma.produit.update({
      where: { id: p.id },
      data: { categorie: cat }
    });
    count++;
  }
  
  console.log(`✅ ${count} produits ont été classés automatiquement !`);
}

main()
  .catch(e => { console.error('Erreur:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
