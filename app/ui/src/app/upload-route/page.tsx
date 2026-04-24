// app/upload-route/page.tsx
"use client";
import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import ShellNavbar from "@/app/components/ShellNavbar";
import { formatSize } from "@/app/utils/routeUtils";

export default function UploadRoutePage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [file, setFile] = useState<File | null>(null);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleFile = (f: File) => {
    if (f.name.endsWith(".json")) setFile(f);
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
    const text = await file.text();
    sessionStorage.setItem("routeFile", JSON.stringify({ name: file.name, content: text }));
    router.push("/driver-view");
  };

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display&family=DM+Sans:wght@400;500;600&display=swap');

        .upload-root {
          min-height: 100vh;
          background: #f7f7f5;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', sans-serif;
        }

        .upload-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
        }

        .upload-title {
          font-family: 'DM Serif Display', serif;
          font-size: 2rem;
          font-weight: 400;
          color: #111;
          margin-bottom: 8px;
          text-align: center;
          letter-spacing: -0.01em;
        }

        .upload-subtitle {
          font-size: 14px;
          color: #888;
          margin-bottom: 32px;
          text-align: center;
        }

        .upload-dropzone {
          width: 100%;
          max-width: 580px;
          border: 1.5px dashed #ccc;
          border-radius: 12px;
          padding: 52px 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 10px;
          cursor: pointer;
          background: #f9f9f8;
          transition: border-color 0.15s, background 0.15s;
          margin-bottom: 16px;
        }

        .upload-dropzone.dragging {
          border-color: #4a8c7a;
          background: #f0f7f5;
        }

        .upload-dropzone-icon { color: #555; margin-bottom: 4px; }

        .upload-dropzone-text {
          font-size: 14px;
          color: #333;
          text-align: center;
        }

        .upload-dropzone-browse {
          font-size: 14px;
          color: #4a8c7a;
          font-weight: 500;
          text-align: center;
        }

        .upload-file-row {
          width: 100%;
          max-width: 580px;
          background: #eef5f3;
          border: 1px solid #d0e5df;
          border-radius: 8px;
          padding: 10px 16px;
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 24px;
        }

        .upload-file-name {
          font-size: 13px;
          font-weight: 500;
          color: #111;
          flex: 1;
        }

        .upload-file-size { font-size: 12px; color: #666; }

        .upload-file-remove {
          background: none;
          border: none;
          cursor: pointer;
          color: #555;
          padding: 4px;
          display: flex;
          align-items: center;
          font-size: 18px;
          line-height: 1;
        }

        .upload-actions {
          width: 100%;
          max-width: 580px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-top: 8px;
        }

        .upload-back-btn {
          background: none;
          border: none;
          cursor: pointer;
          font-size: 14px;
          color: #555;
          font-family: 'DM Sans', sans-serif;
          display: flex;
          align-items: center;
          gap: 6px;
          padding: 0;
        }

        .upload-back-btn:hover { color: #111; }

        .upload-continue-btn {
          background: #4a8c7a;
          color: #fff;
          border: none;
          border-radius: 999px;
          padding: 10px 28px;
          font-size: 14px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          cursor: pointer;
          transition: background 0.15s, opacity 0.15s;
        }

        .upload-continue-btn:disabled {
          opacity: 0.4;
          cursor: not-allowed;
        }

        .upload-continue-btn:not(:disabled):hover {
          background: #3d7a6a;
        }
      `}</style>

      <div className="upload-root">
        <ShellNavbar />

        <div className="upload-content">
          <h2 className="upload-title">Upload your route</h2>
          <p className="upload-subtitle">Upload your route to begin your deliveries!</p>

          <div
            className={`upload-dropzone${isDragging ? " dragging" : ""}`}
            onClick={() => inputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <div className="upload-dropzone-icon">
              <svg width="32" height="36" viewBox="0 0 32 36" fill="none">
                <path d="M18 2H6a2 2 0 00-2 2v28a2 2 0 002 2h20a2 2 0 002-2V14L18 2z" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M18 2v12h12" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
                <path d="M16 22v-6M13 19l3-3 3 3" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
            </div>
            <p className="upload-dropzone-text">Drag and drop .json files here, or</p>
            <p className="upload-dropzone-browse">Browse files</p>
            <input
              ref={inputRef}
              type="file"
              accept=".json"
              style={{ display: "none" }}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) handleFile(f);
              }}
            />
          </div>

          {file && (
            <div className="upload-file-row">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" style={{ color: "#4a8c7a", flexShrink: 0 }}>
                <path d="M21.44 11.05l-9.19 9.19a6 6 0 01-8.49-8.49l9.19-9.19a4 4 0 015.66 5.66l-9.2 9.19a2 2 0 01-2.83-2.83l8.49-8.48" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              <span className="upload-file-name">{file.name}</span>
              <span className="upload-file-size">{formatSize(file.size)}</span>
              <button
                className="upload-file-remove"
                onClick={(e) => { e.stopPropagation(); setFile(null); }}
                aria-label="Remove file"
              >
                ×
              </button>
            </div>
          )}

          <div className="upload-actions">
            <button className="upload-back-btn" onClick={() => router.back()}>
              <svg width="14" height="14" viewBox="0 0 16 16" fill="none">
                <path d="M10 3L5 8l5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              Back
            </button>
            <button
              className="upload-continue-btn"
              onClick={handleContinue}
              disabled={!file}
            >
              Continue
            </button>
          </div>
        </div>
      </div>
    </>
  );
}