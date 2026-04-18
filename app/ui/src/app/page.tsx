// app/page.tsx
'use client';
import { useRouter } from 'next/navigation';

// No ShellNavbar on landing — the design uses a full-bleed gradient
// layout with the app name as a page-level heading, not a sticky bar.
export default function LandingPage() {
  const router = useRouter();

  return (
    <div style={{
      minHeight: '100vh',
      background: `
        radial-gradient(ellipse 80% 60% at 100% 100%, rgba(74, 157, 127, 0.55) 0%, rgba(74, 157, 127, 0) 60%),
        radial-gradient(ellipse 70% 50% at 0% 100%, rgba(120, 180, 155, 0.35) 0%, rgba(120, 180, 155, 0) 55%),
        radial-gradient(ellipse 60% 50% at 100% 0%, rgba(168, 210, 192, 0.28) 0%, rgba(168, 210, 192, 0) 60%),
        linear-gradient(135deg, #f7fbf9 0%, #eaf3ee 45%, #a8d2c0 100%)
      `,
      fontFamily: "'DM Sans', sans-serif",
      display: 'flex',
      flexDirection: 'column',
    }}>
      {/* Minimal top bar — brand name only, no border */}
      <header style={{
        background: '#ffffff',
        padding: '16px 24px',
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#111',
        textTransform: 'uppercase',
      }}>
        Delivery Optimizer
      </header>

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <h1 style={{
          fontSize: '2.75rem',
          fontWeight: 700,
          color: '#111',
          marginBottom: '16px',
          textAlign: 'center',
          letterSpacing: '-0.02em',
          lineHeight: 1.15,
        }}>
          Delivery Optimizer
        </h1>
        <p style={{
          fontSize: '15px',
          color: '#555',
          marginBottom: '48px',
          textAlign: 'center',
          maxWidth: '480px',
          lineHeight: 1.6,
        }}>
          Transform your address lists into efficient, ordered routes to lower
          operational costs and reduce your fleet&apos;s carbon emissions.
        </p>

        <div style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))',
          gap: '16px',
          width: '100%',
          maxWidth: '780px',
        }}>
          {/* Route Manager card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <path d="M12 2C8.686 2 6 4.686 6 8c0 4.418 6 12 6 12s6-7.582 6-12c0-3.314-2.686-6-6-6z" stroke="#4a9d7f" strokeWidth="1.8" fill="none" />
              <circle cx="12" cy="8" r="2" stroke="#4a9d7f" strokeWidth="1.8" fill="none" />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '17px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
                Route manager
              </p>
              <p style={{ fontSize: '13px', color: '#777', lineHeight: 1.6 }}>
                Import routes, edit addresses, assign deliveries, monitor fleet
                routes, and export delivery operations.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => router.push('/welcome')}
                style={{
                  background: '#4a9d7f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#3d8a6d')}
                onMouseLeave={e => (e.currentTarget.style.background = '#4a9d7f')}
              >
                Continue
              </button>
            </div>
          </div>

          {/* Driver card */}
          <div style={{
            background: '#ffffff',
            borderRadius: '16px',
            padding: '28px',
            display: 'flex',
            flexDirection: 'column',
            gap: '12px',
            boxShadow: '0 1px 4px rgba(0,0,0,0.06)',
          }}>
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
              <rect x="1" y="8" width="18" height="10" rx="2" stroke="#4a9d7f" strokeWidth="1.8" fill="none" />
              <path d="M19 11h2l2 3v3h-4" stroke="#4a9d7f" strokeWidth="1.8" strokeLinecap="round" fill="none" />
              <circle cx="6" cy="19" r="2" stroke="#4a9d7f" strokeWidth="1.8" fill="none" />
              <circle cx="16" cy="19" r="2" stroke="#4a9d7f" strokeWidth="1.8" fill="none" />
            </svg>
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '17px', fontWeight: 700, color: '#111', marginBottom: '8px' }}>
                Driver
              </p>
              <p style={{ fontSize: '13px', color: '#777', lineHeight: 1.6 }}>
                View your assigned route, navigate through addresses, update
                delivery status, and import file from route manager.
              </p>
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
              <button
                onClick={() => router.push('/upload-route')}
                style={{
                  background: '#4a9d7f',
                  color: '#fff',
                  border: 'none',
                  borderRadius: '999px',
                  padding: '10px 24px',
                  fontSize: '14px',
                  fontWeight: 600,
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  transition: 'background 0.15s',
                }}
                onMouseEnter={e => (e.currentTarget.style.background = '#3d8a6d')}
                onMouseLeave={e => (e.currentTarget.style.background = '#4a9d7f')}
              >
                Continue
              </button>
            </div>
          </div>
        </div>
      </main>

      <footer style={{
        background: '#ffffff',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '20px 24px',
      }}>
        <img src="/logo.png" alt="b²" style={{ height: '32px', width: 'auto', display: 'block' }} />
        <span style={{ fontSize: '12px', color: '#000' }}>
          Built with ❤️ for Humanity. The Benevolent Bandwidth Foundation
        </span>
      </footer>
    </div>
  );
}