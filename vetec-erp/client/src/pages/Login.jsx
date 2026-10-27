import React, { useState } from 'react';
import { useAuth } from '../auth.jsx';

export default function Login() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(false);
  const [error, setError] = useState(null);
  const [loading, setLoading] = useState(false);

  async function submit(e) {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      await login(email, password);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="login-wrapper">
      <div className="login-card-glass">
        
        <div className="login-brand-center">
          <div className="brand-mark">VT</div>
          <h2>Bem-vindo</h2>
          <p>Acesse sua conta para continuar</p>
        </div>

        <form onSubmit={submit}>
          <div className="login-input-wrap">
            <input 
              type="email" 
              placeholder="E-mail corporativo" 
              value={email} 
              onChange={(e) => setEmail(e.target.value)} 
              required 
              autoFocus
            />
            <i className="fa-regular fa-envelope input-icon"></i>
          </div>

          <div className="login-input-wrap">
            <input 
              type="password" 
              placeholder="Sua senha" 
              value={password} 
              onChange={(e) => setPassword(e.target.value)} 
              required 
            />
            <i className="fa-solid fa-lock input-icon"></i>
          </div>

          {error && <div style={{ color: '#fca5a5', fontSize: 13, marginBottom: 16, textAlign: 'center', background: 'rgba(239, 68, 68, 0.1)', padding: '8px', borderRadius: '8px' }}>{error}</div>}

          <div className="login-options-glass">
            <label>
              <input type="checkbox" checked={remember} onChange={(e) => setRemember(e.target.checked)} style={{ accentColor: '#3b82f6' }} />
              Lembrar de mim
            </label>
            <a href="#" onClick={(e) => { e.preventDefault(); alert('Entre em contato com o administrador do sistema.'); }}>
              Esqueceu a senha?
            </a>
          </div>

          <button type="submit" className="btn-login-glass" disabled={loading}>
            {loading ? 'Autenticando...' : 'Entrar no sistema'}
          </button>
        </form>

        <div className="login-footer-glass">
          VETEC Engenharia © {new Date().getFullYear()} · Todos os direitos reservados.
        </div>
      </div>
    </div>
  );
}
