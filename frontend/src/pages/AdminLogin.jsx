import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import { ShieldCheck, Mail, Lock, KeyRound, Eye, EyeOff, AlertTriangle } from 'lucide-react';

const AdminLogin = () => {
  const [email,     setEmail]     = useState('');
  const [password,  setPassword]  = useState('');
  const [secretKey, setSecretKey] = useState('');
  const [showPass,  setShowPass]  = useState(false);
  const [showKey,   setShowKey]   = useState(false);
  const [error,     setError]     = useState('');
  const [loading,   setLoading]   = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Already logged in as admin → go to dashboard
    const token = localStorage.getItem('access_token');
    const role  = localStorage.getItem('user_role');
    if (token && role === 'admin') navigate('/dashboard');
  }, [navigate]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const res = await api.post('/auth/admin-login', {
        email,
        password,
        secret_key: secretKey,
      });

      const u = res.data.user;
      localStorage.setItem('access_token',  res.data.access_token);
      localStorage.setItem('refresh_token', res.data.refresh_token);
      localStorage.setItem('username',      u.username);
      localStorage.setItem('user_role',     u.role);
      localStorage.setItem('user_email',    u.email);

      navigate('/dashboard');
    } catch (err) {
      setError(err.response?.data?.detail || 'Authentication failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700;800&display=swap');
        html, body, #root { height: 100%; overflow: hidden; margin: 0; }
        * { box-sizing: border-box; }
        .al-input {
          width: 100%; padding: 10px 12px 10px 38px;
          border: 1.5px solid #334155; border-radius: 10px;
          background: #1E293B; color: #F1F5F9;
          font-size: 13px; font-family: inherit; outline: none;
          transition: border-color .15s;
        }
        .al-input::placeholder { color: #475569; }
        .al-input:focus { border-color: #6366F1; }
        .al-input-r { padding-right: 38px; }
        .al-btn {
          width: 100%; padding: 11px;
          background: linear-gradient(135deg, #4F46E5, #7C3AED);
          color: white; border: none; border-radius: 10px;
          font-size: 14px; font-weight: 700; font-family: inherit;
          cursor: pointer; transition: opacity .15s, transform .1s;
          letter-spacing: .01em;
        }
        .al-btn:hover:not(:disabled) { opacity: .92; transform: translateY(-1px); }
        .al-btn:disabled { opacity: .5; cursor: not-allowed; }
        .al-icon-btn {
          position: absolute; right: 10px; top: 50%; transform: translateY(-50%);
          background: none; border: none; cursor: pointer; color: #64748B;
          display: flex; align-items: center; padding: 2px;
        }
        .al-icon-btn:hover { color: #94A3B8; }
      `}</style>

      <div style={{
        height: '100vh', overflow: 'hidden',
        background: 'linear-gradient(135deg, #0F172A 0%, #1E1B4B 50%, #0F172A 100%)',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        fontFamily: "'DM Sans', system-ui, sans-serif",
        position: 'relative',
      }}>

        {/* Background grid decoration */}
        <div style={{
          position: 'absolute', inset: 0, opacity: .04,
          backgroundImage: 'linear-gradient(#6366F1 1px, transparent 1px), linear-gradient(90deg, #6366F1 1px, transparent 1px)',
          backgroundSize: '40px 40px',
        }} />

        {/* Glow blobs */}
        <div style={{
          position: 'absolute', width: 400, height: 400, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(99,102,241,0.15) 0%, transparent 70%)',
          top: '10%', left: '20%', pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute', width: 300, height: 300, borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(124,58,237,0.12) 0%, transparent 70%)',
          bottom: '15%', right: '20%', pointerEvents: 'none',
        }} />

        {/* Card */}
        <div style={{
          width: '100%', maxWidth: 400,
          background: 'rgba(15,23,42,0.85)',
          backdropFilter: 'blur(20px)',
          border: '1px solid rgba(99,102,241,0.25)',
          borderRadius: 20,
          padding: '36px 32px',
          boxShadow: '0 24px 80px rgba(0,0,0,0.5), 0 0 0 1px rgba(255,255,255,0.03)',
          position: 'relative', zIndex: 1,
        }}>

          {/* Icon + Title */}
          <div style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 56, height: 56, borderRadius: 16,
              background: 'linear-gradient(135deg,#4F46E5,#7C3AED)',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
            }}>
              <ShieldCheck size={26} color="white" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#F1F5F9', marginBottom: 4 }}>
              Admin Access
            </h1>
            <p style={{ fontSize: 13, color: '#64748B' }}>
              Restricted — authorised personnel only
            </p>
          </div>

          {/* Warning banner */}
          <div style={{
            display: 'flex', alignItems: 'flex-start', gap: 9,
            background: 'rgba(251,191,36,0.08)', border: '1px solid rgba(251,191,36,0.2)',
            borderRadius: 10, padding: '10px 12px', marginBottom: 22,
          }}>
            <AlertTriangle size={14} color="#FBB124" style={{ flexShrink: 0, marginTop: 1 }} />
            <p style={{ fontSize: 11, color: '#FBB124', lineHeight: 1.5 }}>
              This page is not publicly linked. All access attempts are logged.
            </p>
          </div>

          <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Email */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8',
                              display: 'block', marginBottom: 6, letterSpacing: '.02em' }}>
                EMAIL ADDRESS
              </label>
              <div style={{ position: 'relative' }}>
                <Mail size={14} color="#475569" style={{ position: 'absolute', left: 11,
                                                          top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type="email" required
                  placeholder="admin@neuroscan.ai"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className="al-input"
                  autoComplete="email"
                />
              </div>
            </div>

            {/* Password */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8',
                              display: 'block', marginBottom: 6, letterSpacing: '.02em' }}>
                PASSWORD
              </label>
              <div style={{ position: 'relative' }}>
                <Lock size={14} color="#475569" style={{ position: 'absolute', left: 11,
                                                          top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showPass ? 'text' : 'password'} required
                  placeholder="Your password"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className="al-input al-input-r"
                  autoComplete="current-password"
                />
                <button type="button" className="al-icon-btn" onClick={() => setShowPass(v => !v)}>
                  {showPass ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Secret key */}
            <div>
              <label style={{ fontSize: 12, fontWeight: 600, color: '#94A3B8',
                              display: 'block', marginBottom: 6, letterSpacing: '.02em' }}>
                ADMIN SECRET KEY
              </label>
              <div style={{ position: 'relative' }}>
                <KeyRound size={14} color="#475569" style={{ position: 'absolute', left: 11,
                                                              top: '50%', transform: 'translateY(-50%)' }} />
                <input
                  type={showKey ? 'text' : 'password'} required
                  placeholder="Secret key"
                  value={secretKey} onChange={e => setSecretKey(e.target.value)}
                  className="al-input al-input-r"
                  autoComplete="off"
                />
                <button type="button" className="al-icon-btn" onClick={() => setShowKey(v => !v)}>
                  {showKey ? <EyeOff size={14} /> : <Eye size={14} />}
                </button>
              </div>
            </div>

            {/* Error */}
            {error && (
              <div style={{
                background: 'rgba(225,29,72,0.1)', border: '1px solid rgba(225,29,72,0.3)',
                borderRadius: 9, padding: '10px 12px',
                display: 'flex', alignItems: 'center', gap: 8,
              }}>
                <AlertTriangle size={13} color="#E11D48" style={{ flexShrink: 0 }} />
                <p style={{ fontSize: 12, color: '#FDA4AF' }}>{error}</p>
              </div>
            )}

            <button type="submit" disabled={loading} className="al-btn" style={{ marginTop: 4 }}>
              {loading ? 'Authenticating…' : 'Sign In as Admin'}
            </button>
          </form>

          <p style={{ fontSize: 11, color: '#334155', textAlign: 'center', marginTop: 20 }}>
            Not an admin?{' '}
            <a href="/login" style={{ color: '#6366F1', textDecoration: 'none', fontWeight: 600 }}>
              Regular login
            </a>
          </p>
        </div>
      </div>
    </>
  );
};

export default AdminLogin;
