import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../services/api';
import { Brain, Mail, Lock, KeyRound, Eye, EyeOff, ArrowLeft, CheckCircle2 } from 'lucide-react';

/*
  3-step forgot password flow:
  Step 1 — Enter email → backend sends OTP via Brevo
  Step 2 — Enter 6-digit OTP
  Step 3 — Enter new password + confirm → reset
*/

const STEP_EMAIL    = 1;
const STEP_OTP      = 2;
const STEP_PASSWORD = 3;
const STEP_DONE     = 4;

const inputCls =
  'appearance-none block w-full pl-10 pr-10 py-2.5 border border-slate-300 rounded-lg shadow-sm ' +
  'placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm';

const ForgotPassword = () => {
  const navigate  = useNavigate();

  const [step,        setStep]        = useState(STEP_EMAIL);
  const [email,       setEmail]       = useState('');
  const [otp,         setOtp]         = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPass, setConfirmPass] = useState('');
  const [showNew,     setShowNew]     = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [error,       setError]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [resendTimer, setResendTimer] = useState(0);

  // ── Step 1: Request OTP ────────────────────────────────────
  const handleRequestOtp = async (e) => {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/forgot-password', { email });
      setStep(STEP_OTP);
      startResendTimer();
    } catch (err) {
      setError(err.response?.data?.detail || 'Could not send OTP. Check your email address.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 2: Verify OTP ─────────────────────────────────────
  const handleVerifyOtp = async (e) => {
    e.preventDefault();
    setError('');
    if (otp.length !== 6) { setError('Please enter the 6-digit OTP.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/verify-reset-otp', { email, otp });
      setStep(STEP_PASSWORD);
    } catch (err) {
      setError(err.response?.data?.detail || 'Invalid or expired OTP.');
    } finally {
      setLoading(false);
    }
  };

  // ── Step 3: Reset Password ─────────────────────────────────
  const handleResetPassword = async (e) => {
    e.preventDefault();
    setError('');
    if (newPassword.length < 6) { setError('Password must be at least 6 characters.'); return; }
    if (newPassword !== confirmPass) { setError('Passwords do not match.'); return; }
    setLoading(true);
    try {
      await api.post('/auth/reset-password', { email, otp, new_password: newPassword });
      setStep(STEP_DONE);
    } catch (err) {
      setError(err.response?.data?.detail || 'Password reset failed. Try again.');
    } finally {
      setLoading(false);
    }
  };

  // ── Resend OTP with 60s cooldown ───────────────────────────
  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer(t => {
        if (t <= 1) { clearInterval(interval); return 0; }
        return t - 1;
      });
    }, 1000);
  };

  const handleResend = async () => {
    if (resendTimer > 0) return;
    setError('');
    try {
      await api.post('/auth/forgot-password', { email });
      startResendTimer();
    } catch (err) {
      setError(err.response?.data?.detail || 'Failed to resend OTP.');
    }
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col justify-center py-12 sm:px-6 lg:px-8">
      <div className="sm:mx-auto sm:w-full sm:max-w-md flex flex-col items-center">
        <div className="w-14 h-14 bg-blue-600 rounded-2xl flex items-center justify-center mb-4 shadow-lg shadow-blue-200">
          <Brain className="h-7 w-7 text-white" />
        </div>
        <h2 className="text-center text-3xl font-extrabold text-slate-900">
          {step === STEP_DONE ? 'Password Reset!' : 'Forgot Password'}
        </h2>
        <p className="mt-1 text-sm text-slate-500">
          {step === STEP_EMAIL    && 'Enter your email to receive a reset code'}
          {step === STEP_OTP      && `We sent a 6-digit code to ${email}`}
          {step === STEP_PASSWORD && 'Create your new password'}
          {step === STEP_DONE     && 'You can now sign in with your new password'}
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md">
        <div className="bg-white py-8 px-4 shadow-xl shadow-slate-200/50 sm:rounded-2xl sm:px-10 border border-slate-100">

          {/* ── Step indicator ── */}
          {step !== STEP_DONE && (
            <div className="flex items-center justify-center gap-2 mb-6">
              {[STEP_EMAIL, STEP_OTP, STEP_PASSWORD].map(s => (
                <div key={s} className="flex items-center gap-2">
                  <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    step === s
                      ? 'bg-blue-600 text-white'
                      : step > s
                      ? 'bg-green-500 text-white'
                      : 'bg-slate-200 text-slate-400'
                  }`}>
                    {step > s ? '✓' : s}
                  </div>
                  {s < STEP_PASSWORD && (
                    <div className={`w-8 h-0.5 ${step > s ? 'bg-green-400' : 'bg-slate-200'}`} />
                  )}
                </div>
              ))}
            </div>
          )}

          {/* ── STEP 1: Email ── */}
          {step === STEP_EMAIL && (
            <form className="space-y-5" onSubmit={handleRequestOtp}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Email address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="email" required autoComplete="email"
                    placeholder="you@example.com"
                    value={email} onChange={e => setEmail(e.target.value)}
                    className={inputCls}
                  />
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? 'Sending code…' : 'Send Reset Code'}
              </button>
            </form>
          )}

          {/* ── STEP 2: OTP ── */}
          {step === STEP_OTP && (
            <form className="space-y-5" onSubmit={handleVerifyOtp}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">6-digit OTP</label>
                <div className="relative">
                  <KeyRound className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text" required maxLength={6} inputMode="numeric" autoComplete="one-time-code"
                    placeholder="e.g. 482910"
                    value={otp} onChange={e => setOtp(e.target.value.replace(/\D/g, ''))}
                    className={inputCls}
                  />
                </div>
                <div className="flex items-center justify-between mt-2">
                  <p className="text-xs text-slate-400">Check your inbox (and spam folder)</p>
                  <button
                    type="button"
                    onClick={handleResend}
                    disabled={resendTimer > 0}
                    className="text-xs font-medium text-blue-600 hover:text-blue-500 disabled:text-slate-400 disabled:cursor-not-allowed"
                  >
                    {resendTimer > 0 ? `Resend in ${resendTimer}s` : 'Resend OTP'}
                  </button>
                </div>
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? 'Verifying…' : 'Verify Code'}
              </button>
            </form>
          )}

          {/* ── STEP 3: New Password ── */}
          {step === STEP_PASSWORD && (
            <form className="space-y-5" onSubmit={handleResetPassword}>
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showNew ? 'text' : 'password'} required minLength={6}
                    placeholder="Min. 6 characters"
                    value={newPassword} onChange={e => setNewPassword(e.target.value)}
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowNew(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type={showConfirm ? 'text' : 'password'} required minLength={6}
                    placeholder="Repeat new password"
                    value={confirmPass} onChange={e => setConfirmPass(e.target.value)}
                    className={inputCls}
                  />
                  <button type="button" onClick={() => setShowConfirm(v => !v)} tabIndex={-1}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600">
                    {showConfirm ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
                {confirmPass && newPassword !== confirmPass && (
                  <p className="text-xs text-red-500 mt-1">Passwords do not match</p>
                )}
                {confirmPass && newPassword === confirmPass && (
                  <p className="text-xs text-green-600 mt-1">✓ Passwords match</p>
                )}
              </div>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-2.5">
                  {error}
                </div>
              )}

              <button type="submit" disabled={loading}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 disabled:opacity-50 transition-colors">
                {loading ? 'Resetting…' : 'Reset Password'}
              </button>
            </form>
          )}

          {/* ── STEP 4: Done ── */}
          {step === STEP_DONE && (
            <div className="flex flex-col items-center gap-4 py-4">
              <div className="w-16 h-16 rounded-full bg-green-100 flex items-center justify-center">
                <CheckCircle2 className="w-8 h-8 text-green-600" />
              </div>
              <p className="text-sm text-slate-600 text-center">
                Your password has been reset successfully.
              </p>
              <button
                onClick={() => navigate('/login')}
                className="w-full flex justify-center py-2.5 px-4 border border-transparent rounded-xl shadow-sm text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 transition-colors"
              >
                Go to Login
              </button>
            </div>
          )}

          {/* Back to login link */}
          {step !== STEP_DONE && (
            <div className="mt-6 text-center">
              <Link to="/login" className="inline-flex items-center gap-1 text-sm text-slate-500 hover:text-slate-700">
                <ArrowLeft className="w-3 h-3" /> Back to login
              </Link>
            </div>
          )}

        </div>
      </div>
    </div>
  );
};

export default ForgotPassword;
