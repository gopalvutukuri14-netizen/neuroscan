import React, { useState, useEffect, useRef } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { Brain, Upload, LayoutDashboard, LogOut, ChevronDown, User } from 'lucide-react';

const ROLE_COLORS = {
  patient:    ['#1D4ED8', '#EFF6FF'],
  clinician:  ['#059669', '#F0FDF4'],
  researcher: ['#7C3AED', '#F5F3FF'],
  admin:      ['#BE123C', '#FFF1F2'],
};

const getInitials = (username) => {
  if (!username) return '?';
  const parts = username.trim().split(/[\s._-]+/);
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return username.slice(0, 2).toUpperCase();
};

const Navbar = () => {
  const navigate  = useNavigate();
  const location  = useLocation();
  const token     = localStorage.getItem('access_token');
  const username  = localStorage.getItem('username') || '';
  const role      = localStorage.getItem('user_role') || 'patient';
  const email     = localStorage.getItem('user_email') || '';
  const initials  = getInitials(username || email);
  const [fg, bg]  = ROLE_COLORS[role] || ROLE_COLORS.patient;
  const [open, setOpen] = useState(false);
  const dropRef   = useRef(null);

  useEffect(() => {
    const handler = (e) => {
      if (dropRef.current && !dropRef.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  useEffect(() => { setOpen(false); }, [location.pathname]);

  const handleLogout = () => {
    ['access_token','refresh_token','username','user_role','user_email'].forEach(
      k => localStorage.removeItem(k)
    );
    navigate('/login');
  };

  const isActive = (path) => location.pathname === path;

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600;700&display=swap');
        .nb-root { font-family: 'DM Sans', system-ui, sans-serif; }
        .nb-link {
          display: inline-flex; align-items: center; gap: 6px;
          padding: 6px 12px; border-radius: 8px;
          font-size: 13px; font-weight: 500; color: #64748B;
          text-decoration: none; transition: all 0.15s ease;
          border: none; background: none; cursor: pointer; font-family: inherit;
        }
        .nb-link:hover { color: #0F172A; background: #F1F5F9; }
        .nb-link.active { color: #2563EB; background: #EFF6FF; }
        .avatar-btn {
          display: inline-flex; align-items: center; gap: 7px;
          padding: 4px 8px 4px 4px; border-radius: 24px;
          border: 1px solid #E2E8F0; background: white;
          cursor: pointer; transition: all 0.15s ease; font-family: inherit;
        }
        .avatar-btn:hover { border-color: #CBD5E1; box-shadow: 0 1px 4px rgba(0,0,0,0.08); }
        .avatar-btn.open  { border-color: #93C5FD; box-shadow: 0 0 0 3px #EFF6FF; }
        .avatar-circle {
          width: 28px; height: 28px; border-radius: 50%;
          display: flex; align-items: center; justify-content: center;
          font-size: 11px; font-weight: 700; flex-shrink: 0; letter-spacing: 0.03em;
        }
        .dropdown {
          position: absolute; top: calc(100% + 8px); right: 0; width: 230px;
          background: white; border: 1px solid #E2E8F0; border-radius: 14px;
          box-shadow: 0 8px 32px rgba(0,0,0,0.12), 0 2px 8px rgba(0,0,0,0.06);
          padding: 6px; z-index: 100; animation: ddFadeIn 0.15s ease;
        }
        @keyframes ddFadeIn {
          from { opacity: 0; transform: translateY(-6px) scale(0.97); }
          to   { opacity: 1; transform: translateY(0) scale(1); }
        }
        .dd-header { padding: 10px 12px 8px; border-bottom: 1px solid #F1F5F9; margin-bottom: 4px; }
        .dd-label  { font-size: 10px; font-weight: 600; color: #94A3B8; text-transform: uppercase; letter-spacing: 0.06em; margin-bottom: 2px; }
        .dd-username { font-size: 13px; font-weight: 700; color: #0F172A; }
        .dd-email    { font-size: 11px; color: #94A3B8; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
        .dd-item {
          display: flex; align-items: center; gap: 9px;
          padding: 9px 12px; border-radius: 9px;
          font-size: 13px; font-weight: 500; color: #374151;
          cursor: pointer; text-decoration: none; transition: background 0.12s ease;
          border: none; background: none; width: 100%; font-family: inherit;
        }
        .dd-item:hover { background: #F8FAFC; }
        .dd-item.danger { color: #DC2626; }
        .dd-item.danger:hover { background: #FEF2F2; }
        .dd-sep { height: 1px; background: #F1F5F9; margin: 4px 0; }
      `}</style>

      <nav className="nb-root" style={{
        background: 'white', borderBottom: '1px solid #E2E8F0',
        position: 'sticky', top: 0, zIndex: 50,
      }}>
        <div style={{
          maxWidth: 1200, margin: '0 auto', padding: '0 20px',
          height: 58, display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>

          {/* Brand */}
          <Link to="/dashboard" style={{ display: 'flex', alignItems: 'center', gap: 9, textDecoration: 'none' }}>
            <div style={{
              width: 32, height: 32, background: '#2563EB', borderRadius: 9,
              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
            }}>
              <Brain size={18} color="white" />
            </div>
            <span style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', letterSpacing: '-0.01em' }}>
              NeuroScan <span style={{ color: '#2563EB' }}>AI</span>
            </span>
          </Link>

          {token ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
              <Link to="/dashboard" className={`nb-link${isActive('/dashboard') ? ' active' : ''}`}>
                <LayoutDashboard size={15} /> Dashboard
              </Link>
              <Link to="/upload" className={`nb-link${isActive('/upload') ? ' active' : ''}`}>
                <Upload size={15} /> Upload MRI
              </Link>

              {/* Avatar dropdown */}
              <div ref={dropRef} style={{ position: 'relative', marginLeft: 8 }}>
                <button
                  className={`avatar-btn${open ? ' open' : ''}`}
                  onClick={() => setOpen(o => !o)}
                  aria-label="User menu"
                >
                  <div className="avatar-circle" style={{ background: bg, color: fg }}>
                    {initials}
                  </div>
                  {username && (
                    <span style={{ fontSize: 12, fontWeight: 600, color: '#374151', maxWidth: 80, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {username}
                    </span>
                  )}
                  <ChevronDown size={13} color="#94A3B8"
                    style={{ transition: 'transform 0.2s ease', transform: open ? 'rotate(180deg)' : 'rotate(0deg)' }}
                  />
                </button>

                {open && (
                  <div className="dropdown">
                    <div className="dd-header">
                      <div className="dd-label">Signed in as</div>
                      <div className="dd-username">{username || 'User'}</div>
                      <div className="dd-email" title={email}>{email}</div>
                      <span style={{
                        display: 'inline-block', marginTop: 4,
                        fontSize: 10, fontWeight: 700, padding: '2px 7px', borderRadius: 20,
                        background: bg, color: fg, textTransform: 'capitalize',
                      }}>
                        {role}
                      </span>
                    </div>

                    <Link to="/dashboard" className="dd-item" onClick={() => setOpen(false)}>
                      <LayoutDashboard size={14} color="#64748B" /> Dashboard
                    </Link>
                    <Link to="/upload" className="dd-item" onClick={() => setOpen(false)}>
                      <Upload size={14} color="#64748B" /> Upload MRI
                    </Link>
                    <div className="dd-sep" />
                    <button className="dd-item danger" onClick={handleLogout}>
                      <LogOut size={14} /> Sign out
                    </button>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <Link to="/login" className="nb-link">Login</Link>
              <Link to="/register" style={{
                padding: '7px 16px', background: '#0F172A', color: 'white',
                borderRadius: 9, fontSize: 13, fontWeight: 600, textDecoration: 'none',
              }}>Register</Link>
            </div>
          )}
        </div>
      </nav>
    </>
  );
};

export default Navbar;
