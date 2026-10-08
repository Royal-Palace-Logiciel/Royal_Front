import React, { useEffect, useState } from 'react';
import { Modal, Button, Input, Select } from '../../UI';
import { formatCurrency } from '../../../utils/data';
import { Plus, Search, XCircle } from 'lucide-react';
import type { TableRestaurant, Product, Client, Category } from '../types';

const COOKING_LEVELS = ['Bleu', 'Saignant', 'Saignant Plus', 'À point', 'À point Plus', 'Bien cuit'];
type SelectedItem = { product_id: number; nom: string; quantite: number; prix: number; cuisson?: string };
interface OrderModalProps { isOpen: boolean; onClose: () => void; tables: TableRestaurant[]; products: Product[]; categories: Category[]; clients: Client[]; onSubmit: (data: any) => void | Promise<void>; onNewClient: () => void; orderToEdit?: any; initialTableId?: string; initialLocation?: string; }

export const OrderModal: React.FC<OrderModalProps> = ({ isOpen, onClose, tables, products, categories, clients, onSubmit, onNewClient, orderToEdit, initialTableId, initialLocation }) => {
  const [table, setTable] = useState('');
  const [client, setClient] = useState('');
  const [nombrePersonnes, setNombrePersonnes] = useState('1');
  const [moyenPaiement, setMoyenPaiement] = useState('ESPECES');
  const [specialPersonName, setSpecialPersonName] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuCategory, setMenuCategory] = useState('Toutes');
  const [feedback, setFeedback] = useState<string | null>(null);
  const [showCookingModal, setShowCookingModal] = useState(false);
  const [selectedProductForCooking, setSelectedProductForCooking] = useState<Product | null>(null);

  useEffect(() => {
    const items = orderToEdit?.items || [];
    setTable(String(orderToEdit?.table_id || orderToEdit?.table?.id || initialTableId || ''));
    setClient(String(orderToEdit?.client_id || orderToEdit?.client?.id || ''));
    setNombrePersonnes(String(orderToEdit?.nombre_personnes || 1));
    setMoyenPaiement(orderToEdit?.moyen_paiement || 'ESPECES');
    setSpecialPersonName(orderToEdit?.special_person_name || '');
    setNotes(orderToEdit?.notes || '');
    setSelectedItems(items.map((item: any) => { const product = products.find((candidate) => candidate.id === Number(item.product_id)); return { product_id: Number(item.product_id), nom: item.product_nom || item.product?.nom || product?.nom || `Produit #${item.product_id}`, quantite: Number(item.quantite) || 1, prix: Number(item.prix_unitaire ?? item.prix) || Number(product?.prix_vente) || 0, cuisson: item.cuisson }; }));
    setSearchTerm(''); setMenuCategory('Toutes'); setFeedback(null);
  }, [isOpen, orderToEdit, products, initialTableId, initialLocation]);

  const resetModal = () => { setTable(''); setClient(''); setNombrePersonnes('1'); setMoyenPaiement('ESPECES'); setSpecialPersonName(''); setNotes(''); setSelectedItems([]); setSearchTerm(''); setMenuCategory('Toutes'); setFeedback(null); setShowCookingModal(false); setSelectedProductForCooking(null); };
  const handleClose = () => { resetModal(); onClose(); };
  const addProductToOrder = (product: Product, cuisson?: string) => setSelectedItems((previous) => { const existing = previous.find((item) => item.product_id === product.id && item.cuisson === cuisson); if (existing) return previous.map((item) => item === existing ? { ...item, quantite: item.quantite + 1 } : item); return [...previous, { product_id: product.id, nom: product.nom, quantite: 1, prix: product.prix_vente, cuisson }]; });
  const handleAddItem = (product: Product) => { if (product.nom.toLowerCase().includes('zébu') || product.nom.toLowerCase().includes('zebu')) { setSelectedProductForCooking(product); setShowCookingModal(true); return; } addProductToOrder(product); };
  const handleUpdateItemQuantity = (index: number, delta: number) => setSelectedItems((previous) => previous.flatMap((item, itemIndex) => { if (itemIndex !== index) return [item]; const quantity = item.quantite + delta; return quantity > 0 ? [{ ...item, quantite: quantity }] : []; }));
  const handleSetItemQuantity = (index: number, value: number) => setSelectedItems((previous) => previous.map((item, itemIndex) => itemIndex === index ? { ...item, quantite: Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1 } : item));
  const total = selectedItems.reduce((sum, item) => sum + item.prix * item.quantite, 0);
  const menuItems = products.filter((product) => product.type_produit === 'PRODUIT_FINI' && product.actif && (menuCategory === 'Toutes' || categories.find((category) => category.id === product.category_id)?.nom === menuCategory) && (!searchTerm.trim() || product.nom.toLowerCase().includes(searchTerm.trim().toLowerCase())));
  const locationLabel = initialLocation?.trim().toUpperCase() === 'POCKER GRATUIT' || initialLocation?.trim().toUpperCase() === 'GRATUIT POCKER'
    ? 'Gratuit Pocker'
    : initialLocation;

  const handleSubmit = async (event: React.FormEvent) => { event.preventDefault(); if (!table || selectedItems.length === 0) { setFeedback('Sélectionnez une table et au moins un article.'); return; } if (initialLocation && !specialPersonName.trim()) { setFeedback('Saisissez le nom de la personne avant de créer la commande.'); return; } try { await onSubmit({ ...(orderToEdit ? { id: orderToEdit.id } : {}), table_id: Number(table), client_id: client ? Number(client) : 0, special_person_name: specialPersonName.trim() || undefined, location_type: initialLocation, nombre_personnes: Number(nombrePersonnes) || 1, moyen_paiement: moyenPaiement, notes, montant_total: total, items: selectedItems.map((item) => ({ product_id: item.product_id, quantite: item.quantite, prix_unitaire: item.prix, cuisson: item.cuisson })) }); handleClose(); } catch (error) { console.error('Erreur modification commande restaurant:', error); setFeedback('La commande n’a pas pu être enregistrée. Vérifiez les données puis réessayez.'); } };

  return <Modal isOpen={isOpen} onClose={handleClose} title={<span style={{ fontFamily: '"Comic Sans MS", cursive', fontSize: '20px', fontWeight: 700 }}>{orderToEdit ? 'Modifier la commande · Restaurant' : 'Nouvelle commande · Restaurant'}</span>} headerExtra={locationLabel && <span className="restaurant-location-led mr-6">{locationLabel}</span>} size="full">
    <form onSubmit={handleSubmit} className="space-y-3 sm:space-y-4">
      {feedback && <div className="rounded-xl border border-red-500/20 bg-red-500/10 p-3 text-sm text-red-400">{feedback}</div>}
      <div className="grid grid-cols-1 gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3 sm:grid-cols-2">
        <Input label="Personnes" type="number" min="1" value={nombrePersonnes} onChange={(event) => setNombrePersonnes(event.target.value)} />
        <Select label="Paiement prévu" value={moyenPaiement} onChange={(event) => setMoyenPaiement(event.target.value)} options={[{ value: 'ESPECES', label: 'Espèces' }, { value: 'CREDIT', label: 'Crédit' }, { value: 'TPE', label: 'TPE' }, { value: 'ORANGE_MONEY', label: 'Orange Money' }, { value: 'MVOLA', label: 'MVola' }, { value: 'GRATUIT', label: 'Gratuit' }]} />
      </div>
      {initialLocation && <div className="rounded-xl border border-accent/20 bg-accent/5 p-3"><Input label="Nom de la personne" value={specialPersonName} onChange={(event) => setSpecialPersonName(event.target.value)} placeholder={initialLocation === 'Chambre' ? 'Ex. Nom du client' : 'Ex. Théophile'} /></div>}
      <section className="rounded-xl border border-base bg-[#171b1c] p-3 shadow-inner">
        <div className="mb-3 flex items-center justify-between border-b border-base pb-2"><div><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Ticket</p>{orderToEdit && initialLocation && <p className="mt-1 text-lg font-semibold text-primary">{specialPersonName || 'Nom de la personne'}</p>}</div><span className="text-xs text-muted">{selectedItems.length} article{selectedItems.length > 1 ? 's' : ''}</span></div>
        {selectedItems.length === 0 ? <p className="py-4 text-center text-xs text-muted">Sélectionnez un article</p> : <div className="space-y-2">{selectedItems.map((item, index) => <div key={`${item.product_id}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base bg-surface-2 px-3 py-2 text-xs"><span className="min-w-0 flex-1 truncate text-secondary">{item.nom}{item.cuisson ? ` (${item.cuisson})` : ''}</span><div className="flex items-center gap-2"><div className="flex items-center gap-1 rounded-lg border border-base bg-surface px-2 py-1"><button type="button" onClick={() => handleUpdateItemQuantity(index, -1)} className="px-1 text-slate-400 hover:text-white">-</button><input type="number" min="1" value={item.quantite} onChange={(event) => handleSetItemQuantity(index, Number(event.target.value))} className="w-10 border-0 bg-transparent px-0 text-center text-primary outline-none" /><button type="button" onClick={() => handleUpdateItemQuantity(index, 1)} className="px-1 text-slate-400 hover:text-white">+</button></div><span className="shrink-0 text-accent">{formatCurrency(item.prix * item.quantite)}</span><button type="button" onClick={() => setSelectedItems((previous) => previous.filter((_, itemIndex) => itemIndex !== index))} className="text-red-400"><XCircle size={14} /></button></div></div>)}</div>}
        <div className="mt-3 flex items-center justify-between border-t border-base pt-3 text-sm font-bold"><span>Total</span><span className="text-accent">{formatCurrency(total)}</span></div>
      </section>
      <div className="overflow-hidden rounded-xl border border-base bg-[#101415] shadow-inner">
        <div className="flex items-center justify-between border-b border-base px-3 py-2"><p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Menu du restaurant</p><div className="relative w-40"><Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-muted" /><Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher" className="w-full pl-8 text-xs" /></div></div>
        <div className="grid h-[480px] grid-cols-[92px_minmax(0,1fr)] sm:grid-cols-[128px_minmax(0,1fr)]"><nav className="space-y-1 overflow-y-auto border-r border-base bg-[#171b1c] p-2">{['Toutes', ...categories.map((category) => category.nom)].map((category) => <button key={category} type="button" onClick={() => setMenuCategory(category)} className={`w-full rounded-md px-2 py-3 text-left text-[11px] font-semibold ${menuCategory === category ? 'bg-red-500 text-white' : 'text-secondary hover:bg-surface-3'}`}>{category}</button>)}</nav><div className="min-w-0 p-2 sm:p-3"><div className="grid h-full grid-cols-2 content-start gap-2 overflow-y-auto pr-1 xl:grid-cols-3">{menuItems.map((product) => <button key={product.id} type="button" onClick={() => handleAddItem(product)} className="flex min-h-[84px] flex-col items-center justify-center rounded-md border border-emerald-950 bg-emerald-500 px-2 py-2 text-center text-white transition hover:bg-emerald-400"><span className="text-xs font-bold leading-tight">{product.nom}</span><span className="mt-1 text-[10px] font-semibold text-emerald-950">{formatCurrency(product.prix_vente)}</span></button>)}{menuItems.length === 0 && <p className="col-span-full py-10 text-center text-xs text-muted">Aucun article disponible.</p>}</div></div></div>
      </div>
      <div><label className="mb-1 block text-xs font-semibold text-secondary">Informations complémentaires</label><textarea value={notes} onChange={(event) => setNotes(event.target.value)} placeholder="Ex: Allergie aux noix, sans sauce..." className="h-20 w-full resize-none rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs text-primary" /></div>
      <div className="flex gap-3 pt-2"><Button variant="secondary" type="button" onClick={handleClose} className="flex-1">Annuler</Button><Button type="submit" className="flex-1" disabled={selectedItems.length === 0}><Plus size={16} />{orderToEdit ? 'Modifier la commande' : 'Créer la commande'}</Button></div>
    </form>
    {showCookingModal && selectedProductForCooking && <Modal isOpen={showCookingModal} onClose={() => setShowCookingModal(false)} size="md" title="Niveau de cuisson"><div className="space-y-3"><p className="text-sm text-secondary">Sélectionnez le niveau de cuisson pour <strong>{selectedProductForCooking.nom}</strong>:</p><div className="grid grid-cols-2 gap-2">{COOKING_LEVELS.map((level) => <button key={level} type="button" onClick={() => { addProductToOrder(selectedProductForCooking, level); setShowCookingModal(false); setSelectedProductForCooking(null); }} className="rounded-lg border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-primary hover:bg-accent hover:text-black">{level}</button>)}</div><Button type="button" variant="secondary" onClick={() => setShowCookingModal(false)} className="mt-2 w-full">Annuler</Button></div></Modal>}
  </Modal>;
};
