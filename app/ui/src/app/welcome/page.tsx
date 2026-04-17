// app/welcome/page.tsx
'use client';
import { useRouter } from 'next/navigation';
import ShellNavbar from '@/app/components/ShellNavbar';

/**
 * Route Manager session type selector.
 * Only reachable via the Route Manager card on the landing page.
 * New       → /address-entry
 * Returning → /upload-save-point
 *
 * The ?type query param has been removed — this page owns the
 * new/returning decision directly, eliminating the need for
 * useSearchParams and the Suspense wrapper that it required.
 */
export default function WelcomePage() {
  const router = useRouter();

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: "'DM Sans', sans-serif" }}>
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
          New or Returning?
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#888',
          marginBottom: '48px',
          textAlign: 'center',
        }}>
          Select how you&apos;d like to get started.
        </p>

        <div style={{
          display: 'flex',
          gap: '20px',
          flexWrap: 'wrap',
          justifyContent: 'center',
          width: '100%',
          maxWidth: '720px',
        }}>
          {/* New session → address entry */}
          <button
            onClick={() => router.push('/address-entry')}
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
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="16" cy="13" r="6" stroke="#222" strokeWidth="2" fill="none"/>
              <path d="M4 34c0-7 5.4-12 12-12h2" stroke="#222" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <circle cx="30" cy="30" r="8" stroke="#222" strokeWidth="2" fill="none"/>
              <line x1="30" y1="26" x2="30" y2="34" stroke="#222" strokeWidth="2" strokeLinecap="round"/>
              <line x1="26" y1="30" x2="34" y2="30" stroke="#222" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            <div>
              <p style={{ fontSize: '17px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>New</p>
              <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.5 }}>First time here? Start by entering your delivery addresses.</p>
            </div>
          </button>

          {/* Returning session → upload save point */}
          <button
            onClick={() => router.push('/upload-save-point')}
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
            <svg width="40" height="40" viewBox="0 0 40 40" fill="none">
              <circle cx="18" cy="13" r="6" stroke="#222" strokeWidth="2" fill="none"/>
              <path d="M4 34c0-7 5.4-12 12-12h6" stroke="#222" strokeWidth="2" strokeLinecap="round" fill="none"/>
              <path d="M24 28l4 4 8-8" stroke="#222" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" fill="none"/>
            </svg>
            <div>
              <p style={{ fontSize: '17px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>Returning</p>
              <p style={{ fontSize: '14px', color: '#888', lineHeight: 1.5 }}>Welcome back. Upload your save file to continue where you left off.</p>
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
