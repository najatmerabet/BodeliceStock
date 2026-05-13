export const getBonLivraisonChanges = (
  existingBl: any,
  newClientId: number,
  newLignes: any[],
  produitMap: Map<number, string>
): string[] => {
  const changes: string[] = [];

  // 🔁 Client
  if (existingBl.clientId !== newClientId) {
    changes.push(
      `Client changé: ${existingBl.clientId} → ${newClientId}`
    );
  }

  // 🔥 GROUPER LES LIGNES (IMPORTANT pour gérer doublons)
  const groupLines = (lines: any[]) => {
    const map = new Map<number, any[]>();

    for (const l of lines) {
      if (!map.has(l.produitId)) {
        map.set(l.produitId, []);
      }
      map.get(l.produitId)!.push(l);
    }

    return map;
  };

  const oldGrouped = groupLines(existingBl.lignes);
  const newGrouped = groupLines(newLignes);

  // 🔥 calcul total unités
  const getTotal = (lines: any[]) =>
    lines.reduce((sum, l) => sum + Number(l.nbUnites), 0);

  // 🔄 MODIFICATIONS + SUPPRESSIONS
  for (const [produitId, oldLines] of oldGrouped) {
    const newLines = newGrouped.get(produitId);

    const oldTotal = getTotal(oldLines);
    const newTotal = newLines ? getTotal(newLines) : 0;

    const nomProduit =
      oldLines[0]?.produit?.nom ||
      produitMap.get(produitId) ||
      `ID ${produitId}`;

    // ❌ supprimé
    if (!newLines) {
      changes.push(`Produit "${nomProduit}" supprimé`);
    }

    // 🔄 modifié
    else if (oldTotal !== newTotal) {
      changes.push(
        `Produit "${nomProduit}": ${oldTotal} → ${newTotal}`
      );
    }
  }

  // ➕ AJOUTS
  for (const [produitId, newLines] of newGrouped) {
    if (!oldGrouped.has(produitId)) {
      const nomProduit =
        produitMap.get(produitId) || `ID ${produitId}`;

      const total = getTotal(newLines);

      changes.push(`Produit "${nomProduit}" ajouté (${total})`);
    }
  }

  return changes;
};