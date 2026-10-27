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

console.log('✨ Criando um Preloader Premium integrado ao Tema...\n');

// 1. Novo componente Preloader.jsx
writeFile('client/src/components/Preloader.jsx', `import React, { useState, useEffect } from 'react';

export default function Preloader() {
  const [hide, setHide] = useState(false);

  useEffect(() => {
    // Força o tema correto logo no início
    const currentTheme = localStorage.getItem('theme') || 'light';
    document.documentElement.setAttribute('data-theme', currentTheme);
    
    // Tempo de exibição do Preloader (1.8s)
    const timer = setTimeout(() => {
      setHide(true);
    }, 1800);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div id="preloader" className={hide ? 'hide' : ''}>
      <div className="preloader-glass-card">
        <div className="preloader-logo-box">
          <i className="fa-solid fa-industry"></i>
        </div>
        <div className="preloader-ring"></div>
        <div className="preloader-text">Carregando Ambiente</div>
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
  gap: 24px;
  padding: 40px 60px;
  background: var(--card-bg);
  backdrop-filter: blur(16px);
  -webkit-backdrop-filter: blur(16px);
  border: 1px solid var(--border);
  border-radius: 24px;
  box-shadow: var(--card-shadow);
  animation: preloaderFadeIn 0.5s cubic-bezier(0.16, 1, 0.3, 1);
}

.preloader-logo-box {
  width: 64px;
  height: 64px;
  border-radius: 16px;
  background: linear-gradient(135deg, #3b82f6, #2563eb);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 28px;
  box-shadow: 0 8px 24px rgba(37, 99, 235, 0.4);
  animation: preloaderPulse 2s infinite alternate;
}

.preloader-ring {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  border: 3px solid var(--border);
  border-top-color: var(--brand);
  animation: preloaderSpin 1s linear infinite;
}

.preloader-text {
  color: var(--text-muted);
  font-size: 13px;
  font-weight: 600;
  letter-spacing: 2px;
  text-transform: uppercase;
  animation: preloaderBlink 1.5s ease-in-out infinite alternate;
}

/* Animações */
@keyframes preloaderSpin {
  to { transform: rotate(360deg); }
}

@keyframes preloaderPulse {
  0% { transform: scale(1); box-shadow: 0 8px 24px rgba(37, 99, 235, 0.3); }
  100% { transform: scale(1.05); box-shadow: 0 12px 32px rgba(37, 99, 235, 0.6); }
}

@keyframes preloaderBlink {
  0% { opacity: 0.5; }
  100% { opacity: 1; }
}

@keyframes preloaderFadeIn {
  from { opacity: 0; transform: scale(0.95); }
  to { opacity: 1; transform: scale(1); }
}
`;

  css += newPreloaderCss;
  fs.writeFileSync(cssPath, css, 'utf8');
  console.log('✅ styles.css atualizado com o novo visual do Preloader.');
}

console.log('\n🎉 Preloader Premium aplicado com sucesso!');
console.log('Reinicie o servidor (npm run dev) e atualize a página.');