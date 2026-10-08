import api from '../lib/api';

export interface PlanningAssignment {
  slot: number;
  employeeId: number | null;
  employeeName: string;
  schedule: string;
}

export interface DailyPlanning {
  date: string;
  category: string;
  assignments: PlanningAssignment[];
}

const planningService = {
  async getDaily(date: string, category: string) {
    return (await api.get('/api/planning', { params: { date, category } })).data.data as DailyPlanning;
  },
  async saveDaily(payload: DailyPlanning) {
    return (await api.put('/api/planning', payload)).data.data as DailyPlanning;
  },
};

export default planningService;
