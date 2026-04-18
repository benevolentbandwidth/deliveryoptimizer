// app/upload-save-point/page.tsx
'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ShellNavbar from '@/app/components/ShellNavbar';

export default function UploadSavePointPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.name.endsWith('.json')) setFile(f);
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current += 1;
    setIsDragging(true);
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current -= 1;
    if (dragDepth.current === 0) setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    dragDepth.current = 0;
    setIsDragging(false);
    const f = e.dataTransfer.files[0];
    if (f) handleFile(f);
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(0)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  const handleContinue = async () => {
    if (!file) return;
    // Serialise the file into sessionStorage so the editor can read it
    // after navigation — local state is dropped on router.push().
    // Routes to /edit directly: returning users land in the editor with
    // their save data pre-loaded, bypassing the address-entry upload flow
    // which is only for new sessions.
    const text = await file.text();
    sessionStorage.setItem('savePointFile', JSON.stringify({ name: file.name, content: text }));
    router.push('/edit');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#ffffff', fontFamily: "'DM Sans', sans-serif", display: 'flex', flexDirection: 'column' }}>
      <ShellNavbar />

      <main style={{
        flex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '40px 24px',
      }}>
        <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111', marginBottom: '8px', textAlign: 'center', letterSpacing: '-0.01em' }}>
          Upload your save point
        </h2>
        <p style={{ fontSize: '14px', color: '#999', marginBottom: '28px', textAlign: 'center' }}>
          Continue editing from where you left off.
        </p>

        {/* Drop zone */}
        <div
          onClick={() => inputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragOver={e => e.preventDefault()}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            width: '100%',
            maxWidth: '600px',
            border: `1.5px dashed ${isDragging ? '#4a9d7f' : '#ccc'}`,
            borderRadius: '12px',
            padding: '48px 20px',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '10px',
            cursor: 'pointer',
            background: isDragging ? '#f0f9f6' : '#f7f7f5',
            transition: 'all 0.15s',
            marginBottom: file ? '12px' : '28px',
          }}
        >
          <svg width="36" height="40" viewBox="0 0 36 40" fill="none">
            <rect x="1" y="1" width="26" height="34" rx="3" stroke="#555" strokeWidth="1.5" fill="none" />
            <path d="M7 8h12M7 13h12M7 18h8" stroke="#555" strokeWidth="1.5" strokeLinecap="round" />
            <path d="M18 28v-8M18 20l-3 3M18 20l3 3" stroke="#555" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
          <p style={{ fontSize: '14px', color: '#555', textAlign: 'center' }}>
            Drag and drop CSV files here, or
          </p>
          <span style={{ fontSize: '14px', color: '#4a9d7f', fontWeight: 500 }}>
            Browse files
          </span>
          <input
            ref={inputRef}
            type="file"
            accept=".json"
            style={{ display: 'none' }}
            onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
          />
        </div>

        {/* File loaded row */}
        {file && (
          <div style={{
            width: '100%',
            maxWidth: '600px',
            background: '#e8f4f0',
            borderRadius: '8px',
            padding: '12px 16px',
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            marginBottom: '28px',
          }}>
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M9 1H3a1 1 0 00-1 1v12a1 1 0 001 1h10a1 1 0 001-1V6L9 1z" stroke="#4a9d7f" strokeWidth="1.2" fill="none" />
              <path d="M9 1v5h5" stroke="#4a9d7f" strokeWidth="1.2" />
            </svg>
            <span style={{ flex: 1, fontSize: '13px', fontWeight: 500, color: '#1a1a1a' }}>{file.name}</span>
            <span style={{ fontSize: '12px', color: '#777', marginRight: '8px' }}>{formatSize(file.size)}</span>
            <button
              onClick={e => { e.stopPropagation(); setFile(null); }}
              style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#777', padding: '2px', display: 'flex', alignItems: 'center' }}
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M1 1l12 12M13 1L1 13" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
              </svg>
            </button>
          </div>
        )}

        {/* Back / Continue row */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', maxWidth: '600px' }}>
          <button
            onClick={() => router.back()}
            style={{ background: 'none', border: 'none', cursor: 'pointer', fontSize: '14px', color: '#555', fontFamily: 'inherit', padding: '10px 0' }}
          >
            Back
          </button>
          <button
            onClick={handleContinue}
            disabled={!file}
            style={{
              background: file ? '#4a9d7f' : '#c8d8d3',
              color: '#fff',
              border: 'none',
              borderRadius: '999px',
              padding: '11px 28px',
              fontSize: '14px',
              fontWeight: 600,
              cursor: file ? 'pointer' : 'not-allowed',
              fontFamily: 'inherit',
              transition: 'background 0.15s',
            }}
          >
            Continue
          </button>
        </div>
      </main>
    </div>
  );
}