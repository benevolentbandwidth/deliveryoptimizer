// app/upload-save-point/page.tsx
'use client';
import { useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import ShellNavbar from '@/app/edit/components/ShellNavbar';

export default function UploadSavePointPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  // Tracks drag enter/leave depth to prevent flicker when cursor
  // moves over child elements inside the drop zone.
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

  const handleContinue = async () => {
    if (!file) return;
    // Serialise the file into sessionStorage so the editor can read it
    // after navigation — local state is dropped on router.push().
    const text = await file.text();
    sessionStorage.setItem('savePointFile', JSON.stringify({ name: file.name, content: text }));
    router.push('/edit');
  };

  return (
    <div style={{ minHeight: '100vh', background: '#f5f4f2', fontFamily: "'DM Sans', sans-serif" }}>
      <ShellNavbar />

      <main style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 'calc(100vh - 48px)',
        padding: '40px 24px',
      }}>
        <div style={{
          background: '#fff',
          borderRadius: '20px',
          padding: '40px',
          width: '100%',
          maxWidth: '480px',
          boxShadow: '0 2px 16px rgba(0,0,0,0.06)',
        }}>
          <h2 style={{ fontSize: '1.4rem', fontWeight: 700, color: '#111', marginBottom: '8px', letterSpacing: '-0.01em' }}>
            Upload Save Point
          </h2>
          <p style={{ fontSize: '14px', color: '#999', marginBottom: '24px' }}>
            Upload your previously exported save file to continue editing your route.
          </p>

          <p style={{ fontSize: '13px', fontWeight: 600, color: '#333', marginBottom: '10px' }}>
            Save file in .json
          </p>

          <div
            onClick={() => inputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={e => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? '#111' : '#ccc'}`,
              borderRadius: '12px',
              padding: '36px 20px',
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: '10px',
              cursor: 'pointer',
              background: isDragging ? '#f9f9f9' : '#fafafa',
              transition: 'all 0.15s',
              marginBottom: '24px',
            }}
          >
            <div style={{
              width: '48px',
              height: '48px',
              border: '2px solid #333',
              borderRadius: '8px',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              fontSize: '11px',
              fontWeight: 700,
              color: '#333',
              letterSpacing: '0.02em',
            }}>
              JSON
            </div>
            <p style={{ fontSize: '13px', color: '#777', textAlign: 'center' }}>
              {file ? file.name : 'Click to upload save file'}
            </p>
            <p style={{ fontSize: '12px', color: '#bbb', textAlign: 'center' }}>
              Accepts .json files containing a save point
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".json"
              style={{ display: 'none' }}
              onChange={e => { const f = e.target.files?.[0]; if (f) handleFile(f); }}
            />
          </div>

          <button
            onClick={handleContinue}
            disabled={!file}
            style={{
              width: '100%',
              padding: '14px',
              borderRadius: '10px',
              background: file ? '#1a1a1a' : '#e0dedd',
              color: file ? '#fff' : '#aaa',
              border: 'none',
              cursor: file ? 'pointer' : 'not-allowed',
              fontSize: '14px',
              fontWeight: 600,
              fontFamily: 'inherit',
              marginBottom: '16px',
              transition: 'background 0.15s',
            }}
          >
            Continue Editing Addresses
          </button>

          <div style={{ textAlign: 'center' }}>
            <button
              onClick={() => router.back()}
              style={{
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
          </div>
        </div>
      </main>
    </div>
  );
}