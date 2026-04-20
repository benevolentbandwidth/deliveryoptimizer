// app/address-entry/page.tsx
"use client";
import { useState, useRef, useCallback } from "react";
import { useRouter } from "next/navigation";
import { v4 as uuidv4 } from "uuid";
import ShellNavbar from "@/app/components/ShellNavbar";

interface UploadedFile {
  id: string;
  name: string;
  size: string;
  content: string;
}

export default function AddressEntryPage() {
  const router = useRouter();
  const [isDragging, setIsDragging] = useState(false);
  const [uploads, setUploads] = useState<UploadedFile[]>([]);
  const dragDepth = useRef(0);
  const inputRef = useRef<HTMLInputElement>(null);

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    return `${(bytes / 1024).toFixed(0)} KB`;
  };

  const handleFiles = useCallback(async (files: FileList) => {
    const incoming = Array.from(files).filter(
      (f) => f.name.endsWith(".csv") || f.name.endsWith(".json"),
    );
    const read = await Promise.all(
      incoming.map(async (f) => ({
        id: uuidv4(),
        name: f.name,
        size: formatSize(f.size),
        content: await f.text(),
      })),
    );
    setUploads((prev) => [...prev, ...read]);
  }, []);

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
    handleFiles(e.dataTransfer.files);
  };

  const removeFile = (id: string) => {
    setUploads((prev) => prev.filter((f) => f.id !== id));
  };

  const handleContinue = () => {
    // Forward all uploaded file contents to the editor via sessionStorage.
    sessionStorage.setItem(
      "addressFiles",
      JSON.stringify(
        uploads.map((f) => ({ name: f.name, content: f.content })),
      ),
    );
    router.push("/edit");
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: "#f5f4f2",
        fontFamily: "'DM Sans', sans-serif",
      }}
    >
      <ShellNavbar />

      <main
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: "calc(100vh - 48px)",
          padding: "40px 24px",
        }}
      >
        <div
          style={{
            background: "#fff",
            borderRadius: "20px",
            padding: "40px",
            width: "100%",
            maxWidth: "480px",
            boxShadow: "0 2px 16px rgba(0,0,0,0.06)",
          }}
        >
          <h2
            style={{
              fontSize: "1.4rem",
              fontWeight: 700,
              color: "#111",
              marginBottom: "8px",
              letterSpacing: "-0.01em",
            }}
          >
            Enter Addresses
          </h2>
          <p style={{ fontSize: "14px", color: "#999", marginBottom: "24px" }}>
            Upload a file containing your delivery addresses, or enter them
            manually.
          </p>

          <div
            onClick={() => inputRef.current?.click()}
            onDragEnter={handleDragEnter}
            onDragOver={(e) => e.preventDefault()}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            style={{
              border: `2px dashed ${isDragging ? "#111" : "#ccc"}`,
              borderRadius: "12px",
              padding: "32px 20px",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "8px",
              cursor: "pointer",
              background: isDragging ? "#f9f9f9" : "#fafafa",
              transition: "all 0.15s",
              marginBottom: "20px",
            }}
          >
            <svg width="36" height="36" viewBox="0 0 36 36" fill="none">
              <path
                d="M18 24V12M18 12L13 17M18 12L23 17"
                stroke="#555"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M8 26h20"
                stroke="#ccc"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            <p style={{ fontSize: "13px", color: "#777", textAlign: "center" }}>
              Click to upload file
            </p>
            <p style={{ fontSize: "12px", color: "#bbb", textAlign: "center" }}>
              Accepts .csv and .json files
            </p>
            <input
              ref={inputRef}
              type="file"
              accept=".csv,.json"
              multiple
              style={{ display: "none" }}
              onChange={(e) => {
                if (e.target.files) handleFiles(e.target.files);
              }}
            />
          </div>

          {uploads.length > 0 && (
            <div style={{ marginBottom: "20px" }}>
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#333",
                  marginBottom: "10px",
                }}
              >
                Uploads
              </p>
              <div
                style={{ display: "flex", flexDirection: "column", gap: "8px" }}
              >
                {uploads.map((f) => (
                  <div
                    key={f.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "10px 14px",
                      background: "#f5f4f2",
                      borderRadius: "8px",
                    }}
                  >
                    <div>
                      <p
                        style={{
                          fontSize: "13px",
                          fontWeight: 500,
                          color: "#222",
                          marginBottom: "2px",
                        }}
                      >
                        {f.name}
                      </p>
                      <p style={{ fontSize: "12px", color: "#999" }}>
                        {f.size}
                      </p>
                    </div>
                    <button
                      onClick={() => removeFile(f.id)}
                      style={{
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        padding: "4px",
                        color: "#bbb",
                        display: "flex",
                        alignItems: "center",
                      }}
                    >
                      <svg
                        width="16"
                        height="16"
                        viewBox="0 0 16 16"
                        fill="none"
                      >
                        <path
                          d="M3 5h10M6 5V3h4v2M7 8v4M9 8v4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                        <rect
                          x="3"
                          y="5"
                          width="10"
                          height="8"
                          rx="2"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          fill="none"
                        />
                      </svg>
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            onClick={handleContinue}
            disabled={uploads.length === 0}
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "10px",
              background: uploads.length > 0 ? "#1a1a1a" : "#e0dedd",
              color: uploads.length > 0 ? "#fff" : "#aaa",
              border: "none",
              cursor: uploads.length > 0 ? "pointer" : "not-allowed",
              fontSize: "14px",
              fontWeight: 600,
              fontFamily: "inherit",
              marginBottom: "12px",
              transition: "background 0.15s",
            }}
          >
            Continue
          </button>

          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: "12px",
              marginBottom: "12px",
            }}
          >
            <div style={{ flex: 1, height: "1px", background: "#e8e7e5" }} />
            <span style={{ fontSize: "13px", color: "#bbb" }}>or</span>
            <div style={{ flex: 1, height: "1px", background: "#e8e7e5" }} />
          </div>

          <button
            onClick={() => router.push("/edit")}
            style={{
              width: "100%",
              padding: "13px",
              borderRadius: "10px",
              background: "#fff",
              color: "#333",
              border: "1.5px solid #d4d2d0",
              cursor: "pointer",
              fontSize: "14px",
              fontWeight: 500,
              fontFamily: "inherit",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              gap: "8px",
              transition: "border-color 0.15s",
              marginBottom: "16px",
            }}
            onMouseEnter={(e) => (e.currentTarget.style.borderColor = "#111")}
            onMouseLeave={(e) =>
              (e.currentTarget.style.borderColor = "#d4d2d0")
            }
          >
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path
                d="M2 12.5h12M2 8.5h8M2 4.5h12"
                stroke="currentColor"
                strokeWidth="1.5"
                strokeLinecap="round"
              />
            </svg>
            Manually Enter Addresses
          </button>

          <div style={{ textAlign: "center" }}>
            <button
              onClick={() => router.back()}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
                fontSize: "14px",
                color: "#555",
                fontFamily: "inherit",
              }}
            >
              <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
                <path
                  d="M10 3L5 8L10 13"
                  stroke="currentColor"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
              Back
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}
