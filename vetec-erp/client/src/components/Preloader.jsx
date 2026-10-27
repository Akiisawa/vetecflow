import React, { useState, useEffect } from 'react';

export default function Preloader() {
  const [hide, setHide] = useState(false);

  // Garante que o tema seja aplicado antes de renderizar o preloader
  useEffect(() => {
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Tempo para a animação da linha rodar antes de esconder
    const timer = setTimeout(() => {
      setHide(true);
    }, 1500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="preloader" className={hide ? 'hide' : ''}>
      <div className="preloader-content">
        <div className="preloader-logo">VETEC</div>
        <div className="preloader-line"></div>
      </div>
    </div>
  );
}
