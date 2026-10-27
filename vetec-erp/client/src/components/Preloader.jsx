import React, { useState, useEffect } from 'react';

export default function Preloader() {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    // Força o tema correto logo no início
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Tempo de exibição do Preloader
    const timer = setTimeout(() => {
      setHide(true);
    }, 1800);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="preloader" className={hide ? 'hide' : ''}>
      <div className="preloader-glass-card">
        
        {/* LOGO DA MARCA */}
        <div className="preloader-brand">
          <div className="preloader-logo-box">
            <i className="fa-solid fa-industry"></i>
          </div>
          <div className="preloader-brand-text">
            <strong>VETEC</strong>
            <span>INDUSTRIAL</span>
          </div>
        </div>

        {/* INDICADOR DE CARREGAMENTO */}
        <div className="preloader-ring"></div>
        
      </div>
    </div>
  );
}
