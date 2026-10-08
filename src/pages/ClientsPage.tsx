// src/pages/ClientsPage.tsx
import { useState, useEffect, useRef, useCallback } from 'react';
import { 
  Search, 
  Edit, 
  Trash2, 
  Eye,
  Mail,
  Phone,
  MapPin,
  Download,
  UserPlus,
  CheckCircle,
  XCircle,
  X,
  QrCode,
  Copy,
  Printer,
  Users,
  Loader,
  AlertCircle,
  RefreshCw,
  Plus,
  Check
} from 'lucide-react';
import { useClients } from '../hooks/useClients';
import { Client, ClientFormData, ClientKyc, ClientKycFormData, clientService } from '../services/client.service';
import { ClientCoreFormFields } from '../components/Clients/ClientCoreFormFields';
import { IdentityDocumentsCapture, identityDocumentUrl } from '../components/Clients/IdentityDocumentsCapture';
import { signatureService } from '../services/signature.service';
import toast from 'react-hot-toast';
import QRCode from 'qrcode';
import { printThermal } from '../utils/thermalPrint';

const ClientsPage: React.FC = () => {
  const { 
    clients, 
    loading, 
    error, 
    loadClients,
    searchClients,
    createClient,
    updateClient,
    deleteClient,
    loadClientWithDetails,
    loadClientKyc,
    saveClientKyc
  } = useClients();

  // États
  const [searchTerm, setSearchTerm] = useState<string>('');
  const [isModalOpen, setIsModalOpen] = useState<boolean>(false);
  const [isViewModalOpen, setIsViewModalOpen] = useState<boolean>(false);
  const [isQRModalOpen, setIsQRModalOpen] = useState<boolean>(false);
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState<boolean>(false);
  const [selectedClient, setSelectedClient] = useState<Client | null>(null);
  const [editingClient, setEditingClient] = useState<Client | null>(null);
  const [clientToDelete, setClientToDelete] = useState<Client | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('tous');
  const [currentPage, setCurrentPage] = useState<number>(1);
  const [qrCodeData, setQrCodeData] = useState<string>('');
  const [copied, setCopied] = useState<boolean>(false);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [isProcessing, setIsProcessing] = useState<boolean>(false);
  const [showFilters, setShowFilters] = useState<boolean>(false);
  const [showKycForm, setShowKycForm] = useState<boolean>(false);
  const [kycData, setKycData] = useState<ClientKycFormData>({
    lieu_naissance: '',
    nationalite: '',
    profession: '',
    date_delivrance_piece: '',
    date_expiration_piece: '',
    autorite_delivrance: '',
    source_revenus: '',
    revenu_mensuel_estime: undefined,
    mode_paiement: '',
    banque: '',
    doc_piece_identite: false,
    doc_justificatif_domicile: false,
    doc_photo_client: false,
    doc_autre: '',
    documents_identite_urls: [],
    niveau_risque: undefined,
    commentaires_risque: '',
    declaration_client: false,
    agent_verificateur: undefined,
    date_verification: '',
  });
  const [isSubmittingKyc, setIsSubmittingKyc] = useState<boolean>(false);
  const [viewKycData, setViewKycData] = useState<ClientKyc | null>(null);
  const [newlyCreatedClientId, setNewlyCreatedClientId] = useState<number | null>(null);
  const [kycSaved, setKycSaved] = useState<boolean>(false);
  
  const qrCanvasRef = useRef<HTMLCanvasElement>(null);
  const itemsPerPage: number = 5;

  // Formulaire
  const initialFormData: ClientFormData = {
    nom: '',
    prenom: '',
    email: '',
    telephone: '',
    adresse: '',
    date_naissance: '',
    type_piece: '',
    numero_piece: '',
    statut: 'ACTIF',
    is_casino_player: false,
    code_client: ''
  };
  
  const [formData, setFormData] = useState<ClientFormData>(initialFormData);
  const [formErrors, setFormErrors] = useState<Record<string, string>>({});
  
  // Signature
  const [clientSignature, setClientSignature] = useState<string | null>(null);
  const [signatureDirty, setSignatureDirty] = useState<boolean>(false);

  // Debounce pour la recherche
  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchTerm) {
        searchClients(searchTerm);
      } else {
        loadClients();
      }
    }, 500);

    return () => clearTimeout(timer);
  }, [searchTerm, searchClients, loadClients]);

  // Filtrer les clients
  const getFilteredClients = (): Client[] => {
    let filtered = clients;
    
    if (filterStatus !== 'tous') {
      filtered = filtered.filter(client => 
        client.statut?.toLowerCase() === filterStatus
      );
    }
    
    // Sort clients: active first, then by most recent date
    return filtered.sort((a, b) => {
      // First sort by status (active first)
      const statusOrder = { 'ACTIF': 0, 'BLOCKED': 1, 'INACTIF': 2 };
      const statusA = statusOrder[a.statut as keyof typeof statusOrder] ?? 3;
      const statusB = statusOrder[b.statut as keyof typeof statusOrder] ?? 3;
      
      if (statusA !== statusB) {
        return statusA - statusB;
      }
      
      // Then sort by date (most recent first)
      const dateA = new Date(a.updated_at || a.created_at || '1970-01-01').getTime();
      const dateB = new Date(b.updated_at || b.created_at || '1970-01-01').getTime();
      return dateB - dateA;
    });
  };

  const filteredClients: Client[] = getFilteredClients();
  const totalPages: number = Math.ceil(filteredClients.length / itemsPerPage);
  const startIndex: number = (currentPage - 1) * itemsPerPage;
  const paginatedClients: Client[] = filteredClients.slice(startIndex, startIndex + itemsPerPage);

  // Validation du formulaire
  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};
    
    if (!formData.nom?.trim()) {
      errors.nom = 'Le nom est requis';
    }
    if (formData.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      errors.email = 'Email invalide';
    }
    if (formData.telephone && !/^[0-9+\s-]{8,}$/.test(formData.telephone)) {
      errors.telephone = 'Téléphone invalide';
    }
    
    setFormErrors(errors);
    return Object.keys(errors).length === 0;
  };

  // Gestionnaires d'événements
  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setFormData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value
    }));
    
    if (formErrors[name]) {
      setFormErrors(prev => ({ ...prev, [name]: '' }));
    }
  };

  // Gestionnaire pour SignaturePad
  const handleSignatureChange = (dataUrl: string | null): void => {
    setClientSignature(dataUrl);
    setSignatureDirty(true);
  };

  // Gestionnaire pour les champs KYC
  const handleKycInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>): void => {
    const { name, value, type } = e.target;
    const checked = (e.target as HTMLInputElement).checked;
    
    setKycData(prev => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : type === 'number' ? (value ? Number(value) : undefined) : value
    }));
  };

  // Helper de nettoyage des données KYC
  const formatKycDataForSave = (data: ClientKycFormData): ClientKycFormData => {
    return {
      lieu_naissance: data.lieu_naissance?.trim() || undefined,
      nationalite: data.nationalite?.trim() || undefined,
      profession: data.profession?.trim() || undefined,
      date_delivrance_piece: data.date_delivrance_piece?.trim() || undefined,
      date_expiration_piece: data.date_expiration_piece?.trim() || undefined,
      autorite_delivrance: data.autorite_delivrance?.trim() || undefined,
      source_revenus: data.source_revenus?.trim() || undefined,
      revenu_mensuel_estime: (data.revenu_mensuel_estime !== undefined && data.revenu_mensuel_estime !== null && !isNaN(Number(data.revenu_mensuel_estime)))
        ? Number(data.revenu_mensuel_estime)
        : undefined,
      mode_paiement: data.mode_paiement?.trim() || undefined,
      banque: data.banque?.trim() || undefined,
      doc_piece_identite: Boolean(data.doc_piece_identite),
      doc_justificatif_domicile: Boolean(data.doc_justificatif_domicile),
      doc_photo_client: Boolean(data.doc_photo_client),
      doc_autre: data.doc_autre?.trim() || undefined,
      documents_identite_urls: data.documents_identite_urls || [],
      niveau_risque: (data.niveau_risque && ['FAIBLE', 'MOYEN', 'ELEVE'].includes(data.niveau_risque))
        ? data.niveau_risque
        : undefined,
      commentaires_risque: data.commentaires_risque?.trim() || undefined,
      declaration_client: Boolean(data.declaration_client),
      agent_verificateur: (data.agent_verificateur !== undefined && data.agent_verificateur !== null && !isNaN(Number(data.agent_verificateur)))
        ? Number(data.agent_verificateur)
        : undefined,
      date_verification: data.date_verification?.trim() || undefined,
    };
  };

  // Charger les données KYC et signature lors de l'ouverture du modal d'édition
  const loadKycForClient = async (clientId: number): Promise<void> => {
    try {
      const [kyc, sig] = await Promise.all([
        loadClientKyc(clientId).catch(() => null),
        signatureService.getSignature('client_kyc', clientId).catch(() => null),
      ]);

      if (sig && sig.signature_data) {
        setClientSignature(sig.signature_data);
        setSignatureDirty(false);
      } else {
        setClientSignature(null);
        setSignatureDirty(false);
      }

      if (kyc) {
        setKycSaved(true);
        setKycData({
          lieu_naissance: kyc.lieu_naissance || '',
          nationalite: kyc.nationalite || '',
          profession: kyc.profession || '',
          date_delivrance_piece: kyc.date_delivrance_piece || '',
          date_expiration_piece: kyc.date_expiration_piece || '',
          autorite_delivrance: kyc.autorite_delivrance || '',
          source_revenus: kyc.source_revenus || '',
          revenu_mensuel_estime: kyc.revenu_mensuel_estime || undefined,
          mode_paiement: kyc.mode_paiement || '',
          banque: kyc.banque || '',
          doc_piece_identite: kyc.doc_piece_identite || false,
          doc_justificatif_domicile: kyc.doc_justificatif_domicile || false,
          doc_photo_client: kyc.doc_photo_client || false,
          doc_autre: kyc.doc_autre || '',
          documents_identite_urls: kyc.documents_identite_urls || [],
          niveau_risque: kyc.niveau_risque || undefined,
          commentaires_risque: kyc.commentaires_risque || '',
          declaration_client: kyc.declaration_client || false,
          agent_verificateur: kyc.agent_verificateur ? Number(kyc.agent_verificateur) : undefined,
          date_verification: kyc.date_verification || '',
        });
        setShowKycForm(true);
      } else {
        setKycSaved(false);
        setShowKycForm(false);
        setKycData({
          lieu_naissance: '',
          nationalite: '',
          profession: '',
          date_delivrance_piece: '',
          date_expiration_piece: '',
          autorite_delivrance: '',
          source_revenus: '',
          revenu_mensuel_estime: undefined,
          mode_paiement: '',
          banque: '',
          doc_piece_identite: false,
          doc_justificatif_domicile: false,
          doc_photo_client: false,
          doc_autre: '',
          documents_identite_urls: [],
          niveau_risque: undefined,
          commentaires_risque: '',
          declaration_client: false,
          agent_verificateur: undefined,
          date_verification: '',
        });
      }
    } catch (error) {
      console.error('Error loading KYC data:', error);
      setKycSaved(false);
      setShowKycForm(false);
    }
  };

  // Sauvegarder les données KYC
  const handleSaveKyc = async (): Promise<void> => {
    setIsSubmittingKyc(true);
    try {
      let targetClient = editingClient;

      // Si le client n'existe pas encore (mode création), on valide et crée d'abord le client
      if (!targetClient) {
        if (!validateForm()) {
          toast.error('Veuillez renseigner au moins le nom du client avant de sauvegarder le KYC');
          setIsSubmittingKyc(false);
          return;
        }
        targetClient = await createClient(formData);
        setEditingClient(targetClient);
        toast.success('Client créé avec succès');
      }

      const cleaned = formatKycDataForSave(kycData);
      await saveClientKyc(targetClient.id, cleaned);

      if (clientSignature && signatureDirty) {
        await signatureService.createSignature('client_kyc', targetClient.id, clientSignature, targetClient.id);
        setSignatureDirty(false);
      }

      setKycSaved(true);
      toast.success('Fiche KYC sauvegardée avec succès');
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || error.message || 'Erreur lors de la sauvegarde de la fiche KYC';
      toast.error(errorMessage);
      console.error('❌ Erreur KYC:', error);
    } finally {
      setIsSubmittingKyc(false);
    }
  };

  // Soumission du formulaire
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>): Promise<void> => {
    e.preventDefault();
    
    if (!validateForm()) {
      toast.error('Veuillez corriger les erreurs du formulaire');
      return;
    }

    setIsSubmitting(true);

    try {
      let client: Client;
      if (editingClient) {
        client = await updateClient(editingClient.id, formData);
        toast.success('Client mis à jour avec succès');
      } else {
        client = await createClient(formData);
        toast.success(`Client créé avec succès — code ${client.code_client}`);
      }

      // Sauvegarde automatique du KYC si des données ont été remplies
      const hasKycData = showKycForm || Object.entries(kycData).some(([_, val]) => {
        if (typeof val === 'boolean') return val === true;
        if (typeof val === 'number') return !isNaN(val);
        return val !== undefined && val !== null && String(val).trim() !== '';
      });

      if (hasKycData) {
        const cleaned = formatKycDataForSave(kycData);
        await saveClientKyc(client.id, cleaned);
        setKycSaved(true);
      }

      if (clientSignature && signatureDirty) {
        await signatureService.createSignature('client_kyc', client.id, clientSignature, client.id);
        setSignatureDirty(false);
      }

      closeModal();
    } catch (error: any) {
      const errorMessage = error.response?.data?.message || 'Une erreur est survenue';
      toast.error(errorMessage);
      console.error('❌ Erreur:', error);
    } finally {
      setIsSubmitting(false);
    }
  };

  // Ouvrir le modal d'ajout
  const openAddModal = (): void => {
    setEditingClient(null);
    setFormData(initialFormData);
    setFormErrors({});
    setClientSignature(null);
    setSignatureDirty(false);
    setKycSaved(false);
    setShowKycForm(false);
    setKycData({
      lieu_naissance: '',
      nationalite: '',
      profession: '',
      date_delivrance_piece: '',
      date_expiration_piece: '',
      autorite_delivrance: '',
      source_revenus: '',
      revenu_mensuel_estime: undefined,
      mode_paiement: '',
      banque: '',
      doc_piece_identite: false,
      doc_justificatif_domicile: false,
      doc_photo_client: false,
      doc_autre: '',
      documents_identite_urls: [],
      niveau_risque: undefined,
      commentaires_risque: '',
      declaration_client: false,
      agent_verificateur: undefined,
      date_verification: '',
    });
    setIsModalOpen(true);
    clientService.getNextClientCode()
      .then((code) => setFormData((prev) => (prev.code_client ? prev : { ...prev, code_client: code })))
      .catch((err) => console.error('❌ Erreur aperçu code client:', err));
  };

  // Ouvrir le modal de modification
  const openEditModal = async (client: Client): Promise<void> => {
    setEditingClient(client);
    setFormData({
      code_client: client.code_client || '',
      nom: client.nom,
      prenom: client.prenom || '',
      email: client.email || '',
      telephone: client.telephone || '',
      adresse: client.adresse || '',
      date_naissance: client.date_naissance || '',
      type_piece: client.type_piece || '',
      numero_piece: client.numero_piece || '',
      statut: client.statut || 'ACTIF',
      is_casino_player: client.is_casino_player || false,
    });
    setFormErrors({});
    setClientSignature(null);
    setSignatureDirty(false);
    
    // Load KYC data for existing clients
    await loadKycForClient(client.id);
    
    setIsModalOpen(true);
  };



  const handleDeleteClick = (client: Client): void => {
    setClientToDelete(client);
    setIsDeleteModalOpen(true);
  };

  const handleConfirmDelete = async (): Promise<void> => {
    if (!clientToDelete) return;
    
    setIsProcessing(true);
    try {
      const result = await deleteClient(clientToDelete.id);
      // Client avec historique (séjours, commandes, casino, paiements…) : retiré de la
      // liste sans changer son statut, historique conservé. Sinon : effacé.
      toast.success(result?.archived
        ? `Client supprimé de la liste. Son historique (${result.relatedCount ?? 'plusieurs'} enregistrement(s)) est conservé.`
        : 'Client supprimé définitivement');
      setIsDeleteModalOpen(false);
      setClientToDelete(null);
    } catch (error: any) {
      const errorMessage = error.response?.data?.error?.message || error.response?.data?.message || 'Erreur lors de la suppression';
      toast.error(errorMessage);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleView = async (client: Client): Promise<void> => {
    setSelectedClient(client);
    setIsViewModalOpen(true);

    try {
      const details = await loadClientWithDetails(client.id);
      // Load KYC data for view
      const kyc = await loadClientKyc(client.id);
      setViewKycData(kyc);
    } catch (err) {
      console.error('❌ Erreur chargement détails client:', err);
    }
  };

  const closeModal = (): void => {
    setIsModalOpen(false);
    setEditingClient(null);
    setFormData(initialFormData);
    setFormErrors({});
    setClientSignature(null);
    setSignatureDirty(false);
  };

  // Génération du QR Code
  const generateQRCode = async (client: Client) => {
    const clientData = {
      id: client.id,
      name: `${client.prenom} ${client.nom}`,
      email: client.email,
      phone: client.telephone,
      code: client.code_client,
      status: client.statut,
    };

    const jsonString = JSON.stringify(clientData);
    setQrCodeData(jsonString);
    setSelectedClient(client);
    setIsQRModalOpen(true);
    // QR code generation will be handled by useEffect after modal is rendered
  };

  const generateQRCodeImage = useCallback(async (data: string, client: Client) => {
    const canvas = qrCanvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const size = 200;
    
    try {
      // Generate real QR code using the qrcode library
      const qrDataUrl = await QRCode.toDataURL(data, {
        width: size,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      // Wait for image to load before drawing
      await new Promise<void>((resolve, reject) => {
        const img = new Image();
        img.onload = () => {
          ctx.fillStyle = '#ffffff';
          ctx.fillRect(0, 0, canvas.width, canvas.height);
          
          const startX = (canvas.width - size) / 2;
          const startY = (canvas.height - size) / 2;
          
          ctx.drawImage(img, startX, startY, size, size);
          resolve();
        };
        img.onerror = reject;
        img.src = qrDataUrl;
      });
    } catch (error) {
      console.error('Error generating QR code:', error);
      // Fallback to simple pattern if QR code generation fails
      const cellSize = 4;
      const margin = 20;
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      
      const qrMatrix = generateSimpleQRMatrix(data);
      const startX = (canvas.width - size) / 2;
      const startY = (canvas.height - size) / 2;

      for (let row = 0; row < qrMatrix.length; row++) {
        for (let col = 0; col < qrMatrix[row].length; col++) {
          if (qrMatrix[row][col] === 1) {
            ctx.fillStyle = '#000000';
            ctx.fillRect(
              startX + col * cellSize + margin,
              startY + row * cellSize + margin,
              cellSize,
              cellSize
            );
          }
        }
      }
    }

    ctx.fillStyle = '#000000';
    ctx.font = '12px Arial';
    ctx.textAlign = 'center';
    ctx.fillText(`Client: ${client.prenom || ''} ${client.nom}`.trim(), canvas.width / 2, canvas.height - 10);
  }, []);

  const generateSimpleQRMatrix = (data: string): number[][] => {
    const matrix: number[][] = [];
    const size = 45;
    
    for (let i = 0; i < size; i++) {
      matrix[i] = [];
      for (let j = 0; j < size; j++) {
        const hash = data.split('').reduce((acc, char, index) => {
          return acc + char.charCodeAt(0) * (index + 1);
        }, 0);
        
        const val = (i * j + hash) % 3;
        matrix[i][j] = val === 0 ? 1 : 0;
      }
    }
    
    return matrix;
  };

  // Generate QR code when modal opens and canvas is ready
  useEffect(() => {
    if (isQRModalOpen && selectedClient && qrCodeData) {
      // Small delay to ensure canvas is rendered
      const timer = setTimeout(() => {
        generateQRCodeImage(qrCodeData, selectedClient);
      }, 100);
      return () => clearTimeout(timer);
    }
  }, [isQRModalOpen, selectedClient, qrCodeData, generateQRCodeImage]);

  const copyQRData = () => {
    if (qrCodeData) {
      navigator.clipboard.writeText(qrCodeData);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    }
  };

  // Format carte de visite standard : 89 x 51 mm (≈ 3.5 x 2 po), rendu à 300 dpi.
  const CARD_WIDTH_MM = 89;
  const CARD_HEIGHT_MM = 51;
  const CARD_WIDTH_PX = 1050;
  const CARD_HEIGHT_PX = 600;

  // Compose la carte client (QR + infos) dans un canvas hors-écran, aux dimensions
  // exactes d'une carte de visite — réutilisé pour le téléchargement ET l'impression,
  // pour garantir que les deux rendus soient identiques et correctement proportionnés.
  const renderClientCard = async (client: Client, qrData: string): Promise<HTMLCanvasElement> => {
    const canvas = document.createElement('canvas');
    canvas.width = CARD_WIDTH_PX;
    canvas.height = CARD_HEIGHT_PX;
    const ctx = canvas.getContext('2d')!;

    // Fond + bordure
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.strokeStyle = '#dddddd';
    ctx.lineWidth = 4;
    ctx.strokeRect(2, 2, canvas.width - 4, canvas.height - 4);

    // Bandeau d'en-tête
    ctx.fillStyle = '#111111';
    ctx.fillRect(0, 0, canvas.width, 90);
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 34px Arial';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('CARTE CLIENT', 40, 45);

    // QR code à gauche - use real QR code library
    const qrSize = 380;
    const qrX = 40;
    const qrY = 150;

    try {
      const qrDataUrl = await QRCode.toDataURL(qrData, {
        width: qrSize,
        margin: 1,
        color: {
          dark: '#000000',
          light: '#ffffff'
        }
      });

      const img = new Image();
      await new Promise<void>((resolve, reject) => {
        img.onload = () => {
          ctx.drawImage(img, qrX, qrY, qrSize, qrSize);
          resolve();
        };
        img.onerror = reject;
        img.src = qrDataUrl;
      });
    } catch (error) {
      console.error('Error generating QR code for card:', error);
      // Fallback to simple pattern
      const qrMatrix = generateSimpleQRMatrix(qrData);
      const cell = qrSize / qrMatrix.length;
      ctx.fillStyle = '#000000';
      for (let row = 0; row < qrMatrix.length; row++) {
        for (let col = 0; col < qrMatrix[row].length; col++) {
          if (qrMatrix[row][col] === 1) {
            ctx.fillRect(qrX + col * cell, qrY + row * cell, cell, cell);
          }
        }
      }
    }

    // Informations client à droite du QR
    const infoX = qrX + qrSize + 50;
    let infoY = 190;
    ctx.textAlign = 'left';
    ctx.fillStyle = '#111111';
    ctx.font = 'bold 38px Arial';
    ctx.fillText(`${client.prenom || ''} ${client.nom}`.trim(), infoX, infoY);

    ctx.font = '25px Arial';
    ctx.fillStyle = '#444444';
    infoY += 55;
    ctx.fillText(client.code_client ? `Code : ${client.code_client}` : `ID : #${client.id}`, infoX, infoY);

    if (client.telephone) {
      infoY += 42;
      ctx.fillText(client.telephone, infoX, infoY);
    }
    if (client.email) {
      infoY += 42;
      ctx.font = '21px Arial';
      ctx.fillText(client.email, infoX, infoY);
    }

    return canvas;
  };

  const downloadQRCode = async () => {
    if (!selectedClient || !qrCodeData) return;
    const card = await renderClientCard(selectedClient, qrCodeData);
    const link = document.createElement('a');
    link.download = `carte-client-${selectedClient.code_client || selectedClient.id}.png`;
    link.href = card.toDataURL('image/png');
    link.click();
  };

  const printQRCode = async () => {
    if (!selectedClient || !qrCodeData) return;
    const card = await renderClientCard(selectedClient, qrCodeData);
    const dataUrl = card.toDataURL('image/png');

    // La carte (89 mm) est réduite à la largeur imprimable du rouleau thermique (72 mm) ;
    // l'impression attend le chargement de l'image.
    printThermal('Carte Client', `<img class="card" src="${dataUrl}" alt="Carte client" />`, {
      css: `body { padding: 2mm 0 6mm; } img.card { display: block; width: 100%; height: auto; filter: none; }`,
    });
  };

  const getStatusBadge = (status: string = 'ACTIF'): JSX.Element => {
    const statusMap: Record<string, { color: string; icon: JSX.Element; label: string }> = {
      ACTIF: { 
        color: 'bg-success-bg text-success border-success/30', 
        icon: <CheckCircle size={12} />,
        label: 'Actif'
      },
      INACTIF: { 
        color: 'bg-surface-2 text-muted border-base', 
        icon: <XCircle size={12} />,
        label: 'Inactif'
      },
      BLOCKED: { 
        color: 'bg-danger-bg text-danger border-danger/30', 
        icon: <XCircle size={12} />,
        label: 'Bloqué'
      }
    };
    
    const config = statusMap[status] || statusMap.ACTIF;
    return (
      <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-medium border ${config.color}`}>
        {config.icon}
        {config.label}
      </span>
    );
  };

  // Statistiques
  const stats = {
    total: clients.length,
    actifs: clients.filter(c => c.statut === 'ACTIF').length,
    inactifs: clients.filter(c => c.statut === 'INACTIF').length,
    blocked: clients.filter(c => c.statut === 'BLOCKED').length,
    casino: clients.filter(c => c.is_casino_player).length,
  };

  // Affichage du chargement
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <Loader size={40} className="animate-spin text-accent" />
        <span className="ml-3 text-muted">Chargement des clients...</span>
      </div>
    );
  }

  // Affichage de l'erreur
  if (error) {
    return (
      <div className="bg-danger/10 border border-danger/20 rounded-lg p-6 text-danger text-center">
        <AlertCircle size={40} className="mx-auto mb-3" />
        <p className="text-lg font-medium">{error}</p>
        <button 
          onClick={() => loadClients()}
          className="mt-3 px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent/90 transition"
        >
          Réessayer
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-20">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h2 className="text-primary text-2xl font-bold" style={{ fontFamily: 'Playfair Display, serif' }}>
            Gestion des Clients
          </h2>
          <p className="text-muted text-sm mt-1">Gérez les informations de vos clients</p>
        </div>
        <div className="flex items-center gap-3 flex-wrap">
          <button 
            onClick={() => loadClients()}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-surface-2 border border-base text-muted hover:text-primary text-sm transition-all"
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            <span className="hidden sm:inline">Actualiser</span>
          </button>
          
          {/* ✅ BOUTON D'AJOUT PRINCIPAL */}
          <button 
            onClick={openAddModal}
            className="flex items-center gap-2 px-4 py-2.5 rounded-xl bg-accent text-black hover:bg-accent-2 transition-all font-medium shadow-lg shadow-accent/20"
          >
            <UserPlus size={18} />
            <span>Ajouter un client</span>
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <div className="bg-surface border border-base rounded-xl p-4 text-center">
          <p className="text-muted text-xs mb-1">Total</p>
          <p className="text-primary font-bold text-xl">{stats.total}</p>
        </div>
        <div className="bg-success/5 border border-success/20 rounded-xl p-4 text-center">
          <p className="text-muted text-xs mb-1">Actifs</p>
          <p className="text-success font-bold text-xl">{stats.actifs}</p>
        </div>
        <div className="bg-muted/5 border border-muted/20 rounded-xl p-4 text-center">
          <p className="text-muted text-xs mb-1">Inactifs</p>
          <p className="text-muted font-bold text-xl">{stats.inactifs}</p>
        </div>
        <div className="bg-danger/5 border border-danger/20 rounded-xl p-4 text-center">
          <p className="text-muted text-xs mb-1">Bloqués</p>
          <p className="text-danger font-bold text-xl">{stats.blocked}</p>
        </div>
        <div className="bg-accent/5 border border-accent/20 rounded-xl p-4 text-center">
          <p className="text-muted text-xs mb-1">🎰 Casino</p>
          <p className="text-accent font-bold text-xl">{stats.casino}</p>
        </div>
      </div>

      {/* Recherche et filtres */}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1 relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-muted" size={18} />
          <input
            type="text"
            placeholder="Rechercher un client par nom, email ou téléphone..."
            value={searchTerm}
            onChange={(e) => {
              setSearchTerm(e.target.value);
              setCurrentPage(1);
            }}
            className="w-full pl-10 pr-4 py-2.5 bg-surface border border-base rounded-xl text-primary placeholder-muted focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            value={filterStatus}
            onChange={(e) => {
              setFilterStatus(e.target.value);
              setCurrentPage(1);
            }}
            className="px-4 py-2.5 bg-surface border border-base rounded-xl text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition"
          >
            <option value="tous">Tous les statuts</option>
            <option value="actif">Actifs</option>
            <option value="inactif">Inactifs</option>
            <option value="blocked">Bloqués</option>
          </select>
          
          {/* ✅ BOUTON D'AJOUT SECONDAIRE */}
          <button 
            onClick={openAddModal}
            className="px-4 py-2.5 bg-accent text-black rounded-xl transition flex items-center gap-2 hover:bg-accent-2 font-medium"
          >
            <Plus size={18} />
            <span className="hidden sm:inline">Ajouter</span>
          </button>
          
          <button 
            onClick={() => {
              setSearchTerm('');
              setFilterStatus('tous');
              loadClients();
            }}
            className="px-4 py-2.5 bg-surface border border-base rounded-xl text-muted hover:text-primary transition flex items-center gap-2"
          >
            <X size={18} />
            Réinitialiser
          </button>
        </div>
      </div>

      {/* Tableau des clients */}
      <div className="bg-surface border border-base rounded-2xl overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-base bg-surface-2">
                <th className="text-left p-4 text-muted font-medium text-sm">Client</th>
                <th className="text-left p-4 text-muted font-medium text-sm hidden lg:table-cell">Contact</th>
                <th className="text-left p-4 text-muted font-medium text-sm">Code</th>
                <th className="text-left p-4 text-muted font-medium text-sm">Statut</th>
                <th className="text-left p-4 text-muted font-medium text-sm">Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedClients.length === 0 ? (
                <tr>
                  <td colSpan={5} className="text-center py-12">
                    <div className="flex flex-col items-center gap-3">
                      <Users size={48} className="text-muted/30" />
                      <p className="text-muted">
                        {searchTerm || filterStatus !== 'tous' 
                          ? 'Aucun client ne correspond à vos critères'
                          : 'Aucun client trouvé'}
                      </p>
                      {!searchTerm && filterStatus === 'tous' && (
                        <button 
                          onClick={openAddModal}
                          className="px-4 py-2 bg-accent text-black rounded-lg hover:bg-accent-2 transition"
                        >
                          Ajouter votre premier client
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ) : (
                paginatedClients.map((client) => (
                  <tr key={client.id} className="border-b border-base hover:bg-surface-2 transition">
                    <td className="p-4">
                      <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold">
                          {client.nom.charAt(0).toUpperCase()}
                        </div>
                        <div>
                          <p className="font-medium text-primary">{client.nom} {client.prenom || ''}</p>
                          <p className="text-sm text-muted">{client.email || client.telephone || 'Aucun contact'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-4 hidden lg:table-cell">
                      <div className="space-y-1 text-sm">
                        {client.email && (
                          <p className="flex items-center gap-2 text-muted">
                            <Mail size={14} />
                            {client.email}
                          </p>
                        )}
                        {client.telephone && (
                          <p className="flex items-center gap-2 text-muted">
                            <Phone size={14} />
                            {client.telephone}
                          </p>
                        )}
                        {client.adresse && (
                          <p className="flex items-center gap-2 text-muted">
                            <MapPin size={14} />
                            {client.adresse}
                          </p>
                        )}
                      </div>
                    </td>
                    <td className="p-4">
                      <span className="font-mono text-sm bg-surface-2 px-2 py-1 rounded">
                        {client.code_client || `#${client.id}`}
                      </span>
                    </td>
                    <td className="p-4">
                      {getStatusBadge(client.statut)}
                    </td>
                    <td className="p-4">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleView(client)}
                          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg transition text-sm font-medium text-muted hover:text-primary flex items-center gap-1.5"
                          title="Voir les détails"
                        >
                          <Eye size={16} />
                          <span className="hidden sm:inline">Voir</span>
                        </button>
                        <button
                          onClick={() => openEditModal(client)}
                          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg transition text-sm font-medium text-muted hover:text-primary flex items-center gap-1.5"
                          title="Modifier le client"
                        >
                          <Edit size={16} />
                          <span className="hidden sm:inline">Modifier</span>
                        </button>
                        <button
                          onClick={() => generateQRCode(client)}
                          className="px-3 py-1.5 bg-surface-2 hover:bg-surface-3 rounded-lg transition text-sm font-medium text-muted hover:text-primary flex items-center gap-1.5"
                          title="Générer QR Code"
                        >
                          <QrCode size={16} />
                          <span className="hidden sm:inline">QR</span>
                        </button>
                        <button
                          onClick={() => handleDeleteClick(client)}
                          className="px-3 py-1.5 bg-danger/10 hover:bg-danger/20 rounded-lg transition text-sm font-medium text-danger flex items-center gap-1.5"
                          title="Supprimer le client"
                        >
                          <Trash2 size={16} />
                          <span className="hidden sm:inline">Supprimer</span>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-between p-4 border-t border-base">
            <p className="text-sm text-muted">
              Affichage de {startIndex + 1} à {Math.min(startIndex + itemsPerPage, filteredClients.length)} sur {filteredClients.length} clients
            </p>
            <div className="flex items-center gap-2">
              <button
                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                disabled={currentPage === 1}
                className="px-3 py-1.5 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Précédent
              </button>
              <span className="px-3 py-1.5 text-sm text-muted">
                Page {currentPage} sur {totalPages}
              </span>
              <button
                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                disabled={currentPage === totalPages}
                className="px-3 py-1.5 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Suivant
              </button>
            </div>
          </div>
        )}
      </div>

      {/* Modal d'ajout/modification */}
      {isModalOpen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-base p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-primary">
                {editingClient ? 'Modifier le client' : 'Ajouter un client'}
              </h3>
              <button
                onClick={closeModal}
                className="p-2 hover:bg-surface-2 rounded-lg transition text-muted hover:text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <form onSubmit={handleSubmit} className="p-6 space-y-4">
              <ClientCoreFormFields
                formData={formData}
                formErrors={formErrors}
                onChange={handleInputChange}
                isSubmitting={isSubmitting}
                signature={clientSignature}
                onSignatureChange={handleSignatureChange}
              />

              {/* KYC Form Section */}
              <div className="border-t border-base pt-4">
                <div className="flex items-center justify-between mb-4">
                  <div className="flex items-center gap-3">
                    <h4 className="text-lg font-semibold text-primary">Fiche KYC (Know Your Customer)</h4>
                    {kycSaved && (
                      <span className="px-2.5 py-0.5 bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 text-xs font-medium rounded-full flex items-center gap-1">
                        <Check size={12} />
                        KYC Enregistré
                      </span>
                    )}
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowKycForm(!showKycForm)}
                    className="px-3 py-1.5 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-sm font-medium text-muted hover:text-primary"
                  >
                    {showKycForm ? 'Masquer' : 'Afficher'}
                  </button>
                </div>

                {showKycForm && (
                  <div className="space-y-6">
                    {/* 1. Informations personnelles */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">1. Informations personnelles</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Date et lieu de naissance</label>
                          <input
                            type="text"
                            name="lieu_naissance"
                            value={kycData.lieu_naissance || ''}
                            onChange={handleKycInputChange}
                            placeholder="Lieu de naissance"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Nationalité</label>
                          <input
                            type="text"
                            name="nationalite"
                            value={kycData.nationalite || ''}
                            onChange={handleKycInputChange}
                            placeholder="Nationalité"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Profession</label>
                          <input
                            type="text"
                            name="profession"
                            value={kycData.profession || ''}
                            onChange={handleKycInputChange}
                            placeholder="Profession"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 2. Vérification d'identité */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">2. Vérification d'identité</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Date de délivrance</label>
                          <input
                            type="date"
                            name="date_delivrance_piece"
                            value={kycData.date_delivrance_piece || ''}
                            onChange={handleKycInputChange}
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Date d'expiration</label>
                          <input
                            type="date"
                            name="date_expiration_piece"
                            value={kycData.date_expiration_piece || ''}
                            onChange={handleKycInputChange}
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-primary mb-1">Autorité de délivrance</label>
                          <input
                            type="text"
                            name="autorite_delivrance"
                            value={kycData.autorite_delivrance || ''}
                            onChange={handleKycInputChange}
                            placeholder="Autorité de délivrance"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <IdentityDocumentsCapture
                          urls={kycData.documents_identite_urls || []}
                          onChange={(urls) => setKycData(prev => ({
                            ...prev,
                            documents_identite_urls: urls,
                            doc_piece_identite: urls.length > 0 ? true : prev.doc_piece_identite,
                          }))}
                          disabled={isSubmittingKyc}
                        />
                      </div>
                    </div>

                    {/* 3. Informations financières */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">3. Informations financières</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Source principale des revenus</label>
                          <input
                            type="text"
                            name="source_revenus"
                            value={kycData.source_revenus || ''}
                            onChange={handleKycInputChange}
                            placeholder="Source des revenus"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Revenu mensuel estimé</label>
                          <input
                            type="number"
                            name="revenu_mensuel_estime"
                            value={kycData.revenu_mensuel_estime || ''}
                            onChange={handleKycInputChange}
                            placeholder="Revenu mensuel"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Mode de paiement utilisé</label>
                          <input
                            type="text"
                            name="mode_paiement"
                            value={kycData.mode_paiement || ''}
                            onChange={handleKycInputChange}
                            placeholder="Mode de paiement"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Banque / Institution financière</label>
                          <input
                            type="text"
                            name="banque"
                            value={kycData.banque || ''}
                            onChange={handleKycInputChange}
                            placeholder="Banque"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 4. Documents justificatifs */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">4. Documents justificatifs</h5>
                      <div className="space-y-2">
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="doc_piece_identite"
                            checked={kycData.doc_piece_identite || false}
                            onChange={handleKycInputChange}
                            className="w-4 h-4 rounded border-base text-accent focus:ring-accent"
                            disabled={isSubmittingKyc}
                          />
                          <span className="text-sm text-primary">Copie de la pièce d'identité</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="doc_justificatif_domicile"
                            checked={kycData.doc_justificatif_domicile || false}
                            onChange={handleKycInputChange}
                            className="w-4 h-4 rounded border-base text-accent focus:ring-accent"
                            disabled={isSubmittingKyc}
                          />
                          <span className="text-sm text-primary">Justificatif de domicile</span>
                        </label>
                        <label className="flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            name="doc_photo_client"
                            checked={kycData.doc_photo_client || false}
                            onChange={handleKycInputChange}
                            className="w-4 h-4 rounded border-base text-accent focus:ring-accent"
                            disabled={isSubmittingKyc}
                          />
                          <span className="text-sm text-primary">Photo du client</span>
                        </label>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Autre document</label>
                          <input
                            type="text"
                            name="doc_autre"
                            value={kycData.doc_autre || ''}
                            onChange={handleKycInputChange}
                            placeholder="Autre document (optionnel)"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 5. Évaluation du risque */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">5. Évaluation du risque</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Niveau de risque</label>
                          <select
                            name="niveau_risque"
                            value={kycData.niveau_risque || ''}
                            onChange={handleKycInputChange}
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          >
                            <option value="">Sélectionner</option>
                            <option value="FAIBLE">Faible</option>
                            <option value="MOYEN">Moyen</option>
                            <option value="ELEVE">Élevé</option>
                          </select>
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-primary mb-1">Commentaires</label>
                          <textarea
                            name="commentaires_risque"
                            value={kycData.commentaires_risque || ''}
                            onChange={handleKycInputChange}
                            placeholder="Commentaires sur l'évaluation du risque"
                            rows={2}
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm resize-none"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                      </div>
                    </div>

                    {/* 6. Déclaration du client */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">6. Déclaration du client</h5>
                      <label className="flex items-start gap-2 cursor-pointer">
                        <input
                          type="checkbox"
                          name="declaration_client"
                          checked={kycData.declaration_client || false}
                          onChange={handleKycInputChange}
                          className="w-4 h-4 rounded border-base text-accent focus:ring-accent mt-0.5"
                          disabled={isSubmittingKyc}
                        />
                        <span className="text-sm text-primary">Je certifie que les informations fournies sont exactes et complètes.</span>
                      </label>
                    </div>

                    {/* 7. Validation du casino */}
                    <div className="space-y-3">
                      <h5 className="text-sm font-semibold text-accent uppercase tracking-wide">7. Validation du casino</h5>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Agent responsable (ID)</label>
                          <input
                            type="number"
                            name="agent_verificateur"
                            value={kycData.agent_verificateur || ''}
                            onChange={handleKycInputChange}
                            placeholder="ID de l'agent"
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-primary mb-1">Date de vérification</label>
                          <input
                            type="date"
                            name="date_verification"
                            value={kycData.date_verification || ''}
                            onChange={handleKycInputChange}
                            className="w-full px-3 py-2 bg-surface-2 border border-base rounded-lg text-primary focus:outline-none focus:ring-2 focus:ring-accent/50 transition text-sm"
                            disabled={isSubmittingKyc}
                          />
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center justify-between pt-4 border-t border-base">
                      <div>
                        {kycSaved && (
                          <div className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium bg-emerald-500/10 px-3 py-1.5 rounded-lg border border-emerald-500/20">
                            <Check size={14} />
                            Fiche KYC sauvegardée avec succès
                          </div>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={handleSaveKyc}
                        className="px-4 py-2 bg-accent text-black rounded-lg transition hover:bg-accent-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed font-medium"
                        disabled={isSubmittingKyc}
                      >
                        {isSubmittingKyc ? (
                          <>
                            <Loader size={16} className="animate-spin" />
                            Sauvegarde...
                          </>
                        ) : (
                          <>
                            <Check size={16} />
                            Sauvegarder KYC
                          </>
                        )}
                      </button>
                    </div>
                  </div>
                )}
              </div>

              {/* KYC Form Section */}

              <div className="flex justify-end gap-3 pt-4 border-t border-base">
                <button
                  type="button"
                  onClick={closeModal}
                  className="px-4 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-muted hover:text-primary"
                  disabled={isSubmitting}
                >
                  Annuler
                </button>
                <button
                  type="submit"
                  className="px-6 py-2 bg-accent text-black rounded-lg transition hover:bg-accent-2 flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isSubmitting}
                >
                  {isSubmitting ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      {editingClient ? 'Modification...' : 'Ajout...'}
                    </>
                  ) : (
                    <>
                      {editingClient ? 'Modifier' : 'Ajouter'}
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal de vue */}
      {isViewModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
            <div className="sticky top-0 bg-surface border-b border-base p-6 flex items-center justify-between">
              <h3 className="text-xl font-bold text-primary">Détails du client</h3>
              <button
                onClick={() => setIsViewModalOpen(false)}
                className="p-2 hover:bg-surface-2 rounded-lg transition text-muted hover:text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex items-start gap-4 mb-6">
                <div className="w-16 h-16 rounded-full bg-accent/20 flex items-center justify-center text-accent font-bold text-2xl">
                  {selectedClient.nom.charAt(0).toUpperCase()}
                </div>
                <div className="flex-1">
                  <h4 className="text-xl font-bold text-primary">
                    {selectedClient.nom} {selectedClient.prenom || ''}
                  </h4>
                  <p className="text-muted">{selectedClient.code_client || `#${selectedClient.id}`}</p>
                  {getStatusBadge(selectedClient.statut)}
                </div>
              </div>

              <div className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    {selectedClient.email && (
                      <p className="flex items-center gap-2 text-secondary">
                        <Mail size={16} className="text-muted" />
                        {selectedClient.email}
                      </p>
                    )}
                    {selectedClient.telephone && (
                      <p className="flex items-center gap-2 text-secondary">
                        <Phone size={16} className="text-muted" />
                        {selectedClient.telephone}
                      </p>
                    )}
                    {selectedClient.adresse && (
                      <p className="flex items-center gap-2 text-secondary">
                        <MapPin size={16} className="text-muted" />
                        {selectedClient.adresse}
                      </p>
                    )}
                  </div>
                  <div className="space-y-2">
                    {selectedClient.date_naissance && (
                      <p className="flex items-center gap-2 text-secondary">
                        <span className="text-muted">Né(e) le:</span>
                        {new Date(selectedClient.date_naissance).toLocaleDateString('fr-FR')}
                      </p>
                    )}
                    {selectedClient.type_piece && (
                      <p className="flex items-center gap-2 text-secondary">
                        <span className="text-muted">Pièce:</span>
                        {selectedClient.type_piece} - {selectedClient.numero_piece || 'N/A'}
                      </p>
                    )}
                    {selectedClient.is_casino_player && (
                      <p className="flex items-center gap-2 text-accent">
                        🎰 Joueur de casino
                      </p>
                    )}
                  </div>
                </div>
              </div>

              {/* KYC Information Display */}
              {viewKycData && (
                <div className="mt-6 pt-6 border-t border-base">
                  <h5 className="text-lg font-semibold text-primary mb-4">Fiche KYC</h5>
                  <div className="space-y-4">
                    {/* Informations personnelles */}
                    <div className="bg-surface-2 rounded-lg p-4">
                      <h6 className="text-sm font-semibold text-accent mb-2">Informations personnelles</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {viewKycData.lieu_naissance && (
                          <p className="text-secondary">
                            <span className="text-muted">Lieu de naissance:</span> {viewKycData.lieu_naissance}
                          </p>
                        )}
                        {viewKycData.nationalite && (
                          <p className="text-secondary">
                            <span className="text-muted">Nationalité:</span> {viewKycData.nationalite}
                          </p>
                        )}
                        {viewKycData.profession && (
                          <p className="text-secondary">
                            <span className="text-muted">Profession:</span> {viewKycData.profession}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Vérification d'identité */}
                    <div className="bg-surface-2 rounded-lg p-4">
                      <h6 className="text-sm font-semibold text-accent mb-2">Vérification d'identité</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {viewKycData.date_delivrance_piece && (
                          <p className="text-secondary">
                            <span className="text-muted">Date de délivrance:</span> {new Date(viewKycData.date_delivrance_piece).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {viewKycData.date_expiration_piece && (
                          <p className="text-secondary">
                            <span className="text-muted">Date d'expiration:</span> {new Date(viewKycData.date_expiration_piece).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {viewKycData.autorite_delivrance && (
                          <p className="text-secondary md:col-span-2">
                            <span className="text-muted">Autorité de délivrance:</span> {viewKycData.autorite_delivrance}
                          </p>
                        )}
                      </div>
                      {(viewKycData.documents_identite_urls?.length ?? 0) > 0 && (
                        <div className="mt-3 grid grid-cols-2 sm:grid-cols-3 gap-2">
                          {viewKycData.documents_identite_urls!.map((url, index) => (
                            <a key={`${url}-${index}`} href={identityDocumentUrl(url)} target="_blank" rel="noreferrer" className="block rounded-lg border border-base overflow-hidden hover:opacity-80 transition">
                              {url.toLowerCase().endsWith('.pdf') ? (
                                <div className="h-20 flex items-center justify-center text-xs text-accent">Voir le PDF {index + 1}</div>
                              ) : (
                                <img src={identityDocumentUrl(url)} alt={`Pièce d'identité ${index + 1}`} className="h-20 w-full object-cover" />
                              )}
                            </a>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Informations financières */}
                    <div className="bg-surface-2 rounded-lg p-4">
                      <h6 className="text-sm font-semibold text-accent mb-2">Informations financières</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {viewKycData.source_revenus && (
                          <p className="text-secondary">
                            <span className="text-muted">Source des revenus:</span> {viewKycData.source_revenus}
                          </p>
                        )}
                        {viewKycData.revenu_mensuel_estime && (
                          <p className="text-secondary">
                            <span className="text-muted">Revenu mensuel estimé:</span> {Number(viewKycData.revenu_mensuel_estime).toLocaleString('fr-FR')} Ar
                          </p>
                        )}
                        {viewKycData.mode_paiement && (
                          <p className="text-secondary">
                            <span className="text-muted">Mode de paiement:</span> {viewKycData.mode_paiement}
                          </p>
                        )}
                        {viewKycData.banque && (
                          <p className="text-secondary">
                            <span className="text-muted">Banque:</span> {viewKycData.banque}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Documents justificatifs */}
                    <div className="bg-surface-2 rounded-lg p-4">
                      <h6 className="text-sm font-semibold text-accent mb-2">Documents justificatifs</h6>
                      <div className="space-y-1 text-sm">
                        {viewKycData.doc_piece_identite && (
                          <p className="text-secondary">✓ Copie de la pièce d'identité</p>
                        )}
                        {viewKycData.doc_justificatif_domicile && (
                          <p className="text-secondary">✓ Justificatif de domicile</p>
                        )}
                        {viewKycData.doc_photo_client && (
                          <p className="text-secondary">✓ Photo du client</p>
                        )}
                        {viewKycData.doc_autre && (
                          <p className="text-secondary">Autre: {viewKycData.doc_autre}</p>
                        )}
                      </div>
                    </div>

                    {/* Évaluation du risque */}
                    <div className="bg-surface-2 rounded-lg p-4">
                      <h6 className="text-sm font-semibold text-accent mb-2">Évaluation du risque</h6>
                      <div className="space-y-2 text-sm">
                        {viewKycData.niveau_risque && (
                          <p className="text-secondary">
                            <span className="text-muted">Niveau de risque:</span> 
                            <span className={`ml-2 px-2 py-0.5 rounded text-xs font-medium ${
                              viewKycData.niveau_risque === 'FAIBLE' ? 'bg-success-bg text-success' :
                              viewKycData.niveau_risque === 'MOYEN' ? 'bg-warning-bg text-warning' :
                              'bg-danger-bg text-danger'
                            }`}>
                              {viewKycData.niveau_risque === 'FAIBLE' ? 'Faible' :
                               viewKycData.niveau_risque === 'MOYEN' ? 'Moyen' : 'Élevé'}
                            </span>
                          </p>
                        )}
                        {viewKycData.commentaires_risque && (
                          <p className="text-secondary">
                            <span className="text-muted">Commentaires:</span> {viewKycData.commentaires_risque}
                          </p>
                        )}
                      </div>
                    </div>

                    {/* Validation du casino */}
                    <div className="bg-surface-2 rounded-lg p-4">
                      <h6 className="text-sm font-semibold text-accent mb-2">Validation du casino</h6>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-2 text-sm">
                        {viewKycData.agent_verificateur && (
                          <p className="text-secondary">
                            <span className="text-muted">Agent responsable (ID):</span> {viewKycData.agent_verificateur}
                          </p>
                        )}
                        {viewKycData.date_verification && (
                          <p className="text-secondary">
                            <span className="text-muted">Date de vérification:</span> {new Date(viewKycData.date_verification).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {viewKycData.declaration_client && (
                          <p className="text-secondary md:col-span-2 text-success">
                            ✓ Déclaration du client certifiée
                          </p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-3 pt-4 border-t border-base flex-wrap">
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    generateQRCode(selectedClient);
                  }}
                  className="px-4 py-2 bg-success-bg hover:bg-success/20 rounded-lg transition flex items-center gap-2 border border-success/30 text-success"
                >
                  <QrCode size={16} />
                  QR Code
                </button>
                <button
                  onClick={() => setIsViewModalOpen(false)}
                  className="px-4 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-muted hover:text-primary"
                >
                  Fermer
                </button>
                <button
                  onClick={() => {
                    setIsViewModalOpen(false);
                    openEditModal(selectedClient);
                  }}
                  className="px-4 py-2 bg-accent text-black rounded-lg transition hover:bg-accent-2 flex items-center gap-2"
                >
                  <Edit size={16} />
                  Modifier
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal QR Code */}
      {isQRModalOpen && selectedClient && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-base flex items-center justify-between">
              <h3 className="text-xl font-bold text-primary">QR Code Client</h3>
              <button
                onClick={() => setIsQRModalOpen(false)}
                className="p-2 hover:bg-surface-2 rounded-lg transition text-muted hover:text-primary"
              >
                <X size={20} />
              </button>
            </div>
            <div className="p-6">
              <div className="flex flex-col items-center gap-4">
                <canvas 
                  ref={qrCanvasRef} 
                  width={250} 
                  height={250}
                  className="border border-base rounded-lg"
                />
                <div className="flex gap-2 w-full">
                  <button
                    onClick={copyQRData}
                    className="flex-1 px-4 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition flex items-center justify-center gap-2"
                  >
                    {copied ? <Check size={16} /> : <Copy size={16} />}
                    {copied ? 'Copié' : 'Copier'}
                  </button>
                  <button
                    onClick={downloadQRCode}
                    className="flex-1 px-4 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition flex items-center justify-center gap-2"
                  >
                    <Download size={16} />
                    Télécharger
                  </button>
                  <button
                    onClick={printQRCode}
                    className="flex-1 px-4 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition flex items-center justify-center gap-2"
                  >
                    <Printer size={16} />
                    Imprimer
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Modal de confirmation de suppression */}
      {isDeleteModalOpen && clientToDelete && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
          <div className="bg-surface rounded-2xl w-full max-w-md">
            <div className="p-6 border-b border-base">
              <h3 className="text-xl font-bold text-primary">Confirmer la suppression</h3>
            </div>
            <div className="p-6">
              <p className="text-muted mb-4">
                Êtes-vous sûr de vouloir supprimer le client <strong>{clientToDelete.nom} {clientToDelete.prenom || ''}</strong> ?
              </p>
              <p className="text-sm text-danger mb-6">
                ⚠️ Le client sera retiré de la liste et des recherches. S’il a un historique (séjours, commandes, casino, paiements…), cet historique est conservé.
              </p>
              <div className="flex justify-end gap-3">
                <button
                  onClick={() => setIsDeleteModalOpen(false)}
                  className="px-4 py-2 bg-surface-2 border border-base rounded-lg hover:bg-surface-3 transition text-muted hover:text-primary"
                  disabled={isProcessing}
                >
                  Annuler
                </button>
                <button
                  onClick={handleConfirmDelete}
                  className="px-4 py-2 bg-danger text-white rounded-lg hover:bg-danger/90 transition flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={isProcessing}
                >
                  {isProcessing ? (
                    <>
                      <Loader size={16} className="animate-spin" />
                      Traitement...
                    </>
                  ) : (
                    <>
                      <Trash2 size={16} />
                      Supprimer
                    </>
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ClientsPage;