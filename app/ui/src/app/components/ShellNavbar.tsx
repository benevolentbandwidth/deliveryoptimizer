// app/components/ShellNavbar.tsx
'use client';

/**
 * Minimal top bar for onboarding flow pages.
 * Upload pages use the text-only variant (no border, white bg).
 * Landing/welcome pages have no navbar — they use a full-bleed gradient layout.
 */
export default function ShellNavbar() {
  return (
    <header style={{
      height: '48px',
      background: '#ffffff',
      borderBottom: '1px solid #e8e8e8',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '20px',
      paddingRight: '20px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <span style={{
        fontSize: '12px',
        fontWeight: 700,
        letterSpacing: '0.08em',
        color: '#111',
        textTransform: 'uppercase',
        fontFamily: 'inherit',
      }}>
        Delivery Optimizer
      </span>
    </header>
  );
}