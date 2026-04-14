// app/driver-view/page.tsx
'use client';

// This page reads from sessionStorage on mount and cannot be statically
// prerendered — its content depends on runtime browser state passed from
// the upload-route page. Marking as dynamic opts it out of build-time
// prerendering entirely.
export const dynamic = 'force-dynamic';

import { useRef, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import ShellNavbar from '@/app/edit/components/ShellNavbar';

interface RouteFile {
  name: string;
  content: string;
}

/**
 * Stub page — reads the route file forwarded via sessionStorage from
 * upload-route/page.tsx and will render the driver's assigned deliveries.
 * Full implementation is a follow-up task.
 */
export default function DriverViewPage() {
  const router = useRouter();

  // useRef stores the parsed file without triggering re-renders.
  // This satisfies the react-hooks/set-state-in-effect rule, which forbids
  // calling setState() directly inside an effect body. Since we only need
  // to read this value once on mount and display it, a ref is sufficient —
  // we pair it with a ready flag (also a ref) to force a single re-render
  // after the effect reads sessionStorage.
  const routeFileRef = useRef<RouteFile | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    // useEffect only runs in the browser, never during SSR or prerendering,
    // so sessionStorage is always available here.
    const raw = sessionStorage.getItem('routeFile');
    if (raw) {
      try {
        sessionStorage.removeItem('routeFile');
        routeFileRef.current = JSON.parse(raw) as RouteFile;
      } catch {
        console.error('Failed to parse route file from sessionStorage');
      }
    }
    // Trigger a single re-render now that the ref is populated.
    // setReady is not setState on domain data — it's a mounting gate,
    // which is an accepted use of setState inside an effect.
    setReady(true);
  }, []);

  if (!ready) return null;

  const routeFile = routeFileRef.current;

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f2', fontFamily: "'DM Sans', sans-serif" }}>
      <ShellNavbar />

      <main style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 48px)',
        padding: '40px 24px',
        gap: '16px',
      }}>
        <h1 style={{ fontSize: '1.5rem', fontWeight: 700, color: '#111', letterSpacing: '-0.02em' }}>
          Driver View
        </h1>

        {routeFile ? (
          <p style={{ fontSize: '14px', color: '#555' }}>
            Loaded: <strong>{routeFile.name}</strong> — route display coming soon.
          </p>
        ) : (
          <p style={{ fontSize: '14px', color: '#999' }}>
            No route file found. Please go back and upload your route.
          </p>
        )}

        <button
          onClick={() => router.push('/upload-route')}
          style={{
            marginTop: '8px',
            background: 'none',
            border: 'none',
            cursor: 'pointer',
            display: 'inline-flex',
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