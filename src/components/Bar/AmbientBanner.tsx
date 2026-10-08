import React from 'react';
import { Music } from 'lucide-react';

export const AmbientBanner: React.FC = () => (
  <div className="relative overflow-hidden rounded-2xl bg-surface border border-base p-6 card-gold-hover">
    <div className="flex items-center gap-4">
      <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
        <Music size={24} className="text-black" />
      </div>
      <div>
        <h3 className="text-primary font-semibold">HDA Lounge — Ambiance Jazz Live</h3>
        <p className="text-muted text-sm">Ouvert de 17h à 2h • DJ & Artistes live le week-end</p>
      </div>
      <div className="ml-auto hidden md:flex items-center gap-2 text-accent">
        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
        <span className="text-sm font-medium">En direct</span>
      </div>
    </div>
  </div>
);