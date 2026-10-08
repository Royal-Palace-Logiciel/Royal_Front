export type CasinoView = 'table' | 'setup' | 'players' | 'chips' | 'final' | 'management' | 'caisse' | 'report' | 'results';

export interface IdentityVerificationData {
  fullName: string;
  idType: string;
  idNumber: string;
  issueDate: string;
  transactionType: 'achat' | 'apport' | 'echange';
  amount: number;
  verifiedAt: string;
}

export type PlayerLine = {
  id: number;
  ficheId?: number;
  casinoPlayerId?: number;
  casinoPlayerGameId?: number;
  time: string;
  playerTime: string;
  name: string;
  surnom: string;
  whatsapp: string;
  initialDeposit: string;
  initialCredit: string;
  member: string;
  arrival: string;
  caves: string;
  amount: string;
  total: string;
  accumulated: string;
  payment: string;
  paymentMethod: string;
  bonuses: string;
  bonusResults: string;
  bonusSignature: string;
  resultPaymentOptions: string;
  signature: string;
  finalSignature: string;
  departure: string;
  cashing: string;
  identityVerification?: string;
};

export type ChipLine = {
  value: number;
  previous: string;
  opening: string;
  closing: string;
  withdrawn: string;
};

export type RackCheck = {
  id: number;
  date?: string;
  time: string;
  type: 'Entrée' | 'Contrôle périodique' | 'Sortie' | 'Retour croupier' | 'Sortie croupier' | 'Rajout bureau' | 'Contrôle' | 'Cash check' | 'Rack check entrée' | 'Rack check sortie' | 'Rack check périodique';
  expected: number;
  actual: string;
  missing: string;
  verified: boolean;
  amount?: string;
  variance?: string;
  croupierEntrant?: string;
  croupierSortant?: string;
  validatedBy?: string;
  validatedAt?: string;
};

export const CHIP_VALUES = [1000, 2000, 5000, 10000, 20000, 50000, 100000, 500000, 1000000];
export const casinoCurrency = new Intl.NumberFormat('fr-FR');
export const casinoBorder = { borderColor: 'var(--color-border)' };
export const casinoInput = 'w-full min-w-0 bg-transparent px-2 py-2 text-xs text-primary outline-none placeholder:text-muted';
export const IDENTITY_VERIFICATION_THRESHOLD = 3_000_000;

const normalizeListAmountToken = (token: string): number => {
  const cleaned = token.replace(/[•·▪◆]/g, '').replace(/\s+/g, '').trim();
  if (!cleaned) return 0;

  const digits = cleaned.replace(/[^\d,.-]/g, '');
  if (!digits) return 0;

  if (digits.includes(',') && digits.includes('.')) {
    const lastComma = digits.lastIndexOf(',');
    const lastDot = digits.lastIndexOf('.');
    const decimalSeparator = lastComma > lastDot ? ',' : '.';
    return Number(decimalSeparator === ','
      ? digits.replace(/\./g, '').replace(',', '.')
      : digits.replace(/,/g, ''));
  }

  if (digits.includes(',')) {
    const lastComma = digits.lastIndexOf(',');
    const decimals = digits.slice(lastComma + 1);
    if (decimals.length === 3 && /\d{1,3}(?:[.,]\d{3})+/.test(digits)) {
      return Number(digits.replace(/,/g, ''));
    }
    return Number(digits.replace(',', '.'));
  }

  if (digits.includes('.')) {
    const lastDot = digits.lastIndexOf('.');
    const decimals = digits.slice(lastDot + 1);
    if (decimals.length === 3 && /\d{1,3}(?:[.,]\d{3})+/.test(digits)) {
      return Number(digits.replace(/\./g, ''));
    }
    return Number(digits);
  }

  return Number(digits);
};

export const parseCasinoAmount = (value: string | number | null | undefined): number => {
  const text = String(value ?? '').trim();
  if (!text) return 0;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (!lines.length) return 0;

  return lines.reduce((total, line) => {
    const tokens = line.match(/-?\d{1,3}(?:[.,\s]\d{3})+|-?\d+(?:[.,]\d+)?/g) ?? [line];
    const amount = tokens.reduce((sum, token) => sum + normalizeListAmountToken(token), 0);
    return total + amount;
  }, 0);
};

export const createPlayerLine = (id: number, ficheId = id): PlayerLine => ({
  id,
  ficheId,
  time: '',
  playerTime: '',
  name: '',
  surnom: '',
  whatsapp: '',
  initialDeposit: '',
  initialCredit: '',
  member: '',
  arrival: '',
  caves: '',
  amount: '',
  total: '',
  accumulated: '',
  payment: 'Payé',
  paymentMethod: '',
  bonuses: '',
  bonusResults: '',
  bonusSignature: '',
  resultPaymentOptions: '',
  signature: '',
  finalSignature: '',
  departure: '',
  cashing: '',
});
