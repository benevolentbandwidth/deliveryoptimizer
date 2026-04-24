// app/lib/routeUtils.tsx
// Shared utilities extracted to avoid duplication across upload pages and gradient layouts.

/** Human-readable file size string. */
export function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

/** Decorative gradient blobs shared by landing and welcome pages. */
export function GradientBlobs() {
    return (
        <>
            <div
                style={{
                    position: "fixed",
                    top: "-80px",
                    right: "-80px",
                    width: "520px",
                    height: "520px",
                    background:
                        "radial-gradient(ellipse at top right, #c8ddd6 0%, #dceade 30%, transparent 70%)",
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
            <div
                style={{
                    position: "fixed",
                    bottom: "-100px",
                    left: "-100px",
                    width: "400px",
                    height: "400px",
                    background:
                        "radial-gradient(ellipse at bottom left, #d4e6df 0%, transparent 65%)",
                    pointerEvents: "none",
                    zIndex: 0,
                }}
            />
        </>
    );
}

/** Footer shared by landing and welcome pages. */
export function PageFooter() {
    return (
        <footer
            style={{
                position: "relative",
                zIndex: 1,
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "20px 32px",
                borderTop: "1px solid rgba(0,0,0,0.06)",
                fontFamily: "'DM Sans', sans-serif",
            }}
        >
            <span
                style={{
                    fontSize: "22px",
                    fontWeight: 700,
                    color: "#111",
                    fontFamily: "'DM Serif Display', serif",
                }}
            >
                b²
            </span>
            <span style={{ fontSize: "13px", color: "#555" }}>
                Built with ❤️ for Humanity. The Benevolent Bandwidth Foundation
            </span>
        </footer>
    );
}