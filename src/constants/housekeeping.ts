// src/constants/housekeeping.ts
// Libellés partagés du module Ménage (Housekeeping), en français.
// Source unique pour éviter que les menus déroulants et les badges divergent
// (ex. "Exceptional" vs "Exceptionnel" trouvés dupliqués dans deux fichiers).

export const TYPE_TACHE_LABELS: Record<string, string> = {
  POST_OCCUPANCY: 'Post-occupation',
  AFTER_OCCUPANCY: 'Après occupation',
  DEEP_CLEANING: 'Nettoyage approfondi',
  EXCEPTIONAL: 'Exceptionnel',
  CHAMBRE: 'Chambre',
  ESCALIER_RAMPE: 'Escalier/rampe',
  DECORATIONS: 'Décorations',
  MUR: 'Mur',
  PLAFOND: 'Plafond',
  SOL_MOQUETTE: 'Sol/moquette',
  MEUBLES: 'Meubles',
  COULOIR: 'Couloir',
  TERASSE: 'Terrasse',
  TOILETTES: 'Toilettes',
};
