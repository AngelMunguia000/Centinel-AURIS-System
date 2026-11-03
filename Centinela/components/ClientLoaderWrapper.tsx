'use client';

import React, { useState, useEffect } from 'react';
import Loader from './Loader';

// Marca por pestaña: el splash de pantalla completa solo se muestra en la
// primera visita de la sesión, no en cada carga de ruta (decisión del PO,
// 2026-09-21).
const LOADER_SEEN_KEY = 'centinela:loader-visto';

// sessionStorage puede lanzar (ventana privada, datos bloqueados): en ese caso
// se comporta como antes, mostrando el splash.
function yaVisto(): boolean {
  try {
    return sessionStorage.getItem(LOADER_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function marcarVisto() {
  try {
    sessionStorage.setItem(LOADER_SEEN_KEY, '1');
  } catch {
    // sin storage disponible: el splash volverá a mostrarse, sin más consecuencias
  }
}

export default function ClientLoaderWrapper({
  children,
}: {
  children: React.ReactNode;
}) {
  const [isLoading, setIsLoading] = useState(true);
  const [fadeOut, setFadeOut] = useState(false);

  useEffect(() => {
    const repetida = yaVisto();
    const timers: ReturnType<typeof setTimeout>[] = [];

    if (repetida) {
      // Visita repetida: se retira ya, sin animación (en un timer de 0ms, no
      // sincrónico, para no disparar setState dentro del efecto).
      timers.push(setTimeout(() => setIsLoading(false), 0));
    } else {
      marcarVisto();
      // 2.8 segundos para que la animación Pop se complete
      timers.push(
        setTimeout(() => {
          setFadeOut(true); // Inicia el desvanecimiento
          timers.push(setTimeout(() => setIsLoading(false), 600)); // Remueve el loader del DOM tras 600ms
        }, 2800)
      );
    }

    return () => timers.forEach(clearTimeout);
  }, []);

  return (
    <>
      {isLoading && <Loader size={220} fadeOut={fadeOut} />}
      {children}
    </>
  );
}
