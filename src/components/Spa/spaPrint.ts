// Tickets thermiques du module SPA (piscine) : vente et clôture de caisse.
import { escapeHtml, printThermal, thermalHeader } from '../../utils/thermalPrint';
import { formatCurrency } from '../../utils/data';
import { SPA_CATEGORIE_LABELS, SPA_PAYMENT_LABELS, SpaCategorie, SpaClosure, SpaPaymentMethod, SpaVente } from '../../services/spa.service';

const row = (label: string, value: string, className = 'row line') =>
  `<div class="${className}"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;

export const printSpaVente = (vente: SpaVente, target?: Window | null) => {
  const lines = [`Ticket n° ${vente.id}`, new Date(vente.date).toLocaleString('fr-FR')];
  if (vente.clientNom) lines.push(`Client : ${vente.clientNom}`);
  if (vente.chambre) lines.push(vente.chambre);
  const items = vente.lignes.map((ligne) => row(`${ligne.quantite} × ${ligne.nom}`, formatCurrency(ligne.prix * ligne.quantite))).join('');
  const abonnements = (vente.abonnements || []).map((abonnement) => `
    <div class="box">
      <p>${escapeHtml(abonnement.formule)} — n° ${escapeHtml(abonnement.numero)}</p>
      ${abonnement.entreesTotal !== null ? `<p class="sub">${abonnement.entreesTotal} entrées</p>` : ''}
      ${abonnement.dateFin ? `<p class="sub">Valable jusqu'au ${escapeHtml(new Date(`${abonnement.dateFin}T12:00:00`).toLocaleDateString('fr-FR'))}</p>` : ''}
    </div>`).join('');
  printThermal('Ticket Piscine', `${thermalHeader('Ticket Piscine', lines)}${items}
    ${row('TOTAL', formatCurrency(vente.montant), 'row total')}
    ${row('Paiement', SPA_PAYMENT_LABELS[vente.moyenPaiement])}
    ${abonnements}
    <div class="footer">Merci et bonne baignade !</div>`, { target });
};

export const printSpaClosure = (closure: SpaClosure, target?: Window | null) => {
  const payments = (Object.entries(closure.summary.byPayment) as Array<[SpaPaymentMethod, number]>)
    .filter(([, amount]) => Number(amount) > 0)
    .map(([method, amount]) => row(SPA_PAYMENT_LABELS[method] || method, formatCurrency(amount))).join('');
  const categories = (Object.entries(closure.summary.byCategorie) as Array<[SpaCategorie, { quantite: number; montant: number }]>)
    .filter(([, bucket]) => bucket && bucket.quantite > 0)
    .map(([categorie, bucket]) => row(`${SPA_CATEGORIE_LABELS[categorie]} (${bucket.quantite})`, formatCurrency(bucket.montant))).join('');
  printThermal('Clôture Piscine', `${thermalHeader('Clôture Piscine', [
    `Référence : ${closure.reference}`,
    `Clôturée le : ${new Date(closure.dateCloture).toLocaleString('fr-FR')}`,
  ])}
    ${row('Ventes', String(closure.summary.nombreVentes))}
    ${row('Entrées vendues', String(closure.summary.nombreEntrees))}
    <h2>Par catégorie</h2>${categories || '<p class="center">Aucune vente</p>'}
    <h2>Par moyen de paiement</h2>${payments || '<p class="center">Aucun paiement</p>'}
    <div class="box row"><span>TOTAL ENCAISSÉ</span><span>${escapeHtml(formatCurrency(closure.summary.totalEncaisse))}</span></div>`, { target });
};
