import api from '../lib/api';

export interface RHEmployee { id: number; matricule: string; first_name: string; last_name: string; department: string; position: string; joined_at: string; contract_type: string; qualification?: string | null; cnaps_number?: string | null; dependents?: number; salary: number; prime?: number; pourboire?: number; cnaps?: number; ostie?: number; irsa?: number; presence_days?: number; face_samples?: number; face_consent_at?: string | null; status: string; photo_url?: string | null; birth_date?: string | null; phone?: string | null; address?: string | null; email?: string | null; identification_number?: string | null; contract_end_date?: string | null; departure_date?: string | null; departure_reason?: string | null; }
export type RHDocumentType = 'CIN' | 'RESIDENCE' | 'CV' | 'CONTRAT';
export interface RHDocument { id: number; employee_id: number; doc_type: RHDocumentType; original_name: string; mime_type: string; file_size: number; created_at: string; }
export interface RHDepartmentBudget { department: string; headcount: number; monthly_budget: number; budget: number; actual: number; net: number; to_pay: number; paid: number; remaining: number; usage: number | null; }
export interface RHEmployeeMeta { page: number; limit: number; total: number; totalPages: number; statusCounts: Record<string, number>; grandTotal: number; }
export interface RHDashboard { total: number; active: number; absent: number; onLeave: number; payrollTotal: number; pendingLeave: number; departments: Array<{ department: string; total: number }>; expiringContracts: Array<{ id: number; matricule: string; first_name: string; last_name: string; contract_end_date: string }>; }
export interface RHFacePunch { action: 'CHECK_IN' | 'CHECK_OUT' | 'ALREADY_DONE' | 'TOO_SOON' | 'UNKNOWN' | 'AMBIGUOUS'; employee?: { id: number; first_name: string; last_name: string; matricule: string }; attendance?: RHAttendance; }
export interface RHAttendance { id?: number; attendance_id?: number | null; check_in_method?: 'MANUEL' | 'VISAGE' | null; check_out_method?: 'MANUEL' | 'VISAGE' | null; has_check_in_photo?: number | boolean; has_check_out_photo?: number | boolean; employee_id: number; matricule?: string; first_name?: string; last_name?: string; department?: string; attendance_date?: string; check_in?: string | null; check_out?: string | null; status?: string; attendance_status?: string; notes?: string | null; }
export interface RHPayroll { id: number; employee_id: number; matricule: string; first_name: string; last_name: string; contract_type?: string; base_salary: number; overtime_amount: number; bonuses: number; pourboire?: number; allowances: number; advances: number; deductions: number; absence_deductions?: number; deduction_amount?: number; deduction_frequency?: 'MENSUEL' | 'HEBDOMADAIRE'; deduction_reason?: string | null; cnaps?: number; ostie?: number; irsa?: number; presence_days?: number | null; net_amount: number; status: string; period_month: string; }
export interface RHLeave { id: number; employee_id: number; first_name: string; last_name: string; leave_type: string; start_date: string; end_date: string; days: number; reason?: string; status: string; annual_remaining?: number; }
export interface RHEvaluation { id: number; employee_id: number; first_name?: string; last_name?: string; matricule?: string; department?: string; period: string; score?: number; comment?: string; evaluation_date: string; status: string; }
export interface Page<T> { rows: T[]; meta?: { page: number; limit: number; total: number; totalPages: number; period?: string }; }
const page = <T>(response: any): Page<T> => ({ rows: response.data.data, meta: response.data.meta });

const rhService = {
  async getDashboard() { return (await api.get('/api/rh/dashboard')).data.data as RHDashboard; },
  async listEmployees(params?: Record<string, unknown>) { return page<RHEmployee>(await api.get('/api/rh/employees', { params })); },
  async getEmployee(id: number) { return (await api.get(`/api/rh/employees/${id}`)).data.data as RHEmployee; },
  async createEmployee(payload: Record<string, unknown>) { return (await api.post('/api/rh/employees', payload)).data.data as RHEmployee; },
  async updateEmployee(id: number, payload: Record<string, unknown>) { return (await api.put(`/api/rh/employees/${id}`, payload)).data.data as RHEmployee; },
  async offboardEmployee(id: number, reason: string) { return (await api.post(`/api/rh/employees/${id}/offboard`, { reason })).data.data as RHEmployee; },
  async listLeaveRequests(params?: Record<string, unknown>) { return page<RHLeave>(await api.get('/api/rh/leave-requests', { params })); },
  async createLeaveRequest(payload: Record<string, unknown>) { return (await api.post('/api/rh/leave-requests', payload)).data.data as RHLeave; },
  async updateLeaveStatus(id: number, status: 'APPROUVE' | 'REFUSE' | 'ANNULE') { return (await api.patch(`/api/rh/leave-requests/${id}/status`, { status })).data.data as RHLeave; },
  async listAttendance(params?: Record<string, unknown>) { return page<RHAttendance>(await api.get('/api/rh/attendance', { params })); },
  async checkIn(employee_id: number) { return (await api.post('/api/rh/attendance/check-in', { employee_id })).data.data; },
  async checkOut(employee_id: number) { return (await api.post('/api/rh/attendance/check-out', { employee_id })).data.data; },
  // --- Reconnaissance faciale (admin) ---
  async facePunch(descriptor: number[], photo: string) { return (await api.post('/api/rh/attendance/face-punch', { descriptor, photo })).data.data as RHFacePunch; },
  async enrollFace(employeeId: number, descriptors: number[][]) { return (await api.put(`/api/rh/employees/${employeeId}/face`, { descriptors, consent: true })).data.data as { face_samples: number }; },
  async deleteFace(employeeId: number) { await api.delete(`/api/rh/employees/${employeeId}/face`); },
  async attendancePhoto(attendanceId: number, kind: 'in' | 'out') { return (await api.get(`/api/rh/attendance/${attendanceId}/photo/${kind}`, { responseType: 'blob' })).data as Blob; },
  async listPayroll(params?: Record<string, unknown>) { return page<RHPayroll>(await api.get('/api/rh/payroll', { params })); },
  async generatePayroll(period: string) { return page<RHPayroll>(await api.post(`/api/rh/payroll/${period}/generate`)); },
  async updatePayroll(id: number, payload: Record<string, unknown>) { return (await api.patch(`/api/rh/payroll/${id}`, payload)).data.data as RHPayroll; },
  async updatePayrollStatus(id: number, status: 'VALIDE' | 'PAYE') { return (await api.patch(`/api/rh/payroll/${id}/status`, { status })).data.data as RHPayroll; },
  async deleteEmployee(id: number) { await api.delete(`/api/rh/employees/${id}`); },
  async deletePayroll(id: number) { await api.delete(`/api/rh/payroll/${id}`); },
  async downloadPayslip(period: string, employeeId: number) { return api.get(`/api/rh/payroll/${period}/payslip/${employeeId}`, { responseType: 'blob' }); },
  async listEvaluations(params?: Record<string, unknown>) { return page<RHEvaluation>(await api.get('/api/rh/evaluations', { params })); },
  async listBudgets(params: { from: string; to: string }) { const r = await api.get('/api/rh/budgets', { params }); return { rows: r.data.data as RHDepartmentBudget[], months: Number(r.data.meta?.months || 1) }; },
  async updateBudget(department: string, monthly_budget: number) { return (await api.put(`/api/rh/budgets/${encodeURIComponent(department)}`, { monthly_budget })).data.data as { department: string; monthly_budget: number }; },
  async listDocuments(employeeId: number) { return (await api.get(`/api/rh/employees/${employeeId}/documents`)).data.data as RHDocument[]; },
  async uploadDocument(employeeId: number, docType: RHDocumentType, file: File) {
    const formData = new FormData();
    formData.append('doc_type', docType);
    formData.append('file', file);
    // Laisse le navigateur poser le Content-Type multipart avec sa boundary.
    // timeout 0 : pas de limite de taille, un gros fichier peut dépasser les 30 s par défaut.
    return (await api.post(`/api/rh/employees/${employeeId}/documents`, formData, { headers: { 'Content-Type': undefined }, timeout: 0 })).data.data as RHDocument;
  },
  async downloadDocument(employeeId: number, documentId: number) { return (await api.get(`/api/rh/employees/${employeeId}/documents/${documentId}`, { responseType: 'blob', timeout: 0 })).data as Blob; },
  async deleteDocument(employeeId: number, documentId: number) { await api.delete(`/api/rh/employees/${employeeId}/documents/${documentId}`); },
  // --- Espace personnel : limité à sa propre fiche, pour tout utilisateur connecté ---
  async getMyProfile() { return (await api.get('/api/rh/me')).data.data as RHEmployee; },
  async listMyLeaveRequests(params?: Record<string, unknown>) { return page<RHLeave>(await api.get('/api/rh/me/leave-requests', { params })); },
  async createMyLeaveRequest(payload: { leave_type: string; start_date: string; end_date: string; reason?: string }) { return (await api.post('/api/rh/me/leave-requests', payload)).data.data as RHLeave; },
  async listMyAttendance(params?: Record<string, unknown>) { return page<RHAttendance>(await api.get('/api/rh/me/attendance', { params })); },
};
export default rhService;
