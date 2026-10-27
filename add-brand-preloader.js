const fs = require('fs');
const path = require('path');

const targetDir = path.resolve(__dirname, 'vetec-erp');
if (!fs.existsSync(targetDir)) {
  console.error('❌ Pasta "vetec-erp" não encontrada.');
  process.exit(1);
}

function writeFile(relPath, content) {
  const dest = path.join(targetDir, relPath);
  fs.writeFileSync(dest, content, 'utf8');
  console.log('✅ Atualizado:', relPath);
}

console.log('🏭 Adicionando a Logo VETEC ao Preloader...\n');

// 1. Novo componente Preloader.jsx
writeFile('client/src/components/Preloader.jsx', `import React, { useState, useEffect } from 'react';

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
`);

// 2. Atualizar o CSS do Preloader
const cssPath = path.join(targetDir, 'client', 'src', 'styles.css');
if (fs.existsSync(cssPath)) {
  let css = fs.readFileSync(cssPath, 'utf8');

  // Remove o CSS do preloader antigo
  css = css.replace(/\/\* =+\s*PRELOADER[\s\S]*?(?=\/\* =+|$)/g, '');

  const newPreloaderCss = `
/* =========================================
   PRELOADER PREMIUM (GLASSMORPHISM)
   ========================================= */
#preloader {
  position: fixed;
  inset: 0;
  background-color: var(--bg-body);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  transition: opacity 0.6s ease, visibility 0.6s ease;
}

#preloader.hide {
  opacity: 0;
  visibility: hidden;
}

.preloader-glass-card {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 32px;
  padding: 48px 64px;
  background: var(--card-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--card-shadow);
  animation: preloaderFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

/* Marca no Preloader */
.preloader-brand {
  display: flex;
  align-items: center;
  gap: 16px;
}

.preloader-logo-box {
  width: 52px;
  height: 52px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 24px;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.3);
  animation: preloaderPulse 2s infinite alternate;
}

.preloader-brand-text {
  display: flex;
  flex-direction: column;
  line-height: 1.1;
}

.preloader-brand-text strong {
  font-family: 'Inter', sans-serif;
  font-size: 24px;
  font-weight: 800;
  color: var(--text-main);
  letter-spacing: 1px;
}

.preloader-brand-text span {
  font-size: 12px;
  font-weight: 600;
  color: var(--text-muted);
  letter-spacing: 2px;
  text-transform: uppercase;
}

/* Anel de Carregamento */
.preloader-ring {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--brand);
  animation: preloaderSpin 1s linear infinite;
}

/* Animações */
@keyframes preloaderSpin {
  to { transform: rotate(360deg); }
}

@keyframes preloaderPulse {
  0% { transform: scale(1); box-shadow: 0 8px 24px rgba(37, 99, 235, 0.3); }
  100% { transform: scale(1.05); box-shadow: 0 12px 32px rgba(37, 99, 235, 0.6); }
}

@keyframes preloaderFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
`;

  css += newPreloaderCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('✅ styles.css atualizado com a Logo no Preloader.');
}

console.log('\n🎉 Logo VETEC adicionada ao Preloader com sucesso!');
console.log('Reinicie o servidor (npm run dev) e atualize a página.');