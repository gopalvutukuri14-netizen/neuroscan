import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import {
  Activity, Clock, ChevronRight, ShieldAlert, ShieldCheck,
  Upload, Brain, User, Users, BarChart2, Trash2, RefreshCw,
  UserCheck, Stethoscope, Settings
} from 'lucide-react';

const ROLE_META = {
  patient:   { label: 'Patient',   color: '#1D4ED8', bg: '#EFF6FF', Icon: User         },
  clinician: { label: 'Clinician', color: '#059669', bg: '#F0FDF4', Icon: Stethoscope  },
  admin:     { label: 'Admin',     color: '#BE123C', bg: '#FFF1F2', Icon: Settings     },
};

/* ─── small helpers ─── */
const Chip = ({ children, color = '#64748B', bg = '#F1F5F9' }) => (
  <span style={{
    display: 'inline-flex', alignItems: 'center',
    padding: '2px 9px', borderRadius: 20,
    fontSize: 11, fontWeight: 700,
    color, background: bg,
  }}>{children}</span>
);

const StatCard = ({ icon: Icon, label, value, color }) => (
  <div style={{
    background: 'white', borderRadius: 14, border: '1px solid #E2E8F0',
    padding: '16px 18px', display: 'flex', alignItems: 'center', gap: 14,
    boxShadow: '0 1px 4px rgba(0,0,0,0.04)',
  }}>
    <div style={{ width: 40, height: 40, borderRadius: 10, background: color + '18',
                  display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>
      <Icon size={18} color={color} />
    </div>
    <div>
      <p style={{ fontSize: 22, fontWeight: 800, color: '#0F172A', lineHeight: 1 }}>{value}</p>
      <p style={{ fontSize: 12, color: '#94A3B8', marginTop: 2 }}>{label}</p>
    </div>
  </div>
);

/* ════════════════════════════════
   ADMIN PANEL SUB-VIEWS
════════════════════════════════ */
const AdminStats = ({ stats }) => {
  if (!stats) return null;
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 10, marginBottom: 20 }}>
      <StatCard icon={Users}      label="Total Users"    value={stats.total_users}  color="#2563EB" />
      <StatCard icon={Brain}      label="Total Scans"    value={stats.total_scans}  color="#7C3AED" />
      <StatCard icon={ShieldAlert} label="SCZ Detected"  value={stats.scz_detected} color="#E11D48" />
      <StatCard icon={BarChart2}  label="SCZ Rate"       value={`${stats.scz_rate}%`} color="#D97706" />
    </div>
  );
};

const UserManagement = ({ users, onRoleChange }) => {
  const roleColor = { patient: '#1D4ED8', clinician: '#059669', admin: '#BE123C' };
  const roleBg    = { patient: '#EFF6FF', clinician: '#F0FDF4', admin: '#FFF1F2' };
  return (
    <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0',
                  overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
      <div style={{ padding: '14px 20px', borderBottom: '1px solid #F1F5F9',
                    display: 'flex', alignItems: 'center', gap: 8 }}>
        <Users size={15} color="#64748B" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>User Management</span>
        <span style={{ marginLeft: 'auto', fontSize: 12, color: '#94A3B8' }}>{users.length} users</span>
      </div>
      <div style={{ overflowY: 'auto', maxHeight: 280 }}>
        {users.map(u => (
          <div key={u.user_id} style={{
            display: 'flex', alignItems: 'center', gap: 12,
            padding: '10px 20px', borderBottom: '1px solid #F8FAFC',
          }}>
            <div style={{
              width: 32, height: 32, borderRadius: '50%',
              background: roleBg[u.role] || '#F1F5F9',
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              fontSize: 12, fontWeight: 700, color: roleColor[u.role] || '#64748B', flexShrink: 0,
            }}>
              {(u.username || u.email).slice(0, 2).toUpperCase()}
            </div>
            <div style={{ flex: 1, minWidth: 0 }}>
              <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A' }}>{u.username || '—'}</p>
              <p style={{ fontSize: 11, color: '#94A3B8', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{u.email}</p>
            </div>
            <select
              value={u.role}
              onChange={e => onRoleChange(u.user_id, e.target.value)}
              style={{
                fontSize: 11, fontWeight: 700, padding: '3px 8px', borderRadius: 8,
                border: `1.5px solid ${roleColor[u.role] || '#E2E8F0'}`,
                background: roleBg[u.role] || '#F1F5F9',
                color: roleColor[u.role] || '#64748B',
                cursor: 'pointer', outline: 'none',
              }}
            >
              <option value="patient">Patient</option>
              <option value="clinician">Clinician</option>
              <option value="admin">Admin</option>
            </select>
          </div>
        ))}
      </div>
    </div>
  );
};

/* ════════════════════════════════
   MAIN DASHBOARD
════════════════════════════════ */
const Dashboard = () => {
  const [history,  setHistory]  = useState([]);
  const [loading,  setLoading]  = useState(true);
  const [adminTab, setAdminTab] = useState('scans'); // 'scans' | 'users'
  const [users,    setUsers]    = useState([]);
  const [stats,    setStats]    = useState(null);
  const [deleting, setDeleting] = useState(null);

  const username = localStorage.getItem('username') || 'User';
  const role     = localStorage.getItem('user_role') || 'patient';
  const meta     = ROLE_META[role] || ROLE_META.patient;

  const fetchHistory = async () => {
    setLoading(true);
    try {
      const res = await api.get('/history');
      setHistory(res.data);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminData = async () => {
    try {
      const [uRes, sRes] = await Promise.all([
        api.get('/admin/users'),
        api.get('/admin/stats'),
      ]);
      setUsers(uRes.data);
      setStats(sRes.data);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    fetchHistory();
    if (role === 'admin') fetchAdminData();
  }, [role]);

  const handleRoleChange = async (userId, newRole) => {
    try {
      await api.patch(`/admin/users/${userId}/role`, { role: newRole });
      setUsers(prev => prev.map(u => u.user_id === userId ? { ...u, role: newRole } : u));
    } catch { alert('Failed to update role'); }
  };

  const handleDelete = async (recordId) => {
    if (!window.confirm('Delete this record permanently?')) return;
    setDeleting(recordId);
    try {
      await api.delete(`/history/${recordId}`);
      setHistory(prev => prev.filter(r => r.record_id !== recordId));
      if (stats) setStats(s => ({ ...s, total_scans: s.total_scans - 1 }));
    } catch { alert('Delete failed'); }
    finally { setDeleting(null); }
  };

  const completed = history.filter(r => r.status === 'Completed');
  const scz       = completed.filter(r => r.prediction === 'SCZ');
  const normal    = completed.filter(r => r.prediction !== 'SCZ');

  const isAdmin     = role === 'admin';
  const isClinician = role === 'clinician';
  const isPatient   = role === 'patient';

  return (
    <div style={{ minHeight: '100vh', background: '#F8FAFC', fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <Navbar />
      <main className="max-w-5xl mx-auto py-8 px-4 sm:px-6 lg:px-8">

        {/* ── Header ── */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
              <div style={{ width: 32, height: 32, borderRadius: '50%', background: meta.bg,
                            display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <meta.Icon size={15} color={meta.color} />
              </div>
              <span style={{ fontSize: 14, fontWeight: 600, color: '#374151' }}>{username}</span>
              <Chip color={meta.color} bg={meta.bg}>{meta.label}</Chip>
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#0F172A' }}>
              {isAdmin ? 'Admin Dashboard' : isClinician ? 'Clinical Dashboard' : 'My Scans'}
            </h1>
            <p style={{ fontSize: 13, color: '#94A3B8', marginTop: 2 }}>
              {isAdmin ? 'System-wide view — all users and scans'
               : isClinician ? 'Your MRI analyses and patient records'
               : 'Your personal scan history'}
            </p>
          </div>
          <Link to="/upload" style={{
            display: 'inline-flex', alignItems: 'center', gap: 7,
            background: '#2563EB', color: 'white',
            padding: '9px 18px', borderRadius: 12, textDecoration: 'none',
            fontSize: 13, fontWeight: 600,
            boxShadow: '0 2px 8px rgba(37,99,235,0.25)',
          }}>
            <Upload size={14} /> New Scan
          </Link>
        </div>

        {/* ── Admin: system stats ── */}
        {isAdmin && stats && <AdminStats stats={stats} />}

        {/* ── Admin: tab switcher ── */}
        {isAdmin && (
          <div style={{ display: 'flex', gap: 4, marginBottom: 16,
                        background: '#F1F5F9', borderRadius: 10, padding: 4, width: 'fit-content' }}>
            {[['scans', Brain, 'All Scans'], ['users', Users, 'Users']].map(([tab, Icon, label]) => (
              <button key={tab} onClick={() => setAdminTab(tab)} style={{
                display: 'flex', alignItems: 'center', gap: 6,
                padding: '7px 16px', borderRadius: 8,
                fontSize: 13, fontWeight: 600, border: 'none', cursor: 'pointer',
                background: adminTab === tab ? 'white' : 'transparent',
                color: adminTab === tab ? '#0F172A' : '#64748B',
                boxShadow: adminTab === tab ? '0 1px 4px rgba(0,0,0,0.08)' : 'none',
                transition: 'all .15s',
              }}>
                <Icon size={13} />{label}
              </button>
            ))}
          </div>
        )}

        {/* ── Admin Users tab ── */}
        {isAdmin && adminTab === 'users' && (
          <UserManagement users={users} onRoleChange={handleRoleChange} />
        )}

        {/* ── Scans tab (everyone) ── */}
        {(!isAdmin || adminTab === 'scans') && (
          <>
            {/* Stats row — clinician + patient own stats */}
            {!loading && history.length > 0 && (
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 10, marginBottom: 20 }}>
                <StatCard icon={Brain}       label={isAdmin ? 'Total System Scans' : 'Total Scans'} value={history.length}  color="#2563EB" />
                <StatCard icon={ShieldAlert} label="SCZ Detected"    value={scz.length}    color="#E11D48" />
                <StatCard icon={ShieldCheck} label="Normal (Control)" value={normal.length} color="#059669" />
              </div>
            )}

            {/* Table */}
            {loading ? (
              <div style={{ display: 'flex', justifyContent: 'center', padding: '60px 0' }}>
                <Activity size={28} color="#2563EB" style={{ animation: 'spin 1s linear infinite' }} />
              </div>
            ) : history.length === 0 ? (
              <div style={{
                background: 'white', borderRadius: 20, border: '1px solid #E2E8F0',
                padding: '60px 32px', textAlign: 'center',
              }}>
                <div style={{ width: 56, height: 56, background: '#EFF6FF', borderRadius: '50%',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <Brain size={24} color="#3B82F6" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 6 }}>No scans yet</h3>
                <p style={{ fontSize: 13, color: '#94A3B8', marginBottom: 20 }}>Upload your first MRI to start analysis.</p>
                <Link to="/upload" style={{
                  display: 'inline-flex', alignItems: 'center', gap: 6,
                  background: '#2563EB', color: 'white', padding: '9px 20px',
                  borderRadius: 10, textDecoration: 'none', fontSize: 13, fontWeight: 600,
                }}>
                  <Upload size={14} /> Upload MRI
                </Link>
              </div>
            ) : (
              <div style={{ background: 'white', borderRadius: 16, border: '1px solid #E2E8F0',
                            overflow: 'hidden', boxShadow: '0 2px 8px rgba(0,0,0,0.04)' }}>
                <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
                  {history.map((record) => {
                    const isDone   = record.status === 'Completed';
                    const isSCZ    = record.prediction === 'SCZ';
                    const isFailed = record.status === 'Failed';

                    return (
                      <li key={record.record_id} style={{ borderBottom: '1px solid #F8FAFC' }}>
                        <div style={{ display: 'flex', alignItems: 'center', padding: '12px 20px', gap: 14 }}>

                          {/* Icon */}
                          <div style={{
                            width: 40, height: 40, borderRadius: 10, flexShrink: 0,
                            display: 'flex', alignItems: 'center', justifyContent: 'center',
                            background: isFailed ? '#FEF2F2' : !isDone ? '#FFFBEB'
                              : isSCZ ? '#FFF1F2' : '#F0FDF4',
                          }}>
                            {isFailed    ? <ShieldAlert size={17} color="#EF4444" />
                             : !isDone   ? <Activity size={17} color="#F59E0B" style={{ animation: 'pulse 1s infinite' }} />
                             : isSCZ     ? <ShieldAlert size={17} color="#E11D48" />
                             : <ShieldCheck size={17} color="#059669" />}
                          </div>

                          {/* Info */}
                          <div style={{ flex: 1, minWidth: 0 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A',
                                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                {record.filename || 'MRI Scan'}
                              </p>
                              <span style={{ fontSize: 10, color: '#94A3B8', fontFamily: 'monospace', flexShrink: 0 }}>
                                #{record.record_id.slice(0, 8)}
                              </span>
                            </div>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 2 }}>
                              <Clock size={10} color="#CBD5E1" />
                              <span style={{ fontSize: 11, color: '#94A3B8' }}>
                                {new Date(record.created_at).toLocaleDateString('en-US', { month:'short', day:'numeric', year:'numeric' })}
                              </span>
                              {/* Admin: show uploader username */}
                              {isAdmin && (record.uploader_username || record.user_id) && (
                                <>
                                  <span style={{ color: '#E2E8F0' }}>·</span>
                                  <UserCheck size={10} color="#CBD5E1" />
                                  <span style={{ fontSize: 11, color: '#94A3B8' }}>
                                    {record.uploader_username && record.uploader_username !== 'Unknown' ? record.uploader_username : record.user_id ? record.user_id.slice(0,8) : '—'}
                                  </span>
                                </>
                              )}
                            </div>
                          </div>

                          {/* Result — role-based */}
                          {isDone && (
                            <div style={{ textAlign: 'right', flexShrink: 0 }}>
                              {isPatient ? (
                                // Patient: simplified language, no confidence
                                <p style={{ fontSize: 13, fontWeight: 700,
                                            color: isSCZ ? '#E11D48' : '#059669' }}>
                                  {isSCZ ? '⚠ Further Review Needed' : '✓ No Concerns Found'}
                                </p>
                              ) : (
                                // Clinician + Admin: full technical result
                                <>
                                  <p style={{ fontSize: 13, fontWeight: 700,
                                              color: isSCZ ? '#E11D48' : '#059669' }}>
                                    {isSCZ ? 'Schizophrenia' : 'Normal'}
                                  </p>
                                  <p style={{ fontSize: 11, color: '#94A3B8' }}>
                                    {(record.confidence_score * 100).toFixed(1)}% confidence
                                  </p>
                                </>
                              )}
                            </div>
                          )}

                          {!isDone && !isFailed && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px',
                                           borderRadius: 20, background: '#FEF3C7', color: '#D97706' }}>
                              {record.status}
                            </span>
                          )}
                          {isFailed && (
                            <span style={{ fontSize: 11, fontWeight: 600, padding: '3px 10px',
                                           borderRadius: 20, background: '#FEF2F2', color: '#EF4444' }}>
                              Failed
                            </span>
                          )}

                          {/* Actions */}
                          <div style={{ display: 'flex', gap: 4, flexShrink: 0 }}>
                            <Link to={`/result/${record.record_id}`} style={{
                              display: 'flex', alignItems: 'center', justifyContent: 'center',
                              width: 30, height: 30, borderRadius: 8, background: '#F8FAFC',
                              border: '1px solid #E2E8F0', color: '#64748B', textDecoration: 'none',
                            }}>
                              <ChevronRight size={14} />
                            </Link>
                            {/* Admin only: delete */}
                            {isAdmin && (
                              <button
                                onClick={() => handleDelete(record.record_id)}
                                disabled={deleting === record.record_id}
                                style={{
                                  display: 'flex', alignItems: 'center', justifyContent: 'center',
                                  width: 30, height: 30, borderRadius: 8,
                                  background: '#FFF1F2', border: '1px solid #FFE4E6',
                                  color: '#E11D48', cursor: 'pointer',
                                }}
                              >
                                {deleting === record.record_id
                                  ? <RefreshCw size={12} style={{ animation: 'spin 1s linear infinite' }} />
                                  : <Trash2 size={12} />}
                              </button>
                            )}
                          </div>
                        </div>
                      </li>
                    );
                  })}
                </ul>
              </div>
            )}
          </>
        )}
      </main>
    </div>
  );
};

export default Dashboard;
