// src/vite-env.d.ts
/// <reference types="vite/client" />

interface ImportMetaEnv {
  readonly VITE_API_URL: string;
  readonly VITE_ENV: string;
  readonly VITE_FRONTEND_URL: string;
  // Ajoutez ici toutes vos variables d'environnement Vite
}

interface ImportMeta {
  readonly env: ImportMetaEnv;
}