// // src/components/Bar/AlcoholCommandeView.tsx
// import React, { useEffect, useState } from 'react';
// import type { BarCommande, BarTable, BarProduct } from '../../types/bar.type';
// import { formatCurrency } from '../../utils/data';
// import barService from '../../services/bar.service';
// import { BAR_COMMANDES_ACTIONS } from '../../data/Bar.data';
// import { Badge, Button, Input, Modal, Select } from '../UI';
// import { Plus, Printer, XCircle, ChefHat, CheckCircle2, DollarSign } from 'lucide-react';
// import { clientService, type Client } from '../../services/client.service';
// import AuthService from '../../services/authService';
// import { isAdmin, isCashier } from '../../utils/permissions';

// interface Props {
//   commandes: BarCommande[];
//   onCreateCommande?: (commande: { client: string; table: number; nombre_personnes: number; moyen_paiement: NonNullable<BarCommande['moyen_paiement']>; items: BarCommande['items'] }) => Promise<void> | void;
//   onDeleteCommande?: (id: number) => Promise<void> | void;
//   onUpdateStatut?: (id: number, statut: BarCommande['statut']) => Promise<void> | void;
//   cocktails?: BarProduct[];
//   stockMap?: Record<number, { quantite: number; unite: string }>;
// }

// const statusClasses: Record<string, { label: string; variant: string }> = {
//   'En attente': { label: 'En attente', variant: 'warning' },
//   'En préparation': { label: 'En cours', variant: 'info' },
//   'Prête': { label: 'Prête', variant: 'success' },
//   'Servie': { label: 'Servie', variant: 'success' },
//   'Encaissée': { label: 'Encaissée', variant: 'accent' },
// };

// export const AlcoholCommandeView: React.FC<Props> = ({ 
//   commandes, 
//   onCreateCommande, 
//   onDeleteCommande, 
//   onUpdateStatut, 
//   cocktails = [], 
//   stockMap = {} 
// }) => {
//   const currentUser = AuthService.getCurrentUser();
//   const canEncaisser = isAdmin(currentUser) || isCashier(currentUser);
//   const canDeleteCommande = isAdmin(currentUser);
//   const [localCommandes, setLocalCommandes] = useState<BarCommande[]>(commandes);

//   useEffect(() => {
//     setLocalCommandes(commandes);
//   }, [commandes]);

//   const [client, setClient] = useState('');
//   const [clients, setClients] = useState<Client[]>([]);
//   const [isLoadingClients, setIsLoadingClients] = useState(false);
//   const [isCreatingClient, setIsCreatingClient] = useState(false);
//   const [newClientNom, setNewClientNom] = useState('');
//   const [newClientPrenom, setNewClientPrenom] = useState('');
//   const [newClientTelephone, setNewClientTelephone] = useState('');
//   const [isSavingClient, setIsSavingClient] = useState(false);
//   const [table, setTable] = useState('');
//   const [nombrePersonnes, setNombrePersonnes] = useState('1');
//   const [moyenPaiement, setMoyenPaiement] = useState<NonNullable<BarCommande['moyen_paiement']>>('ESPECES');
//   const [tables, setTables] = useState<BarTable[]>([]);
//   const [isModalOpen, setIsModalOpen] = useState(false);
//   const [selectedItems, setSelectedItems] = useState<BarCommande['items']>([]);
//   const [searchTerm, setSearchTerm] = useState('');
//   const [menuCategory, setMenuCategory] = useState('Toutes');
//   const [menuSubcategory, setMenuSubcategory] = useState('Toutes');
//   const [commandeSearchTerm, setCommandeSearchTerm] = useState('');
//   const [isCreatingTable, setIsCreatingTable] = useState(false);
//   const [newTableNumber, setNewTableNumber] = useState('');
//   const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
//   const [deletingId, setDeletingId] = useState<number | null>(null);
//   const [updatingId, setUpdatingId] = useState<number | null>(null);

//   // États du sélecteur de dosage (spécifique alcool)
//   const [dosageCocktail, setDosageCocktail] = useState<BarProduct | null>(null);
//   const [dosageAmount, setDosageAmount] = useState('4');
//   const [dosageUnit, setDosageUnit] = useState<'cl' | 'L'>('cl');

//   const loadTables = async () => {
//     try {
//       const data = await barService.getBarTables();
//       const tablesList = Array.isArray(data) ? data : (data as { data?: BarTable[] }).data ?? [];
//       setTables(tablesList);
//     } catch (error) {
//       console.error('Erreur chargement tables bar:', error);
//     }
//   };

//   useEffect(() => {
//     void loadTables();
//   }, []);

//   const resetModal = () => {
//     setClient('');
//     setTable('');
//     setNombrePersonnes('1');
//     setMoyenPaiement('ESPECES');
//     setSelectedItems([]);
//     setSearchTerm('');
//     setIsCreatingTable(false);
//     setNewTableNumber('');
//     setIsCreatingClient(false);
//     setNewClientNom('');
//     setNewClientPrenom('');
//     setNewClientTelephone('');
//     setFeedback(null);
//     setIsModalOpen(false);
//     setDosageCocktail(null);
//     setDosageAmount('4');
//     setDosageUnit('cl');
//   };

//   const handleOpenModal = () => {
//     setClient('');
//     setTable('');
//     setNombrePersonnes('1');
//     setMoyenPaiement('ESPECES');
//     setSelectedItems([]);
//     setSearchTerm('');
//     setFeedback(null);
//     setIsCreatingTable(tables.length === 0);
//     setNewTableNumber('');
//     setIsCreatingClient(false);
//     setNewClientNom('');
//     setNewClientPrenom('');
//     setNewClientTelephone('');
//     setIsModalOpen(true);
//     void loadClients();
//   };

//   const handleCloseModal = () => {
//     resetModal();
//   };

//   // Ouvre le sélecteur de dosage au lieu d'ajouter directement l'article
//   const handleOpenDosagePrompt = (cocktail: BarProduct) => {
//     setDosageCocktail(cocktail);
//     setDosageAmount('4');
//     setDosageUnit('cl');
//   };

//   const handleCancelDosage = () => {
//     setDosageCocktail(null);
//     setDosageAmount('4');
//     setDosageUnit('cl');
//   };

//   const handleConfirmDosage = () => {
//     if (!dosageCocktail) return;
//     const amount = Number(dosageAmount.toString().replace(',', '.'));
//     if (!amount || amount <= 0) {
//       setFeedback({ type: 'error', message: 'Veuillez renseigner un dosage valide.' });
//       return;
//     }

//     const label = `${dosageCocktail.nom} (${amount}${dosageUnit})`;

//     setSelectedItems((prev) => {
//       const existing = prev.find((item) => item.nom === label);
//       if (existing) {
//         return prev.map((item) =>
//           item.nom === label ? { ...item, quantite: item.quantite + 1, prix: dosageCocktail.prix } : item
//         );
//       }
//       return [...prev, { product_id: dosageCocktail.id, nom: label, quantite: 1, prix: dosageCocktail.prix }];
//     });

//     setDosageCocktail(null);
//     setDosageAmount('4');
//     setDosageUnit('cl');
//   };

//   const handleUpdateItemQuantity = (index: number, delta: number) => {
//     setSelectedItems((prev) =>
//       prev.flatMap((item, itemIndex) => {
//         if (itemIndex !== index) return [item];
//         const nextQuantity = item.quantite + delta;
//         return nextQuantity > 0 ? [{ ...item, quantite: nextQuantity }] : [];
//       })
//     );
//   };

//   const handleRemoveItem = (index: number) => {
//     setSelectedItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
//   };

//   const handleCreateTable = async (event?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
//     event?.preventDefault();
//     const numero = newTableNumber.trim();
//     if (!numero) {
//       setFeedback({ type: 'error', message: 'Renseignez un nom de table.' });
//       return;
//     }

//     try {
//       const createdTable = await barService.createBarTable({ numero, capacite: 4 });
//       const tableName = createdTable?.numero || numero;
//       setTables((prev) => [...prev, createdTable]);
//       setTable(String(createdTable.id));
//       setIsCreatingTable(false);
//       setNewTableNumber('');
//       setFeedback({ type: 'success', message: `Table ${tableName} créée avec succès.` });
//     } catch (error: any) {
//       console.error('Erreur création table bar:', error);
//       const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'La table n’a pas pu être créée.';
//       setFeedback({ type: 'error', message: errorMsg });
//     }
//   };

//   const handleAjouterCommande = async (event: React.FormEvent) => {
//     event.preventDefault();
//     const clientNom = client.trim() || 'Client anonyme';
//     const tableNumber = Number(table);
//     const guestCount = Number(nombrePersonnes);

//     if (!table || Number.isNaN(tableNumber) || tableNumber <= 0 || !Number.isInteger(guestCount) || guestCount < 1 || selectedItems.length === 0) {
//       return;
//     }

//     const unavailableItem = selectedItems.find((item) => {
//       const available = stockMap[item.product_id || 0]?.quantite;
//       return !Number.isFinite(available) || Number(item.quantite) > available;
//     });
//     if (unavailableItem) {
//       const available = stockMap[unavailableItem.product_id || 0]?.quantite || 0;
//       setFeedback({ type: 'error', message: 'Stock insuffisant pour ' + unavailableItem.nom + '. Disponible : ' + available + '.' });
//       return;
//     }

//     try {
//       await onCreateCommande?.({
//         client: clientNom,
//         table: tableNumber,
//         nombre_personnes: guestCount,
//         moyen_paiement: moyenPaiement,
//         items: selectedItems,
//       });
//       resetModal();
//     } catch (error) {
//       console.error('Erreur création commande bar:', error);
//       setFeedback({ type: 'error', message: "La commande n'a pas pu être créée. Vérifiez les données puis réessayez." });
//     }
//   };

//   const loadClients = async () => {
//     try {
//       setIsLoadingClients(true);
//       const data = await clientService.getClients();
//       setClients(data.sort((firstClient, secondClient) => {
//         const firstName = `${firstClient.nom} ${firstClient.prenom || ''}`.trim();
//         const secondName = `${secondClient.nom} ${secondClient.prenom || ''}`.trim();
//         return firstName.localeCompare(secondName, 'fr');
//       }));
//     } catch (error) {
//       console.error('Erreur chargement clients:', error);
//       setFeedback({ type: 'error', message: 'La liste des clients n’a pas pu être chargée.' });
//     } finally {
//       setIsLoadingClients(false);
//     }
//   };

//   const handleCreateClient = async () => {
//     const nom = newClientNom.trim();
//     const prenom = newClientPrenom.trim();
//     const telephone = newClientTelephone.trim();

//     if (!nom) {
//       setFeedback({ type: 'error', message: 'Le nom du client est requis.' });
//       return;
//     }

//     try {
//       setIsSavingClient(true);
//       const createdClient = await clientService.createClient({
//         nom,
//         prenom: prenom || undefined,
//         telephone: telephone || undefined,
//         statut: 'ACTIF',
//       });
//       const clientName = `${createdClient.nom}${createdClient.prenom ? ` ${createdClient.prenom}` : ''}`;
//       setClients((currentClients) => [...currentClients, createdClient].sort((firstClient, secondClient) => {
//         const firstName = `${firstClient.nom} ${firstClient.prenom || ''}`.trim();
//         const secondName = `${secondClient.nom} ${secondClient.prenom || ''}`.trim();
//         return firstName.localeCompare(secondName, 'fr');
//       }));
//       setClient(clientName);
//       setNewClientNom('');
//       setNewClientPrenom('');
//       setNewClientTelephone('');
//       setIsCreatingClient(false);
//       setFeedback({ type: 'success', message: 'Client ajouté et sélectionné.' });
//     } catch (error) {
//       console.error('Erreur création client bar:', error);
//       setFeedback({ type: 'error', message: 'Le client n’a pas pu être ajouté.' });
//     } finally {
//       setIsSavingClient(false);
//     }
//   };

//   const handleDeleteCommande = async (commande: BarCommande) => {
//     if (!window.confirm(`Supprimer définitivement la commande #${commande.id} ?`)) return;

//     try {
//       setDeletingId(commande.id);
//       await onDeleteCommande?.(commande.id);
//       setFeedback({ type: 'success', message: 'Commande supprimée avec succès.' });
//     } catch (error) {
//       console.error('Erreur suppression commande bar:', error);
//       setFeedback({ type: 'error', message: "La commande n'a pas pu être supprimée." });
//     } finally {
//       setDeletingId(null);
//     }
//   };

//   const handleStatusChange = async (commandeId: number, nouveauStatut: BarCommande['statut']) => {
//     try {
//       setUpdatingId(commandeId);

//       if (onUpdateStatut) {
//         await onUpdateStatut(commandeId, nouveauStatut);
//       } else {
//         const statuses: Record<BarCommande['statut'], 'EN_ATTENTE' | 'EN_PREPARATION' | 'PRETE' | 'SERVIE' | 'ENCAISSEE'> = {
//           'En attente': 'EN_ATTENTE',
//           'En préparation': 'EN_PREPARATION',
//           'Prête': 'PRETE',
//           'Servie': 'SERVIE',
//           'Encaissée': 'ENCAISSEE',
//         };
//         await barService.updateBarOrderStatus(commandeId, statuses[nouveauStatut]);
//       }

//       setLocalCommandes((prev) =>
//         prev.map((cmd) => (cmd.id === commandeId ? { ...cmd, statut: nouveauStatut } : cmd))
//       );

//       setFeedback({ type: 'success', message: 'Statut de la commande mis à jour avec succès.' });
//     } catch (error: any) {
//       console.error('Erreur mise à jour statut commande bar:', error);
//       const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Le statut n'a pas pu être mis à jour.";
//       setFeedback({ type: 'error', message: errorMsg });
//     } finally {
//       setUpdatingId(null);
//     }
//   };

//   const escapePrintHtml = (value: unknown) => String(value ?? '').replace(/[&<>"']/g, (char) => ({
//     '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;',
//   } as Record<string, string>)[char] || char);

//   const handlePrintCommande = (commande: BarCommande) => {
//     const printWindow = window.open('', '_blank', 'width=720,height=640');
//     if (!printWindow) {
//       setFeedback({ type: 'error', message: 'Autorisez les fenetres pop-up pour imprimer la commande.' });
//       return;
//     }

//     const tableName = tables.find((tableItem) => tableItem.id === commande.table)?.numero || `Table ${commande.table}`;
//     const items = commande.items.map((item) => `
//       <tr><td>${escapePrintHtml(item.nom)}</td><td class="number">${item.quantite}</td><td class="number">${formatCurrency(item.prix)}</td><td class="number">${formatCurrency(item.prix * item.quantite)}</td></tr>`).join('');

//     printWindow.document.write(`<!doctype html><html><head><meta charset="utf-8"><title>Commande #${commande.id}</title><style>
//       body { font-family: Arial, sans-serif; color: #111; margin: 32px; } h1 { margin: 0 0 4px; font-size: 22px; } p { margin: 4px 0; } table { width: 100%; border-collapse: collapse; margin-top: 24px; } th, td { padding: 9px 4px; border-bottom: 1px solid #ddd; text-align: left; } .number { text-align: right; } .total { font-size: 18px; font-weight: bold; text-align: right; margin-top: 16px; } .muted { color: #555; font-size: 12px; } @media print { body { margin: 12px; } }
//     </style></head><body><h1>Commande Bar #${commande.id}</h1><p class="muted">Imprimee le ${new Date().toLocaleString('fr-FR')}</p><p><strong>Client :</strong> ${escapePrintHtml(commande.client)}</p><p><strong>Table :</strong> ${escapePrintHtml(tableName)}</p><table><thead><tr><th>Article</th><th class="number">Qte</th><th class="number">Prix</th><th class="number">Total</th></tr></thead><tbody>${items}</tbody></table><p class="total">Total : ${formatCurrency(commande.total)}</p></body></html>`);
//     printWindow.document.close();
//     printWindow.focus();
//     printWindow.print();
//   };

//   const formatCommandeDate = (value?: string) => {
//     if (!value) return '—';
//     const date = new Date(value);
//     return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', {
//       day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
//     });
//   };

//   const columns = [
//     {
//       key: 'table',
//       label: 'Table',
//       render: (commande: BarCommande) => (
//         <div className="flex items-center gap-3">
//           <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-black shadow-[0_0_20px_rgba(234,179,8,0.25)]">
//             {commande.table}
//           </div>
//           <div>
//             <p className="font-semibold text-primary">{commande.client}</p>
//             <p className="text-xs text-slate-500">{tables.find((tableItem) => tableItem.id === commande.table)?.numero || `Table ${commande.table}`} · {commande.nombre_personnes || 1} pers.</p>
//             <p className="text-[11px] text-accent">{commande.moyen_paiement === 'TPE' ? 'TPE' : commande.moyen_paiement === 'CREDIT' ? 'Crédit' : commande.moyen_paiement === 'ORANGE_MONEY' ? 'Orange Money' : commande.moyen_paiement === 'MVOLA' ? 'MVola' : commande.moyen_paiement === 'GRATUIT' ? 'Gratuit' : 'Espèces'}</p>
//           </div>
//         </div>
//       ),
//     },
//     {
//       key: 'items',
//       label: 'Articles',
//       render: (commande: BarCommande) => (
//         <div>
//           {commande.items.length === 0 ? (
//             <span className="text-sm text-slate-500">—</span>
//           ) : (
//             <>
//               {commande.items.slice(0, 2).map((item, index) => (
//                 <p key={`${commande.id}-${index}`} className="text-sm text-slate-300">
//                   {item.nom} ×{item.quantite}
//                 </p>
//               ))}
//               {commande.items.length > 2 && <p className="text-xs text-slate-500">+{commande.items.length - 2} autres</p>}
//             </>
//           )}
//         </div>
//       ),
//     },
//     {
//       key: 'date',
//       label: 'Date',
//       render: (commande: BarCommande) => <span className="text-sm text-slate-300">{formatCommandeDate(commande.created_at)}</span>,
//     },
//     {
//       key: 'montant',
//       label: 'Montant',
//       render: (commande: BarCommande) => <span className="font-semibold text-accent">{formatCurrency(commande.total)}</span>,
//     },
//     {
//       key: 'statut',
//       label: 'Statut',
//       render: (commande: BarCommande) => {
//         const status = statusClasses[commande.statut] || statusClasses['En attente'];
//         return <Badge variant={status.variant as any}>{status.label}</Badge>;
//       },
//     },
//     {
//       key: 'actions',
//       label: '',
//       render: (commande: BarCommande) => {
//         const isUpdating = updatingId === commande.id;
//         return (
//           <>
//             {commande.statut === 'En attente' && (
//               <Button 
//                 size="sm" 
//                 variant="secondary" 
//                 icon={<ChefHat size={14} />} 
//                 onClick={() => void handleStatusChange(commande.id, 'En préparation')}
//                 disabled={isUpdating}
//               >
//                 {isUpdating ? '...' : 'Démarrer'}
//               </Button>
//             )}
//             {commande.statut === 'En préparation' && (
//               <Button 
//                 size="sm" 
//                 variant="secondary" 
//                 icon={<CheckCircle2 size={14} />} 
//                 onClick={() => void handleStatusChange(commande.id, 'Prête')}
//                 disabled={isUpdating}
//               >
//                 {isUpdating ? '...' : 'Marquer prête'}
//               </Button>
//             )}
//             {commande.statut === 'Prête' && (
//               <Button
//                 size="sm"
//                 variant="secondary"
//                 icon={<CheckCircle2 size={14} />}
//                 onClick={() => void handleStatusChange(commande.id, 'Servie')}
//                 disabled={isUpdating}
//               >
//                 {isUpdating ? '...' : 'Servir'}
//               </Button>
//             )}
//             {canEncaisser && commande.statut === 'Servie' && (
//               <Button
//                 size="sm"
//                 variant="secondary"
//                 icon={<DollarSign size={14} />}
//                 onClick={() => void handleStatusChange(commande.id, 'Encaissée')}
//                 disabled={isUpdating}
//               >
//                 {isUpdating ? '...' : 'Encaisser'}
//               </Button>
//             )}
//             <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => handlePrintCommande(commande)}>Imprimer</Button>
//             <Button size="sm" variant="danger" icon={<XCircle size={14} />} onClick={() => void handleDeleteCommande(commande)} disabled={!canDeleteCommande || deletingId === commande.id} title={canDeleteCommande ? 'Supprimer la commande' : 'Suppression réservée à l’administrateur'}>
//               {deletingId === commande.id ? '...' : 'Supprimer'}
//             </Button>
//           </>
//         );
//       },
//     },
//   ];

//   const filteredCommandes = localCommandes.filter((commande) => {
//     const query = commandeSearchTerm.trim().toLocaleLowerCase('fr-FR');
//     if (!query) return true;

//     const searchableValue = [
//       commande.client,
//       tables.find((tableItem) => tableItem.id === commande.table)?.numero || String(commande.table),
//       formatCommandeDate(commande.created_at),
//       ...commande.items.map((item) => item.nom),
//     ].join(' ').toLocaleLowerCase('fr-FR');

//     return searchableValue.includes(query);
//   });
  
//   const data = filteredCommandes;

//   const totalCommandes = localCommandes.reduce((sum, commande) => sum + commande.total, 0);
//   const commandesEnAttente = localCommandes.filter((commande) => commande.statut === 'En attente').length;
//   const filteredCocktails = cocktails.filter((cocktail) => {
//     const value = searchTerm.trim().toLowerCase();
//     if (!value) return true;
//     return `${cocktail.nom} ${cocktail.categorie}`.toLowerCase().includes(value);
//   });
//   const menuParts = (cocktail: BarProduct) => {
//     const [category, subcategory] = (cocktail.categorie || 'Autres').split(/\s*(?:>|\/|\|)\s*/).map((part) => part.trim());
//     return { category: category || 'Autres', subcategory: subcategory || '' };
//   };
//   const menuCategories = ['Toutes', ...Array.from(new Set(cocktails.map((cocktail) => menuParts(cocktail).category)))];
//   const menuSubcategories = ['Toutes', ...Array.from(new Set(cocktails.filter((cocktail) => menuCategory === 'Toutes' || menuParts(cocktail).category === menuCategory).map((cocktail) => menuParts(cocktail).subcategory).filter(Boolean)))];
//   const menuItems = filteredCocktails.filter((cocktail) => {
//     const parts = menuParts(cocktail);
//     return (menuCategory === 'Toutes' || parts.category === menuCategory) && (menuSubcategory === 'Toutes' || parts.subcategory === menuSubcategory);
//   });

//   return (
//     <div className="space-y-4">
//       <div className="rounded-2xl border border-base bg-surface p-4 shadow-sm">
//         <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
//           <div>
//             <h3 className="text-primary font-semibold">Commandes Alcool</h3>
//             <p className="text-sm text-slate-500">Créez une commande avec un client et une table issue de la base</p>
//           </div>
//           <div className="flex items-center gap-3">
//             <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm text-accent">
//               {localCommandes.length} commande{localCommandes.length > 1 ? 's' : ''} active{localCommandes.length > 1 ? 's' : ''}
//             </div>
//             <Button icon={<Plus size={16} />} onClick={handleOpenModal}>
//               {BAR_COMMANDES_ACTIONS.newOrderLabel}
//             </Button>
//           </div>
//         </div>
//       </div>

//       <div className="grid gap-4 md:grid-cols-3">
//         <div className="rounded-2xl border border-base bg-surface p-4">
//           <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Commandes actives</p>
//           <p className="mt-2 text-2xl font-semibold text-primary">{localCommandes.length}</p>
//         </div>
//         <div className="rounded-2xl border border-base bg-surface p-4">
//           <p className="text-xs uppercase tracking-[0.2em] text-slate-500">En attente</p>
//           <p className="mt-2 text-2xl font-semibold text-amber-400">{commandesEnAttente}</p>
//         </div>
//         <div className="rounded-2xl border border-base bg-surface p-4">
//           <p className="text-xs uppercase tracking-[0.2em] text-slate-500">CA en cours</p>
//           <p className="mt-2 text-2xl font-semibold text-accent">{formatCurrency(totalCommandes)}</p>
//         </div>
//       </div>

//       <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Nouvelle commande · Alcool" size="xl">
//         <form onSubmit={handleAjouterCommande} className="space-y-3 sm:space-y-4">
//           {feedback && (
//             <div className={`rounded-xl p-3 text-sm flex items-center justify-between border ${feedback.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
//               <span>{feedback.message}</span>
//               <button type="button" onClick={() => setFeedback(null)} className="text-xs opacity-80 hover:opacity-100">✕</button>
//             </div>
//           )}

//           <div className="grid grid-cols-1 gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3 sm:grid-cols-3">
//             <Select
//               label="Table"
//               value={table}
//               onChange={(event) => setTable(event.target.value)}
//               options={[
//                 { value: '', label: 'Choisir une table' },
//                 ...tables.map((tableItem) => ({ value: String(tableItem.id), label: tableItem.numero }))
//               ]}
//             />
//             <Input label="Personnes" type="number" min="1" value={nombrePersonnes} onChange={(event) => setNombrePersonnes(event.target.value)} />
//             <Select
//               label="Paiement prévu"
//               value={moyenPaiement}
//               onChange={(event) => setMoyenPaiement(event.target.value as NonNullable<BarCommande['moyen_paiement']>)}
//               options={[
//                 { value: 'ESPECES', label: 'Espèces' },
//                 { value: 'CARTE', label: 'Carte bancaire' },
//                 { value: 'TPE', label: 'TPE' },
//                 { value: 'CREDIT', label: 'Crédit' },
//                 { value: 'EURO', label: 'Euro' },
//                 { value: 'ORANGE_MONEY', label: 'Orange Money' },
//                 { value: 'MVOLA', label: 'MVola' },
//                 { value: 'DOLLAR', label: 'Dollar' },
//                 { value: 'VIREMENT', label: 'Virement' },
//                 { value: 'CHEQUE', label: 'Chèque' },
//               ]}
//             />
//           </div>

//           <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-3 space-y-3">
//             <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
//               <p className="text-sm font-medium text-slate-300">Créer une table si besoin</p>
//               <Button type="button" size="sm" variant="secondary" onClick={() => setIsCreatingTable((prev) => !prev)} className="w-full sm:w-auto">
//                 {isCreatingTable ? 'Fermer' : 'Nouvelle table'}
//               </Button>
//             </div>

//             {(isCreatingTable || tables.length === 0) && (
//               <div className="grid gap-3 grid-cols-1 sm:grid-cols-[1fr_auto]">
//                 <Input
//                   label="Nom de table"
//                   value={newTableNumber}
//                   onChange={(event) => setNewTableNumber(event.target.value)}
//                   placeholder="Ex. Bar 12"
//                 />
//                 <div className="flex items-end">
//                   <Button type="button" size="sm" className="w-full justify-center" onClick={() => void handleCreateTable()}>
//                     Créer
//                   </Button>
//                 </div>
//               </div>
//             )}
//           </div>

//           <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
//             <Select
//               label="Client (facultatif)"
//               value={client}
//               onChange={(event) => setClient(event.target.value)}
//               options={[
//                 { value: '', label: isLoadingClients ? 'Chargement des clients...' : 'Client anonyme' },
//                 ...clients.map((clientItem) => ({
//                   value: `${clientItem.nom}${clientItem.prenom ? ` ${clientItem.prenom}` : ''}`,
//                   label: `${clientItem.nom}${clientItem.prenom ? ` ${clientItem.prenom}` : ''}${clientItem.code_client ? ` (${clientItem.code_client})` : ''}`,
//                 })),
//               ]}
//               disabled={isLoadingClients}
//               className="flex-1"
//             />
//             <Button
//               type="button"
//               variant="secondary"
//               onClick={() => { setIsCreatingClient((current) => !current); setFeedback(null); }}
//               className="w-full sm:w-auto"
//             >
//               <Plus size={16} />
//               Nouveau client
//             </Button>
//           </div>

//           {isCreatingClient && (
//             <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-3 space-y-3">
//               <p className="text-sm font-medium text-slate-300">Ajouter un nouveau client</p>
//               <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
//                 <Input label="Nom" value={newClientNom} onChange={(event) => setNewClientNom(event.target.value)} placeholder="Nom" />
//                 <Input label="Prénom" value={newClientPrenom} onChange={(event) => setNewClientPrenom(event.target.value)} placeholder="Prénom" />
//               </div>
//               <Input label="Téléphone" value={newClientTelephone} onChange={(event) => setNewClientTelephone(event.target.value)} placeholder="Téléphone" />
//               <Button type="button" size="sm" onClick={() => void handleCreateClient()} disabled={isSavingClient} className="w-full">
//                 {isSavingClient ? 'Ajout en cours...' : 'Ajouter le client'}
//               </Button>
//             </div>
//           )}

//           <div className="overflow-hidden rounded-xl border border-base bg-[#101415] shadow-inner">
//             <div className="flex items-center justify-between border-b border-base px-3 py-2">
//               <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Menu alcool</p>
//               <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher" className="w-40 text-xs" />
//             </div>
//             <div className="grid min-h-[280px] grid-cols-[92px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)_210px]">
//               <nav className="space-y-1 border-r border-base bg-[#171b1c] p-2">
//                 {menuCategories.map((category) => (
//                   <button key={category} type="button" onClick={() => { setMenuCategory(category); setMenuSubcategory('Toutes'); }} className={`w-full rounded-md px-2 py-3 text-left text-[11px] font-semibold transition ${menuCategory === category ? 'bg-red-500 text-white' : 'text-secondary hover:bg-surface-3'}`}>
//                     {category}
//                   </button>
//                 ))}
//               </nav>
//               <div className="min-w-0 p-2 sm:p-3">
//                 {menuSubcategories.length > 1 && (
//                   <div className="mb-2 flex gap-1 overflow-x-auto border-b border-base pb-2">
//                     {menuSubcategories.map((subcategory) => <button key={subcategory} type="button" onClick={() => setMenuSubcategory(subcategory)} className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${menuSubcategory === subcategory ? 'bg-sky-500 text-white' : 'bg-surface-2 text-muted'}`}>{subcategory}</button>)}
//                   </div>
//                 )}
//                 <div className="grid max-h-[330px] grid-cols-2 gap-2 overflow-y-auto xl:grid-cols-3">
//                   {menuItems.map((cocktail) => {
//                     const stock = stockMap[cocktail.id];
//                     const unavailable = !stock || stock.quantite <= 0;
//                     return <button key={cocktail.id} type="button" disabled={unavailable} onClick={() => handleOpenDosagePrompt(cocktail)} className={`flex min-h-[84px] flex-col items-center justify-center rounded-md border border-emerald-950 bg-emerald-500 px-2 py-2 text-center text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40`}><span className="text-xs font-bold leading-tight">{cocktail.nom}</span><span className="mt-1 text-[10px] font-semibold text-emerald-950">{formatCurrency(cocktail.prix)}</span></button>;
//                   })}
//                   {menuItems.length === 0 && <p className="col-span-full py-10 text-center text-xs text-muted">Aucun article disponible.</p>}
//                 </div>
//               </div>
//               <aside className="col-span-2 border-t border-base bg-[#171b1c] p-3 sm:col-span-1 sm:border-l sm:border-t-0">
//                 <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">Ticket</p>
//                 {selectedItems.length === 0 ? <p className="py-8 text-center text-xs text-muted">Sélectionnez un article</p> : <div className="space-y-2">{selectedItems.map((item, index) => <div key={`${item.nom}-${index}`} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-secondary">{item.nom} ×{item.quantite}</span><span className="shrink-0 text-accent">{formatCurrency(item.prix * item.quantite)}</span></div>)}</div>}
//                 <div className="mt-4 flex items-center justify-between border-t border-base pt-3 text-sm font-bold"><span>Total</span><span className="text-accent">{formatCurrency(selectedItems.reduce((sum, item) => sum + item.prix * item.quantite, 0))}</span></div>
//               </aside>
//             </div>
//           </div>

//           {selectedItems.length > 0 && (
//             <div className="rounded-xl border border-base bg-surface-2 p-4 sm:hidden">
//               <p className="mb-2 text-sm font-medium text-slate-300">Résumé</p>
//               <div className="space-y-2">
//                 {selectedItems.map((item, index) => (
//                   <div key={`${item.nom}-${index}`} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
//                     <span className="text-primary">{item.nom}</span>
//                     <div className="flex items-center gap-2">
//                       <div className="flex items-center gap-1 rounded-lg border border-base bg-surface-2 px-2 py-1">
//                         <button type="button" onClick={() => handleUpdateItemQuantity(index, -1)} className="text-slate-400 transition hover:text-white">
//                           −
//                         </button>
//                         <span className="min-w-5 text-center text-primary">{item.quantite}</span>
//                         <button type="button" onClick={() => handleUpdateItemQuantity(index, 1)} className="text-slate-400 transition hover:text-white">
//                           +
//                         </button>
//                       </div>
//                       <span className="text-accent">{formatCurrency(item.prix * item.quantite)}</span>
//                       <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 transition hover:text-red-300">
//                         <XCircle size={16} />
//                       </button>
//                     </div>
//                   </div>
//                 ))}
//               </div>
//               <div className="mt-3 flex items-center justify-between border-t border-base pt-3">
//                 <span className="text-sm font-medium text-slate-300">Total</span>
//                 <span className="text-lg font-semibold text-accent">
//                   {formatCurrency(selectedItems.reduce((sum, item) => sum + item.prix * item.quantite, 0))}
//                 </span>
//               </div>
//             </div>
//           )}

//           <div className="flex gap-3 pt-2">
//             <Button variant="secondary" type="button" onClick={handleCloseModal} className="flex-1">
//               Annuler
//             </Button>
//             <Button type="submit" className="flex-1" disabled={selectedItems.length === 0}>
//               <Plus size={16} />
//               Créer la commande
//             </Button>
//           </div>
//         </form>
//       </Modal>

//       {/* Sélecteur de dosage (cl/L) avant ajout au ticket */}
//       <Modal isOpen={!!dosageCocktail} onClose={handleCancelDosage} title={`Dosage — ${dosageCocktail?.nom || ''}`} size="md">
//         <div className="space-y-4">
//           <div className="grid grid-cols-2 gap-3">
//             <Input
//               label="Quantité"
//               type="number"
//               min="0"
//               step="0.1"
//               value={dosageAmount}
//               onChange={(e) => setDosageAmount(e.target.value)}
//               placeholder="Ex: 4"
//             />
//             <Select
//               label="Unité"
//               value={dosageUnit}
//               onChange={(e) => setDosageUnit(e.target.value as 'cl' | 'L')}
//               options={[
//                 { value: 'cl', label: 'cl' },
//                 { value: 'L', label: 'L' },
//               ]}
//             />
//           </div>
//           <div className="flex gap-3 pt-2">
//             <Button variant="secondary" type="button" onClick={handleCancelDosage} className="flex-1">
//               Annuler
//             </Button>
//             <Button type="button" className="flex-1" onClick={handleConfirmDosage}>
//               Ajouter au ticket
//             </Button>
//           </div>
//         </div>
//       </Modal>

//       <div className="rounded-2xl overflow-hidden border border-base bg-surface">
//         <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-base px-3 py-3 sm:px-6 sm:py-4 gap-3">
//           <h3 className="text-primary font-semibold text-base sm:text-lg">Liste des commandes</h3>
//           <Input
//             value={commandeSearchTerm}
//             onChange={(event) => setCommandeSearchTerm(event.target.value)}
//             placeholder="Rechercher client, table..."
//             className="w-full sm:max-w-xs text-xs sm:text-sm"
//           />
//         </div>

//         {data.length === 0 ? (
//           <div className="p-6 sm:p-8 text-center text-slate-500 text-sm">
//             {localCommandes.length === 0
//               ? `${BAR_COMMANDES_ACTIONS.emptyTitle}. ${BAR_COMMANDES_ACTIONS.emptyDescription}`
//               : 'Aucune commande ne correspond à votre recherche.'}
//           </div>
//         ) : (
//           <>
//             <div className="block sm:hidden space-y-3 p-3">
//               {data.map((commande) => (
//                 <div key={commande.id} className="rounded-lg border border-base bg-surface-2 p-3 space-y-2 text-xs">
//                   <div className="flex items-start justify-between gap-2">
//                     <div className="flex items-start gap-2 flex-1 min-w-0">
//                       {columns[0].render(commande)}
//                     </div>
//                     <span className="flex-shrink-0">{columns[3].render(commande)}</span>
//                   </div>
//                   <div className="text-slate-400">{columns[1].render(commande)}</div>
//                   <div className="flex items-center justify-between pt-2 border-t border-base">
//                     <div className="text-slate-400">{columns[2].render(commande)}</div>
//                     {columns[4].render(commande)}
//                   </div>
//                   <div className="flex gap-1 pt-2 border-t border-base">{columns[5].render(commande)}</div>
//                 </div>
//               ))}
//             </div>

//             <div className="hidden sm:block overflow-x-auto">
//               <table className="min-w-full text-left text-sm">
//                 <thead className="bg-surface-2 text-slate-400 text-xs">
//                   <tr>
//                     <th className="px-3 py-3 font-medium">Table</th>
//                     <th className="px-3 py-3 font-medium">Articles</th>
//                     <th className="px-3 py-3 font-medium">Date</th>
//                     <th className="px-3 py-3 font-medium">Montant</th>
//                     <th className="px-3 py-3 font-medium">Statut</th>
//                     <th className="px-3 py-3 font-medium text-right">Actions</th>
//                   </tr>
//                 </thead>
//                 <tbody>
//                   {data.map((commande) => (
//                     <tr key={commande.id} className="border-t border-base hover:bg-surface-2/50 transition">
//                       <td className="px-3 py-3">{columns[0].render(commande)}</td>
//                       <td className="px-3 py-3">{columns[1].render(commande)}</td>
//                       <td className="px-3 py-3">{columns[2].render(commande)}</td>
//                       <td className="px-3 py-3">{columns[3].render(commande)}</td>
//                       <td className="px-3 py-3">{columns[4].render(commande)}</td>
//                       <td className="px-3 py-3 text-right">
//                         <div className="flex gap-1 justify-end">{columns[5].render(commande)}</div>
//                       </td>
//                     </tr>
//                   ))}
//                 </tbody>
//               </table>
//             </div>
//           </>
//         )}
//       </div>
//     </div>
//   );
// };

// src/components/Bar/AlcoholCommandeView.tsx
import React, { useEffect, useState } from 'react';
import type { BarCommande, BarTable, BarProduct } from '../../types/bar.type';
import { formatCurrency } from '../../utils/data';
import { escapeHtml, printThermal, thermalHeader } from '../../utils/thermalPrint';
import alcoholService from '../../services/alcohol.service';
import { BAR_COMMANDES_ACTIONS } from '../../data/Bar.data';
import { Badge, Button, Input, Modal, Select } from '../UI';
import { Plus, Printer, XCircle, ChefHat, CheckCircle2, DollarSign } from 'lucide-react';
import { clientService, type Client } from '../../services/client.service';
import AuthService from '../../services/authService';
import { isAdmin, isCashier } from '../../utils/permissions';

interface Props {
  commandes: BarCommande[];
  onCreateCommande?: (commande: { client: string; table: number; nombre_personnes: number; moyen_paiement: NonNullable<BarCommande['moyen_paiement']>; items: BarCommande['items'] }) => Promise<void> | void;
  onDeleteCommande?: (id: number) => Promise<void> | void;
  onUpdateStatut?: (id: number, statut: BarCommande['statut']) => Promise<void> | void;
  cocktails?: BarProduct[];
  stockMap?: Record<number, { quantite: number; unite: string }>;
}

const statusClasses: Record<string, { label: string; variant: string }> = {
  'En attente': { label: 'En attente', variant: 'warning' },
  'En préparation': { label: 'En cours', variant: 'info' },
  'Prête': { label: 'Prête', variant: 'success' },
  'Servie': { label: 'Servie', variant: 'success' },
  'Encaissée': { label: 'Encaissée', variant: 'accent' },
};

export const AlcoholCommandeView: React.FC<Props> = ({ 
  commandes, 
  onCreateCommande, 
  onDeleteCommande, 
  onUpdateStatut, 
  cocktails = [], 
  stockMap = {} 
}) => {
  const currentUser = AuthService.getCurrentUser();
  const canEncaisser = isAdmin(currentUser) || isCashier(currentUser);
  const canDeleteCommande = isAdmin(currentUser);
  const [localCommandes, setLocalCommandes] = useState<BarCommande[]>(commandes);

  useEffect(() => {
    setLocalCommandes(commandes);
  }, [commandes]);

  const [client, setClient] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [isCreatingClient, setIsCreatingClient] = useState(false);
  const [newClientNom, setNewClientNom] = useState('');
  const [newClientPrenom, setNewClientPrenom] = useState('');
  const [newClientTelephone, setNewClientTelephone] = useState('');
  const [isSavingClient, setIsSavingClient] = useState(false);
  const [table, setTable] = useState('');
  const [nombrePersonnes, setNombrePersonnes] = useState('1');
  const [moyenPaiement, setMoyenPaiement] = useState<NonNullable<BarCommande['moyen_paiement']>>('ESPECES');
  const [tables, setTables] = useState<BarTable[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedItems, setSelectedItems] = useState<BarCommande['items']>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuCategory, setMenuCategory] = useState('Toutes');
  const [menuSubcategory, setMenuSubcategory] = useState('Toutes');
  const [commandeSearchTerm, setCommandeSearchTerm] = useState('');
  const [isCreatingTable, setIsCreatingTable] = useState(false);
  const [newTableNumber, setNewTableNumber] = useState('');
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  // États du sélecteur de dosage (spécifique alcool)
  const [dosageCocktail, setDosageCocktail] = useState<BarProduct | null>(null);
  const [dosageAmount, setDosageAmount] = useState('4');
  const [dosageUnit, setDosageUnit] = useState<'cl' | 'L'>('cl');

  const loadTables = async () => {
    try {
      const data = await alcoholService.getAlcoholTables();
      const tablesList = Array.isArray(data) ? data : (data as { data?: BarTable[] }).data ?? [];
      setTables(tablesList);
    } catch (error) {
      console.error('Erreur chargement tables alcool:', error);
    }
  };

  useEffect(() => {
    void loadTables();
  }, []);

  const resetModal = () => {
    setClient('');
    setTable('');
    setNombrePersonnes('1');
    setMoyenPaiement('ESPECES');
    setSelectedItems([]);
    setSearchTerm('');
    setIsCreatingTable(false);
    setNewTableNumber('');
    setIsCreatingClient(false);
    setNewClientNom('');
    setNewClientPrenom('');
    setNewClientTelephone('');
    setFeedback(null);
    setIsModalOpen(false);
    setDosageCocktail(null);
    setDosageAmount('4');
    setDosageUnit('cl');
  };

  const handleOpenModal = () => {
    setClient('');
    setTable('');
    setNombrePersonnes('1');
    setMoyenPaiement('ESPECES');
    setSelectedItems([]);
    setSearchTerm('');
    setFeedback(null);
    setIsCreatingTable(tables.length === 0);
    setNewTableNumber('');
    setIsCreatingClient(false);
    setNewClientNom('');
    setNewClientPrenom('');
    setNewClientTelephone('');
    setIsModalOpen(true);
    void loadClients();
  };

  const handleCloseModal = () => {
    resetModal();
  };

  // Ouvre le sélecteur de dosage au lieu d'ajouter directement l'article
  const handleOpenDosagePrompt = (cocktail: BarProduct) => {
    setDosageCocktail(cocktail);
    setDosageAmount('4');
    setDosageUnit('cl');
  };

  const handleCancelDosage = () => {
    setDosageCocktail(null);
    setDosageAmount('4');
    setDosageUnit('cl');
  };

  const handleConfirmDosage = () => {
    if (!dosageCocktail) return;
    const amount = Number(dosageAmount.toString().replace(',', '.'));
    if (!amount || amount <= 0) {
      setFeedback({ type: 'error', message: 'Veuillez renseigner un dosage valide.' });
      return;
    }

    const label = `${dosageCocktail.nom} (${amount}${dosageUnit})`;

    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.nom === label);
      if (existing) {
        return prev.map((item) =>
          item.nom === label ? { ...item, quantite: item.quantite + 1, prix: dosageCocktail.prix } : item
        );
      }
      return [...prev, { product_id: dosageCocktail.id, nom: label, quantite: 1, prix: dosageCocktail.prix }];
    });

    setDosageCocktail(null);
    setDosageAmount('4');
    setDosageUnit('cl');
  };

  const handleUpdateItemQuantity = (index: number, delta: number) => {
    setSelectedItems((prev) =>
      prev.flatMap((item, itemIndex) => {
        if (itemIndex !== index) return [item];
        const nextQuantity = item.quantite + delta;
        return nextQuantity > 0 ? [{ ...item, quantite: nextQuantity }] : [];
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const handleCreateTable = async (event?: React.FormEvent | React.MouseEvent<HTMLButtonElement>) => {
    event?.preventDefault();
    const numero = newTableNumber.trim();
    if (!numero) {
      setFeedback({ type: 'error', message: 'Renseignez un nom de table.' });
      return;
    }

    try {
      const createdTable = await alcoholService.createAlcoholTable({ numero, capacite: 4 });
      const tableName = createdTable?.numero || numero;
      setTables((prev) => [...prev, createdTable]);
      setTable(String(createdTable.id));
      setIsCreatingTable(false);
      setNewTableNumber('');
      setFeedback({ type: 'success', message: `Table ${tableName} créée avec succès.` });
    } catch (error: any) {
      console.error('Erreur création table alcool:', error);
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || 'La table n’a pas pu être créée.';
      setFeedback({ type: 'error', message: errorMsg });
    }
  };

  const handleAjouterCommande = async (event: React.FormEvent) => {
    event.preventDefault();
    const clientNom = client.trim() || 'Client anonyme';
    const tableNumber = Number(table);
    const guestCount = Number(nombrePersonnes);

    if (!table || Number.isNaN(tableNumber) || tableNumber <= 0 || !Number.isInteger(guestCount) || guestCount < 1 || selectedItems.length === 0) {
      return;
    }

    const unavailableItem = selectedItems.find((item) => {
      const available = stockMap[item.product_id || 0]?.quantite;
      return !Number.isFinite(available) || Number(item.quantite) > available;
    });
    if (unavailableItem) {
      const available = stockMap[unavailableItem.product_id || 0]?.quantite || 0;
      setFeedback({ type: 'error', message: 'Stock insuffisant pour ' + unavailableItem.nom + '. Disponible : ' + available + '.' });
      return;
    }

    try {
      await onCreateCommande?.({
        client: clientNom,
        table: tableNumber,
        nombre_personnes: guestCount,
        moyen_paiement: moyenPaiement,
        items: selectedItems,
      });
      resetModal();
    } catch (error) {
      console.error('Erreur création commande alcool:', error);
      setFeedback({ type: 'error', message: "La commande n'a pas pu être créée. Vérifiez les données puis réessayez." });
    }
  };

  const loadClients = async () => {
    try {
      setIsLoadingClients(true);
      const data = await clientService.getClients();
      setClients(data.sort((firstClient, secondClient) => {
        const firstName = `${firstClient.nom} ${firstClient.prenom || ''}`.trim();
        const secondName = `${secondClient.nom} ${secondClient.prenom || ''}`.trim();
        return firstName.localeCompare(secondName, 'fr');
      }));
    } catch (error) {
      console.error('Erreur chargement clients:', error);
      setFeedback({ type: 'error', message: 'La liste des clients n’a pas pu être chargée.' });
    } finally {
      setIsLoadingClients(false);
    }
  };

  const handleCreateClient = async () => {
    const nom = newClientNom.trim();
    const prenom = newClientPrenom.trim();
    const telephone = newClientTelephone.trim();

    if (!nom) {
      setFeedback({ type: 'error', message: 'Le nom du client est requis.' });
      return;
    }

    try {
      setIsSavingClient(true);
      const createdClient = await clientService.createClient({
        nom,
        prenom: prenom || undefined,
        telephone: telephone || undefined,
        statut: 'ACTIF',
      });
      const clientName = `${createdClient.nom}${createdClient.prenom ? ` ${createdClient.prenom}` : ''}`;
      setClients((currentClients) => [...currentClients, createdClient].sort((firstClient, secondClient) => {
        const firstName = `${firstClient.nom} ${firstClient.prenom || ''}`.trim();
        const secondName = `${secondClient.nom} ${secondClient.prenom || ''}`.trim();
        return firstName.localeCompare(secondName, 'fr');
      }));
      setClient(clientName);
      setNewClientNom('');
      setNewClientPrenom('');
      setNewClientTelephone('');
      setIsCreatingClient(false);
      setFeedback({ type: 'success', message: 'Client ajouté et sélectionné.' });
    } catch (error) {
      console.error('Erreur création client alcool:', error);
      setFeedback({ type: 'error', message: 'Le client n’a pas pu être ajouté.' });
    } finally {
      setIsSavingClient(false);
    }
  };

  const handleDeleteCommande = async (commande: BarCommande) => {
    if (!window.confirm(`Supprimer définitivement la commande #${commande.id} ?`)) return;

    try {
      setDeletingId(commande.id);
      await onDeleteCommande?.(commande.id);
      setFeedback({ type: 'success', message: 'Commande supprimée avec succès.' });
    } catch (error) {
      console.error('Erreur suppression commande alcool:', error);
      setFeedback({ type: 'error', message: "La commande n'a pas pu être supprimée." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleStatusChange = async (commandeId: number, nouveauStatut: BarCommande['statut']) => {
    try {
      setUpdatingId(commandeId);

      if (onUpdateStatut) {
        await onUpdateStatut(commandeId, nouveauStatut);
      } else {
        const statuses: Record<BarCommande['statut'], 'EN_ATTENTE' | 'EN_PREPARATION' | 'SERVIE' | 'ENCAISSEE'> = {
          'En attente': 'EN_ATTENTE',
          'En préparation': 'EN_PREPARATION',
          'Prête': 'EN_PREPARATION',
          'Servie': 'SERVIE',
          'Encaissée': 'ENCAISSEE',
        };
        await alcoholService.updateAlcoholOrderStatus(commandeId, statuses[nouveauStatut]);
      }

      setLocalCommandes((prev) =>
        prev.map((cmd) => (cmd.id === commandeId ? { ...cmd, statut: nouveauStatut } : cmd))
      );

      setFeedback({ type: 'success', message: 'Statut de la commande mis à jour avec succès.' });
    } catch (error: any) {
      console.error('Erreur mise à jour statut commande alcool:', error);
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Le statut n'a pas pu être mis à jour.";
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setUpdatingId(null);
    }
  };

  const handlePrintCommande = (commande: BarCommande) => {
    const tableName = tables.find((tableItem) => tableItem.id === commande.table)?.numero || `Table ${commande.table}`;
    const items = commande.items.map((item) => `
      <div class="line"><div class="row"><span>${item.quantite} x ${escapeHtml(item.nom)}</span><span>${escapeHtml(formatCurrency(item.prix * item.quantite))}</span></div><div class="sub">PU ${escapeHtml(formatCurrency(item.prix))}</div></div>`).join('');

    const printed = printThermal(`Commande #${commande.id}`, `${thermalHeader(`Commande Alcool #${commande.id}`)}<p><strong>Client :</strong> ${escapeHtml(commande.client)}</p><p><strong>Table :</strong> ${escapeHtml(tableName)}</p><div class="sep"></div>${items}<div class="row total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(commande.total))}</span></div><div class="footer"><p>Merci de votre visite</p></div>`);
    if (!printed) setFeedback({ type: 'error', message: 'Autorisez les fenetres pop-up pour imprimer la commande.' });
  };

  const formatCommandeDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const columns = [
    {
      key: 'table',
      label: 'Table',
      render: (commande: BarCommande) => (
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-accent text-sm font-bold text-black shadow-[0_0_20px_rgba(234,179,8,0.25)]">
            {commande.table}
          </div>
          <div>
            <p className="font-semibold text-primary">{commande.client}</p>
            <p className="text-xs text-slate-500">{tables.find((tableItem) => tableItem.id === commande.table)?.numero || `Table ${commande.table}`} · {commande.nombre_personnes || 1} pers.</p>
            <p className="text-[11px] text-accent">{commande.moyen_paiement === 'TPE' ? 'TPE' : commande.moyen_paiement === 'CREDIT' ? 'Crédit' : commande.moyen_paiement === 'ORANGE_MONEY' ? 'Orange Money' : commande.moyen_paiement === 'MVOLA' ? 'MVola' : commande.moyen_paiement === 'GRATUIT' ? 'Gratuit' : 'Espèces'}</p>
          </div>
        </div>
      ),
    },
    {
      key: 'items',
      label: 'Articles',
      render: (commande: BarCommande) => (
        <div>
          {commande.items.length === 0 ? (
            <span className="text-sm text-slate-500">—</span>
          ) : (
            <>
              {commande.items.slice(0, 2).map((item, index) => (
                <p key={`${commande.id}-${index}`} className="text-sm text-slate-300">
                  {item.nom} ×{item.quantite}
                </p>
              ))}
              {commande.items.length > 2 && <p className="text-xs text-slate-500">+{commande.items.length - 2} autres</p>}
            </>
          )}
        </div>
      ),
    },
    {
      key: 'date',
      label: 'Date',
      render: (commande: BarCommande) => <span className="text-sm text-slate-300">{formatCommandeDate(commande.created_at)}</span>,
    },
    {
      key: 'montant',
      label: 'Montant',
      render: (commande: BarCommande) => <span className="font-semibold text-accent">{formatCurrency(commande.total)}</span>,
    },
    {
      key: 'statut',
      label: 'Statut',
      render: (commande: BarCommande) => {
        const status = statusClasses[commande.statut] || statusClasses['En attente'];
        return <Badge variant={status.variant as any}>{status.label}</Badge>;
      },
    },
    {
      key: 'actions',
      label: '',
      render: (commande: BarCommande) => {
        const isUpdating = updatingId === commande.id;
        return (
          <>
            {commande.statut === 'En attente' && (
              <Button 
                size="sm" 
                variant="secondary" 
                icon={<ChefHat size={14} />} 
                onClick={() => void handleStatusChange(commande.id, 'En préparation')}
                disabled={isUpdating}
              >
                {isUpdating ? '...' : 'Démarrer'}
              </Button>
            )}
            {commande.statut === 'En préparation' && (
              <Button 
                size="sm" 
                variant="secondary" 
                icon={<CheckCircle2 size={14} />} 
                onClick={() => void handleStatusChange(commande.id, 'Prête')}
                disabled={isUpdating}
              >
                {isUpdating ? '...' : 'Marquer prête'}
              </Button>
            )}
            {commande.statut === 'Prête' && (
              <Button
                size="sm"
                variant="secondary"
                icon={<CheckCircle2 size={14} />}
                onClick={() => void handleStatusChange(commande.id, 'Servie')}
                disabled={isUpdating}
              >
                {isUpdating ? '...' : 'Servir'}
              </Button>
            )}
            {canEncaisser && commande.statut === 'Servie' && (
              <Button
                size="sm"
                variant="secondary"
                icon={<DollarSign size={14} />}
                onClick={() => void handleStatusChange(commande.id, 'Encaissée')}
                disabled={isUpdating}
              >
                {isUpdating ? '...' : 'Encaisser'}
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => handlePrintCommande(commande)}>Imprimer</Button>
            <Button size="sm" variant="danger" icon={<XCircle size={14} />} onClick={() => void handleDeleteCommande(commande)} disabled={!canDeleteCommande || deletingId === commande.id} title={canDeleteCommande ? 'Supprimer la commande' : 'Suppression réservée à l’administrateur'}>
              {deletingId === commande.id ? '...' : 'Supprimer'}
            </Button>
          </>
        );
      },
    },
  ];

  const filteredCommandes = localCommandes.filter((commande) => {
    const query = commandeSearchTerm.trim().toLocaleLowerCase('fr-FR');
    if (!query) return true;

    const searchableValue = [
      commande.client,
      tables.find((tableItem) => tableItem.id === commande.table)?.numero || String(commande.table),
      formatCommandeDate(commande.created_at),
      ...commande.items.map((item) => item.nom),
    ].join(' ').toLocaleLowerCase('fr-FR');

    return searchableValue.includes(query);
  });
  
  const data = filteredCommandes;

  const totalCommandes = localCommandes.reduce((sum, commande) => sum + commande.total, 0);
  const commandesEnAttente = localCommandes.filter((commande) => commande.statut === 'En attente').length;
  const filteredCocktails = cocktails.filter((cocktail) => {
    const value = searchTerm.trim().toLowerCase();
    if (!value) return true;
    return `${cocktail.nom} ${cocktail.categorie}`.toLowerCase().includes(value);
  });
  const menuParts = (cocktail: BarProduct) => {
    const [category, subcategory] = (cocktail.categorie || 'Autres').split(/\s*(?:>|\/|\|)\s*/).map((part) => part.trim());
    return { category: category || 'Autres', subcategory: subcategory || '' };
  };
  const menuCategories = ['Toutes', ...Array.from(new Set(cocktails.map((cocktail) => menuParts(cocktail).category)))];
  const menuSubcategories = ['Toutes', ...Array.from(new Set(cocktails.filter((cocktail) => menuCategory === 'Toutes' || menuParts(cocktail).category === menuCategory).map((cocktail) => menuParts(cocktail).subcategory).filter(Boolean)))];
  const menuItems = filteredCocktails.filter((cocktail) => {
    const parts = menuParts(cocktail);
    return (menuCategory === 'Toutes' || parts.category === menuCategory) && (menuSubcategory === 'Toutes' || parts.subcategory === menuSubcategory);
  });

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-base bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-primary font-semibold">Commandes Alcool</h3>
            <p className="text-sm text-slate-500">Créez une commande avec un client et une table issue de la base</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm text-accent">
              {localCommandes.length} commande{localCommandes.length > 1 ? 's' : ''} active{localCommandes.length > 1 ? 's' : ''}
            </div>
            <Button icon={<Plus size={16} />} onClick={handleOpenModal}>
              {BAR_COMMANDES_ACTIONS.newOrderLabel}
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-base bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Commandes actives</p>
          <p className="mt-2 text-2xl font-semibold text-primary">{localCommandes.length}</p>
        </div>
        <div className="rounded-2xl border border-base bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">En attente</p>
          <p className="mt-2 text-2xl font-semibold text-amber-400">{commandesEnAttente}</p>
        </div>
        <div className="rounded-2xl border border-base bg-surface p-4">
          <p className="text-xs uppercase tracking-[0.2em] text-slate-500">CA en cours</p>
          <p className="mt-2 text-2xl font-semibold text-accent">{formatCurrency(totalCommandes)}</p>
        </div>
      </div>

      <Modal isOpen={isModalOpen} onClose={handleCloseModal} title="Nouvelle commande · Alcool" size="xl">
        <form onSubmit={handleAjouterCommande} className="space-y-3 sm:space-y-4">
          {feedback && (
            <div className={`rounded-xl p-3 text-sm flex items-center justify-between border ${feedback.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <span>{feedback.message}</span>
              <button type="button" onClick={() => setFeedback(null)} className="text-xs opacity-80 hover:opacity-100">✕</button>
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3 sm:grid-cols-3">
            <Select
              label="Table"
              value={table}
              onChange={(event) => setTable(event.target.value)}
              options={[
                { value: '', label: 'Choisir une table' },
                ...tables.map((tableItem) => ({ value: String(tableItem.id), label: tableItem.numero }))
              ]}
            />
            <Input label="Personnes" type="number" min="1" value={nombrePersonnes} onChange={(event) => setNombrePersonnes(event.target.value)} />
            <Select
              label="Paiement prévu"
              value={moyenPaiement}
              onChange={(event) => setMoyenPaiement(event.target.value as NonNullable<BarCommande['moyen_paiement']>)}
              options={[
                { value: 'ESPECES', label: 'Espèces' },
                { value: 'CARTE', label: 'Carte bancaire' },
                { value: 'TPE', label: 'TPE' },
                { value: 'CREDIT', label: 'Crédit' },
                { value: 'EURO', label: 'Euro' },
                { value: 'ORANGE_MONEY', label: 'Orange Money' },
                { value: 'MVOLA', label: 'MVola' },
                { value: 'DOLLAR', label: 'Dollar' },
                { value: 'VIREMENT', label: 'Virement' },
                { value: 'CHEQUE', label: 'Chèque' },
              ]}
            />
          </div>

          <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-3 space-y-3">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
              <p className="text-sm font-medium text-slate-300">Créer une table si besoin</p>
              <Button type="button" size="sm" variant="secondary" onClick={() => setIsCreatingTable((prev) => !prev)} className="w-full sm:w-auto">
                {isCreatingTable ? 'Fermer' : 'Nouvelle table'}
              </Button>
            </div>

            {(isCreatingTable || tables.length === 0) && (
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-[1fr_auto]">
                <Input
                  label="Nom de table"
                  value={newTableNumber}
                  onChange={(event) => setNewTableNumber(event.target.value)}
                  placeholder="Ex. Bar 12"
                />
                <div className="flex items-end">
                  <Button type="button" size="sm" className="w-full justify-center" onClick={() => void handleCreateTable()}>
                    Créer
                  </Button>
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-col sm:flex-row sm:items-end gap-2 sm:gap-3">
            <Select
              label="Client (facultatif)"
              value={client}
              onChange={(event) => setClient(event.target.value)}
              options={[
                { value: '', label: isLoadingClients ? 'Chargement des clients...' : 'Client anonyme' },
                ...clients.map((clientItem) => ({
                  value: `${clientItem.nom}${clientItem.prenom ? ` ${clientItem.prenom}` : ''}`,
                  label: `${clientItem.nom}${clientItem.prenom ? ` ${clientItem.prenom}` : ''}${clientItem.code_client ? ` (${clientItem.code_client})` : ''}`,
                })),
              ]}
              disabled={isLoadingClients}
              className="flex-1"
            />
            <Button
              type="button"
              variant="secondary"
              onClick={() => { setIsCreatingClient((current) => !current); setFeedback(null); }}
              className="w-full sm:w-auto"
            >
              <Plus size={16} />
              Nouveau client
            </Button>
          </div>

          {isCreatingClient && (
            <div className="rounded-xl border border-dashed border-slate-700/60 bg-slate-950/40 p-3 space-y-3">
              <p className="text-sm font-medium text-slate-300">Ajouter un nouveau client</p>
              <div className="grid gap-3 grid-cols-1 sm:grid-cols-2">
                <Input label="Nom" value={newClientNom} onChange={(event) => setNewClientNom(event.target.value)} placeholder="Nom" />
                <Input label="Prénom" value={newClientPrenom} onChange={(event) => setNewClientPrenom(event.target.value)} placeholder="Prénom" />
              </div>
              <Input label="Téléphone" value={newClientTelephone} onChange={(event) => setNewClientTelephone(event.target.value)} placeholder="Téléphone" />
              <Button type="button" size="sm" onClick={() => void handleCreateClient()} disabled={isSavingClient} className="w-full">
                {isSavingClient ? 'Ajout en cours...' : 'Ajouter le client'}
              </Button>
            </div>
          )}

          <div className="overflow-hidden rounded-xl border border-base bg-[#101415] shadow-inner">
            <div className="flex items-center justify-between border-b border-base px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Menu alcool</p>
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher" className="w-40 text-xs" />
            </div>
            <div className="grid min-h-[280px] grid-cols-[92px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)_210px]">
              <nav className="space-y-1 border-r border-base bg-[#171b1c] p-2">
                {menuCategories.map((category) => (
                  <button key={category} type="button" onClick={() => { setMenuCategory(category); setMenuSubcategory('Toutes'); }} className={`w-full rounded-md px-2 py-3 text-left text-[11px] font-semibold transition ${menuCategory === category ? 'bg-red-500 text-white' : 'text-secondary hover:bg-surface-3'}`}>
                    {category}
                  </button>
                ))}
              </nav>
              <div className="min-w-0 p-2 sm:p-3">
                {menuSubcategories.length > 1 && (
                  <div className="mb-2 flex gap-1 overflow-x-auto border-b border-base pb-2">
                    {menuSubcategories.map((subcategory) => <button key={subcategory} type="button" onClick={() => setMenuSubcategory(subcategory)} className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${menuSubcategory === subcategory ? 'bg-sky-500 text-white' : 'bg-surface-2 text-muted'}`}>{subcategory}</button>)}
                  </div>
                )}
                <div className="grid max-h-[330px] grid-cols-2 gap-2 overflow-y-auto xl:grid-cols-3">
                  {menuItems.map((cocktail) => {
                    const stock = stockMap[cocktail.id];
                    const unavailable = !stock || stock.quantite <= 0;
                    return <button key={cocktail.id} type="button" disabled={unavailable} onClick={() => handleOpenDosagePrompt(cocktail)} className={`flex min-h-[84px] flex-col items-center justify-center rounded-md border border-emerald-950 bg-emerald-500 px-2 py-2 text-center text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40`}><span className="text-xs font-bold leading-tight">{cocktail.nom}</span><span className="mt-1 text-[10px] font-semibold text-emerald-950">{formatCurrency(cocktail.prix)}</span></button>;
                  })}
                  {menuItems.length === 0 && <p className="col-span-full py-10 text-center text-xs text-muted">Aucun article disponible.</p>}
                </div>
              </div>
              <aside className="col-span-2 border-t border-base bg-[#171b1c] p-3 sm:col-span-1 sm:border-l sm:border-t-0">
                <p className="mb-2 text-xs font-semibold uppercase tracking-[0.15em] text-accent">Ticket</p>
                {selectedItems.length === 0 ? <p className="py-8 text-center text-xs text-muted">Sélectionnez un article</p> : <div className="space-y-2">{selectedItems.map((item, index) => <div key={`${item.nom}-${index}`} className="flex items-center justify-between gap-2 text-xs"><span className="min-w-0 truncate text-secondary">{item.nom} ×{item.quantite}</span><span className="shrink-0 text-accent">{formatCurrency(item.prix * item.quantite)}</span></div>)}</div>}
                <div className="mt-4 flex items-center justify-between border-t border-base pt-3 text-sm font-bold"><span>Total</span><span className="text-accent">{formatCurrency(selectedItems.reduce((sum, item) => sum + item.prix * item.quantite, 0))}</span></div>
              </aside>
            </div>
          </div>

          {selectedItems.length > 0 && (
            <div className="rounded-xl border border-base bg-surface-2 p-4 sm:hidden">
              <p className="mb-2 text-sm font-medium text-slate-300">Résumé</p>
              <div className="space-y-2">
                {selectedItems.map((item, index) => (
                  <div key={`${item.nom}-${index}`} className="flex items-center justify-between rounded-lg bg-surface px-3 py-2 text-sm">
                    <span className="text-primary">{item.nom}</span>
                    <div className="flex items-center gap-2">
                      <div className="flex items-center gap-1 rounded-lg border border-base bg-surface-2 px-2 py-1">
                        <button type="button" onClick={() => handleUpdateItemQuantity(index, -1)} className="text-slate-400 transition hover:text-white">
                          −
                        </button>
                        <span className="min-w-5 text-center text-primary">{item.quantite}</span>
                        <button type="button" onClick={() => handleUpdateItemQuantity(index, 1)} className="text-slate-400 transition hover:text-white">
                          +
                        </button>
                      </div>
                      <span className="text-accent">{formatCurrency(item.prix * item.quantite)}</span>
                      <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 transition hover:text-red-300">
                        <XCircle size={16} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
              <div className="mt-3 flex items-center justify-between border-t border-base pt-3">
                <span className="text-sm font-medium text-slate-300">Total</span>
                <span className="text-lg font-semibold text-accent">
                  {formatCurrency(selectedItems.reduce((sum, item) => sum + item.prix * item.quantite, 0))}
                </span>
              </div>
            </div>
          )}

          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleCloseModal} className="flex-1">
              Annuler
            </Button>
            <Button type="submit" className="flex-1" disabled={selectedItems.length === 0}>
              <Plus size={16} />
              Créer la commande
            </Button>
          </div>
        </form>
      </Modal>

      {/* Sélecteur de dosage (cl/L) avant ajout au ticket */}
      <Modal isOpen={!!dosageCocktail} onClose={handleCancelDosage} title={`Dosage — ${dosageCocktail?.nom || ''}`} size="md">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <Input
              label="Quantité"
              type="number"
              min="0"
              step="0.1"
              value={dosageAmount}
              onChange={(e) => setDosageAmount(e.target.value)}
              placeholder="Ex: 4"
            />
            <Select
              label="Unité"
              value={dosageUnit}
              onChange={(e) => setDosageUnit(e.target.value as 'cl' | 'L')}
              options={[
                { value: 'cl', label: 'cl' },
                { value: 'L', label: 'L' },
              ]}
            />
          </div>
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={handleCancelDosage} className="flex-1">
              Annuler
            </Button>
            <Button type="button" className="flex-1" onClick={handleConfirmDosage}>
              Ajouter au ticket
            </Button>
          </div>
        </div>
      </Modal>

      <div className="rounded-2xl overflow-hidden border border-base bg-surface">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between border-b border-base px-3 py-3 sm:px-6 sm:py-4 gap-3">
          <h3 className="text-primary font-semibold text-base sm:text-lg">Liste des commandes</h3>
          <Input
            value={commandeSearchTerm}
            onChange={(event) => setCommandeSearchTerm(event.target.value)}
            placeholder="Rechercher client, table..."
            className="w-full sm:max-w-xs text-xs sm:text-sm"
          />
        </div>

        {data.length === 0 ? (
          <div className="p-6 sm:p-8 text-center text-slate-500 text-sm">
            {localCommandes.length === 0
              ? `${BAR_COMMANDES_ACTIONS.emptyTitle}. ${BAR_COMMANDES_ACTIONS.emptyDescription}`
              : 'Aucune commande ne correspond à votre recherche.'}
          </div>
        ) : (
          <>
            <div className="block sm:hidden space-y-3 p-3">
              {data.map((commande) => (
                <div key={commande.id} className="rounded-lg border border-base bg-surface-2 p-3 space-y-2 text-xs">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-start gap-2 flex-1 min-w-0">
                      {columns[0].render(commande)}
                    </div>
                    <span className="flex-shrink-0">{columns[3].render(commande)}</span>
                  </div>
                  <div className="text-slate-400">{columns[1].render(commande)}</div>
                  <div className="flex items-center justify-between pt-2 border-t border-base">
                    <div className="text-slate-400">{columns[2].render(commande)}</div>
                    {columns[4].render(commande)}
                  </div>
                  <div className="flex gap-1 pt-2 border-t border-base">{columns[5].render(commande)}</div>
                </div>
              ))}
            </div>

            <div className="hidden sm:block overflow-x-auto">
              <table className="min-w-full text-left text-sm">
                <thead className="bg-surface-2 text-slate-400 text-xs">
                  <tr>
                    <th className="px-3 py-3 font-medium">Table</th>
                    <th className="px-3 py-3 font-medium">Articles</th>
                    <th className="px-3 py-3 font-medium">Date</th>
                    <th className="px-3 py-3 font-medium">Montant</th>
                    <th className="px-3 py-3 font-medium">Statut</th>
                    <th className="px-3 py-3 font-medium text-right">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {data.map((commande) => (
                    <tr key={commande.id} className="border-t border-base hover:bg-surface-2/50 transition">
                      <td className="px-3 py-3">{columns[0].render(commande)}</td>
                      <td className="px-3 py-3">{columns[1].render(commande)}</td>
                      <td className="px-3 py-3">{columns[2].render(commande)}</td>
                      <td className="px-3 py-3">{columns[3].render(commande)}</td>
                      <td className="px-3 py-3">{columns[4].render(commande)}</td>
                      <td className="px-3 py-3 text-right">
                        <div className="flex gap-1 justify-end">{columns[5].render(commande)}</div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};