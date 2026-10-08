import api from '../lib/api';

export type PaymentMethod = 'ESPECES' | 'CREDIT' | 'TPE' | 'ORANGE_MONEY' | 'MVOLA' | 'GRATUIT';
export type PafGender = 'Homme' | 'Femme' | 'Mixte';

export type PafTicketDetail = {
  price: number;
  gender: 'Homme' | 'Femme';
  qty: number;
};

export type PafOperation = {
  id: number;
  date: string;
  gender: PafGender;
  price: number;
  paymentMethod: PaymentMethod;
  details: PafTicketDetail[];
  statut: 'OUVERTE' | 'CLOTUREE';
  sessionId: number;
  clotureId: number | null;
  userId: number | null;
};

export type PafSummary = {
  totalTickets: number;
  totalAmount: number;
  homme: number;
  femme: number;
  byPrice: Array<{ price: number; count: number; amount: number }>;
  byPayment: Record<PaymentMethod, number>;
  totalInitial?: number;
  totalFinal?: number;
};

export type PafClosure = {
  id: number;
  reference: string;
  date: string;
  dateCloture: string;
  sessionId: number;
  createdBy: number | null;
  summary: PafSummary;
  operations?: PafOperation[];
};

export type PafCurrent = {
  session: { id: number; date_session: string; statut: 'OUVERTE' };
  operations: PafOperation[];
  summary: PafSummary;
};

type ApiResponse<T> = { data: T };

export const getPafCurrent = () =>
  api.get<ApiResponse<PafCurrent>>('/api/paf/current').then((response) => response.data.data);

export const createPafOperation = (payload: { details: PafTicketDetail[]; paymentMethod: PaymentMethod }) =>
  api.post<ApiResponse<PafOperation>>('/api/paf/operations', payload).then((response) => response.data.data);

export const updatePafOperation = (id: number, payload: { details: PafTicketDetail[]; paymentMethod: PaymentMethod }) =>
  api.put<ApiResponse<PafOperation>>(`/api/paf/operations/${id}`, payload).then((response) => response.data.data);

export const deletePafOperation = (id: number) =>
  api.delete(`/api/paf/operations/${id}`);

export const closePafDay = () =>
  api.post<ApiResponse<{ closure: PafClosure; currentSession: PafCurrent['session']; currentSummary: PafSummary }>>('/api/paf/close').then((response) => response.data.data);

export const getPafClosures = () =>
  api.get<ApiResponse<PafClosure[]>>('/api/paf/closures').then((response) => response.data.data);

export const getPafHistory = () =>
  api.get<ApiResponse<PafClosure[]>>('/api/paf/history').then((response) => response.data.data);

export const getPafClosure = (id: number) =>
  api.get<ApiResponse<PafClosure>>(`/api/paf/closures/${id}`).then((response) => response.data.data);
