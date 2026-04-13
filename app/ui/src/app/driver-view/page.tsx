// app/driver-view/page.tsx
'use client';

// This page reads from sessionStorage on mount and cannot be statically
// prerendered — its content depends on runtime browser state passed from
// the upload-route page. Marking as dynamic opts it out of build-time
// prerendering entirely.
export const dynamic = 'force-dynamic';

import { useState, useEffect } from 'react';
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
  const [init, setInit] = useState<{ ready: boolean; routeFile: RouteFile | null }>({
    ready: false,
    routeFile: null
  });

  // useEffect only runs in the browser — never during SSR or static
  // prerendering — so sessionStorage is always available here.
useEffect(() => {
  const raw = sessionStorage.getItem('routeFile');
  let parsed: RouteFile | null = null;
  if (raw) {
    try {
      parsed = JSON.parse(raw) as RouteFile;
      sessionStorage.removeItem('routeFile');
    } catch {
      console.error('Failed to parse route file from sessionStorage');
    }
  }
  setInit({ ready: true, routeFile: parsed });
}, []);

  // Render nothing until the client-side effect has run to avoid
  // a flash of the "no route file" message during hydration.
  if (!init.ready) return null;

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

        {init.routeFile ? (
          <p>Loaded: <strong>{init.routeFile.name}</strong> — route display coming soon.</p>
        ) : (
          <p>No route file found. Please go back and upload your route.</p>
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