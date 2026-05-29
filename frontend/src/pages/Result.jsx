import React, { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import {
  Download, ArrowLeft, ShieldAlert,
  ShieldCheck, Brain, Zap, AlertCircle, Send, FileText,
  Maximize2, X
} from 'lucide-react';

const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:8000";

const STAGES = [
  { id: 'preprocess', label: 'Preprocessing MRI',   minSec: 0,  maxSec: 5,  pct: 20 },
  { id: 'inference',  label: 'Running AI Model',    minSec: 5,  maxSec: 12, pct: 65 },
  { id: 'gradcam',    label: 'Generating Heatmap',  minSec: 12, maxSec: 20, pct: 90 },
];

const getStageInfo = (secs) => {
  for (let i = STAGES.length - 1; i >= 0; i--) {
    if (secs >= STAGES[i].minSec) {
      const stage = STAGES[i];
      if (i < STAGES.length - 1) {
        const next  = STAGES[i + 1];
        const range = next.minSec - stage.minSec;
        const prog  = secs - stage.minSec;
        const pct   = stage.pct + ((next.pct - stage.pct) * Math.min(prog / range, 1));
        return { stageIdx: i, label: stage.label, pct: Math.min(pct, 94) };
      }
      return { stageIdx: i, label: stage.label, pct: stage.pct };
    }
  }
  return { stageIdx: 0, label: STAGES[0].label, pct: 5 };
};

/* ── Toast ── */
const Toast = ({ msg, type, onClose }) => {
  useEffect(() => { const t = setTimeout(onClose, 3500); return () => clearTimeout(t); }, [onClose]);
  const bg = type === 'error' ? '#FEF2F2' : '#F0FDF4';
  const cl = type === 'error' ? '#DC2626'  : '#16A34A';
  const br = type === 'error' ? '#FECACA'  : '#BBF7D0';
  return (
    <div style={{
      position: 'fixed', bottom: 24, right: 24, zIndex: 9999,
      background: bg, border: `1px solid ${br}`, borderRadius: 10,
      padding: '10px 16px', display: 'flex', alignItems: 'center', gap: 10,
      boxShadow: '0 4px 20px rgba(0,0,0,0.1)', animation: 'fadeUp .25s ease',
      maxWidth: 320,
    }}>
      <span style={{ fontSize: 13, color: cl, flex: 1 }}>{msg}</span>
      <button onClick={onClose} style={{ background: 'none', border: 'none', cursor: 'pointer', color: cl }}>
        <X size={13} />
      </button>
    </div>
  );
};

/* ── Clinical Notes ── */
const ClinicalNotes = ({ recordId }) => {
  const [notes,  setNotes]  = useState([]);
  const [text,   setText]   = useState('');
  const [saving, setSaving] = useState(false);
  const [loaded, setLoaded] = useState(false);
  const [toast,  setToast]  = useState(null);

  useEffect(() => {
    api.get(`/notes/${recordId}`)
      .then(r => { setNotes(r.data); setLoaded(true); })
      .catch(() => setLoaded(true));
  }, [recordId]);

  const addNote = async () => {
    if (!text.trim()) return;
    setSaving(true);
    try {
      const res = await api.post(`/notes/${recordId}`, { note: text.trim() });
      setNotes(prev => [...prev, res.data.note]);
      setText('');
      setToast({ msg: 'Note saved', type: 'success' });
    } catch {
      setToast({ msg: 'Failed to save note', type: 'error' });
    } finally { setSaving(false); }
  };

  return (
    <div style={{
      background: 'white', borderRadius: 14, border: '1px solid #E2E8F0',
      boxShadow: '0 2px 8px rgba(0,0,0,0.04)', padding: '14px 16px',
      display: 'flex', flexDirection: 'column', height: '100%',
    }}>
      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 10 }}>
        <FileText size={14} color="#7C3AED" />
        <span style={{ fontSize: 13, fontWeight: 700, color: '#0F172A' }}>Clinical Notes</span>
        {notes.length > 0 && (
          <span style={{ marginLeft: 'auto', fontSize: 11, color: '#94A3B8' }}>
            {notes.length} note{notes.length > 1 ? 's' : ''}
          </span>
        )}
      </div>

      <div style={{ flex: 1, overflowY: 'auto', marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 6 }}>
        {loaded && notes.length === 0 && (
          <p style={{ fontSize: 12, color: '#94A3B8', fontStyle: 'italic' }}>No notes yet.</p>
        )}
        {notes.map((n, i) => (
          <div key={i} style={{
            background: '#FAF5FF', border: '1px solid #EDE9FE',
            borderRadius: 9, padding: '8px 11px',
          }}>
            <p style={{ fontSize: 12, color: '#3B0764', lineHeight: 1.5 }}>{n.text}</p>
            <p style={{ fontSize: 10, color: '#94A3B8', marginTop: 3 }}>
              {n.author} · {new Date(n.created_at).toLocaleString()}
            </p>
          </div>
        ))}
      </div>

      <div style={{ display: 'flex', gap: 6 }}>
        <input
          value={text} onChange={e => setText(e.target.value)}
          onKeyDown={e => e.key === 'Enter' && !e.shiftKey && addNote()}
          placeholder="Add clinical note…"
          style={{
            flex: 1, fontSize: 12, padding: '7px 10px', borderRadius: 8,
            border: '1px solid #E2E8F0', outline: 'none', fontFamily: 'inherit',
          }}
        />
        <button onClick={addNote} disabled={saving || !text.trim()} style={{
          padding: '7px 12px', borderRadius: 8, border: 'none',
          background: text.trim() ? '#7C3AED' : '#E2E8F0',
          color: text.trim() ? 'white' : '#94A3B8',
          cursor: text.trim() ? 'pointer' : 'default', transition: 'all .15s',
        }}>
          <Send size={12} />
        </button>
      </div>
    </div>
  );
};

/* ── Heatmap lightbox ── */
const HeatmapLightbox = ({ src, onClose }) => (
  <div
    onClick={onClose}
    style={{
      position: 'fixed', inset: 0, zIndex: 9998,
      background: 'rgba(0,0,0,0.88)',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      animation: 'fadeUp .2s ease',
    }}
  >
    <button onClick={onClose} style={{
      position: 'absolute', top: 20, right: 20,
      background: 'rgba(255,255,255,0.1)', border: 'none', borderRadius: '50%',
      width: 36, height: 36, cursor: 'pointer', color: 'white',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
    }}>
      <X size={18} />
    </button>
    <img
      src={src} alt="Grad-CAM fullscreen"
      onClick={e => e.stopPropagation()}
      style={{
        maxWidth: '92vw', maxHeight: '88vh',
        borderRadius: 12, boxShadow: '0 24px 80px rgba(0,0,0,0.6)',
        objectFit: 'contain',
      }}
    />
  </div>
);

/* ════════════ MAIN RESULT ════════════ */
const Result = () => {
  const { id }                          = useParams();
  const [result,    setResult]          = useState(null);
  const [loading,   setLoading]         = useState(true);
  const [error,     setError]           = useState('');
  const [elapsed,   setElapsed]         = useState(0);
  const [imgLoaded, setImgLoaded]       = useState(false);
  const [lightbox,  setLightbox]        = useState(false);
  const [toast,     setToast]           = useState(null);
  const [pdfLoading, setPdfLoading]     = useState(false);

  const role        = localStorage.getItem('user_role') || 'patient';
  const isPatient   = role === 'patient';
  const isClinician = role === 'clinician';
  const isAdmin     = role === 'admin';
  const canSeeFull  = isClinician || isAdmin;
  const canPDF      = isClinician || isAdmin;
  const canNotes    = isClinician || isAdmin;

  useEffect(() => {
    if (!loading) return;
    const t = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    const run = async () => {
      try {
        const res = await api.post(`/predict/${id}`, {}, { timeout: 900000 });
        setResult({
          prediction : res.data.prediction,
          confidence : res.data.confidence_score ?? res.data.confidence,
          heatmap_url: `${BASE_URL}${res.data.heatmap_url}`,
        });
      } catch (err) {
        setError(err.response?.data?.detail || 'Analysis failed. Please try again.');
      } finally {
        setLoading(false);
      }
    };
    run();
  }, [id]);

  const handlePDF = async () => {
    setPdfLoading(true);
    try {
      const res = await api.get(`/report/${id}`, { responseType: 'blob' });
      const url = window.URL.createObjectURL(new Blob([res.data]));
      const a   = document.createElement('a');
      a.href = url; a.download = `NeuroScan_Report_${id.slice(0,8)}.pdf`; a.click();
      setToast({ msg: 'PDF downloaded successfully', type: 'success' });
    } catch {
      setToast({ msg: 'PDF not available — run analysis first', type: 'error' });
    } finally { setPdfLoading(false); }
  };

  const { stageIdx, label: stageLabel, pct } = getStageInfo(elapsed);
  const isSCZ       = result?.prediction === 'SCZ';
  const confVal     = result ? result.confidence * 100 : 0;
  const confPct     = confVal.toFixed(1);
  const accentColor = isSCZ ? '#E11D48' : '#059669';
  const accentLight = isSCZ ? '#FFE4E6' : '#DCFCE7';

  const patientTitle = isSCZ ? 'Further Review Recommended' : 'No Concerns Detected';
  const patientDesc  = isSCZ
    ? 'Your scan has been flagged for clinical review. Please consult your doctor.'
    : 'Your scan did not show any concerning patterns. Continue routine check-ups.';

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&family=DM+Mono:wght@400;500&display=swap');
        *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
        html, body, #root { height: 100%; overflow: hidden; }
        @keyframes fadeUp  { from{opacity:0;transform:translateY(10px)} to{opacity:1;transform:translateY(0)} }
        @keyframes spin    { to{transform:rotate(360deg)} }
        @keyframes pring   { 0%{transform:scale(.9);opacity:.6} 70%,100%{transform:scale(1.3);opacity:0} }
        @keyframes dbounce { 0%,80%,100%{transform:scale(.7);opacity:.4} 40%{transform:scale(1.1);opacity:1} }
        @keyframes shimmer { 0%{background-position:-600px 0} 100%{background-position:600px 0} }
        .f1 { animation: fadeUp .35s ease both; }
        .f2 { animation: fadeUp .35s .07s ease both; }
        .f3 { animation: fadeUp .35s .14s ease both; }
        .hm-img { opacity:0; transition:opacity .5s ease; cursor:zoom-in; }
        .hm-img.on { opacity:1; }
        .hm-img:hover { filter: brightness(1.05); }
        .shim {
          background: linear-gradient(90deg,#0D1117 25%,#1a1f2e 50%,#0D1117 75%);
          background-size: 600px 100%; animation: shimmer 1.4s infinite;
        }
        .abtn {
          display:inline-flex; align-items:center; gap:7px;
          padding:9px 16px; border-radius:10px;
          font-size:13px; font-weight:600; font-family:inherit;
          cursor:pointer; border:none; text-decoration:none;
          transition:all .15s ease;
        }
        .abtn:hover:not(:disabled) { transform:translateY(-1px); opacity:.92; }
        .abtn:disabled { opacity:.5; cursor:not-allowed; }
      `}</style>

      {toast && <Toast msg={toast.msg} type={toast.type} onClose={() => setToast(null)} />}
      {lightbox && result && (
        <HeatmapLightbox src={result.heatmap_url} onClose={() => setLightbox(false)} />
      )}

      <div style={{
        height: '100vh', overflow: 'hidden',
        display: 'flex', flexDirection: 'column',
        background: '#F8FAFC',
        fontFamily: "'DM Sans', system-ui, sans-serif",
      }}>
        <div style={{ flexShrink: 0 }}><Navbar /></div>

        <main style={{
          flex: 1, minHeight: 0,
          maxWidth: 1020, width: '100%',
          margin: '0 auto', padding: '10px 20px',
          display: 'flex', flexDirection: 'column', gap: 8,
        }}>

          <Link to="/dashboard" style={{
            flexShrink: 0, display: 'inline-flex', alignItems: 'center', gap: 5,
            fontSize: 13, fontWeight: 500, color: '#64748B', textDecoration: 'none',
          }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>

          {/* ══ LOADING ══ */}
          {loading && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div style={{
                background: 'white', borderRadius: 20, border: '1px solid #E2E8F0',
                padding: '28px 28px 24px', boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
                width: '100%', maxWidth: 420,
              }}>
                <div style={{ display: 'flex', justifyContent: 'center', marginBottom: 18 }}>
                  <div style={{ position: 'relative', width: 56, height: 56 }}>
                    <div style={{ position: 'absolute', inset: 0, borderRadius: '50%',
                                  border: '2px solid #BFDBFE', animation: 'pring 1.8s ease-out infinite' }} />
                    <svg style={{ position: 'absolute', inset: 0, animation: 'spin 1.4s linear infinite' }}
                      width={56} height={56} viewBox="0 0 56 56">
                      <circle cx={28} cy={28} r={24} fill="none" stroke="#EFF6FF" strokeWidth={4} />
                      <circle cx={28} cy={28} r={24} fill="none" stroke="#3B82F6" strokeWidth={4}
                        strokeLinecap="round" strokeDasharray="30 120" />
                    </svg>
                    <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      <Brain size={20} color="#3B82F6" />
                    </div>
                  </div>
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', textAlign: 'center', marginBottom: 3 }}>Analyzing MRI</h3>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5, marginBottom: 16 }}>
                  <span style={{ fontSize: 13, color: '#64748B' }}>{stageLabel}</span>
                  {[0,1,2].map(i => (
                    <div key={i} style={{ width: 4, height: 4, borderRadius: '50%', background: '#3B82F6',
                                          animation: `dbounce 1.4s ${i*.16}s infinite ease-in-out` }} />
                  ))}
                </div>
                <div style={{ marginBottom: 12 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: '#94A3B8', marginBottom: 5 }}>
                    <span>{Math.round(pct)}%</span>
                    <span style={{ fontFamily: "'DM Mono',monospace" }}>{elapsed}s</span>
                  </div>
                  <div style={{ height: 5, background: '#F1F5F9', borderRadius: 99, overflow: 'hidden' }}>
                    <div style={{ height: '100%', width: `${pct}%`, borderRadius: 99,
                                  background: 'linear-gradient(90deg,#3B82F6,#60A5FA)', transition: 'width 1s linear' }} />
                  </div>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {STAGES.map((stage, i) => {
                    const done = i < stageIdx, active = i === stageIdx;
                    return (
                      <div key={stage.id} style={{
                        display: 'flex', alignItems: 'center', gap: 8, padding: '7px 10px', borderRadius: 8,
                        background: done ? '#F0FDF4' : active ? '#EFF6FF' : '#F8FAFC',
                        border: `1px solid ${done ? '#BBF7D0' : active ? '#BFDBFE' : '#E2E8F0'}`,
                        opacity: i > stageIdx ? .5 : 1, transition: 'all .3s',
                      }}>
                        <div style={{ width: 17, height: 17, borderRadius: '50%', flexShrink: 0,
                                      background: done ? '#22C55E' : active ? '#3B82F6' : '#CBD5E1',
                                      display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                          {done ? (
                            <svg width={9} height={9} viewBox="0 0 9 9">
                              <polyline points="1.5,4.5 3.5,7 7.5,2.5" fill="none" stroke="white" strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                          ) : (
                            <div style={{ width: 5, height: 5, borderRadius: '50%', background: 'white',
                                          animation: active ? 'pring 1s ease-out infinite' : undefined }} />
                          )}
                        </div>
                        <span style={{ fontSize: 12, fontWeight: 500, flex: 1,
                                        color: done ? '#16A34A' : active ? '#2563EB' : '#94A3B8' }}>
                          {stage.label}
                        </span>
                        {done   && <span style={{ fontSize: 11, color: '#22C55E', fontWeight: 600 }}>Done</span>}
                        {active && <Zap size={11} color="#3B82F6" />}
                      </div>
                    );
                  })}
                </div>
                <p style={{ fontSize: 11, color: '#94A3B8', textAlign: 'center', marginTop: 12 }}>
                  Processing typically takes 20–40 seconds · Keep this tab open
                </p>
              </div>
            </div>
          )}

          {/* ══ ERROR ══ */}
          {!loading && error && (
            <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <div className="f1" style={{
                background: 'white', borderRadius: 20, border: '1px solid #FFE4E6',
                padding: '40px 32px', textAlign: 'center',
                boxShadow: '0 4px 24px rgba(0,0,0,0.06)', maxWidth: 360, width: '100%',
              }}>
                <div style={{ width: 48, height: 48, borderRadius: '50%', background: '#FFF1F2',
                              display: 'flex', alignItems: 'center', justifyContent: 'center', margin: '0 auto 14px' }}>
                  <AlertCircle size={20} color="#E11D48" />
                </div>
                <h3 style={{ fontSize: 16, fontWeight: 700, color: '#0F172A', marginBottom: 8 }}>Analysis Failed</h3>
                <p style={{ fontSize: 13, color: '#E11D48', marginBottom: 22 }}>{error}</p>
                <Link to="/upload" className="abtn" style={{ background: '#0F172A', color: 'white', margin: '0 auto' }}>
                  Try Again
                </Link>
              </div>
            </div>
          )}

          {/* ══ RESULT ══ */}
          {!loading && result && (
            <div style={{
              flex: 1, minHeight: 0,
              display: 'grid',
              gridTemplateColumns: '1fr 1fr',
              gridTemplateRows: 'auto 1fr',
              gap: 10,
            }}>

              {/* TOP LEFT — Diagnosis banner */}
              <div className="f1" style={{
                borderRadius: 16, overflow: 'hidden',
                background: isSCZ
                  ? 'linear-gradient(135deg,#881337 0%,#BE123C 55%,#E11D48 100%)'
                  : 'linear-gradient(135deg,#064E3B 0%,#065F46 55%,#059669 100%)',
                color: 'white', padding: '20px 22px 18px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
              }}>
                <div>
                  <div style={{
                    display: 'inline-flex', padding: '3px 9px', borderRadius: 20,
                    background: 'rgba(255,255,255,0.18)', marginBottom: 11,
                    fontSize: 10, fontWeight: 700, letterSpacing: '.06em', color: 'rgba(255,255,255,0.85)',
                  }}>DIAGNOSIS RESULT</div>

                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 7 }}>
                    {isSCZ ? <ShieldAlert size={20} color="rgba(255,255,255,0.9)" />
                           : <ShieldCheck size={20} color="rgba(255,255,255,0.9)" />}
                    <h2 style={{ fontSize: 19, fontWeight: 700, lineHeight: 1.2 }}>
                      {isPatient ? patientTitle
                        : isSCZ ? 'Schizophrenia Detected' : 'Normal — Control'}
                    </h2>
                  </div>

                  <p style={{ fontSize: 12, color: 'rgba(255,255,255,0.75)', lineHeight: 1.5 }}>
                    {isPatient ? patientDesc
                      : isSCZ
                        ? 'Structural patterns consistent with schizophrenia were identified.'
                        : 'No schizophrenia-related structural patterns were detected.'}
                  </p>
                </div>

                {canSeeFull && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between',
                                  fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 5 }}>
                      <span>Confidence</span>
                      <span style={{ fontWeight: 700, color: 'white', fontSize: 13 }}>{confPct}%</span>
                    </div>
                    <div style={{ height: 4, background: 'rgba(255,255,255,0.2)', borderRadius: 99, overflow: 'hidden' }}>
                      <div style={{ height: '100%', width: `${confPct}%`, background: 'white', borderRadius: 99,
                                    transition: 'width 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
                    </div>
                  </div>
                )}
              </div>

              {/* TOP RIGHT — confidence ring / patient card + actions */}
              <div className="f2" style={{
                background: 'white', borderRadius: 16, border: '1px solid #E2E8F0',
                boxShadow: '0 2px 12px rgba(0,0,0,0.04)', padding: '18px 20px',
                display: 'flex', flexDirection: 'column', justifyContent: 'space-between', gap: 12,
              }}>
                {canSeeFull ? (
                  <div style={{ display: 'flex', justifyContent: 'center' }}>
                    {(() => {
                      const r = 42, circ = 2 * Math.PI * r, off = circ - (confVal / 100) * circ;
                      return (
                        <svg width={108} height={108} viewBox="0 0 108 108">
                          <circle cx={54} cy={54} r={r} fill="none" stroke={accentLight} strokeWidth={10} />
                          <circle cx={54} cy={54} r={r} fill="none" stroke={accentColor} strokeWidth={10}
                            strokeLinecap="round" strokeDasharray={circ} strokeDashoffset={off}
                            style={{ transform: 'rotate(-90deg)', transformOrigin: '54px 54px',
                                     transition: 'stroke-dashoffset 1.2s cubic-bezier(0.34,1.56,0.64,1)' }} />
                          <text x={54} y={51} textAnchor="middle"
                            style={{ fontSize: 19, fontWeight: 700, fill: '#0F172A', fontFamily: "'DM Sans',sans-serif" }}>
                            {confPct}%
                          </text>
                          <text x={54} y={66} textAnchor="middle"
                            style={{ fontSize: 10, fill: '#94A3B8', fontFamily: "'DM Sans',sans-serif" }}>
                            confidence
                          </text>
                        </svg>
                      );
                    })()}
                  </div>
                ) : (
                  <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center',
                                justifyContent: 'center', flex: 1, gap: 10 }}>
                    <div style={{ width: 64, height: 64, borderRadius: '50%',
                                  background: isSCZ ? '#FFF1F2' : '#F0FDF4',
                                  display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                      {isSCZ ? <ShieldAlert size={28} color="#E11D48" />
                              : <ShieldCheck size={28} color="#059669" />}
                    </div>
                    <p style={{ fontSize: 12, color: '#64748B', textAlign: 'center', lineHeight: 1.5 }}>
                      {isSCZ
                        ? 'Please share this result with your healthcare provider.'
                        : 'Your scan looks healthy. Keep up with regular check-ups.'}
                    </p>
                  </div>
                )}

                <div style={{ background: '#FFFBEB', border: '1px solid #FDE68A', borderRadius: 9, padding: '9px 12px' }}>
                  <p style={{ fontSize: 11, color: '#92400E', lineHeight: 1.55 }}>
                    {isPatient
                      ? '⚠ This is a screening tool only. Always consult a qualified doctor.'
                      : '⚠ AI-generated for research only. Must be reviewed by a qualified clinician.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 8 }}>
                  <Link to="/dashboard" className="abtn"
                    style={{ background: '#F1F5F9', color: '#475569', flex: 1, justifyContent: 'center' }}>
                    <ArrowLeft size={13} /> Dashboard
                  </Link>
                  {canPDF && (
                    <button className="abtn" disabled={pdfLoading}
                      style={{ background: '#0F172A', color: 'white', flex: 1, justifyContent: 'center' }}
                      onClick={handlePDF}>
                      {pdfLoading
                        ? <><div style={{ width:13, height:13, border:'2px solid rgba(255,255,255,0.3)', borderTopColor:'white', borderRadius:'50%', animation:'spin .8s linear infinite' }} /> Generating…</>
                        : <><Download size={13} /> PDF Report</>}
                    </button>
                  )}
                </div>
              </div>

              {/* BOTTOM LEFT — Grad-CAM 3×3 grid */}
              <div className="f3" style={{
                gridColumn: canNotes ? '1 / 2' : '1 / -1',
                background: '#0D1117', borderRadius: 16,
                border: '1px solid #1E2D3D',
                boxShadow: '0 2px 12px rgba(0,0,0,0.15)', padding: '12px 14px',
                display: 'flex', flexDirection: 'column', minHeight: 0,
              }}>
                {/* Header */}
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                              marginBottom: 8, flexShrink: 0 }}>
                  <div>
                    <h3 style={{ fontSize: 13, fontWeight: 700, color: '#F1F5F9', marginBottom: 1 }}>
                      Grad-CAM Brain Activation Map
                    </h3>
                    <p style={{ fontSize: 11, color: '#4B5563' }}>
                      {isPatient
                        ? 'Brain regions highlighted by the AI model'
                        : '3 views × 3 highest-activation slices · custom neuro colormap'}
                    </p>
                  </div>
                  <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                    {canSeeFull && (
                      <div style={{ display: 'flex', gap: 4 }}>
                        {['Axial', 'Coronal', 'Sagittal'].map(v => (
                          <span key={v} style={{
                            padding: '2px 8px', borderRadius: 20,
                            fontSize: 10, fontWeight: 600,
                            background: '#1E2D3D', color: '#60A5FA',
                            border: '1px solid #2D3F50',
                          }}>{v}</span>
                        ))}
                      </div>
                    )}
                    {/* Expand button */}
                    <button
                      onClick={() => setLightbox(true)}
                      style={{
                        width: 28, height: 28, borderRadius: 7,
                        background: '#1E2D3D', border: '1px solid #2D3F50',
                        color: '#9CA3AF', cursor: 'pointer',
                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                      }}
                      title="View fullscreen"
                    >
                      <Maximize2 size={12} />
                    </button>
                  </div>
                </div>

                {/* Heatmap image — fills remaining space */}
                <div style={{
                  flex: 1, minHeight: 0, borderRadius: 8, overflow: 'hidden',
                  background: '#0D1117', position: 'relative',
                }}>
                  {!imgLoaded && (
                    <div className="shim" style={{
                      position: 'absolute', inset: 0,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                    }}>
                      <Brain size={24} color="#1E2D3D" />
                    </div>
                  )}
                  <img
                    src={`${result.heatmap_url}?t=${Date.now()}`}
                    alt="Grad-CAM heatmap"
                    className={`hm-img${imgLoaded ? ' on' : ''}`}
                    style={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block' }}
                    onLoad={() => setImgLoaded(true)}
                    onError={e => { e.target.style.display = 'none'; setImgLoaded(true); }}
                    onClick={() => setLightbox(true)}
                  />
                </div>

                {/* Color scale legend text */}
                {canSeeFull && imgLoaded && (
                  <div style={{
                    display: 'flex', justifyContent: 'space-between',
                    marginTop: 5, flexShrink: 0,
                  }}>
                    {['No Activation', 'Low', 'Medium', 'High', 'Peak'].map((lbl, i) => {
                      const colors = ['#1a1a2e', '#6B0F8E', '#C0392B', '#E67E22', '#F9E400'];
                      return (
                        <div key={lbl} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                          <div style={{ width: 8, height: 8, borderRadius: 2, background: colors[i] }} />
                          <span style={{ fontSize: 9, color: '#4B5563' }}>{lbl}</span>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* BOTTOM RIGHT — Clinical Notes (clinician/admin only) */}
              {canNotes && (
                <div className="f3" style={{ display: 'flex', flexDirection: 'column', minHeight: 0 }}>
                  <ClinicalNotes recordId={id} />
                </div>
              )}

            </div>
          )}
        </main>
      </div>
    </>
  );
};

export default Result;
