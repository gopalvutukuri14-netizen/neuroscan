import React, { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../services/api';
import Navbar from '../components/Navbar';
import {
  UploadCloud, FileCheck, AlertCircle, X,
  Zap, Clock, Info
} from 'lucide-react';

const ACCEPTED = ['.nii', '.nii.gz', '.dcm'];

const isValidFile = (file) =>
  file && ACCEPTED.some(ext => file.name.toLowerCase().endsWith(ext));

const formatSize = (bytes) => {
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

// ── Pipeline step estimates ────────────────────────────────────
const PIPELINE_STEPS = [
  { label: 'MRI Preprocessing',  time: '~5s',   icon: '⚙️' },
  { label: 'AI Model Inference', time: '~1s',   icon: '🧠' },
  { label: 'Grad-CAM Heatmap',   time: '~3s',   icon: '🔥' },
];

const Upload = () => {
  const [file,     setFile]     = useState(null);
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState('');
  const [dragging, setDragging] = useState(false);
  const inputRef  = useRef();
  const navigate  = useNavigate();

  const handleFile = (selected) => {
    if (isValidFile(selected)) {
      setFile(selected);
      setError('');
    } else {
      setFile(null);
      setError('Invalid file. Please select a .nii, .nii.gz, or .dcm file.');
    }
  };

  const handleDragOver  = (e) => { e.preventDefault(); setDragging(true);  };
  const handleDragLeave = (e) => { e.preventDefault(); setDragging(false); };
  const handleDrop      = (e) => {
    e.preventDefault();
    setDragging(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const handleUpload = async () => {
    if (!file) return;
    setLoading(true);
    setError('');
    const formData = new FormData();
    formData.append('file', file);
    try {
      const res = await api.post('/upload/', formData, {
        headers: { 'Content-Type': 'multipart/form-data' },
      });
      navigate(`/result/${res.data.record_id}`);
    } catch (err) {
      setError(err.response?.data?.detail || 'Upload failed. Please try again.');
      setLoading(false);
    }
  };

  return (
    <div style={{
      minHeight: '100vh',
      overflow: 'hidden',
      background: '#F8FAFC',
      fontFamily: "'DM Sans', system-ui, sans-serif",
    }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;600;700&display=swap');

        .up-root * { box-sizing: border-box; }

        @keyframes fadeUp {
          from { opacity: 0; transform: translateY(12px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes spin {
          to { transform: rotate(360deg); }
        }
        @keyframes borderPulse {
          0%, 100% { border-color: #93C5FD; }
          50%       { border-color: #2563EB; }
        }

        .card { animation: fadeUp 0.35s ease both; }

        .dropzone {
          border: 2px dashed #CBD5E1;
          border-radius: 16px;
          padding: 40px 24px;
          text-align: center;
          cursor: pointer;
          transition: all 0.2s ease;
          position: relative;
        }
        .dropzone:hover {
          border-color: #93C5FD;
          background: #F8FBFF;
        }
        .dropzone.dragging {
          border-color: #2563EB;
          background: #EFF6FF;
          animation: borderPulse 1s ease infinite;
        }
        .dropzone.has-file {
          border-color: #93C5FD;
          background: #F0F7FF;
          cursor: default;
        }

        .analyze-btn {
          width: 100%;
          padding: 14px;
          border-radius: 12px;
          border: none;
          font-size: 15px;
          font-weight: 600;
          font-family: inherit;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.18s ease;
          background: #1D4ED8;
          color: white;
          box-shadow: 0 2px 12px rgba(29,78,216,0.25);
        }
        .analyze-btn:hover:not(:disabled) {
          background: #1E40AF;
          box-shadow: 0 4px 20px rgba(29,78,216,0.35);
          transform: translateY(-1px);
        }
        .analyze-btn:active:not(:disabled) {
          transform: translateY(0);
        }
        .analyze-btn:disabled {
          background: #94A3B8;
          box-shadow: none;
          cursor: not-allowed;
        }

        .step-chip {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 10px 12px;
          background: #F8FAFC;
          border: 1px solid #E2E8F0;
          border-radius: 10px;
          flex: 1;
          min-width: 0;
        }

        .format-badge {
          display: inline-flex;
          align-items: center;
          padding: 3px 9px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          background: #EFF6FF;
          color: #1D4ED8;
          border: 1px solid #BFDBFE;
          font-family: 'DM Mono', monospace;
        }

        .spinner {
          width: 18px;
          height: 18px;
          border: 2.5px solid rgba(255,255,255,0.3);
          border-top-color: white;
          border-radius: 50%;
          animation: spin 0.8s linear infinite;
          flex-shrink: 0;
        }
      `}</style>

      <div className="up-root">
        <Navbar />

        <main style={{
          maxWidth: 520,
          margin: '0 auto',
          padding: '20px 20px',
        }}>

          {/* ── Header ── */}
          <div className="card" style={{ textAlign: 'center', marginBottom: 28 }}>
            <div style={{
              width: 52, height: 52,
              background: 'linear-gradient(135deg, #2563EB, #1D4ED8)',
              borderRadius: 14,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              margin: '0 auto 14px',
              boxShadow: '0 4px 16px rgba(37,99,235,0.3)',
            }}>
              <UploadCloud size={24} color="white" />
            </div>
            <h1 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A',
                        margin: '0 0 6px', letterSpacing: '-0.01em' }}>
              Upload MRI Scan
            </h1>
            <p style={{ fontSize: 13, color: '#64748B', margin: 0 }}>
              Schizophrenia detection powered by 3D-CNN + ViT hybrid model
            </p>
          </div>

          {/* ── Main card ── */}
          <div className="card" style={{
            background: 'white',
            borderRadius: 20,
            border: '1px solid #E2E8F0',
            padding: '28px 28px 24px',
            boxShadow: '0 4px 24px rgba(0,0,0,0.06)',
            animationDelay: '0.05s',
          }}>

            {/* Formats */}
            <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
              {['.nii', '.nii.gz', '.dcm'].map(f => (
                <span key={f} className="format-badge">{f}</span>
              ))}
              <span style={{ fontSize: 12, color: '#94A3B8',
                            alignSelf: 'center', marginLeft: 'auto' }}>
                up to 500 MB
              </span>
            </div>

            {/* Drop zone */}
            <div
              className={`dropzone${file ? ' has-file' : ''}${dragging ? ' dragging' : ''}`}
              onDragOver={handleDragOver}
              onDragLeave={handleDragLeave}
              onDrop={handleDrop}
              onClick={() => !file && inputRef.current?.click()}
            >
              <input
                ref={inputRef}
                type="file"
                style={{ display: 'none' }}
                onChange={e => handleFile(e.target.files[0])}
                accept=".nii,.nii.gz,.dcm"
              />

              {file ? (
                <div style={{ display: 'flex', alignItems: 'center',
                              justifyContent: 'space-between', gap: 12 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
                    <div style={{
                      width: 40, height: 40,
                      background: '#EFF6FF',
                      borderRadius: 10,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      flexShrink: 0,
                    }}>
                      <FileCheck size={18} color="#2563EB" />
                    </div>
                    <div style={{ minWidth: 0 }}>
                      <p style={{ fontSize: 13, fontWeight: 600, color: '#0F172A',
                                  margin: '0 0 2px', overflow: 'hidden',
                                  textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {file.name}
                      </p>
                      <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                        {formatSize(file.size)}
                      </p>
                    </div>
                  </div>
                  <button
                    onClick={e => { e.stopPropagation(); setFile(null); }}
                    style={{
                      width: 30, height: 30,
                      borderRadius: '50%',
                      border: '1px solid #E2E8F0',
                      background: 'white',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      cursor: 'pointer', flexShrink: 0,
                      transition: 'all 0.15s',
                    }}
                    onMouseEnter={e => {
                      e.currentTarget.style.background = '#FEF2F2';
                      e.currentTarget.style.borderColor = '#FCA5A5';
                    }}
                    onMouseLeave={e => {
                      e.currentTarget.style.background = 'white';
                      e.currentTarget.style.borderColor = '#E2E8F0';
                    }}
                  >
                    <X size={14} color="#94A3B8" />
                  </button>
                </div>
              ) : (
                <div>
                  <UploadCloud
                    size={40}
                    color={dragging ? '#2563EB' : '#CBD5E1'}
                    style={{ marginBottom: 12, transition: 'color 0.2s' }}
                  />
                  <p style={{ fontSize: 14, fontWeight: 600, color: '#374151',
                              margin: '0 0 4px' }}>
                    {dragging ? 'Drop your MRI file here' : 'Drag & drop your MRI scan'}
                  </p>
                  <p style={{ fontSize: 12, color: '#94A3B8', margin: 0 }}>
                    or{' '}
                    <span style={{ color: '#2563EB', fontWeight: 600 }}>click to browse</span>
                  </p>
                </div>
              )}
            </div>

            {/* Error */}
            {error && (
              <div style={{
                display: 'flex', alignItems: 'flex-start', gap: 9,
                padding: '10px 14px',
                background: '#FEF2F2',
                border: '1px solid #FECACA',
                borderRadius: 10,
                marginTop: 14,
              }}>
                <AlertCircle size={15} color="#DC2626" style={{ flexShrink: 0, marginTop: 1 }} />
                <p style={{ fontSize: 13, color: '#DC2626', margin: 0 }}>{error}</p>
              </div>
            )}

            {/* ── GPU Time Estimate Panel ── */}
            <div style={{
              marginTop: 20,
              padding: '14px 16px',
              background: 'linear-gradient(135deg, #F0F9FF, #E0F2FE)',
              border: '1px solid #BAE6FD',
              borderRadius: 12,
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 10 }}>
                <Zap size={13} color="#0369A1" />
                <span style={{ fontSize: 12, fontWeight: 700, color: '#0369A1',
                              textTransform: 'uppercase', letterSpacing: '0.06em' }}>
                  GPU Accelerated
                </span>
                <div style={{
                  marginLeft: 'auto',
                  display: 'flex', alignItems: 'center', gap: 5,
                }}>
                  <Clock size={12} color="#0369A1" />
                  <span style={{ fontSize: 12, fontWeight: 700, color: '#0369A1' }}>
                    ~20–25 seconds
                  </span>
                </div>
              </div>

              {/* Steps row */}
              <div style={{ display: 'flex', gap: 6 }}>
                {PIPELINE_STEPS.map((step, i) => (
                  <div key={i} className="step-chip">
                    <span style={{ fontSize: 14, flexShrink: 0 }}>{step.icon}</span>
                    <div style={{ minWidth: 0 }}>
                      <div style={{ fontSize: 11, fontWeight: 600, color: '#0F172A',
                                    overflow: 'hidden', textOverflow: 'ellipsis',
                                    whiteSpace: 'nowrap' }}>
                        {step.label}
                      </div>
                      <div style={{ fontSize: 11, color: '#64748B',
                                    fontFamily: "'DM Mono', monospace" }}>
                        {step.time}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Analyze button */}
            <button
              className="analyze-btn"
              onClick={handleUpload}
              disabled={!file || loading}
              style={{ marginTop: 18 }}
            >
              {loading ? (
                <>
                  <div className="spinner" />
                  Uploading...
                </>
              ) : (
                <>
                  <UploadCloud size={16} />
                  {file ? 'Analyze Scan' : 'Select a file first'}
                </>
              )}
            </button>

            {/* Footer note */}
            <div style={{
              display: 'flex', alignItems: 'flex-start', gap: 6,
              marginTop: 14,
            }}>
              <Info size={12} color="#94A3B8" style={{ flexShrink: 0, marginTop: 1 }} />
              <p style={{ fontSize: 11, color: '#94A3B8', margin: 0, lineHeight: 1.5 }}>
                Results include AI prediction, confidence score, and Grad-CAM brain
                heatmap. For research use only — always confirm with a clinician.
              </p>
            </div>

          </div>
        </main>
      </div>
    </div>
  );
};

export default Upload;