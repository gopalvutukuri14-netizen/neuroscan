import React from 'react';
import { Link } from 'react-router-dom';
import { Brain, ArrowLeft } from 'lucide-react';

const NotFound = () => (
  <>
    <style>{`
      html, body, #root { height: 100%; overflow: hidden; margin: 0; }
      @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-12px)} }
    `}</style>
    <div style={{
      height: '100vh', overflow: 'hidden',
      background: 'linear-gradient(135deg, #F8FAFC 0%, #EFF6FF 100%)',
      display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      fontFamily: "'DM Sans', system-ui, sans-serif", textAlign: 'center',
      padding: '20px',
    }}>
      {/* Animated brain icon */}
      <div style={{
        width: 80, height: 80, background: 'white',
        borderRadius: 24, display: 'flex', alignItems: 'center', justifyContent: 'center',
        boxShadow: '0 8px 32px rgba(37,99,235,0.15)',
        marginBottom: 24, animation: 'float 3s ease-in-out infinite',
      }}>
        <Brain size={40} color="#3B82F6" />
      </div>

      {/* 404 */}
      <h1 style={{
        fontSize: 96, fontWeight: 900, lineHeight: 1,
        background: 'linear-gradient(135deg, #1E40AF, #7C3AED)',
        WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent',
        marginBottom: 8,
      }}>404</h1>

      <h2 style={{ fontSize: 22, fontWeight: 700, color: '#0F172A', marginBottom: 10 }}>
        Page Not Found
      </h2>
      <p style={{ fontSize: 14, color: '#64748B', maxWidth: 340, lineHeight: 1.6, marginBottom: 32 }}>
        The page you're looking for doesn't exist or has been moved.
      </p>

      <div style={{ display: 'flex', gap: 12 }}>
        <Link to="/dashboard" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: '#2563EB', color: 'white',
          padding: '10px 22px', borderRadius: 12,
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
          boxShadow: '0 4px 14px rgba(37,99,235,0.3)',
        }}>
          <ArrowLeft size={15} /> Go to Dashboard
        </Link>
        <Link to="/login" style={{
          display: 'inline-flex', alignItems: 'center', gap: 7,
          background: 'white', color: '#374151',
          padding: '10px 22px', borderRadius: 12,
          fontSize: 14, fontWeight: 600, textDecoration: 'none',
          border: '1.5px solid #E2E8F0',
        }}>
          Login
        </Link>
      </div>

      {/* Decorative dots */}
      <div style={{ position: 'absolute', bottom: 40, display: 'flex', gap: 6 }}>
        {[0,1,2].map(i => (
          <div key={i} style={{
            width: 8, height: 8, borderRadius: '50%',
            background: i === 1 ? '#3B82F6' : '#CBD5E1',
          }} />
        ))}
      </div>
    </div>
  </>
);

export default NotFound;
