import React, { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import api from '../services/api';
import { Brain, User, Mail, Lock, UserRound, Stethoscope } from 'lucide-react';

// Admin is NOT available on signup — only via internal promotion
const ROLES = [
  { value: 'patient',   label: 'Patient',   desc: 'Individual seeking screening',  Icon: UserRound,   color: { border: '#3B82F6', bg: '#EFF6FF', text: '#1D4ED8', iconBg: '#DBEAFE' } },
  { value: 'clinician', label: 'Clinician', desc: 'Licensed medical professional', Icon: Stethoscope, color: { border: '#10B981', bg: '#F0FDF4', text: '#065F46', iconBg: '#D1FAE5' } },
];

const Register = () => {
  const [username, setUsername] = useState('');
  const [email,    setEmail]    = useState('');
  const [password, setPassword] = useState('');
  const [role,     setRole]     = useState('patient');
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    if (username.trim().length < 3) { setError('Username must be at least 3 characters.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/register', { username: username.trim(), email, password, role });
      navigate('/verify-otp', { state: { email } });
    } catch (err) {
      setError(err.response?.data?.detail || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  const inputCls = "appearance-none block w-full pl-10 pr-3 py-2.5 border border-slate-300 rounded-lg shadow-sm placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm";

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col justify-center py-6 sm:px-6 lg:px-8"
         style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
          <Brain className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">Create your account</h2>
        <p className="mt-1 text-sm text-slate-500">Join NeuroScan AI</p>
      </div>

      <div className="mt-6 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">
          <form className="space-y-5" onSubmit={handleRegister}>

            {/* ── Role picker — 2 columns (no admin) ── */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-2">I am a…</label>
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map(({ value, label, desc, Icon, color }) => {
                  const active = role === value;
                  return (
                    <button
                      key={value} type="button"
                      onClick={() => setRole(value)}
                      style={active ? { borderColor: color.border, background: color.bg } : {}}
                      className={`flex flex-col items-center text-center p-4 rounded-xl border-2 transition-all ${
                        active ? '' : 'border-slate-200 bg-white hover:border-slate-300'
                      }`}
                    >
                      <div className="w-9 h-9 rounded-lg flex items-center justify-center mb-2"
                           style={{ background: active ? color.iconBg : '#F1F5F9' }}>
                        <Icon size={17} style={{ color: active ? color.border : '#94A3B8' }} />
                      </div>
                      <p className="text-sm font-bold" style={{ color: active ? color.text : '#374151' }}>
                        {label}
                      </p>
                      <p className="text-slate-400 leading-tight mt-0.5" style={{ fontSize: 11 }}>{desc}</p>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Username */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Username</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="text" required minLength={3} maxLength={30}
                  placeholder="e.g. dr_smith"
                  value={username} onChange={e => setUsername(e.target.value)}
                  className={inputCls} />
              </div>
              <p className="text-xs text-slate-400 mt-1">Used on your dashboard and scan records</p>
            </div>

            {/* Email */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="email" required placeholder="you@example.com"
                  value={email} onChange={e => setEmail(e.target.value)}
                  className={inputCls} />
              </div>
            </div>

            {/* Password */}
            <div>
              <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
              <div className="relative">
                <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                <input type="password" required minLength={6}
                  placeholder="Min. 6 characters"
                  value={password} onChange={e => setPassword(e.target.value)}
                  className={inputCls} />
              </div>
            </div>

            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                {error}
              </div>
            )}

            <button type="submit" disabled={loading}
              className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 disabled:opacity-50 transition-colors">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>

          <div className="mt-5 text-center">
            <p className="text-sm text-slate-600">
              Already have an account?{' '}
              <Link to="/login" className="font-semibold text-blue-600 hover:text-blue-500">Log in</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Register;
