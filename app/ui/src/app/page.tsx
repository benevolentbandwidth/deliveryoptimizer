// app/page.tsx
"use client";
import { useRouter } from "next/navigation";
import ShellNavbar from "./components/ShellNavbar";
import { PageFooter } from "./utils/routeUtils";

export default function LandingPage() {
  const router = useRouter();

  return (
    <>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@400;500;600&display=swap');

        .landing-root {
          min-height: 100vh;
          display: flex;
          flex-direction: column;
          font-family: 'DM Sans', sans-serif;
          position: relative;
        }

        /* Subtle gradient: warm off-white bottom-left → soft sage green top-right */
        .landing-bg {
          position: fixed;
          inset: 0;
          background:
            radial-gradient(ellipse at 100% 0%,   #8dbfb0 0%, rgba(141,191,176,0) 55%),
            radial-gradient(ellipse at 0%   100%, #8dbfb0 0%, rgba(141,191,176,0) 55%),
            #f2f0ea;
          z-index: 0;
        }

        /* Navbar override — pure white */
        .landing-root :global(.shell-navbar),
        .landing-navbar-wrap {
          position: relative;
          z-index: 10;
          background: #ffffff;
          border-bottom: 1px solid rgba(0,0,0,0.08);
        }

        .landing-content {
          flex: 1;
          display: flex;
          flex-direction: column;
          align-items: center;
          justify-content: center;
          padding: 48px 24px;
          position: relative;
          z-index: 1;
        }

        .landing-title {
          font-family: 'DM Sans', sans-serif;
          font-size: 2rem;
          font-weight: 500;
          color: #111;
          margin-bottom: 12px;
          text-align: center;
          letter-spacing: -0.01em;
        }

        .landing-subtitle {
          font-size: 14px;
          color: #4a6358;
          margin-bottom: 48px;
          text-align: center;
          max-width: 520px;
          line-height: 1.65;
        }

        .landing-cards {
          display: flex;
          flex-wrap: wrap;
          gap: 24px;
          justify-content: center;
          width: 100%;
          max-width: 860px;
        }

        .landing-card {
          background: #ffffff;
          border-radius: 16px;
          border: 1px solid rgba(0,0,0,0.07);
          padding: 32px 28px 28px;
          display: flex;
          flex-direction: column;
          align-items: flex-start;
          gap: 12px;
          width: 340px;
          box-sizing: border-box;
          box-shadow: 0 2px 8px rgba(0,0,0,0.06);
          transition: box-shadow 0.2s, border-color 0.2s, transform 0.2s;
          cursor: pointer;
        }

        .landing-card:hover,
        .landing-card:focus-visible {
          box-shadow: 0 6px 20px rgba(0,0,0,0.1);
          border-color: rgba(0,0,0,0.12);
          transform: translateY(-2px);
        }

        .landing-card:focus-visible {
          outline: 2px solid #4a8c7a;
          outline-offset: 2px;
        }

        .landing-card-icon {
          color: #4a8c7a;
          margin-bottom: 4px;
        }

        .landing-card-title {
          font-size: 18px;
          font-weight: 600;
          color: #111;
          margin: 0;
        }

        .landing-card-desc {
          font-size: 13px;
          color: #666;
          line-height: 1.55;
          margin: 0;
          flex: 1;
        }

        /* Presentational pill — aria-hidden, pointer-events:none */
        .landing-card-cta {
          margin-top: 16px;
          align-self: flex-end;
          background: #4a8c7a;
          color: #111;
          border-radius: 999px;
          padding: 10px 24px;
          font-size: 14px;
          font-weight: 500;
          font-family: 'DM Sans', sans-serif;
          pointer-events: none;
          transition: background 0.15s;
        }

        .landing-card:hover .landing-card-cta,
        .landing-card:focus-visible .landing-card-cta {
          background: #3d7a6a;
        }

        .landing-root footer,
        .landing-root [class*="footer"],
        .landing-root [class*="Footer"] {
          background: #ffffff !important;
          position: relative;
          z-index: 1;
        }

        .landing-root footer svg,
        .landing-root [class*="footer"] svg,
        .landing-root [class*="Footer"] svg {
          color: #1a4d40 !important;
          fill: #1a4d40 !important;
        }
      `}</style>

      <div className="landing-root">
        {/* Full-page gradient background */}
        <div className="landing-bg" />

        {/* Navbar wrapped in a white div so it overrides any inherited background */}
        <div className="landing-navbar-wrap" style={{ background: "#ffffff", borderBottom: "1px solid rgba(0,0,0,0.08)", position: "relative", zIndex: 10 }}>
          <ShellNavbar />
        </div>

        <div className="landing-content">
          <h1 className="landing-title">Delivery Optimizer</h1>
          <p className="landing-subtitle">
            Transform your address lists into efficient, ordered routes to lower
            operational costs and reduce your fleet&apos;s carbon emissions.
          </p>

          <div className="landing-cards">
            {/* Route Manager — full card is the interactive target */}
            <div
              className="landing-card"
              role="button"
              tabIndex={0}
              aria-label="Route manager — continue"
              onClick={() => router.push("/welcome")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push("/welcome");
                }
              }}
            >
              <div className="landing-card-icon">
                <svg width="24" height="24" viewBox="0 0 24 24" fill="none">
                  <path
                    d="M12 2C8.686 2 6 4.686 6 8c0 4.418 6 12 6 12s6-7.582 6-12c0-3.314-2.686-6-6-6z"
                    stroke="currentColor"
                    strokeWidth="1.75"
                    fill="none"
                    strokeLinejoin="round"
                  />
                  <circle cx="12" cy="8" r="2" stroke="currentColor" strokeWidth="1.75" fill="none" />
                </svg>
              </div>
              <p className="landing-card-title">Route manager</p>
              <p className="landing-card-desc">
                Import routes, edit addresses, assign deliveries, monitor fleet routes, and export delivery operations.
              </p>
              <span className="landing-card-cta" aria-hidden="true">Continue</span>
            </div>

            {/* Driver — full card is the interactive target */}
            <div
              className="landing-card"
              role="button"
              tabIndex={0}
              aria-label="Driver — continue"
              onClick={() => router.push("/upload-route")}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") {
                  e.preventDefault();
                  router.push("/upload-route");
                }
              }}
            >
              <div className="landing-card-icon">
                <svg width="26" height="22" viewBox="0 0 28 24" fill="none">
                  <rect x="2" y="8" width="16" height="10" rx="2" stroke="currentColor" strokeWidth="1.75" fill="none" />
                  <path d="M18 11h3l3 3v4h-6" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" fill="none" />
                  <circle cx="6" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" fill="none" />
                  <circle cx="21" cy="19" r="2" stroke="currentColor" strokeWidth="1.75" fill="none" />
                </svg>
              </div>
              <p className="landing-card-title">Driver</p>
              <p className="landing-card-desc">
                View your assigned route, navigate through addresses, update delivery status, and import file from route manager.
              </p>
              <span className="landing-card-cta" aria-hidden="true">Continue</span>
            </div>
          </div>
        </div>

        <PageFooter />
      </div>
    </>
  );
}