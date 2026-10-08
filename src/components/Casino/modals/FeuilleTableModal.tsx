import React, { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Printer, Download, CalendarDays, Users } from 'lucide-react';
import { Modal, Spinner, ErrorBanner, Badge, Button, formatAriary, formatDateTime, TextInput } from '../common';
import { tablesJeuApi } from '../../../services/casinoTablesJeu.service';
import { chipTypesApi } from '../../../services/casino.service'; // AJOUT v1.2 : jetons réels pour la fiche Poker Night Kamoula
import type { TableJeu, FeuilleTable } from '../../../types/casinoTablesJeu.types';
import type { ChipType } from '../../../types/casino.types';
import { TYPE_JEU_LABELS } from '../../../types/casinoTablesJeu.types';
import { escapeHtml, printThermal, thermalHeader } from '../../../utils/thermalPrint';

interface FeuilleTableModalProps {
  table: TableJeu;
  date?: string; // YYYY-MM-DD, défaut aujourd'hui
  onClose: () => void;
}

/** Complète un tableau avec des lignes vides (null) jusqu'à `min` — pour reproduire
 *  les lignes pré-imprimées vierges de la fiche papier (à remplir à la main si besoin). */
function padArray<T>(arr: T[], min: number): (T | null)[] {
  if (arr.length >= min) return arr;
  return [...arr, ...Array(min - arr.length).fill(null)];
}

const printTh: React.CSSProperties = { border: '1px solid #000', padding: '3px 4px', textAlign: 'left', background: '#eee', fontSize: '9px' };
const printTd: React.CSSProperties = { border: '1px solid #000', padding: '3px 4px', fontSize: '9px', height: 20 };
const printCellHeader: React.CSSProperties = { border: '1px solid #000', padding: '3px 4px', fontWeight: 700, background: '#eee', width: '25%', fontSize: '10px' };
const printCellValue: React.CSSProperties = { border: '1px solid #000', padding: '3px 4px', width: '25%', fontSize: '10px' };

export const FeuilleTableModal: React.FC<FeuilleTableModalProps> = ({ table, date, onClose }) => {
  const [feuille, setFeuille] = useState<FeuilleTable | null>(null);
  const [selectedDate, setSelectedDate] = useState(date || new Date().toISOString().slice(0, 10));
  const [chipTypes, setChipTypes] = useState<ChipType[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const printAreaRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      setError(null);
      try {
        const [f, ct] = await Promise.all([
          tablesJeuApi.feuille(table.id, { date: selectedDate }),
          chipTypesApi.list(),
        ]);
        setFeuille(f);
        setChipTypes([...ct].sort((a, b) => a.valeur_nominale - b.valeur_nominale));
      } catch (e: any) {
        setError(e?.message || 'Erreur de chargement de la feuille de table.');
      } finally {
        setLoading(false);
      }
    })();
  }, [table.id, selectedDate]);

  // Lignes vierges façon fiche papier : 20 caves, 8 prolongations, à compléter au stylo
  // si la fiche est imprimée avant la fin du service.
  const paddedLignes = feuille ? padArray(feuille.lignes, 20) : [];
  const paddedProlongations = feuille ? padArray(feuille.prolongations, 8) : [];

  // Génère un PDF à partir du bloc imprimable existant (celui utilisé pour window.print()),
  // sans passer par la boîte de dialogue d'impression du navigateur.
  const handleSavePdf = async () => {
    if (!printAreaRef.current || !feuille) return;
    setGeneratingPdf(true);
    try {
      const [{ default: html2canvas }, { default: jsPDF }] = await Promise.all([
        import('html2canvas-pro'),
        import('jspdf'),
      ]);

      const canvas = await html2canvas(printAreaRef.current, {
        scale: 2,
        useCORS: true,
        backgroundColor: '#ffffff',
        // Le bloc est masqué à l'écran (classe "hidden print:block") : on le rend
        // visible uniquement dans le DOM cloné utilisé par html2canvas, sans toucher
        // à l'affichage réel de la page.
        onclone: (clonedDoc) => {
          const cloneEl = clonedDoc.querySelector('.feuille-print-area') as HTMLElement | null;
          if (cloneEl) {
            cloneEl.classList.remove('hidden');
            cloneEl.style.display = 'block';
          }
        },
      });

      const imgData = canvas.toDataURL('image/png');
      const pdf = new jsPDF('p', 'mm', 'a4');
      const pageWidth = pdf.internal.pageSize.getWidth();
      const pageHeight = pdf.internal.pageSize.getHeight();
      const imgWidth = pageWidth;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      let heightLeft = imgHeight;
      let position = 0;

      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;

      while (heightLeft > 0) {
        position = heightLeft - imgHeight;
        pdf.addPage();
        pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
        heightLeft -= pageHeight;
      }

      pdf.save(`feuille-table-${feuille.table.numero}-${feuille.date}.pdf`);
    } catch (e) {
      console.error('Erreur lors de la génération du PDF', e);
      setError('Erreur lors de la génération du PDF.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Impression sur l'imprimante thermique 80 mm : la fiche A4 est remise en liste verticale
  // (une entrée par cave / prolongation) ; les cases à remplir à la main restent vierges.
  const handlePrint = () => {
    if (!feuille) return;
    const paid = (statut: string, moyen?: string | null) => (statut === 'PAYE' ? moyen || 'Payé' : 'Non payé');
    const signature = (value?: string | null) => (value ? `<img class="signature" src="${escapeHtml(value)}" alt="Signature" />` : '');
    const row = (label: string, value: string) => `<div class="row line"><span>${escapeHtml(label)}</span><span>${escapeHtml(value)}</span></div>`;
    const blankRow = (label: string) => `<div class="row line blank"><span>${escapeHtml(label)}</span><span></span></div>`;
    const caves = feuille.lignes.map((l) => `
      <div class="line">
        <div class="row"><strong>${escapeHtml(l.joueur)}</strong><span>Cave n°${escapeHtml(l.numero_cave)}</span></div>
        <div class="sub">Adh. ${escapeHtml(l.numero_adherent || '—')} · arrivée ${escapeHtml(l.heure_arrivee || '—')} · ${escapeHtml(l.heure || '—')}</div>
        <div class="row"><span>Montant cave</span><span>${escapeHtml(formatAriary(l.montant_cave))}</span></div>
        <div class="row"><span>Total joueur</span><span>${escapeHtml(formatAriary(l.montant_total_joueur))}</span></div>
        <div class="sub">${escapeHtml(paid(l.statut_paiement, l.moyen_paiement))}</div>
        ${signature(l.signature_data)}
      </div>`).join('');
    const prolongations = feuille.prolongations.map((p) => `
      <div class="line">
        <div class="row"><strong>${escapeHtml(p.joueur)}</strong><span>${escapeHtml(formatAriary(p.montant))}</span></div>
        <div class="sub">${escapeHtml(formatDateTime(p.heure))} · ${escapeHtml(paid(p.statut_paiement, p.moyen_paiement))}</div>
        ${signature(p.signature_data)}
      </div>`).join('');
    const chipRows = (cells: number) => chipTypes.map((ct) => `<tr><td>(${escapeHtml(ct.nom)}) ${escapeHtml(ct.valeur_nominale.toLocaleString('fr-FR'))}</td>${'<td></td>'.repeat(cells)}</tr>`).join('');

    printThermal(`Feuille de table ${feuille.table.numero}`, `
      ${thermalHeader(`Fiche de table — ${feuille.table.numero}`, [`${TYPE_JEU_LABELS[feuille.table.type_jeu]} · Salle ${feuille.table.salle}`])}
      ${row('Date', feuille.date)}
      ${row('Cave minimum', formatAriary(feuille.table.cave_minimum))}
      ${row('Durée jeu simple', `${feuille.table.duree_jeu_simple_minutes} min`)}
      ${row('Durée prolongation', `${feuille.table.duree_prolongation_minutes} min`)}
      <h2>CAVES / RECAVES</h2>
      ${caves || '<p>Aucune cave enregistrée.</p>'}
      <h2>PROLONGATIONS</h2>
      ${prolongations || '<p>Aucune prolongation.</p>'}
      <h2>POURBOIRES</h2>
      ${row('Jetons', formatAriary(feuille.pourboires.total_jetons))}
      ${row('Espèces', formatAriary(feuille.pourboires.total_especes))}
      <div class="row total"><span>TOTAL POURBOIRES</span><span>${escapeHtml(formatAriary(feuille.pourboires.total))}</span></div>
      <h2>TOTAUX</h2>
      ${row('Total cashing en jetons', formatAriary(feuille.totaux.total_cashing_jetons))}
      ${row('Total caves cavées', formatAriary(feuille.totaux.total_caves_encaissees))}
      ${row('Payé — Espèces', formatAriary(feuille.totaux.montant_paye_especes))}
      ${row('Payé — TPE', formatAriary(feuille.totaux.montant_paye_tpe))}
      ${row('Reste à payer', formatAriary(feuille.totaux.montant_non_paye))}
      ${row('Total prolongation', formatAriary(feuille.totaux.total_prolongation))}
      ${blankRow('Total bon restaurant')}
      ${blankRow('Total offert')}
      <p class="sign-line">Signature croupier</p>
      <p class="sign-line">Signature responsable</p>
      ${chipTypes.length ? `
        <h2>FICHE POKER NIGHT KAMOULA</h2>
        <table class="chips"><thead><tr><th>Jetons</th><th>Veille</th><th>Valeur</th><th>Départ</th><th>Ferm.</th></tr></thead><tbody>${chipRows(4)}<tr><td colspan="5"><strong>TOTAL</strong></td></tr></tbody></table>
        <p class="center"><strong>TOTAL DES PRÉLÈVEMENTS</strong></p>
        <table class="chips"><thead><tr><th>Jetons</th><th>Nombre</th><th>Valeur totale</th></tr></thead><tbody>${chipRows(2)}<tr><td><strong>TOTAL</strong></td><td></td><td></td></tr></tbody></table>` : ''}
    `, {
      css: `
        .blank span:last-child { min-width: 30mm; }
        .sign-line { margin-top: 14mm; border-top: 1px solid #000; padding-top: 2px; font-size: 11px; }
        table.chips th, table.chips td { border: 1px solid #000; font-size: 10px; height: 20px; }
      `,
    });
  };

  return (
    <Modal
      title={`Feuille de table — ${table.numero}`}
      subtitle={
        feuille
          ? `${feuille.date} · jeu simple ${feuille.table.duree_jeu_simple_minutes} min · prolongation ${feuille.table.duree_prolongation_minutes} min`
          : undefined
      }
      onClose={onClose}
      size="lg"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>
            Fermer
          </Button>
          <Button
            icon={<Download size={16} />}
            onClick={handleSavePdf}
            disabled={!feuille || generatingPdf}
          >
            {generatingPdf ? 'Génération…' : 'Enregistrer PDF'}
          </Button>
          <Button icon={<Printer size={16} />} onClick={handlePrint} disabled={!feuille}>
            Imprimer
          </Button>
        </>
      }
    >
      {loading ? (
        <Spinner label="Chargement…" />
      ) : error ? (
        <ErrorBanner message={error} />
      ) : !feuille ? null : (
        <>
        <div className="flex flex-col gap-5 print:hidden">
          <div
            className="rounded-2xl p-4 flex flex-col md:flex-row md:items-end justify-between gap-3"
            style={{ backgroundColor: 'var(--color-bg)', border: '1px solid var(--color-border)' }}
          >
            <div>
              <div className="flex items-center gap-2 text-accent text-xs font-bold uppercase tracking-wide">
                <Users size={14} /> Feuille de suivi des joueurs
              </div>
              <p className="text-primary text-sm font-semibold mt-1">{TYPE_JEU_LABELS[table.type_jeu]} · {table.type_partie === 'TOURNOI' ? 'Tournoi' : 'Jeu simple'} · {table.nombre_places} places</p>
              <p className="text-muted text-[11px] mt-1">Chaque cave ou recave est ajoutée à la ligne du joueur avec son total cumulé et son état de paiement.</p>
            </div>
            <label className="flex flex-col gap-1 text-secondary text-xs font-medium w-full md:w-44">
              <span className="flex items-center gap-1"><CalendarDays size={13} /> Date de la fiche</span>
              <TextInput type="date" value={selectedDate} onChange={(event) => setSelectedDate(event.target.value)} className="py-2 text-xs" />
            </label>
          </div>

          {/* Caves / recaves */}
          <div className="overflow-x-auto">
            <table className="w-full text-[11px]">
              <thead>
                <tr className="text-[10px] uppercase tracking-wide" style={{ backgroundColor: 'var(--color-bg)', color: 'var(--text-muted, inherit)' }}>
                  <th className="px-2 py-2 text-left" colSpan={2}>Arrivée / joueur</th>
                  <th className="px-2 py-2 text-left" colSpan={2}>Caves</th>
                  <th className="px-2 py-2 text-right" colSpan={2}>Montants</th>
                  <th className="px-2 py-2 text-center" colSpan={2}>Paiement</th>
                  <th className="px-2 py-2 text-center">Validation</th>
                </tr>
                <tr className="text-muted text-left" style={{ borderBottom: '1px solid var(--color-border)' }}>
                  <th className="py-1.5 pr-2">Joueur</th>
                  <th className="py-1.5 pr-2">N° adhérent</th>
                  <th className="py-1.5 pr-2">Arrivée</th>
                  <th className="py-1.5 pr-2">Heure</th>
                  <th className="py-1.5 pr-2 text-right">N° cave</th>
                  <th className="py-1.5 pr-2 text-right">Montant cave</th>
                  <th className="py-1.5 pr-2 text-right">Total caves</th>
                  <th className="py-1.5 pr-2 text-center">Payé</th>
                  <th className="py-1.5 text-center">Signature</th>
                </tr>
              </thead>
              <tbody>
                {feuille.lignes.map((l, idx) => (
                  <tr key={idx} style={{ borderTop: '1px solid var(--color-border)' }}>
                    <td className="py-1.5 pr-2 text-primary font-medium">{l.joueur}</td>
                    <td className="py-1.5 pr-2 text-muted">{l.numero_adherent || '—'}</td>
                    <td className="py-1.5 pr-2 text-muted">{l.heure_arrivee}</td>
                    <td className="py-1.5 pr-2 text-muted">{l.heure}</td>
                    <td className="py-1.5 pr-2 text-right text-muted">{l.numero_cave}</td>
                    <td className="py-1.5 pr-2 text-right text-primary font-semibold">{formatAriary(l.montant_cave)}</td>
                    <td className="py-1.5 pr-2 text-right text-primary">{formatAriary(l.montant_total_joueur)}</td>
                    <td className="py-1.5 pr-2 text-center">
                      <Badge tone={l.statut_paiement === 'PAYE' ? 'success' : 'danger'}>
                        {l.statut_paiement === 'PAYE' ? l.moyen_paiement || 'Payé' : 'Non payé'}
                      </Badge>
                    </td>
                    <td className="py-1.5 text-center">
                      {l.signature_data ? (
                        <img
                          src={l.signature_data}
                          alt="Signature"
                          className="inline-block h-6 max-w-[80px] object-contain"
                          style={{ filter: 'invert(1)' }}
                        />
                      ) : (
                        <Badge tone={l.signature_presente ? 'success' : 'danger'}>
                          {l.signature_presente ? '✓' : 'Manquante'}
                        </Badge>
                      )}
                    </td>
                  </tr>
                ))}
                {feuille.lignes.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-3 text-center text-muted">
                      Aucune cave enregistrée ce jour.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Prolongations */}
          <div>
            <p className="text-primary text-xs font-semibold mb-1.5">Prolongations</p>
            <div className="overflow-x-auto">
              <table className="w-full text-[11px]">
                <thead>
                  <tr className="text-muted text-left" style={{ borderBottom: '1px solid var(--color-border)' }}>
                    <th className="py-1.5 pr-2">Joueur</th>
                    <th className="py-1.5 pr-2">Heure</th>
                    <th className="py-1.5 pr-2 text-right">Montant</th>
                    <th className="py-1.5 pr-2 text-center">Payé</th>
                    <th className="py-1.5 text-center">Signature</th>
                  </tr>
                </thead>
                <tbody>
                  {feuille.prolongations.map((p, idx) => (
                    <tr key={idx} style={{ borderTop: '1px solid var(--color-border)' }}>
                      <td className="py-1.5 pr-2 text-primary font-medium">{p.joueur}</td>
                      <td className="py-1.5 pr-2 text-muted">{formatDateTime(p.heure)}</td>
                      <td className="py-1.5 pr-2 text-right text-primary font-semibold">{formatAriary(p.montant)}</td>
                      <td className="py-1.5 pr-2 text-center">
                        <Badge tone={p.statut_paiement === 'PAYE' ? 'success' : 'danger'}>
                          {p.statut_paiement === 'PAYE' ? p.moyen_paiement || 'Payé' : 'Non payé'}
                        </Badge>
                      </td>
                      <td className="py-1.5 text-center">
                        {p.signature_data ? (
                          <img
                            src={p.signature_data}
                            alt="Signature"
                            className="inline-block h-6 max-w-[80px] object-contain"
                            style={{ filter: 'invert(1)' }}
                          />
                        ) : (
                          <Badge tone={p.signature_presente ? 'success' : 'danger'}>
                            {p.signature_presente ? '✓' : 'Manquante'}
                          </Badge>
                        )}
                      </td>
                    </tr>
                  ))}
                  {feuille.prolongations.length === 0 && (
                    <tr>
                      <td colSpan={5} className="py-3 text-center text-muted">
                        Aucune prolongation ce jour.
                      </td>
                    </tr>
                  )}
                </tbody>
              </table>
            </div>
          </div>

          {/* Totaux */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
            <TotalStat label="Total cashing (jetons)" value={formatAriary(feuille.totaux.total_cashing_jetons)} />
            <TotalStat label="Total caves encaissées" value={formatAriary(feuille.totaux.total_caves_encaissees)} />
            <TotalStat label="Payé — Espèces" value={formatAriary(feuille.totaux.montant_paye_especes)} />
            <TotalStat label="Payé — TPE" value={formatAriary(feuille.totaux.montant_paye_tpe)} />
            <TotalStat label="Non payé (caves)" value={formatAriary(feuille.totaux.montant_non_paye)} />
            <TotalStat label="TOTAL PROLONGATION" value={formatAriary(feuille.totaux.total_prolongation)} highlight />
            <TotalStat label="Prolongation payée" value={formatAriary(feuille.totaux.total_prolongation_payee)} />
            <TotalStat label="Prolongation non payée" value={formatAriary(feuille.totaux.total_prolongation_non_payee)} />
          </div>

          {/* Pourboires */}
          <div className="grid grid-cols-3 gap-2">
            <TotalStat label="Pourboires — Jetons" value={formatAriary(feuille.pourboires.total_jetons)} />
            <TotalStat label="Pourboires — Espèces" value={formatAriary(feuille.pourboires.total_especes)} />
            <TotalStat label="TOTAL POURBOIRES" value={formatAriary(feuille.pourboires.total)} highlight />
          </div>
        </div>

        {/* Bloc imprimable uniquement — masqué à l'écran, affiché au print.
            Rendu via portail vers document.body : la Modal a un panneau interne en
            overflow-y-auto à hauteur limitée, donc un bloc absolute resté à l'intérieur
            se fait couper (les signatures en bas de fiche disparaissaient). */}
        {createPortal(
        <div ref={printAreaRef} className="hidden print:block text-black feuille-print-area">
          <style>{`
            @media print {
              body * { visibility: hidden; }
              .feuille-print-area, .feuille-print-area * { visibility: visible; }
              .feuille-print-area { position: absolute; left: 0; top: 0; width: 100%; }
              @page { size: A4; margin: 12mm; }
            }
          `}</style>

          <h1 style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 2 }}>
            FICHE DE TABLE — {feuille.table.numero}
          </h1>
          <p style={{ textAlign: 'center', fontSize: 11, marginBottom: 10 }}>
            {TYPE_JEU_LABELS[feuille.table.type_jeu]} · Salle {feuille.table.salle}
          </p>

          {/* En-tête */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 10 }}>
            <tbody>
              <tr>
                <td style={printCellHeader}>DATE</td>
                <td style={printCellValue}>{feuille.date}</td>
                <td style={printCellHeader}>CAVE MINIMUM</td>
                <td style={printCellValue}>{formatAriary(feuille.table.cave_minimum)}</td>
              </tr>
              <tr>
                <td style={printCellHeader}>DUREE JEU SIMPLE</td>
                <td style={printCellValue}>{feuille.table.duree_jeu_simple_minutes} min</td>
                <td style={printCellHeader}>DUREE PROLONGATION</td>
                <td style={printCellValue}>{feuille.table.duree_prolongation_minutes} min</td>
              </tr>
            </tbody>
          </table>

          {/* Caves / recaves */}
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={printTh}>Heure arrivée</th>
                <th style={printTh}>Joueur</th>
                <th style={printTh}>N° adhérent</th>
                <th style={printTh}>Heure</th>
                <th style={printTh}>N° cave</th>
                <th style={printTh}>Montant cave</th>
                <th style={printTh}>Total joueur</th>
                <th style={printTh}>Payé</th>
                <th style={{ ...printTh, width: 90 }}>Signature</th>
              </tr>
            </thead>
            <tbody>
              {paddedLignes.map((l, idx) => (
                <tr key={idx}>
                  <td style={printTd}>{l?.heure_arrivee || ''}</td>
                  <td style={printTd}>{l?.joueur || ''}</td>
                  <td style={printTd}>{l?.numero_adherent || ''}</td>
                  <td style={printTd}>{l?.heure || ''}</td>
                  <td style={printTd}>{l ? l.numero_cave : ''}</td>
                  <td style={{ ...printTd, textAlign: 'right' }}>{l ? formatAriary(l.montant_cave) : ''}</td>
                  <td style={{ ...printTd, textAlign: 'right' }}>{l ? formatAriary(l.montant_total_joueur) : ''}</td>
                  <td style={{ ...printTd, textAlign: 'center' }}>
                    {l ? (l.statut_paiement === 'PAYE' ? (l.moyen_paiement || 'Payé') : 'Non payé') : ''}
                  </td>
                  <td style={{ ...printTd, textAlign: 'center' }}>
                    {l?.signature_data ? (
                      <img src={l.signature_data} alt="" style={{ height: 16, maxWidth: 80, objectFit: 'contain' }} />
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Prolongations */}
          <p style={{ fontSize: 11, fontWeight: 700, margin: '10px 0 4px' }}>PROLONGATIONS</p>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr>
                <th style={printTh}>Heure</th>
                <th style={printTh}>Joueur</th>
                <th style={printTh}>Montant</th>
                <th style={printTh}>Payé</th>
                <th style={{ ...printTh, width: 90 }}>Signature</th>
              </tr>
            </thead>
            <tbody>
              {paddedProlongations.map((p, idx) => (
                <tr key={idx}>
                  <td style={printTd}>{p ? formatDateTime(p.heure) : ''}</td>
                  <td style={printTd}>{p?.joueur || ''}</td>
                  <td style={{ ...printTd, textAlign: 'right' }}>{p ? formatAriary(p.montant) : ''}</td>
                  <td style={{ ...printTd, textAlign: 'center' }}>
                    {p ? (p.statut_paiement === 'PAYE' ? (p.moyen_paiement || 'Payé') : 'Non payé') : ''}
                  </td>
                  <td style={{ ...printTd, textAlign: 'center' }}>
                    {p?.signature_data ? (
                      <img src={p.signature_data} alt="" style={{ height: 16, maxWidth: 80, objectFit: 'contain' }} />
                    ) : (
                      ''
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          {/* Pourboires */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <tbody>
              <tr>
                <td style={printCellHeader}>POURBOIRES — JETONS</td>
                <td style={printCellValue}>{formatAriary(feuille.pourboires.total_jetons)}</td>
                <td style={printCellHeader}>POURBOIRES — ESPECES</td>
                <td style={printCellValue}>{formatAriary(feuille.pourboires.total_especes)}</td>
                <td style={printCellHeader}>TOTAL POURBOIRES</td>
                <td style={printCellValue}>{formatAriary(feuille.pourboires.total)}</td>
              </tr>
            </tbody>
          </table>

          {/* Totaux */}
          <table style={{ width: '100%', borderCollapse: 'collapse', marginTop: 10 }}>
            <tbody>
              <tr>
                <td style={printCellHeader}>TOTAL CASHING EN JETONS</td>
                <td style={printCellValue}>{formatAriary(feuille.totaux.total_cashing_jetons)}</td>
                <td style={printCellHeader}>TOTAL CAVES CAVEES</td>
                <td style={printCellValue}>{formatAriary(feuille.totaux.total_caves_encaissees)}</td>
              </tr>
              <tr>
                <td style={printCellHeader}>MONTANT PAYE — ESPECES</td>
                <td style={printCellValue}>{formatAriary(feuille.totaux.montant_paye_especes)}</td>
                <td style={printCellHeader}>MONTANT PAYE — TPE</td>
                <td style={printCellValue}>{formatAriary(feuille.totaux.montant_paye_tpe)}</td>
              </tr>
              <tr>
                <td style={printCellHeader}>RESTE A PAYER (non payé)</td>
                <td style={printCellValue}>{formatAriary(feuille.totaux.montant_non_paye)}</td>
                <td style={printCellHeader}>TOTAL PROLONGATION</td>
                <td style={printCellValue}>{formatAriary(feuille.totaux.total_prolongation)}</td>
              </tr>
              {/* Non suivi côté données → champs vierges à remplir à la main, comme demandé */}
              <tr>
                <td style={printCellHeader}>TOTAL BON RESTAURANT</td>
                <td style={printCellValue}>&nbsp;</td>
                <td style={printCellHeader}>TOTAL OFFERT</td>
                <td style={printCellValue}>&nbsp;</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures finales */}
          <table style={{ width: '100%', marginTop: 28 }}>
            <tbody>
              <tr>
                <td style={{ width: '50%', fontSize: 10, paddingTop: 24 }}>
                  SIGNATURE CROUPIER
                  <div style={{ marginTop: 24, borderTop: '1px solid #000', width: '80%' }} />
                </td>
                <td style={{ width: '50%', fontSize: 10, paddingTop: 24 }}>
                  SIGNATURE RESPONSABLE
                  <div style={{ marginTop: 24, borderTop: '1px solid #000', width: '80%' }} />
                </td>
              </tr>
            </tbody>
          </table>

          {/* AJOUT v1.1 : page "Fiche Poker Night Kamoula" — deux tableaux vierges de dénombrement des jetons */}
          <div style={{ pageBreakBefore: 'always', marginTop: 20 }}>
            <h1 style={{ textAlign: 'center', fontSize: 16, fontWeight: 700, marginBottom: 10 }}>
              FICHE POKER NIGHT KAMOULA
            </h1>

            {/* Tableau 1 : total de la veille / valeur départ / total fermeture — vierge, à remplir à la main */}
            <table style={{ width: '100%', borderCollapse: 'collapse', marginBottom: 4 }}>
              <thead>
                <tr>
                  <th style={printTh}>VALEURS DES JETONS</th>
                  <th style={printTh}>TOTAL DE LA VEILLE</th>
                  <th style={printTh}>VALEUR</th>
                  <th style={printTh}>VALEUR DEPART</th>
                  <th style={printTh}>TOTAL FERMETURE</th>
                </tr>
              </thead>
              <tbody>
                {chipTypes.map((ct) => (
                  <tr key={`pn1-${ct.id}`}>
                    <td style={printTd}>({ct.nom}) {ct.valeur_nominale.toLocaleString('fr-FR')}</td>
                    <td style={printTd}>&nbsp;</td>
                    <td style={printTd}>&nbsp;</td>
                    <td style={printTd}>&nbsp;</td>
                    <td style={printTd}>&nbsp;</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...printTd, fontWeight: 700, textAlign: 'center' }} colSpan={5}>
                    TOTAL
                  </td>
                </tr>
              </tbody>
            </table>

            <p style={{ textAlign: 'center', fontSize: 11, fontWeight: 700, margin: '6px 0' }}>
              TOTAL DES PRELEVEMENTS
            </p>

            {/* Tableau 2 : nombre de jetons / valeur totale — vierge, à remplir à la main */}
            <table style={{ width: '100%', borderCollapse: 'collapse' }}>
              <thead>
                <tr>
                  <th style={printTh}>VALEURS DES JETONS</th>
                  <th style={printTh}>&nbsp;</th>
                  <th style={printTh}>NOMBRE DE JETONS</th>
                  <th style={printTh}>VALEUR TOTAL</th>
                </tr>
              </thead>
              <tbody>
                {chipTypes.map((ct) => (
                  <tr key={`pn2-${ct.id}`}>
                    <td style={printTd}>({ct.nom}) {ct.valeur_nominale.toLocaleString('fr-FR')}</td>
                    <td style={printTd}>&nbsp;</td>
                    <td style={printTd}>&nbsp;</td>
                    <td style={printTd}>&nbsp;</td>
                  </tr>
                ))}
                <tr>
                  <td style={{ ...printTd, fontWeight: 700 }} colSpan={2}>
                    TOTAL DES PRELEVEMENTS
                  </td>
                  <td style={printTd}>&nbsp;</td>
                  <td style={printTd}>&nbsp;</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>,
        document.body
        )}
        </>
      )}
    </Modal>
  );
};

const TotalStat: React.FC<{ label: string; value: React.ReactNode; highlight?: boolean }> = ({ label, value, highlight }) => (
  <div
    className="rounded-xl p-2.5"
    style={{
      backgroundColor: highlight ? 'var(--color-accent)' : 'var(--color-bg)',
      border: '1px solid var(--color-border)',
    }}
  >
    <p className="text-[10px]" style={{ color: highlight ? '#000' : 'var(--text-muted, inherit)' }}>{label}</p>
    <p className="font-semibold" style={{ color: highlight ? '#000' : 'var(--text-primary, inherit)' }}>{value}</p>
  </div>
);

export default FeuilleTableModal;
