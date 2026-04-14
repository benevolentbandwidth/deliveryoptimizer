// app/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import ShellNavbar from '@/app/edit/components/ShellNavbar';

/**
 * Entry point — asks the user whether they are a Route Manager or Driver.
 * Route Manager → /welcome (where they choose new vs returning session)
 * Driver        → /upload-route
 */
export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', background: '#fff', fontFamily: "'DM Sans', sans-serif" }}>
      <ShellNavbar />

      <main style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 48px)',
        padding: '40px 24px',
      }}>
        <h1 style={{
          fontSize: '2.25rem',
          fontWeight: 700,
          color: '#111',
          marginBottom: '12px',
          textAlign: 'center',
          letterSpacing: '-0.02em',
        }}>
          Welcome!
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#888',
          marginBottom: '48px',
          textAlign: 'center',
        }}>
          Choose your role to get started.
        </p>

        <div style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '720px',
        }}>
          {/* Route Manager → /welcome to pick new vs returning */}
          <button
            onClick={() => router.push('/welcome')}
            style={{
              flex: '1 1 280px',
              maxWidth: '340px',
              padding: '40px 28px',
              border: '1.5px solid #d4d2d0',
              borderRadius: '16px',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
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
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
              <circle cx="14" cy="10" r="4" stroke="#222" strokeWidth="1.8" fill="none"/>
              <path d="M14 10v8" stroke="#222" strokeWidth="1.8" strokeLinecap="round"/>
              <circle cx="14" cy="20" r="2" fill="#222"/>
              <path d="M8 26c0-4 2.7-7 6-7s6 3 6 7" stroke="#222" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
            </svg>
            <div>
              <p style={{ fontSize: '17px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>Route Manager</p>
              <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.5 }}>Create and manage delivery routes for your team.</p>
            </div>
          </button>

          {/* Driver → /upload-route directly */}
          <button
            onClick={() => router.push('/upload-route')}
            style={{
              flex: '1 1 280px',
              maxWidth: '340px',
              padding: '40px 28px',
              border: '1.5px solid #d4d2d0',
              borderRadius: '16px',
              background: '#fff',
              cursor: 'pointer',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '16px',
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
            <svg width="40" height="40" viewBox="0 0 28 28" fill="none">
              <rect x="3" y="10" width="22" height="12" rx="3" stroke="#222" strokeWidth="1.8" fill="none"/>
              <path d="M3 14h22" stroke="#222" strokeWidth="1.8"/>
              <path d="M7 10V7a7 7 0 0114 0v3" stroke="#222" strokeWidth="1.8" strokeLinecap="round" fill="none"/>
              <circle cx="8" cy="22" r="2.5" fill="#222"/>
              <circle cx="20" cy="22" r="2.5" fill="#222"/>
            </svg>
            <div>
              <p style={{ fontSize: '17px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>Driver</p>
              <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.5 }}>Upload your assigned route and start your deliveries.</p>
            </div>
          </button>
        </div>
      </main>
    </div>
  );
}