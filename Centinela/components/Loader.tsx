import React from 'react';
import Logo from './Logo';
import styles from './Loader.module.css';

interface LoaderProps {
  size?: number;
  text?: string;
  fullScreen?: boolean;
  fadeOut?: boolean; // Propiedad para activar la salida suave
}

export const Loader: React.FC<LoaderProps> = ({
  size = 200,
  text = '',
  fullScreen = true,
  fadeOut = false,
}) => {
  return (
    <div
      className={`
        ${styles.loaderContainer} 
        ${fullScreen ? styles.fullScreen : ''} 
        ${fadeOut ? styles.fadeOut : ''}
      `}
    >
      <div className={styles.logoWrapper}>
        <Logo size={size} isAnimated={false} className={styles.loaderLogo} />
      </div>
      {text && <p className={styles.loaderText}>{text}</p>}
    </div>
  );
};

export default Loader;