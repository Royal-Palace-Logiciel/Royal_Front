import React from 'react';
import { Wine } from 'lucide-react';

interface BarHeaderProps {
  title?: string;
  subtitle?: string;
}

export const BarHeader: React.FC<BarHeaderProps> = ({
  title = 'Bar & Lounge',
  subtitle = 'Cocktails premium & service bar',
}) => (
  <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
    <div>
      <h2
        className="text-primary text-xl sm:text-2xl md:text-3xl font-bold"
        style={{ fontFamily: 'Playfair Display, serif' }}
      >
        {title}
      </h2>
      <p className="text-muted text-xs sm:text-sm mt-1">{subtitle}</p>
    </div>
    <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center flex-shrink-0">
      <Wine size={24} className="text-black" />
    </div>
  </div>
);