// hotel/modals/ReservationFormModal.tsx
import React, { useState, useEffect, useMemo } from 'react';
import { Reservation, Room, Client, ReservationExtraService, ReservationPayment } from '../../../types/hotel.types';
import { reservationService } from '../../../services/reservation.service';
import api from '../../../lib/api';
import { 
  X, 
  Calendar, 
  Users, 
  DollarSign, 
  User, 
  DoorOpen,
  CreditCard,
  Clock,
  CheckCircle,
  AlertCircle,
  UserCheck,
  Loader,
  Plus,
  UserPlus,
  Car,
  MapPin,
  Trash2,
  Printer
} from 'lucide-react';
import { HotelReceiptData, printPaymentHistoryTicket, printReservationTicket } from '../../../utils/hotelReceipt';
import { formatCurrency, formatDate } from '../../../utils/data';
import { Modal } from '../../Modal';
import { useRooms } from '../../../hooks/useRooms';
import { useClients } from '../../../hooks/useClients';
import { useReservations } from '../../../hooks/useReservations';
import { clientService, ClientFormData } from '../../../services/client.service';
import { signatureService } from '../../../services/signature.service';
import { toast } from 'react-hot-toast';
import { ClientCoreFormFields } from '../../Clients/ClientCoreFormFields';

const parseExtraServices = (raw: Reservation['services_extras']): ReservationExtraService[] => {
  if (!raw) return [];
  if (Array.isArray(raw)) return raw;
  try {
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const newExtraService = (type: ReservationExtraService['type'], date = ''): ReservationExtraService => ({
  type,
  description: '',
  date,
  heure: '',
  personnes: 1,
  prix: 0,
});

// Clé de comparaison d'un transfert/excursion entre l'état payé et l'état actuel.
const extraServiceKey = (item: ReservationExtraService) =>
  `${item.type}|${String(item.description || '').trim().toLowerCase()}|${item.date || ''}|${Number(item.prix) || 0}`;
const extraServiceLabel = (item: ReservationExtraService) =>
  `${item.type === 'TRANSFERT' ? 'Transfert' : 'Excursion'}${item.description ? ` : ${item.description}` : ''}`;
const paymentMethodLabels: Record<string, string> = {
  ESPECES: 'Espèces', TPE: 'TPE', MVOLA: 'MVola', ORANGE_MONEY: 'Orange Money',
  CARTE: 'Carte bancaire', VIREMENT: 'Virement', CREDIT: 'Crédit', GRATUIT: 'Gratuit',
};

interface ReservationFormModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialData: Reservation | null;
  onSuccess?: () => void;
}

export const ReservationFormModal: React.FC<ReservationFormModalProps> = ({
  isOpen,
  onClose,
  initialData,
  onSuccess,
}) => {
  // Récupération des données
  const { rooms, loading: roomsLoading, error: roomsError, loadRooms } = useRooms();
  const { clients, loading: clientsLoading, error: clientsError, loadClients } = useClients();
  const { createReservation, updateReservation } = useReservations();
  
  const [formData, setFormData] = useState<Partial<Reservation>>({
    client_id: undefined,
    room_id: undefined,
    date_arrivee: '',
    date_depart: '',
    pdj_inclus: false,
    montant_total: 0,
    statut: 'CONFIRMEE',
    type_reservation: 'BOOKING',
    laundry_included: false,
    laundry_price: 0,
    manual_price: 0,
  });

  const [selectedRoom, setSelectedRoom] = useState<Room | null>(null);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [apiError, setApiError] = useState<string | null>(null);
  const [discountMode, setDiscountMode] = useState<'none' | 'discount'>('none');
  const [discountPercent, setDiscountPercent] = useState(0);
  const [clientSearchTerm, setClientSearchTerm] = useState('');
  const [showAllClients, setShowAllClients] = useState(false);
  const [roomAvailabilityError, setRoomAvailabilityError] = useState<string | null>(null);
  const [showAvailabilityModal, setShowAvailabilityModal] = useState(false);
  const [exchangeRate, setExchangeRate] = useState<string>('');
  // Transferts & excursions saisis manuellement (hors remise, ajoutés au total)
  const [extraServices, setExtraServices] = useState<ReservationExtraService[]>([]);
  const extrasTotal = extraServices.reduce((sum, item) => sum + (Number(item.prix) || 0), 0);
  const updateExtraService = (index: number, patch: Partial<ReservationExtraService>) => {
    setExtraServices(prev => prev.map((item, i) => (i === index ? { ...item, ...patch } : item)));
  };

  // Paiements déjà encaissés : seule la rectification (reste à payer) compte dans le total.
  const [payments, setPayments] = useState<ReservationPayment[]>([]);
  const montantPaye = Number(initialData?.montant_paye || 0);
  const grandTotal = (formData.montant_total || 0) + extrasTotal;
  const resteAPayer = Math.round((grandTotal - montantPaye) * 100) / 100;

  useEffect(() => {
    if (!isOpen || !initialData?.id) {
      setPayments([]);
      return;
    }
    let cancelled = false;
    reservationService.getReservationPayments(initialData.id)
      .then(rows => { if (!cancelled) setPayments(rows); })
      .catch(() => { if (!cancelled) setPayments([]); });
    return () => { cancelled = true; };
  }, [isOpen, initialData?.id, montantPaye]);

  // Détail de la rectification = différence entre l'état actuel et ce qui a été payé
  // lors du dernier encaissement (blanchisserie, transferts/excursions ajoutés ou retirés).
  const rectification = useMemo(() => {
    if (montantPaye <= 0) return null;
    const lines: Array<{ label: string; montant: number }> = [];
    const paidIndexes = new Set<number>();
    const snapshot = payments.length ? payments[payments.length - 1].details : null;
    if (snapshot) {
      const currentLaundry = formData.laundry_included ? Number(formData.laundry_price || 0) : 0;
      const laundryDiff = currentLaundry - Number(snapshot.laundry_price || 0);
      if (laundryDiff !== 0) lines.push({ label: laundryDiff > 0 ? 'Blanchisserie' : 'Blanchisserie retirée', montant: laundryDiff });

      const remaining = [...(snapshot.services_extras || [])];
      extraServices.forEach((item, index) => {
        const matchIndex = remaining.findIndex(paid => extraServiceKey(paid) === extraServiceKey(item));
        if (matchIndex >= 0) {
          remaining.splice(matchIndex, 1);
          paidIndexes.add(index);
        } else {
          lines.push({ label: extraServiceLabel(item), montant: Number(item.prix) || 0 });
        }
      });
      remaining.forEach(paid => lines.push({ label: `${extraServiceLabel(paid)} (retiré)`, montant: -(Number(paid.prix) || 0) }));
    }
    const explained = lines.reduce((sum, line) => sum + line.montant, 0);
    const other = Math.round((resteAPayer - explained) * 100) / 100;
    if (Math.abs(other) >= 1) lines.push({ label: snapshot ? 'Ajustement hébergement' : 'Rectification', montant: other });
    return { lines, paidIndexes };
  }, [montantPaye, payments, formData.laundry_included, formData.laundry_price, extraServices, resteAPayer]);

  // Données du ticket 80 mm, construites depuis l'état actuel du formulaire.
  const buildReceiptData = (): HotelReceiptData => {
    const laundry = formData.laundry_included ? Number(formData.laundry_price || 0) : 0;
    return {
      reservationId: initialData?.id,
      clientName: selectedClient ? `${selectedClient.prenom || ''} ${selectedClient.nom || ''}`.trim() : '',
      roomNumber: selectedRoom ? String(selectedRoom.numero) : '',
      dateArrivee: formData.date_arrivee,
      dateDepart: formData.date_depart,
      typeReservation: formData.type_reservation,
      pdjInclus: Boolean(formData.pdj_inclus),
      hebergement: Math.max(0, (formData.montant_total || 0) - laundry),
      laundry,
      remisePourcentage: discountMode === 'discount' ? discountPercent : 0,
      extras: extraServices,
      total: grandTotal,
      montantPaye,
      montantEncaisse: Number(initialData?.montant_encaisse ?? montantPaye),
      montantCredit: Number(initialData?.montant_credit || 0),
      montantGratuit: Number(initialData?.montant_gratuit || 0),
      payments,
      rectificationLines: rectification?.lines,
    };
  };

  // Blanchisserie : ajuste le total par différence, sans recalculer l'hébergement
  // (une réservation déjà payée garde son prix de chambre / taux Booking d'origine).
  const applyLaundry = (included: boolean, price: number) => {
    setFormData(prev => {
      const factor = discountMode === 'discount' && discountPercent > 0 ? 1 - discountPercent / 100 : 1;
      const oldPart = prev.laundry_included ? Number(prev.laundry_price || 0) : 0;
      const newPart = included ? price : 0;
      return {
        ...prev,
        laundry_included: included,
        laundry_price: price,
        montant_total: Math.max(0, (prev.montant_total || 0) + (newPart - oldPart) * factor),
      };
    });
  };

  // États pour le formulaire de création rapide de client
  // Réutilise les mêmes champs que la page "Clients" (voir ClientCoreFormFields)
  // au lieu d'un formulaire réduit dupliqué.
  const [showClientModal, setShowClientModal] = useState(false);
  const emptyQuickClientData: ClientFormData = {
    nom: '',
    prenom: '',
    telephone: '',
    email: '',
    adresse: '',
    date_naissance: '',
    type_piece: '',
    numero_piece: '',
    code_client: '',
    statut: 'ACTIF',
    is_casino_player: false,
  };
  const [quickClientData, setQuickClientData] = useState<ClientFormData>(emptyQuickClientData);
  const [quickClientErrors, setQuickClientErrors] = useState<Record<string, string>>({});
  const [isSubmittingClient, setIsSubmittingClient] = useState(false);
  const [quickClientSignature, setQuickClientSignature] = useState<string | null>(null);

  // Charger les données au montage et quand le modal s'ouvre
  useEffect(() => {
    if (isOpen) {
      loadRooms();
      loadClients();
    }
  }, [isOpen, loadRooms, loadClients]);

  // Initialiser le formulaire avec les données de la réservation
  useEffect(() => {
    if (isOpen && initialData) {
      const initialExtras = parseExtraServices(initialData.services_extras);
      const initialExtrasTotal = Number(initialData.services_extras_total)
        || initialExtras.reduce((sum, item) => sum + (Number(item.prix) || 0), 0);
      setExtraServices(initialExtras);
      setFormData({
        client_id: initialData.client_id,
        room_id: initialData.room_id,
        date_arrivee: initialData.date_arrivee?.split('T')[0] || '',
        date_depart: initialData.date_depart?.split('T')[0] || '',
        pdj_inclus: Boolean(initialData.pdj_inclus),
        // montant_total du formulaire = partie hébergement ; les extras sont ajoutés à l'envoi
        montant_total: Math.max(0, Number(initialData.montant_total || 0) - initialExtrasTotal),
        statut: initialData.statut || 'CONFIRMEE',
        type_reservation: initialData.type_reservation || 'BOOKING',
        laundry_included: Boolean(initialData.laundry_included),
        laundry_price: initialData.laundry_price || 0,
        manual_price: initialData.manual_price || 0,
      });
      setDiscountPercent(initialData.remise_pourcentage || 0);
      setDiscountMode(initialData.remise_pourcentage ? 'discount' : 'none');
      
      const room = rooms.find(r => r.id === initialData.room_id);
      setSelectedRoom(room || null);
      
      const client = clients.find(c => c.id === initialData.client_id);
      setSelectedClient(client || null);
    } else if (isOpen && !initialData) {
      setFormData({
        client_id: undefined,
        room_id: undefined,
        date_arrivee: '',
        date_depart: '',
        pdj_inclus: false,
        montant_total: 0,
        statut: 'CONFIRMEE',
        type_reservation: 'BOOKING',
        laundry_included: false,
        laundry_price: 0,
        manual_price: 0,
        exchange_rate: 0,
      });
      setDiscountPercent(0);
      setDiscountMode('none');
      setSelectedRoom(null);
      setSelectedClient(null);
      setExchangeRate('');
      setExtraServices([]);
    }
    setErrors({});
    setApiError(null);
    setRoomAvailabilityError(null);
    setShowAvailabilityModal(false);
    setClientSearchTerm('');
    setShowAllClients(false);
  }, [initialData, isOpen, rooms, clients]);

  const handleRoomChange = async (roomId: number) => {
    const room = rooms.find(r => r.id === roomId);
    setSelectedRoom(room || null);
    setFormData({ ...formData, room_id: roomId });
    setRoomAvailabilityError(null);
    
    // Check room availability if dates are set
    if (formData.date_arrivee && formData.date_depart && !initialData) {
      try {
        const response = await api.get(`/api/hebergement/rooms/availability?room_id=${roomId}&date_arrivee=${formData.date_arrivee}&date_depart=${formData.date_depart}`);
        const data = response.data.data;
        console.log('Room availability check:', data);
        if (!data.available) {
          setShowAvailabilityModal(true);
        }
      } catch (error) {
        console.error('Error checking room availability:', error);
      }
    }
    
    calculateTotal(room as any, formData.date_arrivee, formData.date_depart);
  };

  const handleClientChange = (clientId: number) => {
    const client = clients.find(c => c.id === clientId);
    setSelectedClient(client || null);
    setFormData({ ...formData, client_id: clientId });
  };

  const calculateTotal = (room: Room | null, arrivee?: string, depart?: string) => {
    if (formData.type_reservation === 'GRATUIT') {
      setFormData(prev => ({ ...prev, montant_total: 0 }));
      return;
    }

    if (arrivee && depart && room?.prix_nuit) {
      const days = Math.ceil(
        (new Date(depart).getTime() - new Date(arrivee).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
      if (days > 0) {
        let total = 0;
        
        // For Booking.com, use manual price per night, multiply by nights, then convert to Ariary
        if (formData.type_reservation === 'BOOKING' && (formData.manual_price || 0) > 0) {
          // Price per night × number of nights = total EUR
          const rate = parseFloat(exchangeRate) || 39.76;
          const totalEur = (formData.manual_price || 0) * days;
          // Convert total EUR to Ariary
          total = totalEur * rate;
        } else {
          // For On-site, use room's normal price
          total = days * (room.prix_nuit || 0);
        }
        
        // Add laundry price if included
        if (formData.laundry_included) {
          total += formData.laundry_price || 0;
        }
        
        // Apply discount (only for On-site or if manual price not set for Booking)
        if (discountMode === 'discount' && discountPercent > 0) {
          total = total * (1 - discountPercent / 100);
        }
        
        const newTotal = total;
        setFormData(prev => ({
          ...prev,
          montant_total: newTotal
        }));
      }
    }
  };

  const handleDateChange = async (field: 'date_arrivee' | 'date_depart', value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    if (field === 'date_arrivee' || field === 'date_depart') {
      const arrivee = field === 'date_arrivee' ? value : formData.date_arrivee;
      const depart = field === 'date_depart' ? value : formData.date_depart;
      calculateTotal(selectedRoom, arrivee, depart);
      
      // Check room availability when dates change
      if (formData.room_id && arrivee && depart && !initialData) {
        try {
          const response = await api.get(`/api/hebergement/rooms/availability?room_id=${formData.room_id}&date_arrivee=${arrivee}&date_depart=${depart}`);
          const data = response.data.data;
          console.log('Date change availability check:', data);
          if (!data.available) {
            setShowAvailabilityModal(true);
          }
        } catch (error) {
          console.error('Error checking room availability:', error);
        }
      }
    }
  };

  // Validation du formulaire client rapide (mêmes règles que la page Clients)
  const validateQuickClient = (): boolean => {
    const errors: Record<string, string> = {};

    if (!quickClientData.nom?.trim()) {
      errors.nom = 'Le nom est requis';
    }
    if (quickClientData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(quickClientData.email)) {
      errors.email = 'Email invalide';
    }
    if (quickClientData.telephone && !/^[0-9+\s-]{8,}$/.test(quickClientData.telephone)) {
      errors.telephone = 'Téléphone invalide';
    }

    setQuickClientErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const closeQuickClientModal = () => {
    setShowClientModal(false);
    setQuickClientData(emptyQuickClientData);
    setQuickClientErrors({});
    setQuickClientSignature(null);
  };

  const handleQuickClientChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;

    setQuickClientData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));

    if (quickClientErrors[name]) {
      setQuickClientErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Création rapide d'un client
  const handleQuickClientSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateQuickClient()) {
      toast.error('Veuillez corriger les erreurs');
      return;
    }

    setIsSubmittingClient(true);

    try {
      const newClient = await clientService.createClient(quickClientData);

      if (quickClientSignature) {
        await signatureService.createSignature('client_kyc', newClient.id, quickClientSignature, newClient.id);
      }

      toast.success(`Client créé avec succès — code ${newClient.code_client}`);

      // Recharger la liste des clients
      await loadClients();

      // Sélectionner automatiquement le nouveau client
      setSelectedClient(newClient);
      setFormData(prev => ({ ...prev, client_id: newClient.id }));
      setClientSearchTerm(`${newClient.prenom || ''} ${newClient.nom}`.trim());
      setShowAllClients(false);

      // Fermer le modal de création
      closeQuickClientModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la création du client';
      toast.error(errorMessage);
      setQuickClientErrors({ general: errorMessage });
    } finally {
      setIsSubmittingClient(false);
    }
  };

  const validateForm = (): boolean => {
    const newErrors: Record<string, string> = {};
    
    if (!formData.client_id) {
      newErrors.client_id = 'Veuillez sélectionner un client';
    }
    if (!formData.room_id) {
      newErrors.room_id = 'Veuillez sélectionner une chambre';
    }
    if (!formData.date_arrivee) {
      newErrors.date_arrivee = 'Veuillez sélectionner une date d\'arrivée';
    }
    if (!formData.date_depart) {
      newErrors.date_depart = 'Veuillez sélectionner une date de départ';
    }
    if (formData.date_arrivee && formData.date_depart) {
      const arrivee = new Date(formData.date_arrivee);
      const depart = new Date(formData.date_depart);
      if (depart <= arrivee) {
        newErrors.date_depart = 'La date de départ doit être après la date d\'arrivée';
      }
    }
    if (formData.montant_total !== undefined && formData.montant_total !== null && Number(formData.montant_total) < 0) {
      newErrors.montant_total = 'Le montant ne peut pas être négatif';
    }
    extraServices.forEach((item, index) => {
      if (!item.description.trim()) {
        newErrors[`extra_${index}`] = `${item.type === 'TRANSFERT' ? 'Transfert' : 'Excursion'} n°${index + 1} : description obligatoire`;
      } else if (Number(item.prix) < 0) {
        newErrors[`extra_${index}`] = `${item.type === 'TRANSFERT' ? 'Transfert' : 'Excursion'} n°${index + 1} : prix invalide`;
      }
    });

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs du formulaire');
      return;
    }

    setIsSubmitting(true);
    setApiError(null);

    try {
      // Check room availability before creating new reservation
      if (!initialData && formData.room_id && formData.date_arrivee && formData.date_depart) {
        try {
          const response = await api.get(`/api/hebergement/rooms/availability?room_id=${formData.room_id}&date_arrivee=${formData.date_arrivee}&date_depart=${formData.date_depart}`);
          console.log('Availability check in submit:', response.data);
          if (!response.data.data.available) {
            setShowAvailabilityModal(true);
            setIsSubmitting(false);
            return;
          }
        } catch (error) {
          console.error('Error checking room availability:', error);
          // Continue with submission if availability check fails
        }
      }

      const submitData = {
        client_id: formData.client_id!,
        room_id: formData.room_id!,
        date_arrivee: formData.date_arrivee!,
        date_depart: formData.date_depart!,
        pdj_inclus: Boolean(formData.pdj_inclus),
        montant_total: (formData.montant_total || 0) + extrasTotal,
        services_extras: extraServices.map(item => ({
          ...item,
          description: item.description.trim(),
          personnes: Number(item.personnes) || 0,
          prix: Number(item.prix) || 0,
        })),
        statut: formData.statut || 'CONFIRMEE',
        remise_pourcentage: discountMode === 'discount' ? discountPercent : 0,
        type_reservation: formData.type_reservation || 'BOOKING',
        laundry_included: Boolean(formData.laundry_included),
        laundry_price: formData.laundry_price || 0,
        manual_price: formData.manual_price || 0,
        exchange_rate: parseFloat(exchangeRate) || 39.76,
      };

      if (initialData) {
        await updateReservation(initialData.id, submitData);
        toast.success('Réservation mise à jour avec succès');
      } else {
        await createReservation(submitData);
        toast.success('Réservation créée avec succès');
      }

      if (onSuccess) {
        onSuccess();
      }
      onClose();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Erreur lors de la sauvegarde';
      setApiError(errorMessage);
      toast.error(errorMessage);
      console.error('❌ Erreur:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  const getNightsCount = (): number => {
    if (formData.date_arrivee && formData.date_depart) {
      return Math.ceil(
        (new Date(formData.date_depart).getTime() - new Date(formData.date_arrivee).getTime()) / 
        (1000 * 60 * 60 * 24)
      );
    }
    return 0;
  };

  const nights = getNightsCount();

  // Affichage du chargement
  if (roomsLoading || clientsLoading) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <div className="p-6 flex items-center justify-center min-h-[300px]">
          <div className="text-center">
            <Loader size={40} className="animate-spin text-accent mx-auto mb-4" />
            <p className="text-muted">Chargement des données...</p>
            <p className="text-muted text-sm">Clients et chambres</p>
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <>
      {/* Modal principal */}
      <Modal isOpen={isOpen} onClose={onClose} size="lg">
        <div className="p-6 max-w-3xl w-full max-h-[90vh] overflow-y-auto">
          {/* Header */}
          <div className="relative mb-6">
            <div className="absolute -top-6 -right-6 w-32 h-32 bg-gradient-to-br from-accent/10 to-transparent rounded-full blur-2xl" />
            <div className="flex items-center justify-between relative z-10">
              <div>
                <h3 className="text-2xl font-bold text-primary" style={{ fontFamily: 'Playfair Display, serif' }}>
                  {initialData ? '✏️ Modifier la réservation' : '📅 Nouvelle réservation'}
                </h3>
                <p className="text-muted text-sm mt-1">
                  {initialData 
                    ? 'Modifiez les détails de la réservation' 
                    : 'Créez une nouvelle réservation pour un client'}
                </p>
              </div>
              <button 
                onClick={onClose} 
                className="p-2 rounded-xl hover:bg-surface-2 transition-all duration-300 hover:rotate-90"
                disabled={isSubmitting}
              >
                <X size={22} className="text-muted" />
              </button>
            </div>
          </div>

          {/* Erreur API */}
          {apiError && (
            <div className="mb-4 p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
              <AlertCircle size={16} />
              <span>{apiError}</span>
            </div>
          )}

          {/* Aperçu du client sélectionné */}
          {selectedClient && (
            <div className="mb-4 p-3.5 rounded-xl bg-gradient-to-r from-accent-4 to-accent-5 border border-accent/20">
              <div className="flex items-center gap-3.5">
                <div className="w-10 h-10 rounded-full bg-gradient-to-br from-accent to-accent-600 flex items-center justify-center text-white font-bold text-base shadow-soft-sm">
                  {selectedClient.prenom?.[0]}{selectedClient.nom?.[0] || 'C'}
                </div>
                <div className="flex-1">
                  <p className="text-primary font-semibold text-sm">
                    {selectedClient.prenom} {selectedClient.nom}
                  </p>
                  <div className="flex flex-wrap gap-2 text-xs text-muted">
                    {selectedClient.telephone && (
                      <span>📞 {selectedClient.telephone}</span>
                    )}
                    {selectedClient.email && (
                      <span>✉️ {selectedClient.email}</span>
                    )}
                    {selectedClient.is_casino_player && (
                      <span className="text-accent">🎰 Joueur Casino</span>
                    )}
                  </div>
                </div>
                <button 
                  onClick={() => {
                    setSelectedClient(null);
                    setFormData(prev => ({ ...prev, client_id: undefined }));
                  }}
                  className="text-muted hover:text-danger transition-colors p-1"
                  disabled={isSubmitting}
                >
                  <X size={15} />
                </button>
              </div>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Type de réservation - moved to top */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <Calendar size={14} className="inline mr-1.5" />
                Type de réservation *
              </label>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, type_reservation: 'GRATUIT' }));
                    calculateTotal(selectedRoom, formData.date_arrivee, formData.date_depart);
                  }}
                  className={`p-2 rounded-lg border ${formData.type_reservation === 'GRATUIT' ? 'border-emerald-500 bg-emerald-500/10 text-emerald-400' : 'border-base text-muted'}`}
                  disabled={isSubmitting}
                >
                  Gratuit
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, type_reservation: 'BOOKING' }));
                    calculateTotal(selectedRoom, formData.date_arrivee, formData.date_depart);
                  }}
                  className={`p-2 rounded-lg border ${formData.type_reservation === 'BOOKING' ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}
                  disabled={isSubmitting}
                >
                  Booking
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setFormData(prev => ({ ...prev, type_reservation: 'ON_SITE' }));
                    calculateTotal(selectedRoom, formData.date_arrivee, formData.date_depart);
                  }}
                  className={`p-2 rounded-lg border ${formData.type_reservation === 'ON_SITE' ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}
                  disabled={isSubmitting}
                >
                  Sur place
                </button>
              </div>
            </div>

            {/* Client avec bouton Ajouter et recherche */}
            <div className="space-y-1.5">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-sm font-medium text-primary">
                  <User size={14} className="inline mr-1.5" />
                  Client *
                </label>
                <button
                  type="button"
                  onClick={() => {
                    setQuickClientData(emptyQuickClientData);
                    setQuickClientErrors({});
                    setQuickClientSignature(null);
                    setShowClientModal(true);
                    clientService.getNextClientCode()
                      .then((code) => setQuickClientData(prev => (prev.code_client ? prev : { ...prev, code_client: code })))
                      .catch((err) => console.error('Erreur aperçu code client:', err));
                  }}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-accent text-black hover:bg-accent-2 rounded-lg text-xs font-semibold whitespace-nowrap transition-all"
                >
                  <UserPlus size={14} />
                  Nouveau client
                </button>
              </div>
              <div className="flex gap-2">
                <div className="flex-1 relative">
                  <input
                    type="text"
                    placeholder="Rechercher un client..."
                    value={clientSearchTerm}
                    onChange={(e) => {
                      setClientSearchTerm(e.target.value);
                      setShowAllClients(true);
                    }}
                    onFocus={() => setShowAllClients(true)}
                    className={`input-field w-full text-sm py-2.5 px-3.5 rounded-lg ${
                      errors.client_id ? 'border-red-500 focus:border-red-500' : ''
                    }`}
                    disabled={isSubmitting}
                    style={{ minHeight: '42px' }}
                  />
                  {showAllClients && (
                    <div className="absolute z-10 w-full mt-1 bg-gray-800 border border-gray-700 rounded-lg max-h-60 overflow-y-auto">
                      {clients
                        .filter(client => 
                          clientSearchTerm === '' || 
                          client.nom?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
                          client.prenom?.toLowerCase().includes(clientSearchTerm.toLowerCase()) ||
                          client.telephone?.includes(clientSearchTerm)
                        )
                        .map(client => (
                          <div
                            key={client.id}
                            onClick={() => {
                              handleClientChange(client.id);
                              setClientSearchTerm(`${client.prenom} ${client.nom}`);
                              setShowAllClients(false);
                            }}
                            className="px-3 py-2 hover:bg-gray-700 cursor-pointer text-sm text-white"
                          >
                            {client.prenom} {client.nom} {client.telephone ? `- ${client.telephone}` : ''}
                          </div>
                        ))}
                    </div>
                  )}
                </div>
              </div>
              {errors.client_id && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.client_id}
                </p>
              )}
            </div>

            {/* Chambre */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <DoorOpen size={14} className="inline mr-1.5" />
                Chambre *
              </label>
              <select
                value={formData.room_id || ''}
                onChange={(e) => handleRoomChange(Number(e.target.value))}
                className={`input-field w-full text-sm py-2.5 px-3.5 rounded-lg ${
                  errors.room_id ? 'border-red-500 focus:border-red-500' : ''
                }`}
                required
                disabled={isSubmitting}
                style={{ minHeight: '42px' }}
              >
                <option value="">Sélectionner une chambre</option>
                {rooms.map(room => (
                  <option key={room.id} value={room.id}>
                    Chambre {room.numero} - {room.room_type?.nom || 'Standard'}{formData.type_reservation === 'ON_SITE' ? ` - ${formatCurrency(room.prix_nuit || 0)}/nuit` : ''}{room.statut === 'OCCUPEE' && ' (Occupée)'}{room.statut === 'RESERVEE' && ' (Réservée)'}
                  </option>
                ))}
              </select>
              {roomAvailabilityError && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {roomAvailabilityError}
                </p>
              )}
              {errors.room_id && (
                <p className="text-red-400 text-xs flex items-center gap-1">
                  <AlertCircle size={11} /> {errors.room_id}
                </p>
              )}
            </div>

            {/* Dates */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary">
                  <Calendar size={14} className="inline mr-1.5" />
                  Date d'arrivée *
                </label>
                <input
                  type="date"
                  value={formData.date_arrivee || ''}
                  onChange={(e) => handleDateChange('date_arrivee', e.target.value)}
                  className={`input-field w-full text-sm py-2.5 px-3.5 rounded-lg ${
                    errors.date_arrivee ? 'border-red-500 focus:border-red-500' : ''
                  }`}
                  required
                  disabled={isSubmitting}
                  style={{ minHeight: '42px' }}
                />
                {errors.date_arrivee && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.date_arrivee}
                  </p>
                )}
              </div>
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary">
                  <Calendar size={14} className="inline mr-1.5" />
                  Date de départ *
                </label>
                <input
                  type="date"
                  value={formData.date_depart || ''}
                  onChange={(e) => handleDateChange('date_depart', e.target.value)}
                  className={`input-field w-full text-sm py-2.5 px-3.5 rounded-lg ${
                    errors.date_depart ? 'border-red-500 focus:border-red-500' : ''
                  }`}
                  required
                  min={formData.date_arrivee || undefined}
                  disabled={isSubmitting}
                  style={{ minHeight: '42px' }}
                />
                {errors.date_depart && (
                  <p className="text-red-400 text-xs flex items-center gap-1">
                    <AlertCircle size={11} /> {errors.date_depart}
                  </p>
                )}
              </div>
            </div>

            {/* Manual pricing for Booking */}
            {formData.type_reservation === 'BOOKING' && (
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-primary">
                    <DollarSign size={14} className="inline mr-1.5" />
                    Prix en euros (optionnel)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={formData.manual_price || ''}
                    onChange={(e) => {
                      const newPrice = parseFloat(e.target.value) || 0;
                      setFormData(prev => ({ ...prev, manual_price: newPrice }));
                      // Force calculation with current exchange rate
                      const currentRate = parseFloat(exchangeRate) || 39.76;
                      const currentNights = formData.date_arrivee && formData.date_depart ? 
                        Math.ceil((new Date(formData.date_depart).getTime() - new Date(formData.date_arrivee).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      if (currentNights > 0 && newPrice > 0) {
                        const totalEur = newPrice * currentNights;
                        const totalAr = totalEur * currentRate;
                        let finalTotal = totalAr;
                        if (formData.laundry_included) {
                          finalTotal += formData.laundry_price || 0;
                        }
                        if (discountMode === 'discount' && discountPercent > 0) {
                          finalTotal = finalTotal * (1 - discountPercent / 100);
                        }
                        setFormData(prev => ({ ...prev, montant_total: finalTotal }));
                      }
                    }}
                    className="input-field w-full text-sm py-2.5 rounded-lg"
                    min="0"
                    placeholder="Laisser vide pour calcul automatique"
                    disabled={isSubmitting}
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="block text-sm font-medium text-primary">
                    <DollarSign size={14} className="inline mr-1.5" />
                    Taux de change (EUR → Ariary)
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    value={exchangeRate}
                    onChange={(e) => {
                      setExchangeRate(e.target.value);
                      // Force recalculation with new exchange rate
                      const newRate = parseFloat(e.target.value) || 39.76;
                      const currentNights = formData.date_arrivee && formData.date_depart ? 
                        Math.ceil((new Date(formData.date_depart).getTime() - new Date(formData.date_arrivee).getTime()) / (1000 * 60 * 60 * 24)) : 0;
                      if (currentNights > 0 && (formData.manual_price || 0) > 0) {
                        const totalEur = (formData.manual_price || 0) * currentNights;
                        const totalAr = totalEur * newRate;
                        let finalTotal = totalAr;
                        if (formData.laundry_included) {
                          finalTotal += formData.laundry_price || 0;
                        }
                        if (discountMode === 'discount' && discountPercent > 0) {
                          finalTotal = finalTotal * (1 - discountPercent / 100);
                        }
                        setFormData(prev => ({ ...prev, montant_total: finalTotal }));
                      }
                    }}
                    className="input-field w-full text-sm py-2.5 rounded-lg"
                    min="0"
                    placeholder="Taux de change"
                    disabled={isSubmitting}
                  />
                </div>
              </div>
            )}

            {/* Laundry option */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <CheckCircle size={14} className="inline mr-1.5" />
                Blanchisserie
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => { if (!formData.laundry_included) applyLaundry(true, Number(formData.laundry_price || 0)); }}
                  className={`p-2 rounded-lg border ${formData.laundry_included ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}
                  disabled={isSubmitting}
                >
                  Inclure
                </button>
                <button
                  type="button"
                  onClick={() => { if (formData.laundry_included) applyLaundry(false, Number(formData.laundry_price || 0)); }}
                  className={`p-2 rounded-lg border ${!formData.laundry_included ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}
                  disabled={isSubmitting}
                >
                  Exclure
                </button>
              </div>
              {formData.laundry_included && (
                <div className="mt-2">
                  <input
                    type="number"
                    value={formData.laundry_price || ''}
                    onChange={(e) => applyLaundry(true, Math.max(0, Number(e.target.value) || 0))}
                    className="input-field w-full text-sm py-2.5 rounded-lg"
                    min="0"
                    placeholder="Prix de la blanchisserie"
                    disabled={isSubmitting}
                  />
                </div>
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <CheckCircle size={14} className="inline mr-1.5" />
                Petit-déjeuner
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, pdj_inclus: true }))}
                  className={`p-2 rounded-lg border ${formData.pdj_inclus ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}
                  disabled={isSubmitting}
                >
                  PDJ inclus
                </button>
                <button
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, pdj_inclus: false }))}
                  className={`p-2 rounded-lg border ${!formData.pdj_inclus ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}
                  disabled={isSubmitting}
                >
                  PDJ non inclus
                </button>
              </div>
            </div>

            {/* Transferts & excursions */}
            <div className="space-y-2">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <label className="block text-sm font-medium text-primary">
                  <Car size={14} className="inline mr-1.5" />
                  Transferts & excursions
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setExtraServices(prev => [...prev, newExtraService('TRANSFERT', formData.date_arrivee || '')])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-base text-xs font-medium text-primary hover:bg-surface-2 transition-all"
                    disabled={isSubmitting}
                  >
                    <Plus size={13} /> <Car size={13} /> Transfert
                  </button>
                  <button
                    type="button"
                    onClick={() => setExtraServices(prev => [...prev, newExtraService('EXCURSION')])}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-base text-xs font-medium text-primary hover:bg-surface-2 transition-all"
                    disabled={isSubmitting}
                  >
                    <Plus size={13} /> <MapPin size={13} /> Excursion
                  </button>
                </div>
              </div>

              {extraServices.length === 0 ? (
                <p className="text-xs text-muted">Aucun transfert ni excursion. Utilisez les boutons ci-dessus pour en ajouter.</p>
              ) : (
                <div className="space-y-2">
                  {extraServices.map((item, index) => (
                    <div key={index} className="rounded-lg border border-base bg-surface-2 p-3 space-y-2">
                      <div className="flex items-center gap-2">
                        <select
                          value={item.type}
                          onChange={(e) => updateExtraService(index, { type: e.target.value as ReservationExtraService['type'] })}
                          className="input-field text-sm py-2 px-2.5 rounded-lg"
                          disabled={isSubmitting}
                        >
                          <option value="TRANSFERT">🚗 Transfert</option>
                          <option value="EXCURSION">🗺️ Excursion</option>
                        </select>
                        <input
                          type="text"
                          value={item.description}
                          onChange={(e) => updateExtraService(index, { description: e.target.value })}
                          placeholder={item.type === 'TRANSFERT' ? 'Ex. Aéroport → Hôtel' : 'Ex. Visite de Nosy Komba'}
                          className={`input-field flex-1 min-w-0 text-sm py-2 px-3 rounded-lg ${errors[`extra_${index}`] ? 'border-red-500' : ''}`}
                          disabled={isSubmitting}
                        />
                        {rectification?.paidIndexes.has(index) ? (
                          <span className="px-2 py-1 rounded-md bg-emerald-500/15 text-emerald-400 text-[11px] font-semibold whitespace-nowrap">✓ Payé</span>
                        ) : montantPaye > 0 ? (
                          <span className="px-2 py-1 rounded-md bg-orange-500/15 text-orange-300 text-[11px] font-semibold whitespace-nowrap">À payer</span>
                        ) : null}
                        <button
                          type="button"
                          onClick={() => setExtraServices(prev => prev.filter((_, i) => i !== index))}
                          className="p-2 rounded-lg text-muted hover:text-danger hover:bg-red-500/10 transition-colors"
                          title="Retirer"
                          disabled={isSubmitting}
                        >
                          <Trash2 size={15} />
                        </button>
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <label className="text-xs text-muted">
                          Date
                          <input
                            type="date"
                            value={item.date}
                            onChange={(e) => updateExtraService(index, { date: e.target.value })}
                            className="input-field w-full text-sm py-2 px-2.5 rounded-lg mt-1"
                            disabled={isSubmitting}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Heure
                          <input
                            type="time"
                            value={item.heure}
                            onChange={(e) => updateExtraService(index, { heure: e.target.value })}
                            className="input-field w-full text-sm py-2 px-2.5 rounded-lg mt-1"
                            disabled={isSubmitting}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Personnes
                          <input
                            type="number"
                            min="0"
                            value={item.personnes || ''}
                            onChange={(e) => updateExtraService(index, { personnes: Math.max(0, Number(e.target.value) || 0) })}
                            className="input-field w-full text-sm py-2 px-2.5 rounded-lg mt-1"
                            disabled={isSubmitting}
                          />
                        </label>
                        <label className="text-xs text-muted">
                          Prix (Ar)
                          <input
                            type="number"
                            min="0"
                            value={item.prix || ''}
                            onChange={(e) => updateExtraService(index, { prix: Math.max(0, Number(e.target.value) || 0) })}
                            placeholder="0"
                            className="input-field w-full text-sm py-2 px-2.5 rounded-lg mt-1"
                            disabled={isSubmitting}
                          />
                        </label>
                      </div>
                      {errors[`extra_${index}`] && (
                        <p className="text-red-400 text-xs flex items-center gap-1">
                          <AlertCircle size={11} /> {errors[`extra_${index}`]}
                        </p>
                      )}
                    </div>
                  ))}
                  <p className="text-xs text-muted text-right">
                    Total transferts & excursions : <strong className="text-primary">{formatCurrency(extrasTotal)}</strong> (hors remise)
                  </p>
                </div>
              )}
            </div>

            {/* Historique des paiements + rectification (réservation déjà encaissée) */}
            {montantPaye > 0 && (
              <div className="space-y-2 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-3">
                <div className="flex items-center justify-between gap-2">
                  <p className="text-sm font-medium text-primary flex items-center gap-1.5">
                    <CreditCard size={14} /> Historique des paiements
                  </p>
                  <button
                    type="button"
                    onClick={() => printPaymentHistoryTicket(buildReceiptData())}
                    className="flex items-center gap-1.5 px-2.5 py-1 rounded-lg border border-base text-xs font-medium text-primary hover:bg-surface-2 transition-all"
                    title="Imprimer l'historique (ticket 80 mm)"
                  >
                    <Printer size={13} /> Imprimer l'historique
                  </button>
                </div>
                {payments.length === 0 ? (
                  <p className="text-xs text-muted">Déjà payé : {formatCurrency(montantPaye)}</p>
                ) : (
                  <div className="space-y-1.5">
                    {payments.map((payment, index) => (
                      <div key={payment.id} className="flex items-start justify-between gap-3 rounded-md bg-surface-2 px-3 py-2 text-xs">
                        <div className="min-w-0">
                          <p className="text-primary font-medium">
                            {index === 0 ? 'Paiement initial' : `Rectification n°${index}`}
                            <span className="ml-2 text-emerald-400">✓ Payé</span>
                          </p>
                          <p className="text-muted">
                            <Clock size={11} className="inline mr-1" />
                            {new Date(payment.created_at).toLocaleString('fr-FR', { dateStyle: 'short', timeStyle: 'short' })}
                            {' · '}{paymentMethodLabels[payment.moyen_paiement || ''] || payment.moyen_paiement || '—'}
                            {payment.created_by_nom ? ` · par ${payment.created_by_prenom || ''} ${payment.created_by_nom}` : ''}
                          </p>
                        </div>
                        <strong className="text-emerald-400 whitespace-nowrap">{formatCurrency(payment.montant)}</strong>
                      </div>
                    ))}
                  </div>
                )}

                <div className="pt-2 border-t border-base space-y-1 text-xs">
                  <p className="text-sm font-medium text-primary">Rectification à payer</p>
                  {rectification && rectification.lines.length > 0 ? (
                    rectification.lines.map((line, index) => (
                      <div key={index} className="flex justify-between gap-3">
                        <span className="text-muted">{line.label}</span>
                        <strong className={line.montant < 0 ? 'text-emerald-400' : 'text-orange-300'}>
                          {line.montant > 0 ? '+' : ''}{formatCurrency(line.montant)}
                        </strong>
                      </div>
                    ))
                  ) : (
                    <p className="text-muted">Aucune rectification : la réservation est entièrement payée.</p>
                  )}
                </div>
              </div>
            )}

            {/* Remise */}
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-primary">
                <DollarSign size={14} className="inline mr-1.5" />
                Tarif
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button type="button" onClick={() => { setDiscountMode('none'); setDiscountPercent(0); }} className={`p-2 rounded-lg border ${discountMode === 'none' ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}>
                  Sans remise
                </button>
                <button type="button" onClick={() => setDiscountMode('discount')} className={`p-2 rounded-lg border ${discountMode === 'discount' ? 'border-accent bg-accent/10 text-accent' : 'border-base text-muted'}`}>
                  Avec remise
                </button>
              </div>
              {discountMode === 'discount' && (
                <input
                  type="number"
                  value={discountPercent}
                  onChange={(e) => setDiscountPercent(Math.min(100, Math.max(0, Number(e.target.value))))}
                  className="input-field w-full text-sm py-2.5 rounded-lg"
                  min="0"
                  max="100"
                  step="1"
                  placeholder="Pourcentage de remise"
                  disabled={isSubmitting}
                />
              )}
              <p className="text-xs text-muted">La remise sera soumise à validation de la direction.</p>
              <div className="rounded-lg bg-surface-2 p-3 text-sm space-y-1">
                <div className="flex justify-between"><span>Durée</span><strong>{nights} nuit{nights > 1 ? 's' : ''}</strong></div>
                <div className="flex justify-between"><span>Type</span><strong>{formData.type_reservation === 'BOOKING' ? 'Booking.com' : 'Sur place'}</strong></div>
                {formData.type_reservation === 'BOOKING' && formData.manual_price > 0 && (
                  <>
                    <div className="flex justify-between"><span>Prix/nuit Booking.com (€)</span><strong>{formData.manual_price.toFixed(2)} €</strong></div>
                    <div className="flex justify-between"><span>Total Booking.com (€)</span><strong>{(formData.manual_price * nights).toFixed(2)} €</strong></div>
                    <div className="flex justify-between"><span>Taux de change</span><strong>{exchangeRate} Ar/€</strong></div>
                    <div className="flex justify-between"><span>Total converti (Ar)</span><strong>{formatCurrency(formData.manual_price * nights * parseFloat(exchangeRate))}</strong></div>
                  </>
                )}
                {formData.type_reservation !== 'BOOKING' && selectedRoom && nights > 0 && (
                  <div className="flex justify-between"><span>Prix normal</span><strong>{formatCurrency(selectedRoom.prix_nuit || 0)}/nuit</strong></div>
                )}
                {formData.laundry_included && (
                  <div className="flex justify-between"><span>Blanchisserie</span><strong>{formatCurrency(formData.laundry_price || 0)}</strong></div>
                )}
                {discountMode === 'discount' && discountPercent > 0 && (
                  <div className="flex justify-between"><span>Remise</span><strong>{discountPercent}%</strong></div>
                )}
                {extraServices.length > 0 && (
                  <>
                    <div className="flex justify-between"><span>Hébergement</span><strong>{formatCurrency(formData.montant_total || 0)}</strong></div>
                    <div className="flex justify-between"><span>Transferts & excursions ({extraServices.length})</span><strong>{formatCurrency(extrasTotal)}</strong></div>
                  </>
                )}
                {montantPaye > 0 ? (
                  <>
                    <div className="flex justify-between text-muted pt-2 border-t border-base"><span>Total de la réservation</span><span>{formatCurrency(grandTotal)}</span></div>
                    <div className="flex justify-between text-emerald-400"><span>Déjà couvert</span><span>− {formatCurrency(montantPaye)}</span></div>
                    {Number(initialData?.montant_encaisse || 0) > 0 && <div className="flex justify-between text-muted"><span>Argent réellement encaissé</span><span>{formatCurrency(initialData?.montant_encaisse || 0)}</span></div>}
                    {Number(initialData?.montant_gratuit || 0) > 0 && <div className="flex justify-between text-violet-300"><span>Couvert gratuitement</span><span>{formatCurrency(initialData?.montant_gratuit || 0)}</span></div>}
                    {Number(initialData?.montant_credit || 0) > 0 && <div className="flex justify-between text-orange-300"><span>Crédit restant dû</span><span>{formatCurrency(initialData?.montant_credit || 0)}</span></div>}
                    <div className="flex justify-between text-accent pt-2 border-t border-base">
                      <span>{resteAPayer > 0 ? 'Total à payer (rectification)' : resteAPayer < 0 ? 'Trop-perçu à rendre' : 'Total à payer'}</span>
                      <strong>{formatCurrency(Math.abs(resteAPayer))}</strong>
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-accent pt-2 border-t border-base"><span>Total (Ar)</span><strong>{formatCurrency(grandTotal)}</strong></div>
                )}
              </div>
              {initialData && (
                <button
                  type="button"
                  onClick={() => printReservationTicket(buildReceiptData())}
                  className="w-full flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-base text-sm font-medium text-primary hover:bg-surface-2 transition-all"
                  title="Imprimer le ticket de la réservation (80 mm)"
                >
                  <Printer size={15} /> Imprimer le ticket (80 mm)
                </button>
              )}
              {selectedRoom && nights > 0 && formData.type_reservation !== 'BOOKING' && (
                <p className="text-xs text-muted">
                  💡 Calculé automatiquement : {nights} nuit{nights > 1 ? 's' : ''} × {formatCurrency(selectedRoom.prix_nuit || 0)} = {formatCurrency((selectedRoom.prix_nuit || 0) * nights)}
                </p>
              )}
            </div>

            {/* Statut */}
            {initialData && (
              <div className="space-y-1.5">
                <label className="block text-sm font-medium text-primary">
                  <CheckCircle size={14} className="inline mr-1.5" />
                  Statut
                </label>
                <select
                  value={formData.statut || 'CONFIRMEE'}
                  onChange={(e) => setFormData({ ...formData, statut: e.target.value as any })}
                  className="input-field w-full text-sm py-2.5 px-3.5 rounded-lg"
                  disabled={isSubmitting}
                  style={{ minHeight: '42px' }}
                >
                  <option value="CONFIRMEE">Confirmée</option>
                  <option value="EN_COURS">En cours</option>
                  <option value="TERMINEE">Terminée</option>
                  <option value="ANNULEE">Annulée</option>
                </select>
              </div>
            )}

            {/* Boutons */}
            <div className="flex gap-3 pt-3 border-t border-base">
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-4 py-2.5 rounded-lg border border-base text-primary font-medium text-sm hover:bg-surface-2 transition-all duration-300"
                disabled={isSubmitting}
                style={{ minHeight: '44px' }}
              >
                Annuler
              </button>
              <button
                type="submit"
                className="flex-1 px-4 py-2.5 rounded-lg bg-accent text-black font-medium text-sm transition-all duration-300 hover:bg-accent-2 flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={isSubmitting}
                style={{ minHeight: '44px' }}
              >
                {isSubmitting ? (
                  <>
                    <Loader size={16} className="animate-spin" />
                    Enregistrement...
                  </>
                ) : (
                  <>
                    <UserCheck size={16} />
                    {initialData ? 'Mettre à jour' : 'Créer la réservation'}
                  </>
                )}
              </button>
            </div>
          </form>
        </div>
      </Modal>

      {/* Room availability warning modal */}
      {showAvailabilityModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[70]">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md shadow-2xl border border-gray-700 animate-scaleIn">
            <div className="p-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="w-12 h-12 rounded-full bg-red-500/20 flex items-center justify-center">
                  <AlertCircle size={24} className="text-red-400" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Chambre non disponible</h3>
                  <p className="text-sm text-gray-400">Conflit de réservation</p>
                </div>
              </div>
              <p className="text-gray-300 mb-6">
                Cette chambre est déjà réservée pour les dates sélectionnées. Veuillez choisir d'autres dates ou une autre chambre.
              </p>
              <div className="flex gap-3">
                <button
                  onClick={() => setShowAvailabilityModal(false)}
                  className="flex-1 px-4 py-2.5 rounded-lg border border-gray-600 text-gray-300 font-medium text-sm hover:bg-gray-800 transition-all"
                >
                  Fermer
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de création rapide de client */}
      {showClientModal && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-[60]">
          <div className="bg-gray-900 rounded-2xl w-full max-w-md max-h-[90vh] overflow-y-auto shadow-2xl border border-gray-700 animate-scaleIn">
            <div className="sticky top-0 bg-gray-900 p-6 border-b border-gray-800 flex items-center justify-between z-10">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-xl bg-accent/20 flex items-center justify-center">
                  <UserPlus size={20} className="text-accent" />
                </div>
                <div>
                  <h3 className="text-lg font-bold text-white">Nouveau client</h3>
                  <p className="text-sm text-gray-400">Création rapide</p>
                </div>
              </div>
              <button
                onClick={closeQuickClientModal}
                className="p-2 hover:bg-gray-800 rounded-lg transition-colors text-gray-400 hover:text-gray-300"
              >
                <X size={20} />
              </button>
            </div>

            <form onSubmit={handleQuickClientSubmit} className="p-6 space-y-4">
              {/* Erreur générale */}
              {quickClientErrors.general && (
                <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-lg text-red-400 text-sm flex items-center gap-2">
                  <AlertCircle size={16} />
                  <span>{quickClientErrors.general}</span>
                </div>
              )}

              <ClientCoreFormFields
                formData={quickClientData}
                formErrors={quickClientErrors}
                onChange={handleQuickClientChange}
                isSubmitting={isSubmittingClient}
                signature={quickClientSignature}
                onSignatureChange={setQuickClientSignature}
              />

              <div className="flex justify-end gap-3 pt-4 border-t border-gray-800">
                <button
                  type="button"
                  onClick={closeQuickClientModal}
                  className="px-5 py-2.5 bg-gray-800 text-gray-300 font-medium rounded-xl hover:bg-gray-700 transition-all"
                  disabled={isSubmittingClient}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2.5 bg-accent text-white font-medium rounded-xl hover:bg-accent-2 transition-all flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed shadow-lg shadow-accent/25"
                  disabled={isSubmittingClient}
                >
                  {isSubmittingClient ? (
                    <>
                      <Loader size={18} className="animate-spin" />
                      Création...
                    </>
                  ) : (
                    <>
                      <UserPlus size={18} />
                      Créer le client
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      <style>{`
        @keyframes scaleIn {
          from { 
            opacity: 0;
            transform: scale(0.95) translateY(-10px);
          }
          to { 
            opacity: 1;
            transform: scale(1) translateY(0);
          }
        }
        .animate-scaleIn {
          animation: scaleIn 0.25s ease-out;
        }
      `}</style>
    </>
  );
};  