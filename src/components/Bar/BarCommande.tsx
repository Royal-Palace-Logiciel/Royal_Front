import React, { useEffect, useState } from 'react';
import type { BarCommande, BarTable, BarProduct } from '../../types/bar.type';
import { formatCurrency } from '../../utils/data';
import { escapeHtml, printThermal, thermalHeader } from '../../utils/thermalPrint';
import api from '../../lib/api';
import barService from '../../services/bar.service';
import { BAR_COMMANDES_ACTIONS } from '../../data/Bar.data';
import { Badge, Button, Input, Modal, Select } from '../UI';
import { Plus, Printer, XCircle, ChefHat, CheckCircle2, DollarSign, AlertTriangle, Gift, Dices, Hotel, MapPin } from 'lucide-react';
import { clientService, type Client } from '../../services/client.service';
import { reservationService } from '../../services/reservation.service';
import AuthService from '../../services/authService';
import { isAdmin, isCashier, isBarman, isHostess, isManager } from '../../utils/permissions';


interface Props {
  commandes: BarCommande[];
  onCreateCommande?: (commande: { client: string; table: number; nombre_personnes: number; moyen_paiement: NonNullable<BarCommande['moyen_paiement']>; observation?: string; items: BarCommande['items']; hotel_reservation_id?: number | null; room_id?: number | null; room_guest_name?: string | null; room_account_paid?: boolean }) => Promise<void> | void;
  onUpdateCommande?: (commande: { id: number; client: string; table: number; nombre_personnes: number; moyen_paiement: NonNullable<BarCommande['moyen_paiement']>; observation?: string; items: BarCommande['items']; hotel_reservation_id?: number | null; room_id?: number | null; room_guest_name?: string | null; room_account_paid?: boolean }) => Promise<void> | void;
  onDeleteCommande?: (id: number) => Promise<void> | void;
  onUpdateStatut?: (id: number, statut: BarCommande['statut'], moyenPaiement?: NonNullable<BarCommande['moyen_paiement']>) => Promise<void> | void;
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

type OrderLocationOption = {
  kind: 'table' | 'special';
  label: string;
  tableId: number;
};

const orderLocationOptions: OrderLocationOption[] = [
  ...Array.from({ length: 16 }, (_, index) => ({
    kind: 'table' as const,
    label: `T${index + 1}`,
    tableId: index + 1,
  })),
  { kind: 'special', label: 'Gratuit', tableId: 0 },
  { kind: 'special', label: 'Pocker gratuit', tableId: 0 },
  { kind: 'special', label: 'Chambre', tableId: 0 },
];

export const BarCommandeView: React.FC<Props> = ({
  commandes,
  onCreateCommande,
  onUpdateCommande,
  onDeleteCommande,
  onUpdateStatut,
  cocktails = [],
  stockMap = {}
}) => {
  const currentUser = AuthService.getCurrentUser();
  const canEncaisser = isAdmin(currentUser) || isCashier(currentUser) || isManager(currentUser);
  const userIsHostess = isHostess(currentUser);
  const canModifyCommande = isAdmin(currentUser) || isCashier(currentUser) || isBarman(currentUser) || userIsHostess || isManager(currentUser);
  const canDeleteCommande = isAdmin(currentUser) || isManager(currentUser);
  const canDeleteTicketItem = isAdmin(currentUser) || isManager(currentUser);
  const canAdjustTicketQuantity = isAdmin(currentUser) || isManager(currentUser);
  const [localCommandes, setLocalCommandes] = useState<BarCommande[]>(commandes);

  useEffect(() => {
    setLocalCommandes(commandes);
  }, [commandes]);

  const [client, setClient] = useState('');
  const [clients, setClients] = useState<Client[]>([]);
  const [chamberReservationOptions, setChamberReservationOptions] = useState<Array<{ value: string; label: string; reservationId: number; clientId: number | null; roomLabel: string }>>([]);
  const [chamberReservationSearch, setChamberReservationSearch] = useState('');
  const [selectedChamberRoomLabel, setSelectedChamberRoomLabel] = useState<string>('');
  const [showChamberSuggestions, setShowChamberSuggestions] = useState(false);
  const [isLoadingClients, setIsLoadingClients] = useState(false);
  const [table, setTable] = useState('');
  const [nombrePersonnes, setNombrePersonnes] = useState('1');
  const [moyenPaiement, setMoyenPaiement] = useState<NonNullable<BarCommande['moyen_paiement']>>('ESPECES');
  const [tables, setTables] = useState<BarTable[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isLocationSelectionOpen, setIsLocationSelectionOpen] = useState(false);
  const [selectedLocation, setSelectedLocation] = useState<OrderLocationOption | null>(null);
  const [isPaymentModalOpen, setIsPaymentModalOpen] = useState(false);
  const [paymentOrder, setPaymentOrder] = useState<BarCommande | null>(null);
  const [paymentMethod, setPaymentMethod] = useState<NonNullable<BarCommande['moyen_paiement']>>('ESPECES');
  const [isEditingOrder, setIsEditingOrder] = useState(false);
  const [editingOrderId, setEditingOrderId] = useState<number | null>(null);
  const [selectedItems, setSelectedItems] = useState<BarCommande['items']>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [menuCategory, setMenuCategory] = useState('Toutes');
  const [menuSubcategory, setMenuSubcategory] = useState('Toutes');
  const [commandeSearchTerm, setCommandeSearchTerm] = useState('');
  const [specialPersonName, setSpecialPersonName] = useState('');
  const [pokerActivePerson, setPokerActivePerson] = useState('');
  const [pokerPeople, setPokerPeople] = useState<string[]>([]);
  const [pokerOrders, setPokerOrders] = useState<Record<string, BarCommande['items']>>({});
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);
  const [deletingId, setDeletingId] = useState<number | null>(null);
  const [pendingDeleteOrder, setPendingDeleteOrder] = useState<BarCommande | null>(null);
  const [updatingId, setUpdatingId] = useState<number | null>(null);

  const resolveReservationClientLabel = (reservation: any) => {
    const firstName = String(reservation?.client?.prenom ?? reservation?.client_prenom ?? reservation?.prenom ?? '').trim();
    const lastName = String(reservation?.client?.nom ?? reservation?.client_nom ?? reservation?.nom ?? '').trim();

    if (firstName || lastName) {
      return [firstName, lastName].filter(Boolean).join(' ');
    }

    const reservationId = Number(reservation?.id ?? reservation?.client_id ?? 0);
    if (reservationId > 0) {
      return `Client #${reservationId}`;
    }

    return 'Client chambre';
  };

  const loadTables = async () => {
    try {
      const data = await barService.getBarTables();
      const tablesList = Array.isArray(data) ? data : (data as { data?: BarTable[] }).data ?? [];
      setTables(tablesList);
    } catch (error) {
      console.error('Erreur chargement tables bar:', error);
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
    setSpecialPersonName('');
    setPokerActivePerson('');
    setPokerPeople([]);
    setPokerOrders({});
    setFeedback(null);
    setIsEditingOrder(false);
    setEditingOrderId(null);
    setSelectedLocation(null);
    setChamberReservationSearch('');
    setSelectedChamberRoomLabel('');
    setShowChamberSuggestions(false);
    setChamberReservationOptions([]);
    setIsLocationSelectionOpen(false);
    setIsModalOpen(false);
  };

  const loadChamberReservationOptions = async () => {
    try {
      const [reservations, reservationGuestsResponse] = await Promise.all([
        reservationService.getReservations(),
        api.get('/api/hebergement/reservation-guests'),
      ]);

      const guestsPayload = reservationGuestsResponse?.data?.data ?? reservationGuestsResponse?.data ?? [];
      const guestsByReservation = new Map<number, string[]>();

      for (const guest of Array.isArray(guestsPayload) ? guestsPayload : []) {
        const reservationId = Number(guest?.reservation_id ?? 0);
        if (!reservationId) continue;
        const fullName = [guest?.prenom, guest?.nom].filter(Boolean).join(' ').trim();
        if (!fullName) continue;
        const existing = guestsByReservation.get(reservationId) ?? [];
        if (!existing.includes(fullName)) existing.push(fullName);
        guestsByReservation.set(reservationId, existing);
      }

      const activeStatuses = ['CONFIRMEE', 'CHECKED_IN', 'EN_COURS'];
      const options = reservations
        .filter((reservation) => reservation && reservation.statut && activeStatuses.includes(reservation.statut))
        .flatMap((reservation) => {
          const roomLabel = reservation.room?.numero ? `Chambre ${reservation.room.numero}` : (reservation.room_id ? `Chambre ${reservation.room_id}` : 'Chambre');
          const primaryClientName = resolveReservationClientLabel(reservation);
          const names = new Set<string>();
          if (primaryClientName && primaryClientName !== 'Client chambre') names.add(primaryClientName);
          for (const guestName of guestsByReservation.get(reservation.id) ?? []) names.add(guestName);

          if (!names.size) {
            const fallbackName = `Client #${reservation.client_id ?? reservation.id}`;
            names.add(fallbackName);
          }

          return Array.from(names).map((name) => ({
            value: name,
            label: `${name} — ${roomLabel}`,
            reservationId: reservation.id,
            clientId: reservation.client_id ?? null,
            roomLabel,
          }));
        })
        .filter((option, index, array) => array.findIndex((item) => item.value === option.value && item.reservationId === option.reservationId) === index)
        .sort((first, second) => first.label.localeCompare(second.label, 'fr'));

      setChamberReservationOptions(options);
    } catch (error) {
      console.error('Erreur chargement réservations hôtel pour chambre:', error);
      setChamberReservationOptions([]);
      setFeedback({ type: 'error', message: 'La liste des clients de réservation n’a pas pu être chargée.' });
    }
  };

  const handleOpenModal = () => {
    setClient('');
    setTable('');
    setNombrePersonnes('1');
    setMoyenPaiement('ESPECES');
    setSelectedItems([]);
    setSearchTerm('');
    setSpecialPersonName('');
    setPokerActivePerson('');
    setPokerPeople([]);
    setPokerOrders({});
    setFeedback(null);
    setIsEditingOrder(false);
    setEditingOrderId(null);
    setChamberReservationSearch('');
    setSelectedChamberRoomLabel('');
    setChamberReservationOptions([]);
    setIsModalOpen(false);
    setIsLocationSelectionOpen(true);
    void loadClients();
  };

  const handleSelectLocation = (location: OrderLocationOption) => {
    setSelectedLocation(location);
    setTable(String(location.tableId));
    setIsLocationSelectionOpen(false);
    setIsModalOpen(true);
    if (location.label === 'Chambre') {
      void loadChamberReservationOptions();
      setMoyenPaiement('CREDIT');
    } else if (location.label === 'Gratuit' || location.label === 'Pocker gratuit') {
      setMoyenPaiement('GRATUIT');
      setChamberReservationOptions([]);
      setChamberReservationSearch('');
    } else {
      setMoyenPaiement('ESPECES');
      setChamberReservationOptions([]);
      setChamberReservationSearch('');
    }
  };

  const handleOpenEditModal = (commande: BarCommande) => {
    const specialMode = commande.observation?.trim().toUpperCase();
    const isPoker = specialMode === 'POCKER' || specialMode === 'POKER' || specialMode === 'POCKER GRATUIT' || specialMode === 'POKER GRATUIT';
    const isChambre = specialMode === 'CHAMBRE' || Boolean(commande.hotel_reservation_id) || Boolean(commande.room_id) || (commande.table === 0 && commande.moyen_paiement === 'CREDIT');
    const isGratuit = specialMode === 'GRATUIT' || (commande.table === 0 && commande.moyen_paiement === 'GRATUIT');

    const location: OrderLocationOption = isPoker
      ? { kind: 'special' as const, label: 'Pocker gratuit', tableId: 0 }
      : isChambre
        ? { kind: 'special' as const, label: 'Chambre', tableId: 0 }
        : isGratuit
          ? { kind: 'special' as const, label: 'Gratuit', tableId: 0 }
          : { kind: 'table' as const, label: `T${commande.table}`, tableId: commande.table };
    const chamberGuest = location.label === 'Chambre' ? String(commande.client || '') : '';
    const chamberParts = chamberGuest ? chamberGuest.split(/\s*—\s*/) : ['', ''];
    const chamberName = chamberParts[0]?.trim() || chamberGuest;
    const chamberRoom = chamberParts[1]?.trim() || extractChamberRoomLabel(chamberGuest) || '';
    setClient(commande.client);
    setTable(String(commande.table));
    setNombrePersonnes(String(commande.nombre_personnes || 1));
    setMoyenPaiement(commande.moyen_paiement || (isGratuit || isPoker ? 'GRATUIT' : isChambre ? 'CREDIT' : 'ESPECES'));
    setSelectedItems(commande.items.map((item) => ({ ...item })));
    setSearchTerm('');
    setSelectedLocation(location);
    setSpecialPersonName(location.kind === 'special' ? chamberName : '');
    setSelectedChamberRoomLabel(location.label === 'Chambre' ? chamberRoom : '');
    setChamberReservationSearch(location.label === 'Chambre' ? chamberName : '');
    setPokerActivePerson(location.label === 'Pocker gratuit' ? commande.client : '');
    setPokerPeople(location.label === 'Pocker gratuit' ? [commande.client] : []);
    setPokerOrders(location.label === 'Pocker gratuit' ? { [commande.client]: commande.items.map((item) => ({ ...item })) } : {});
    setFeedback(null);
    setIsEditingOrder(true);
    setEditingOrderId(commande.id);
    setIsLocationSelectionOpen(false);
    setIsModalOpen(true);
    void loadClients();
  };

  const handleCloseModal = () => {
    resetModal();
  };

  const handleCancelLocationSelection = () => {
    setIsLocationSelectionOpen(false);
    if (selectedLocation || isEditingOrder || selectedItems.length > 0) {
      setIsModalOpen(true);
    } else {
      resetModal();
    }
  };

  const handleAddItem = (cocktail: BarProduct) => {
    setSelectedItems((prev) => {
      const existing = prev.find((item) => item.nom === cocktail.nom);
      if (existing) {
        return prev.map((item) =>
          item.nom === cocktail.nom ? { ...item, quantite: item.quantite + 1, prix: cocktail.prix } : item
        );
      }
      return [...prev, { product_id: cocktail.id, nom: cocktail.nom, quantite: 1, prix: cocktail.prix }];
    });
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

  const handleSetItemQuantity = (index: number, value: number) => {
    setSelectedItems((prev) =>
      prev.flatMap((item, itemIndex) => {
        if (itemIndex !== index) return [item];
        const nextQuantity = Number.isFinite(value) ? Math.max(1, Math.floor(value)) : 1;
        return [{ ...item, quantite: nextQuantity }];
      })
    );
  };

  const handleRemoveItem = (index: number) => {
    setSelectedItems((prev) => prev.filter((_, itemIndex) => itemIndex !== index));
  };

  const isPokerLocation = selectedLocation?.label === 'Pocker gratuit' || selectedLocation?.label?.toUpperCase().includes('POKER') || selectedLocation?.label?.toUpperCase().includes('POCKER');
  const isNamedLocation = selectedLocation?.kind === 'special';
  const isGratuitLocation = selectedLocation?.label === 'Gratuit' || (selectedLocation?.kind === 'special' && selectedLocation?.label?.toUpperCase().includes('GRATUIT') && !isPokerLocation);
  const isChambreLocation = selectedLocation?.label === 'Chambre' || (selectedLocation?.kind === 'special' && selectedLocation?.label?.toUpperCase().includes('CHAMBRE'));

  const getSelectedLocationInfo = () => {
    const rawLabel = selectedLocation?.label?.trim() || '';
    const upperLabel = rawLabel.toUpperCase();

    const isChambre = isChambreLocation || upperLabel === 'CHAMBRE' || (selectedLocation?.kind === 'special' && upperLabel.includes('CHAMBRE'));
    const isPoker = isPokerLocation || upperLabel === 'POCKER GRATUIT' || upperLabel === 'POKER GRATUIT' || upperLabel === 'POKER' || upperLabel === 'POCKER';
    const isGratuit = isGratuitLocation || upperLabel === 'GRATUIT' || (selectedLocation?.kind === 'special' && upperLabel.includes('GRATUIT') && !isPoker);

    if (isGratuit) {
      return {
        type: 'GRATUIT' as const,
        badgeLabel: 'GRATUIT',
        title: 'GRATUIT',
        subtitle: 'Consommation offerte · Mode Gratuit au Bar (aucun encaissement)',
        badgeBg: 'bg-emerald-500 text-black shadow-[0_0_15px_rgba(16,185,129,0.35)]',
        badgeBorder: 'border-emerald-400',
        cardBorder: 'border-emerald-500/40 bg-emerald-500/10',
        textColor: 'text-emerald-400',
        icon: Gift,
      };
    }

    if (isPoker) {
      return {
        type: 'POKER' as const,
        badgeLabel: 'POKER GRATUIT',
        title: 'POKER GRATUIT',
        subtitle: 'Table Poker · Boissons et consommations offertes aux joueurs',
        badgeBg: 'bg-purple-500 text-white shadow-[0_0_15px_rgba(168,85,247,0.35)]',
        badgeBorder: 'border-purple-400',
        cardBorder: 'border-purple-500/40 bg-purple-500/10',
        textColor: 'text-purple-300',
        icon: Dices,
      };
    }

    if (isChambre) {
      const roomSuffix = selectedChamberRoomLabel ? ` — ${selectedChamberRoomLabel}` : '';
      return {
        type: 'CHAMBRE' as const,
        badgeLabel: selectedChamberRoomLabel ? selectedChamberRoomLabel.toUpperCase() : 'CHAMBRE',
        title: `CHAMBRE${roomSuffix}`,
        subtitle: selectedChamberRoomLabel
          ? `Facturation portée au compte de la ${selectedChamberRoomLabel}`
          : 'Commande rattachée à un client hôtel · Ajout sur note de chambre',
        badgeBg: 'bg-sky-500 text-black shadow-[0_0_15px_rgba(14,165,233,0.35)]',
        badgeBorder: 'border-sky-400',
        cardBorder: 'border-sky-500/40 bg-sky-500/10',
        textColor: 'text-sky-300',
        icon: Hotel,
      };
    }

    const tableNumero = selectedLocation?.kind === 'table' ? selectedLocation.label : (table ? `T${table}` : 'T?');
    return {
      type: 'TABLE' as const,
      badgeLabel: tableNumero,
      title: `Emplacement : Table ${tableNumero}`,
      subtitle: 'Commande standard bar servie en salle',
      badgeBg: 'bg-accent text-black shadow-[0_0_15px_rgba(234,179,8,0.3)]',
      badgeBorder: 'border-accent/40',
      cardBorder: 'border-accent/30 bg-accent/5',
      textColor: 'text-accent',
      icon: MapPin,
    };
  };

  const isChambreOrder = (commande: BarCommande) => commande.observation?.trim().toUpperCase() === 'CHAMBRE';
  const filteredChamberReservationOptions = chamberReservationOptions.filter((option) => {
    const searchValue = chamberReservationSearch.trim().toLowerCase();
    if (!searchValue) return true;
    return option.label.toLowerCase().includes(searchValue);
  });

  const visibleChamberSuggestions = showChamberSuggestions ? filteredChamberReservationOptions.slice(0, 6) : [];

  const handleChamberPersonSelect = (name: string) => {
    setSpecialPersonName(name);
    setChamberReservationSearch(name);
    const selectedOption = chamberReservationOptions.find((option) => option.value === name && option.label.startsWith(`${name} — `));
    setSelectedChamberRoomLabel(selectedOption?.roomLabel || '');
    setShowChamberSuggestions(false);
  };

  const handleSelectPokerPerson = (name: string) => {
    const currentName = pokerActivePerson.trim();
    if (currentName && currentName !== name) {
      setPokerOrders((prev) => ({ ...prev, [currentName]: selectedItems }));
    }
    setSpecialPersonName(name);
    setPokerActivePerson(name);
    setSelectedItems(pokerOrders[name] || []);
    setFeedback(null);
  };

  const handleAddPokerPerson = () => {
    const name = specialPersonName.trim();
    if (!name) {
      setFeedback({ type: 'error', message: 'Saisissez le nom de la personne.' });
      return;
    }

    const currentName = pokerActivePerson.trim();
    setPokerOrders((prev) => ({
      ...prev,
      ...(currentName && currentName !== name ? { [currentName]: selectedItems } : {}),
      [name]: prev[name] || [],
    }));
    setPokerPeople((prev) => (prev.includes(name) ? prev : [...prev, name]));
    setSpecialPersonName(name);
    setPokerActivePerson(name);
    setSelectedItems(pokerOrders[name] || []);
    setFeedback(null);
  };

  const handleAjouterCommande = async (event: React.FormEvent) => {
    event.preventDefault();
    const rawPersonName = isNamedLocation ? specialPersonName.trim() : client.trim() || 'Client anonyme';
    const clientNom = selectedLocation?.label === 'Chambre' && rawPersonName
      ? (selectedChamberRoomLabel ? `${rawPersonName} — ${selectedChamberRoomLabel}` : rawPersonName)
      : rawPersonName;
    const linkedReservation = selectedLocation?.label === 'Chambre'
      ? chamberReservationOptions.find((option) => option.value === rawPersonName || option.label.startsWith(`${rawPersonName} — `)) ?? null
      : null;
    const tableNumber = Number(table);
    const guestCount = Number(nombrePersonnes);
    const effectivePaymentMethod = selectedLocation?.label === 'Chambre' ? 'CREDIT' : moyenPaiement;

    const invalidTable = !table || Number.isNaN(tableNumber) || (selectedLocation?.kind !== 'special' && tableNumber <= 0);
    if (invalidTable || !Number.isInteger(guestCount) || guestCount < 1 || selectedItems.length === 0 || (isNamedLocation && !clientNom)) {
      if (isNamedLocation && !clientNom) {
        setFeedback({ type: 'error', message: 'Saisissez le nom de la personne avant de créer la commande.' });
      }
      return;
    }

    const stockIssue = selectedItems.map((item) => {
      const productId = Number(item.product_id ?? 0);
      const stock = productId > 0 ? stockMap[productId] : undefined;
      const available = stock ? Number(stock.quantite) : 0;
      if (!productId || !stock) {
        return `${item.nom} n'a pas de stock configuré. Ajoutez ce produit au stock du bar.`;
      }
      if (!Number.isFinite(available) || Number(item.quantite) > available) {
        return `Stock insuffisant pour ${item.nom}. Disponible : ${Number.isFinite(available) ? available : 0}.`;
      }
      return null;
    }).find(Boolean);
    if (stockIssue) {
      setFeedback({ type: 'error', message: stockIssue });
      return;
    }

    try {
      if (isEditingOrder && editingOrderId !== null) {
        await onUpdateCommande?.({
          id: editingOrderId,
          client: clientNom,
          table: tableNumber,
          nombre_personnes: guestCount,
          moyen_paiement: effectivePaymentMethod,
          items: selectedItems,
          observation: selectedLocation?.kind === 'special' ? selectedLocation.label === 'Pocker gratuit' ? 'POCKER' : selectedLocation.label.toUpperCase() : undefined,
          hotel_reservation_id: linkedReservation?.reservationId ?? null,
          room_id: linkedReservation ? Number(linkedReservation.roomLabel.replace(/\D/g, '')) || null : null,
          room_guest_name: selectedLocation?.label === 'Chambre' ? rawPersonName : null,
          room_account_paid: false,
        });
      } else {
        await onCreateCommande?.({
          client: clientNom,
          table: tableNumber,
          nombre_personnes: guestCount,
          moyen_paiement: effectivePaymentMethod,
          items: selectedItems,
          observation: selectedLocation?.kind === 'special' ? selectedLocation.label === 'Pocker gratuit' ? 'POCKER' : selectedLocation.label.toUpperCase() : undefined,
          hotel_reservation_id: linkedReservation?.reservationId ?? null,
          room_id: linkedReservation ? Number(linkedReservation.roomLabel.replace(/\D/g, '')) || null : null,
          room_guest_name: selectedLocation?.label === 'Chambre' ? rawPersonName : null,
          room_account_paid: false,
        });
      }
      resetModal();
    } catch (error) {
      console.error('Erreur commande bar:', error);
      const apiError = error as { response?: { data?: { error?: { message?: string } } }; message?: string };
      const fallbackMessage = isEditingOrder
        ? "La commande n'a pas pu être modifiée. Vérifiez les données puis réessayez."
        : "La commande n'a pas pu être créée. Vérifiez les données puis réessayez.";
      setFeedback({ type: 'error', message: apiError.response?.data?.error?.message || apiError.message || fallbackMessage });
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

  const handleDeleteCommande = async (commande: BarCommande) => {
    try {
      setDeletingId(commande.id);
      setPendingDeleteOrder(null);
      await onDeleteCommande?.(commande.id);
      setFeedback({ type: 'success', message: 'Commande supprimée avec succès.' });
    } catch (error) {
      console.error('Erreur suppression commande bar:', error);
      setFeedback({ type: 'error', message: "La commande n'a pas pu être supprimée." });
    } finally {
      setDeletingId(null);
    }
  };

  const handleRequestDeleteCommande = (commande: BarCommande) => {
    setPendingDeleteOrder(commande);
  };

  const handleStatusChange = async (commandeId: number, nouveauStatut: BarCommande['statut']) => {
    try {
      setUpdatingId(commandeId);

      if (onUpdateStatut) {
        await onUpdateStatut(commandeId, nouveauStatut);
      } else {
        const statuses: Record<BarCommande['statut'], 'EN_ATTENTE' | 'EN_PREPARATION' | 'PRETE' | 'SERVIE' | 'ENCAISSEE'> = {
          'En attente': 'EN_ATTENTE',
          'En préparation': 'EN_PREPARATION',
          'Prête': 'PRETE',
          'Servie': 'SERVIE',
          'Encaissée': 'ENCAISSEE',
        };
        await barService.updateBarOrderStatus(commandeId, statuses[nouveauStatut]);
      }

      setLocalCommandes((prev) =>
        prev.map((cmd) => (cmd.id === commandeId ? { ...cmd, statut: nouveauStatut } : cmd))
      );

      setFeedback({ type: 'success', message: 'Statut de la commande mis à jour avec succès.' });
    } catch (error: any) {
      console.error('Erreur mise à jour statut commande bar:', error);
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "Le statut n'a pas pu être mis à jour.";
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setUpdatingId(null);
    }
  };

  const handleOpenPaymentModal = (commande: BarCommande) => {
    if (isChambreOrder(commande)) return;
    setPaymentOrder(commande);
    setPaymentMethod(commande.moyen_paiement || 'ESPECES');
    setIsPaymentModalOpen(true);
  };

  const handleConfirmPayment = async () => {
    if (!paymentOrder || isChambreOrder(paymentOrder)) return;

    setIsPaymentModalOpen(false);
    try {
      setUpdatingId(paymentOrder.id);
      if (onUpdateStatut) {
        await onUpdateStatut(paymentOrder.id, 'Encaissée', paymentMethod);
      } else {
        await barService.updateBarOrderStatus(paymentOrder.id, 'ENCAISSEE', paymentMethod);
      }
      setLocalCommandes((prev) => prev.map((cmd) => cmd.id === paymentOrder.id ? { ...cmd, statut: 'Encaissée', moyen_paiement: paymentMethod } : cmd));
      setFeedback({ type: 'success', message: 'Commande encaissée avec succès.' });
    } catch (error: any) {
      console.error('Erreur encaissement commande bar:', error);
      const errorMsg = error?.response?.data?.message || error?.response?.data?.error || error?.message || "La commande n'a pas pu être encaissée.";
      setFeedback({ type: 'error', message: errorMsg });
    } finally {
      setUpdatingId(null);
      setPaymentOrder(null);
    }
  };

  const handlePrintCommande = (commande: BarCommande) => {
    const tableName = tables.find((tableItem) => tableItem.id === commande.table)?.numero || `Table ${commande.table}`;
    const items = commande.items.map((item) => `
      <div class="line"><div class="row"><span>${item.quantite} x ${escapeHtml(item.nom)}</span><span>${escapeHtml(formatCurrency(item.prix * item.quantite))}</span></div><div class="sub">PU ${escapeHtml(formatCurrency(item.prix))}</div></div>`).join('');

    const printed = printThermal(`Commande #${commande.id}`, `${thermalHeader(`Commande Bar #${commande.id}`)}<p><strong>Client :</strong> ${escapeHtml(commande.client)}</p><p><strong>Table :</strong> ${escapeHtml(tableName)}</p><div class="sep"></div>${items}<div class="row total"><span>TOTAL</span><span>${escapeHtml(formatCurrency(commande.total))}</span></div><div class="footer"><p>Merci de votre visite</p></div>`);
    if (!printed) setFeedback({ type: 'error', message: 'Autorisez les fenetres pop-up pour imprimer la commande.' });
  };

  const formatCommandeDate = (value?: string) => {
    if (!value) return '—';
    const date = new Date(value);
    return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString('fr-FR', {
      day: '2-digit', month: '2-digit', year: 'numeric', hour: '2-digit', minute: '2-digit',
    });
  };

  const getOrderSpecialType = (commande: BarCommande) => {
    const specialLabels: Record<string, string> = {
      POCKER: 'Pocker',
      'POCKER GRATUIT': 'Pocker',
      GRATUIT: 'Gratuit',
      CHAMBRE: 'Chambre',
    };
    const specialLabel = specialLabels[commande.observation?.trim().toUpperCase() || ''];
    return specialLabel || (commande.table === 0 && commande.moyen_paiement === 'GRATUIT' ? 'Gratuit' : undefined);
  };

  const extractChamberRoomLabel = (value: string) => {
    const match = value.match(/\s*—\s*(Chambre\s*[^—]+)$/i);
    return match ? match[1].trim() : '';
  };

  const getOrderLocationLabel = (commande: BarCommande) => {
    if (getOrderSpecialType(commande) === 'Chambre') {
      const roomLabel = extractChamberRoomLabel(String(commande.client || ''));
      return roomLabel || 'Chambre';
    }
    if (getOrderSpecialType(commande)) return getOrderSpecialType(commande);
    if (commande.table === 0) return 'Gratuit';
    return tables.find((tableItem) => tableItem.id === commande.table)?.numero || `Table ${commande.table}`;
  };

  const columns = [
    {
      key: 'table',
      label: 'Table',
      render: (commande: BarCommande) => {
        const specialType = getOrderSpecialType(commande);
        const locationLabel = getOrderLocationLabel(commande);
        return (
          <div className="flex items-center gap-3">
            <div className={`flex min-h-10 items-center justify-center rounded-xl px-2 text-center text-xs font-bold shadow-[0_0_20px_rgba(234,179,8,0.25)] ${specialType ? 'min-w-[88px] bg-accent text-black' : 'min-w-10 bg-accent text-black'}`}>
              <span className="leading-tight">{locationLabel}</span>
            </div>
            <div>
              <p className="font-semibold text-primary">{commande.client}</p>
              <p className="text-xs text-slate-500">{commande.nombre_personnes || 1} pers.</p>
              <p className="text-[11px] text-accent">{commande.moyen_paiement === 'TPE' ? 'TPE' : commande.moyen_paiement === 'CREDIT' ? 'Crédit' : commande.moyen_paiement === 'ORANGE_MONEY' ? 'Orange Money' : commande.moyen_paiement === 'MVOLA' ? 'MVola' : commande.moyen_paiement === 'GRATUIT' ? 'Gratuit' : 'Espèces'}</p>
            </div>
          </div>
        );
      },
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
            {canModifyCommande && (
              <Button
                size="sm"
                variant="secondary"
                icon={<Plus size={14} />}
                onClick={() => handleOpenEditModal(commande)}
                disabled={isUpdating}
              >
                Modifier
              </Button>
            )}
            {canEncaisser && commande.statut === 'Servie' && !isChambreOrder(commande) && (
              <Button
                size="sm"
                variant="primary"
                icon={<DollarSign size={14} />}
                onClick={() => handleOpenPaymentModal(commande)}
                disabled={isUpdating}
              >
                {isUpdating ? '...' : 'Encaisser'}
              </Button>
            )}
            <Button size="sm" variant="secondary" icon={<Printer size={14} />} onClick={() => handlePrintCommande(commande)}>Imprimer</Button>
            {canDeleteCommande && (
              <Button size="sm" variant="danger" icon={<XCircle size={14} />} onClick={() => handleRequestDeleteCommande(commande)} disabled={deletingId === commande.id} title="Supprimer la commande">
                {deletingId === commande.id ? '...' : 'Supprimer'}
              </Button>
            )}
          </>
        );
      },
    },
  ];

  const activeCommandes = localCommandes.filter((commande) => commande.statut !== 'Encaissée');
  const filteredCommandes = activeCommandes.filter((commande) => {
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

  const totalCommandes = activeCommandes.reduce((sum, commande) => sum + commande.total, 0);
  const commandesEnAttente = activeCommandes.filter((commande) => commande.statut === 'En attente').length;
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

  const selectedLocationInfo = getSelectedLocationInfo();

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-base bg-surface p-4 shadow-sm">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h3 className="text-primary font-semibold">Commandes Bar</h3>
            <p className="text-sm text-slate-500">Créez une commande avec un client et une table issue de la base</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="rounded-full border border-accent/20 bg-accent/10 px-3 py-1 text-sm text-accent">
              {activeCommandes.length} commande{activeCommandes.length > 1 ? 's' : ''} active{activeCommandes.length > 1 ? 's' : ''}
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
          <p className="mt-2 text-2xl font-semibold text-primary">{activeCommandes.length}</p>
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

      <Modal isOpen={isLocationSelectionOpen} onClose={handleCancelLocationSelection} title="Choisir l'emplacement de la commande" size="sm">
        <div className="space-y-4">
          <p className="text-sm text-secondary">Sélectionnez une table ou un type de réservation.</p>
          <div className="grid grid-cols-4 gap-2">
            {orderLocationOptions.map((location) => (
              <button
                key={location.kind === 'table' ? location.tableId : location.label}
                type="button"
                onClick={() => handleSelectLocation(location)}
                className={`flex min-h-16 items-center justify-center rounded-lg border px-2 py-2 text-center text-xs font-semibold transition hover:border-accent hover:bg-accent/10 ${location.kind === 'table' ? 'border-base bg-surface-2 text-primary' : 'border-amber-500/40 bg-amber-500/10 text-amber-300'}`}
              >
                {location.label}
              </button>
            ))}
          </div>
          <Button variant="danger" size="sm" type="button" onClick={handleCancelLocationSelection} className="w-auto self-end rounded-md px-3 py-1.5">
            Annuler
          </Button>
        </div>
      </Modal>

      <Modal
        isOpen={isModalOpen}
        onClose={handleCloseModal}
        title={`${isEditingOrder ? 'Modifier la commande · Bar' : 'Nouvelle commande · Bar'} — ${selectedLocationInfo.badgeLabel}`}
        size="full"
      >
        <form onSubmit={handleAjouterCommande} className="space-y-3 sm:space-y-4">

          {/* Libellé explicite et immédiatement visible en haut du modal selon la table / emplacement sélectionné */}
          <div className={`flex flex-wrap items-center justify-between gap-3 rounded-2xl border p-3.5 sm:p-4 shadow-sm transition-all ${selectedLocationInfo.cardBorder}`}>
            <div className="flex items-center gap-3 sm:gap-4">
              <div className={`flex min-h-12 min-w-[95px] sm:min-w-[120px] items-center justify-center gap-2 rounded-xl border px-3 py-1.5 text-center text-xs sm:text-sm font-black tracking-wider uppercase ${selectedLocationInfo.badgeBg} ${selectedLocationInfo.badgeBorder}`}>
                <selectedLocationInfo.icon size={16} />
                <span className="leading-tight">{selectedLocationInfo.badgeLabel}</span>
              </div>
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-semibold uppercase tracking-wider text-slate-400">Emplacement sélectionné :</span>
                  <span className={`text-sm sm:text-base font-extrabold ${selectedLocationInfo.textColor}`}>
                    {selectedLocationInfo.title}
                  </span>
                </div>
                <p className="mt-0.5 text-xs text-slate-300/80">{selectedLocationInfo.subtitle}</p>
              </div>
            </div>

            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => {
                setIsModalOpen(false);
                setIsLocationSelectionOpen(true);
              }}
              className="text-xs"
            >
              Changer d'emplacement
            </Button>
          </div>

          {feedback && (
            <div className={`rounded-xl p-3 text-sm flex items-center justify-between border ${feedback.type === 'error' ? 'bg-red-500/10 border-red-500/20 text-red-400' : 'bg-emerald-500/10 border-emerald-500/20 text-emerald-400'}`}>
              <span>{feedback.message}</span>
              <button type="button" onClick={() => setFeedback(null)} className="text-xs opacity-80 hover:opacity-100">✕</button>
            </div>
          )}

          {isNamedLocation && (
            <div className="rounded-xl border border-accent/20 bg-accent/5 p-3">
              {selectedLocation?.label === 'Chambre' ? (
                <div className="relative grid gap-2">
                  <Input
                    label="Nom de la personne (Client hôtel)"
                    value={chamberReservationSearch}
                    onChange={(event) => {
                      const nextValue = event.target.value;
                      setChamberReservationSearch(nextValue);
                      setSpecialPersonName(nextValue);
                      setSelectedChamberRoomLabel('');
                      setShowChamberSuggestions(true);
                    }}
                    onFocus={() => setShowChamberSuggestions(true)}
                    placeholder="Nom, prénom ou chambre"
                  />
                  {selectedChamberRoomLabel && (
                    <div className="flex items-center justify-between rounded-lg border border-sky-500/30 bg-sky-500/10 px-3 py-1.5 text-xs text-sky-300">
                      <span>Chambre liée : <strong className="font-bold text-white">{selectedChamberRoomLabel}</strong></span>
                      <button
                        type="button"
                        onClick={() => setSelectedChamberRoomLabel('')}
                        className="text-xs text-slate-400 hover:text-white"
                        title="Détacher la chambre"
                      >
                        ✕
                      </button>
                    </div>
                  )}
                  {visibleChamberSuggestions.length > 0 && (
                    <div className="absolute left-0 right-0 top-[calc(100%+4px)] z-10 max-h-52 overflow-y-auto rounded-xl border border-base bg-[#111827] shadow-2xl">
                      {visibleChamberSuggestions.map((option) => (
                        <button
                          key={`${option.reservationId}-${option.value}`}
                          type="button"
                          onClick={() => handleChamberPersonSelect(option.value)}
                          className="flex w-full items-center justify-between px-3 py-2 text-left text-sm text-slate-200 transition hover:bg-slate-800"
                        >
                          <span>{option.value}</span>
                          <span className="text-xs text-slate-400">{option.label.split(' — ')[1] || ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              ) : isPokerLocation ? (
                <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-end">
                  <Input
                    label="Nom de la personne (Joueur Poker)"
                    value={specialPersonName}
                    onChange={(event) => setSpecialPersonName(event.target.value)}
                    placeholder="Ex. Théophile"
                  />
                  <Button type="button" onClick={handleAddPokerPerson} className="w-full sm:w-auto">
                    Ajouter
                  </Button>
                  {pokerPeople.length > 0 && (
                    <Select
                      label="Personne active"
                      value={specialPersonName}
                      onChange={(event) => handleSelectPokerPerson(event.target.value)}
                      options={pokerPeople.map((name) => ({ value: name, label: name }))}
                      className="sm:col-span-2"
                    />
                  )}
                </div>
              ) : (
                <Input
                  label="Nom du bénéficiaire (Consommation offerte)"
                  value={specialPersonName}
                  onChange={(event) => setSpecialPersonName(event.target.value)}
                  placeholder="Ex. Théophile / Nom de l'invité"
                />
              )}
            </div>
          )}

          <div className="grid grid-cols-1 gap-2 rounded-xl border border-accent/20 bg-accent/5 p-3 sm:grid-cols-2">
            <Input label="Personnes" type="number" min="1" value={nombrePersonnes} onChange={(event) => setNombrePersonnes(event.target.value)} />
            <Select
              label="Paiement prévu"
              value={moyenPaiement}
              onChange={(event) => setMoyenPaiement(event.target.value as NonNullable<BarCommande['moyen_paiement']>)}
              options={[
                { value: 'ESPECES', label: 'Espèces' },
                { value: 'CREDIT', label: 'Crédit' },
                { value: 'TPE', label: 'TPE' },
                { value: 'ORANGE_MONEY', label: 'Orange Money' },
                { value: 'MVOLA', label: 'MVola' },
                { value: 'GRATUIT', label: 'Gratuit' },
              ]}
            />
          </div>

          <section className="rounded-xl border border-base bg-[#171b1c] p-3 shadow-inner">
            <div className="mb-3 flex items-center justify-between border-b border-base pb-2">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Ticket</p>
                {isEditingOrder && <p className="mt-1 text-lg font-semibold text-primary">{client || specialPersonName || 'Client anonyme'}</p>}
              </div>
              <span className="text-xs text-muted">{selectedItems.length} article{selectedItems.length > 1 ? 's' : ''}</span>
            </div>
            {selectedItems.length === 0 ? (
              <p className="py-4 text-center text-xs text-muted">Sélectionnez un article</p>
            ) : (
              <div className="space-y-2">
                {selectedItems.map((item, index) => (
                  <div key={`${item.nom}-${index}`} className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-base bg-surface-2 px-3 py-2 text-xs">
                    <span className="min-w-0 flex-1 truncate text-secondary">{item.nom}</span>
                    <div className="flex items-center gap-2">
                      {canAdjustTicketQuantity ? (
                        <div className="flex items-center gap-1 rounded-lg border border-base bg-surface px-2 py-1">
                          <button type="button" onClick={() => handleUpdateItemQuantity(index, -1)} className="px-1 text-slate-400 transition hover:text-white" aria-label={`Diminuer la quantité de ${item.nom}`}>−</button>
                          <input type="number" min="1" step="1" value={item.quantite} onChange={(event) => handleSetItemQuantity(index, Number(event.target.value))} className="w-10 border-0 bg-transparent px-0 text-center text-primary outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none" aria-label={`Quantité de ${item.nom}`} />
                          <button type="button" onClick={() => handleUpdateItemQuantity(index, 1)} className="px-1 text-slate-400 transition hover:text-white" aria-label={`Augmenter la quantité de ${item.nom}`}>+</button>
                        </div>
                      ) : (
                        <span className="min-w-5 text-center text-primary">×{item.quantite}</span>
                      )}
                      <span className="shrink-0 text-accent">{formatCurrency(item.prix * item.quantite)}</span>
                      {canDeleteTicketItem && <button type="button" onClick={() => handleRemoveItem(index)} className="text-red-400 transition hover:text-red-300" aria-label={`Supprimer ${item.nom}`}><XCircle size={14} /></button>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <div className="mt-3 flex items-center justify-between border-t border-base pt-3 text-sm font-bold">
              <span>Total</span>
              <span className="text-accent">{formatCurrency(selectedItems.reduce((sum, item) => sum + item.prix * item.quantite, 0))}</span>
            </div>
          </section>

          <div className="overflow-hidden rounded-xl border border-base bg-[#101415] shadow-inner">
            <div className="flex items-center justify-between border-b border-base px-3 py-2">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-accent">Menu du bar</p>
              <Input value={searchTerm} onChange={(event) => setSearchTerm(event.target.value)} placeholder="Rechercher" className="w-40 text-xs" />
            </div>
            <div className="grid h-[min(480px,60dvh)] min-h-[280px] grid-cols-1 grid-rows-[auto_minmax(0,1fr)] lg:h-[480px] lg:grid-cols-[128px_minmax(0,1fr)] lg:grid-rows-1">
              <nav className="flex gap-1 overflow-x-auto border-b border-base bg-[#171b1c] p-2 touch-pan-x overscroll-contain lg:block lg:space-y-1 lg:overflow-y-auto lg:overflow-x-hidden lg:border-b-0 lg:border-r">
                {menuCategories.map((category) => (
                  <button
                    key={category}
                    type="button"
                    onClick={() => {
                      setMenuCategory(category);
                      setMenuSubcategory('Toutes');
                      setSearchTerm('');
                    }}
                    className={`w-max shrink-0 rounded-md px-3 py-3 text-left text-[11px] font-semibold transition lg:w-full lg:px-2 ${menuCategory === category ? 'bg-red-500 text-white' : 'text-secondary hover:bg-surface-3'}`}
                  >
                    {category}
                  </button>
                ))}
              </nav>
              <div className="flex h-full min-h-0 min-w-0 flex-col p-2 sm:p-3">
                {menuSubcategories.length > 1 && (
                  <div className="mb-2 flex gap-1 overflow-x-auto border-b border-base pb-2 shrink-0">
                    {menuSubcategories.map((subcategory) => <button key={subcategory} type="button" onClick={() => setMenuSubcategory(subcategory)} className={`shrink-0 rounded px-2 py-1 text-[10px] font-semibold ${menuSubcategory === subcategory ? 'bg-sky-500 text-white' : 'bg-surface-2 text-muted'}`}>{subcategory}</button>)}
                  </div>
                )}
                <div className="grid min-h-0 flex-1 grid-cols-2 content-start gap-2 overflow-y-auto overscroll-contain pr-1 touch-pan-y xl:grid-cols-3">
                  {menuItems.map((cocktail) => {
                    const isSpecialBillardItem = cocktail.id <= 0;
                    const stock = stockMap[cocktail.id];
                    const unavailable = !isSpecialBillardItem && (!stock || stock.quantite <= 0);
                    return <button key={cocktail.id} type="button" disabled={unavailable} onClick={() => handleAddItem(cocktail)} className={`flex min-h-[84px] flex-col items-center justify-center rounded-md border border-emerald-950 bg-emerald-500 px-2 py-2 text-center text-white transition hover:bg-emerald-400 disabled:cursor-not-allowed disabled:opacity-40`}><span className="text-xs font-bold leading-tight">{cocktail.nom}</span><span className="mt-1 text-[10px] font-semibold text-emerald-950">{formatCurrency(cocktail.prix)}</span></button>;
                  })}
                  {menuItems.length === 0 && <p className="col-span-full py-10 text-center text-xs text-muted">Aucun article disponible.</p>}
                </div>
              </div>
            </div>
          </div>

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

      <Modal isOpen={isPaymentModalOpen} onClose={() => { setIsPaymentModalOpen(false); setPaymentOrder(null); }} title={`Encaisser la commande #${paymentOrder?.id ?? ''}`} size="sm">
        <div className="space-y-4">
          <p className="text-sm text-secondary">Choisissez le mode de paiement pour confirmer cette commande.</p>
          <Select
            label="Mode de paiement"
            value={paymentMethod}
            onChange={(event) => setPaymentMethod(event.target.value as NonNullable<BarCommande['moyen_paiement']>)}
            options={[
              { value: 'ESPECES', label: 'Espèces' },
              { value: 'CREDIT', label: 'Crédit' },
              { value: 'TPE', label: 'TPE' },
              { value: 'ORANGE_MONEY', label: 'Orange Money' },
              { value: 'MVOLA', label: 'MVola' },
              { value: 'GRATUIT', label: 'Gratuit' },
            ]}
          />
          <div className="flex gap-3 pt-2">
            <Button variant="secondary" type="button" onClick={() => { setIsPaymentModalOpen(false); setPaymentOrder(null); }} className="flex-1">Annuler</Button>
            <Button type="button" onClick={() => void handleConfirmPayment()} disabled={updatingId === paymentOrder?.id} className="flex-1">
              <CheckCircle2 size={16} />
              {updatingId === paymentOrder?.id ? 'Confirmation...' : 'Confirmer'}
            </Button>
          </div>
        </div>
      </Modal>

      <Modal isOpen={pendingDeleteOrder !== null} onClose={() => setPendingDeleteOrder(null)} title="Confirmer la suppression" size="sm">
        <div className="space-y-5">
          <div className="flex gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4">
            <AlertTriangle className="mt-0.5 shrink-0 text-red-400" size={20} />
            <div>
              <p className="font-semibold text-primary">Supprimer cette commande ?</p>
              <p className="mt-1 text-sm leading-relaxed text-secondary">
                Cette action supprimera définitivement la commande de {pendingDeleteOrder?.client || 'ce client'} et ses articles.
              </p>
            </div>
          </div>
          <div className="flex justify-end gap-2">
            <Button variant="secondary" type="button" onClick={() => setPendingDeleteOrder(null)} className="rounded-lg px-4">
              Annuler
            </Button>
            <Button variant="danger" type="button" onClick={() => pendingDeleteOrder && void handleDeleteCommande(pendingDeleteOrder)} disabled={pendingDeleteOrder !== null && deletingId === pendingDeleteOrder.id} className="rounded-lg px-4">
              {pendingDeleteOrder !== null && deletingId === pendingDeleteOrder.id ? 'Suppression...' : 'Supprimer'}
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
            {activeCommandes.length === 0
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
                    <tr key={commande.id} className={`border-t border-base transition ${commande.statut === 'Encaissée' ? 'bg-emerald-500/10 hover:bg-emerald-500/15' : 'hover:bg-surface-2/50'}`}>
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
