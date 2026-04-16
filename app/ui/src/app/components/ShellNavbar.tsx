// app/components/ShellNavbar.tsx
'use client';

/**
 * Minimal top bar for onboarding flow pages (landing, welcome, upload, address-entry).
 * Shows branding only — no Save/Export/Optimize actions, which belong exclusively
 * on the editor. Using the full edit Navbar here would require passing no-op handlers
 * for onOptimize/isOptimizing/optimizeError/onClearOptimizeError, which is misleading
 * and renders a non-functional Optimize button to the user.
 */
export default function ShellNavbar() {
  return (
    <header style={{
      height: '48px',
      background: '#f0efed',
      borderBottom: '1px solid #e0dedd',
      display: 'flex',
      alignItems: 'center',
      paddingLeft: '16px',
      paddingRight: '16px',
      gap: '10px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
    }}>
      <div style={{
        width: '28px',
        height: '28px',
        borderRadius: '50%',
        background: '#e0dedd',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        fontSize: '10px',
        color: '#888',
        fontFamily: 'inherit',
        flexShrink: 0,
      }}>
        logo
      </div>
      <span style={{
        fontSize: '15px',
        fontWeight: 500,
        color: '#1a1a1a',
        fontFamily: "'DM Sans', sans-serif",
      }}>
        Name
      </span>
    </header>
  );
}