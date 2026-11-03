'use client';

import React from 'react';

export const TrackingHUD: React.FC<{ targetRef?: any }> = () => {
  return (
    // Cuadro 2D overlay de visión artificial fijado a la pantalla (sin alambre 3D)
    <div className="absolute inset-8 pointer-events-none z-10 flex flex-col justify-between">
      {/* Esquinas superiores */}
      <div className="flex justify-between">
        <div className="w-8 h-8 border-t-2 border-l-2 border-white/70" />
        <div className="w-8 h-8 border-t-2 border-r-2 border-white/70" />
      </div>

      {/* Esquinas inferiores */}
      <div className="flex justify-between">
        <div className="w-8 h-8 border-b-2 border-l-2 border-white/70" />
        <div className="w-8 h-8 border-b-2 border-r-2 border-white/70" />
      </div>
    </div>
  );
};