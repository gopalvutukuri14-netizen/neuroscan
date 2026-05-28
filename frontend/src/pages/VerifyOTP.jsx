import React, { useState, useEffect, useRef } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Brain, Mail, RotateCcw, CheckCircle } from 'lucide-react';

const RESEND_COOLDOWN = 60; // seconds

const VerifyOTP = () => {
  const [digits,   setDigits]   = useState(['', '', '', '', '', '']);
  const [error,    setError]    = useState('');
  const [loading,  setLoading]  = useState(false);
  const [success,  setSuccess]  = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [resendMsg, setResendMsg] = useState('');
  const inputRefs = useRef([]);
  const location  = useLocation();
  const navigate  = useNavigate();
  const email     = location.state?.email;

  useEffect(() => {
    if (!email) navigate('/login');
  }, [email, navigate]);

  // Cooldown timer
  useEffect(() => {
    if (cooldown <= 0) return;
    const t = setInterval(() => setCooldown(c => c - 1), 1000);
    return () => clearInterval(t);
  }, [cooldown]);

  // Auto-focus first input
  useEffect(() => {
    inputRefs.current[0]?.focus();
  }, []);

  const otp = digits.join('');

  const handleDigitChange = (index, value) => {
    // Allow paste of full OTP
    if (value.length > 1) {
      const pasted = value.replace(/\D/g, '').slice(0, 6).split('');
      const newDigits = [...digits];
      pasted.forEach((d, i) => { if (index + i < 6) newDigits[index + i] = d; });
      setDigits(newDigits);
      const nextIdx = Math.min(index + pasted.length, 5);
      inputRefs.current[nextIdx]?.focus();
      return;
    }
    if (!/^\d?$/.test(value)) return;
    const newDigits = [...digits];
    newDigits[index] = value;
    setDigits(newDigits);
    if (value && index < 5) inputRefs.current[index + 1]?.focus();
  };

  const handleKeyDown = (index, e) => {
    if (e.key === 'Backspace' && !digits[index] && index > 0) {
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handleVerify = async (e) => {
    e?.preventDefault();
    if (otp.length < 6) { setError('Please enter all 6 digits'); return; }
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/verify-otp', { email, otp });
      setSuccess(true);
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid OTP — please try again');
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } finally {
      setLoading(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0 || resending) return;
    setResendMsg('');
    setError('');
    setResending(true);
    try {
      await api.post('/auth/resend-otp', { email });
      setResendMsg('New code sent! Check your inbox.');
      setCooldown(RESEND_COOLDOWN);
      setDigits(['', '', '', '', '', '']);
      inputRefs.current[0]?.focus();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend — try again shortly');
    } finally {
      setResending(false);
    }
  };

  // Auto-submit when all 6 digits filled
  useEffect(() => {
    if (otp.length === 6 && !loading && !success) handleVerify();
  }, [otp]);

  if (!email) return null;

  return (
    <div className="h-screen overflow-hidden bg-slate-50 flex flex-col justify-center py-6 sm:px-6 lg:px-8"
         style={{ fontFamily: "'DM Sans', system-ui, sans-serif" }}>

      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
          <Brain className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">Check your email</h2>
        <p className="mt-2 text-center text-sm text-slate-500">
          We sent a 6-digit code to
        </p>
        <div className="flex items-center gap-2 mt-1">
          <Mail size={14} className="text-blue-500" />
          <span className="text-sm font-semibold text-blue-600">{email}</span>
        </div>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">

          {success ? (
            /* ── Success state ── */
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 bg-emerald-100 rounded-full flex items-center justify-center">
                <CheckCircle size={32} className="text-emerald-500" />
              </div>
              <h3 className="text-lg font-bold text-slate-900">Email Verified!</h3>
              <p className="text-sm text-slate-500 text-center">Redirecting to login…</p>
            </div>
          ) : (
            <form onSubmit={handleVerify} className="space-y-6">

              {/* 6 digit boxes */}
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-4 text-center">
                  Enter verification code
                </label>
                <div className="flex justify-center gap-3">
                  {digits.map((d, i) => (
                    <input
                      key={i}
                      ref={el => inputRefs.current[i] = el}
                      type="text"
                      inputMode="numeric"
                      maxLength={6}
                      value={d}
                      onChange={e => handleDigitChange(i, e.target.value)}
                      onKeyDown={e => handleKeyDown(i, e)}
                      onFocus={e => e.target.select()}
                      style={{
                        width: 44, height: 52,
                        textAlign: 'center', fontSize: 22, fontWeight: 700,
                        fontFamily: "'DM Mono', monospace",
                        border: `2px solid ${d ? '#3B82F6' : '#E2E8F0'}`,
                        borderRadius: 10, outline: 'none',
                        background: d ? '#EFF6FF' : 'white',
                        color: '#0F172A',
                        transition: 'all .15s',
                      }}
                    />
                  ))}
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5 text-center">
                  {error}
                </div>
              )}

              {resendMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-2.5 text-center">
                  {resendMsg}
                </div>
              )}

              <button
                type="submit" disabled={loading || otp.length < 6}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {loading ? 'Verifying…' : 'Verify Email'}
              </button>

              {/* Resend section */}
              <div className="text-center">
                <p className="text-sm text-slate-500 mb-2">Didn't receive the code?</p>
                <button
                  type="button"
                  onClick={handleResend}
                  disabled={cooldown > 0 || resending}
                  className="inline-flex items-center gap-2 text-sm font-semibold disabled:opacity-40 transition-colors"
                  style={{ color: cooldown > 0 ? '#94A3B8' : '#2563EB', background: 'none', border: 'none', cursor: cooldown > 0 ? 'not-allowed' : 'pointer' }}
                >
                  <RotateCcw size={13} style={{ animation: resending ? 'spin .8s linear infinite' : 'none' }} />
                  {resending ? 'Sending…'
                   : cooldown > 0 ? `Resend in ${cooldown}s`
                   : 'Resend code'}
                </button>
              </div>

            </form>
          )}

        </div>
      </div>
    </div>
  );
};

export default VerifyOTP;
