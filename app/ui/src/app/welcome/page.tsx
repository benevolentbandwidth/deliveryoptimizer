// app/welcome/page.tsx
'use client';
import { useRouter, useSearchParams } from 'next/navigation';
import { Suspense } from 'react';
import { NavBar } from '@/app/components/AddressGeocoder/NavBar';

function WelcomeContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const userType = searchParams.get('type'); // 'new' | 'returning'

  const handleRouteManager = () => {
    if (userType === 'returning') {
      router.push('/upload-save-point');
    } else {
      router.push('/address-entry');
    }
  };

  const handleDriver = () => {
    router.push('/upload-route');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f2', fontFamily: "'DM Sans', sans-serif" }}>
      <NavBar showBack />

      <main style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 48px)',
        padding: '40px 24px',
      }}>
        <h1 style={{
          fontSize: '2rem',
          fontWeight: 700,
          color: '#111',
          marginBottom: '10px',
          textAlign: 'center',
          letterSpacing: '-0.02em',
        }}>
          Welcome!
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#888',
          marginBottom: '40px',
          textAlign: 'center',
        }}>
          Lorem ipsum dolor sit amet consectetur.
        </p>

        <div style={{
          display: 'flex',
          gap: '16px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '560px',
        }}>
          {/* Route Manager Card */}
          <button
            onClick={handleRouteManager}
            style={{
              flex: '1 1 200px',
              maxWidth: '240px',
              padding: '28px 20px',
              border: '1.5px solid #d4d2d0',
              borderRadius: '14px',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              textAlign: 'center',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#111';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4d2d0';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="10" r="4" stroke="#222" strokeWidth="1.8" fill="none"/>
              <path d="M14 10v8" stroke="#222" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="14" cy="20" r="2" fill="#222"/>
              <path d="M8 26c0-4 2.7-7 6-7s6 3 6 7" stroke="#222" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            </svg>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#111', marginBottom: '6px' }}>Route Manager</p>
              <p style={{ fontSize: '12px', color: '#999', lineHeight: 1.5 }}>Lorem ipsum dolor sit amet consectetur.</p>
            </div>
          </button>

          {/* Driver Card */}
          <button
            onClick={handleDriver}
            style={{
              flex: '1 1 200px',
              maxWidth: '240px',
              padding: '28px 20px',
              border: '1.5px solid #d4d2d0',
              borderRadius: '14px',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '12px',
              transition: 'border-color 0.15s, box-shadow 0.15s',
              textAlign: 'center',
            }}
            onMouseEnter={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#111';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = '0 4px 16px rgba(0,0,0,0.08)';
            }}
            onMouseLeave={e => {
              (e.currentTarget as HTMLButtonElement).style.borderColor = '#d4d2d0';
              (e.currentTarget as HTMLButtonElement).style.boxShadow = 'none';
            }}
          >
            <svg width="28" height="28" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="10" width="22" height="12" rx="3" stroke="#222" strokeWidth="1.8" fill="none"/>
              <path d="M3 14h22" stroke="#222" strokeWidth="1.8"/>
              <path d="M7 10V7a7 7 0 0114 0v3" stroke="#222" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              <circle cx="8" cy="22" r="2.5" fill="#222"/>
              <circle cx="20" cy="22" r="2.5" fill="#222"/>
            </svg>
            <div>
              <p style={{ fontSize: '14px', fontWeight: 700, color: '#111', marginBottom: '6px' }}>Driver</p>
              <p style={{ fontSize: '12px', color: '#999', lineHeight: 1.5 }}>Lorem ipsum dolor sit amet consectetur.</p>
            </div>
          </button>
        </div>

        <button
          onClick={() => router.back()}
          style={{
            marginTop: '36px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'flex',
            alignItems: 'center',
            gap: '6px',
            fontSize: '14px',
            color: '#555',
            fontFamily: 'inherit',
          }}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M10 3L5 8L10 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
          Back
        </button>
      </main>
    </div>
  );
}

export default function WelcomePage() {
  return (
    <Suspense>
      <WelcomeContent />
    </Suspense>
  );
}