// src/services/upload.service.ts
import api from '../lib/api';

export interface UploadedFile {
  url: string;
  filename: string;
  size: number;
}

export const uploadService = {
  async uploadFile(file: File): Promise<UploadedFile> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await api.post('/api/uploads', formData, {
      // Laisse le navigateur définir le Content-Type multipart avec sa
      // boundary : l'instance axios force "application/json" par défaut,
      // ce qui casserait le parsing du fichier côté serveur si on le laissait.
      headers: { 'Content-Type': undefined },
    });
    return response.data.data as UploadedFile;
  },
};

export default uploadService;
