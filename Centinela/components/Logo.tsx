import React from 'react';
import styles from './Logo.module.css';

interface LogoProps {
  size?: number;
  className?: string;
  isAnimated?: boolean; // Flag opcional para activar movimiento
}

export const Logo: React.FC<LogoProps> = ({ size = 200, className = '', isAnimated = true }) => {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 200 200"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={`${styles['logo-svg']} ${isAnimated ? styles.animated : ''} ${className}`}
    >
      {/* Círculo 1: Exterior Blanco */}
      <circle cx="100" cy="100" r="95" fill="white" className={styles['ring-outer-white']} />

      {/* Círculo 2: Anillo Exterior Negro */}
      <circle cx="100" cy="100" r="85" fill="black" className={styles['ring-outer-black']} />

      {/* Círculo 3: Anillo Interior Blanco */}
      <circle cx="100" cy="100" r="60" fill="white" className={styles['ring-inner-white']} />

      {/* Círculo 4: Fondo Negro del Núcleo */}
      <circle cx="100" cy="100" r="50" fill="black" className={styles['ring-inner-black']} />

      {/* Círculo 5: Núcleo Rojo */}
      <circle cx="100" cy="100" r="30" fill="#c8243f" className={styles['core-red']} />
    </svg>
  );
};

export default Logo;