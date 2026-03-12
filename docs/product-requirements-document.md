**PRODUCT REQUIREMENTS DOCUMENT**

**Small-Business Delivery Optimizer**

Benevolent Bandwidth Foundation (B2)  |  Phase 1

| Version | 0.5 — Draft for Review |
| :---- | :---- |
| **Date** | March 2025 |
| **Phase** | Phase 1  (Target: End of March 2025\) |
| **Status** | In Review |
| **Prepared by** | Mark Boenigk, Kirill Kovalenko |

# **1\. Overview & Problem Statement**

Small businesses, florists, dry cleaners, and local food producers  manage local deliveries without access to route optimization software. Existing solutions are either too expensive, lack critical features (e.g., time-window support), or require accounts and retain customer data, creating legal and privacy exposure.

User research conducted with small business owners in the floral and local goods sectors surfaced a consistent set of pain points that define the target persona:

* All orders arrive last-minute, making static pre-planned routes impractical.

* Manual routing is slow and error-prone, less experienced drivers create inefficient straight-line routes instead of loop routes.

* Outlier addresses (far from the main cluster) disrupt route flow with no systematic handling.

* Time-specific deliveries (schools, businesses) have uncommunicated deadlines that are hard to schedule.

* Local road knowledge (divided highways, one-way streets) is not always captured by standard mapping tools.

| *Peak use case: Valentine's Day / Mother's Day with 250+ deliveries, where last-minute orders arrive constantly on the morning of delivery. The system must support rapid, dynamic route generation under this real-world load.* |
| :---- |

# **2\. Goals & Success Criteria**

## **2.1 Goals**

* Provide small business Route Managers a fast, privacy-safe optimizer with zero account setup required.

* Reduce manual planning time and fuel costs for local delivery fleets.

* Support peak-day volumes (250+ stops) with dynamic, last-minute address additions.

* Ship a working Phase 1 product by end of March 2025\.

* Establish a clean foundation for Phase 2 (live map view, in-app integration with Apple/Google Maps) in a subsequent release.

## **2.2 Non-Goals (Phase 1\)**

* No user accounts, logins, or server-side sessions.

* No customer data storage — the system is fully stateless.

* No live traffic data integration.

* No native mobile app,  Phase 1 is a mobile-first PWA via Next.js.

* No multi-region support, ok US only; initial map data: Texas and California.

## **2.3 Success Criteria**

* A Route Manager can upload a CSV, configure depot and vehicles, receive an optimized route, and export it — all within a single browser session.

* All address data is cleared from browser memory when the tab/window closes.

* No customer PII is written to any database, log, or persistent storage at any point.

* All P0 requirements pass acceptance tests before go-live.

# **3\. User Personas**

## **3.1 Route Manager (Primary Actor)**

The business owner or designated logistics coordinator who plans the day's deliveries. This person is not technical and works under time pressure, especially on peak delivery days. They upload or enter addresses, configure constraints, trigger optimization, review results, and export the output to hand off to drivers.

* Manages 5 to 250+ stops per session.

* Needs to add individual last-minute orders without re-uploading the entire list.

* Possesses local road knowledge that supplements algorithm output.

## **3.2 Driver (Downstream Persona)**

Does not interact with the application directly. Receives an exported output file (CSV or JSON) from the Route Manager and then uploads the file to the website to see and navigate their route. 

# **4\. Functional Requirements**

| *Priority legend:  P0 \= Launch blocker.  P1 \= Required before public release.  P2 \= Highly desirable, can ship shortly after launch.* |
| :---- |

## **4.1 Address Input**

| ID | Requirement | Pri | Notes / Open Questions |
| :---- | :---- | ----- | :---- |
| **F-01** | Display a centered drag-and-drop zone accepting CSV and Excel (.xlsx) files containing delivery addresses. | **P0** |  |
| **F-02** | Provide a single-address text input field for manual entry of last-minute individual orders with auto-complete via standard geocoding (no LLM). | **P0** |  |
| **F-03** | On CSV/Excel import, strip any customer name columns at parse time. PII should never be stored locally or on the server.  | **P0** |  |
| **F-04** | Validate each address via geocoding. Flag invalid or unresolvable addresses visually before optimization can proceed. | **P0** |  |
| **F-05** | Allow the Route Manager to remove or edit flagged/invalid addresses from the list before optimization. | **P1** |  |
| **F-06** | Display a running count of loaded addresses with a preview list (addresses only). | **P1** |  |

## **4.2 Configuration**

| ID | Requirement | Pri | Notes / Open Questions |
| :---- | :---- | ----- | :---- |
| **F-07** | Allow the Route Manager to enter a starting depot address (business location or vehicle start point). Required for round-trip loop routing. | **P0** |  |
| **F-08** | Allow the Route Manager to specify the number of vehicles. | **P0** |  |
| **F-09** | Allow the Route Manager to specify vehicle capacity (\# of units, sq feet, weight, etc.)). | **P0** | *Test with users to establish capacity types* |
| **F-10** | Allow per-stop time windows (optional). Stops without a time window are treated as flexible by the optimizer. | **P0** |  |
| **F-11** | Allow the Route Manager to mark a vehicle as “available.” When "Optimize" is clicked, filter the vehicles array so that only vehicles with isAvailable \=== true are sent to the backend. | **P0** |  |
| **F-12** | Allow the Route Manager to manually edit each delivery element (customer name, address, time buffer, time window, quantity, and notes). | **P0** |  |
| **F-13** | Allow the Route Manager to specify the number of deliveries. | **P0** |  |
| **F-14** | Allow the Route Manager to search for a delivery. | **P1** |  |
| **F-15** | Allow the Route Manager to select a vehicle type (heavy, standard, bicycle), with presets determining the speed at which the delivery can be made. | **P1** |  |
| **F-16** | Allow the Route Manager to assign a delivery start time (e.g., 8:00 AM) to anchor time-window calculations. | **P1** |  |
| **F-17** | Allow the Route Manager to “Undo” edits. | **P2** |  |

## **4.3 Optimization Engine**

| ID | Requirement | Pri | Notes / Open Questions |
| :---- | :---- | ----- | :---- |
| **F-18** | Submit job list and configuration to the VROOM+OSRM backend via POST /api/v1/deliveries/optimize. | **P0** |  |
| **F-19** | All routes must be round-trips: vehicles depart from and return to the depot. | **P0** |  |
| **F-20** | Each vehicle may be used only once per optimization run (no multi-trip routing in Phase 1). | **P0** |  |
| **F-21** | Display a progress/loading animation while optimization is running. | **P0** |  |
| **F-22** | Toss the deliveries that have been optimized and exported. | **P0** |  |

## **4.4 Results View**

| ID | Requirement | Pri | Notes / Open Questions |
| :---- | :---- | ----- | :---- |
| **F-23** | Display the optimized route(s) as a numbered ordered stop list per vehicle (e.g., 1\. 123 Main St, 2\. 456 Elm St...). | **P0** |  |
| **F-24** | Display a per-stop estimated arrival time (ETA) alongside each address. | **P1** |  |
| **F-25** | Allow the Route Manager to add delivery notes per stop (text only, non-identifying). | **P1** |  |
| **F-26** | Provide Undo capability for result edits. | **P2** |  |
| **F-27** | Redesign platform to allow Route Manager to view Edit Page and Result Page on one screen. | **P2** |  |

## **4.5 Export & Driver Handoff**

| ID | Requirement | Pri | Notes / Open Questions |
| :---- | :---- | ----- | :---- |
| **F-28** | 'Download CSV' exports the optimized ordered address list with ETA. | **P0** |  |
| **F-29** | 'Download JSON' exports the full route as a VROOM-compatible save-point. | **P1** |  |
| **F-30** | Generate separate export files per vehicle when multiple vehicles are configured. | **P1** |  |

## **4.6 Driver Assist Checklist**

| ID | Requirement | Pri | Notes / Open Questions |
| :---- | :---- | ----- | :---- |
| **F-31** | Allow the driver to upload a file containing previously compiled delivery route. | **P0** |  |
| **F-32** | Allow the driver to click on a deep-link button on each individual delivery component to launch Apple Maps (iOS) or Google Maps (Android/web) with the address attributed to that delivery. | **P0** |  |
| **F-33** | Allow the driver to mark a delivery as completed, lowering the delivery element opacity and moving it out of the way of the driver | **P0** |  |
| **F-34** | Allow the Driver to click “Route Complete,” creating and exporting a route summary file that can be handed off to the Route Manager.  | **P1** |  |
| **F-35** | Allow the Driver to mark a delivery as “Failed,” opening up an overlay to write a reason why the delivery failed. | **P1** |  |

## **4.6 Data Lifecycle & Session Management**

| ID | Requirement | Pri | Notes / Open Questions |
| :---- | :---- | ----- | :---- |
| **F-36** | All address data, job lists, and results are held exclusively in browser memory (JS state). Nothing is written to any server-side store, only to local storage. | **P0** |  |
| **F-37** | When the browser tab or window is closed, data is still accessible via localStorage.  | **P0** | *OQ-5: Browser close cannot trigger server confirmation — a pre-session banner is the mitigation* |
| **F-38** | The API server must not log or persist address coordinates, job lists, or route results. Only operational metrics (response time, status codes, error types) may be logged. | **P0** |  |
| **F-39** | Allow Route Manager to delete all data  | **P0** |  |
| **F-40** | Display a one-time informational banner at session start: 'This tool processes your data in-browser only. All of your work is cleared when you close this tab.' | **P1** |  |
| **F-41** | Display a pop-up with a warning “Closing this tab will delete all of your work, please save if you want to make future changes” when the user attempts to close the Edit Page. | **P1** |  |

# **5\. Non-Functional Requirements**

## **5.1 Performance**

* The UI must remain responsive during optimization (non-blocking async with loading state).

## **5.2 Privacy & Security**

* No customer PII may persist in any server-side store at any time. PII might be stored in localStorage.

* Server logs are limited to HTTP status codes, response latency, error types, and timestamps. IP address logging must be reviewed and masked or excluded.

* All API communication between frontend and backend must use HTTPS in production.

* The application must comply with B2's core principles.

## **5.3 Compatibility**

* Mobile-first responsive design. Primary targets: iOS Safari, Android Chrome.

* Desktop: Chrome, Firefox, Safari, Edge (latest two major versions).

* Built with Next.js (App Router), deployed as a PWA.

## **5.4 Hosting & Deployment**

* Phase 1 (POC): Render.com or Vercel free tier to minimize cost.

* Future: Migrate to Google Cloud Platform (GCP).

* Map data (.osm.pbf): Dev team is responsible for configuring regional map files. Initial regions: Texas and California. US only for Phase 1\.

# **6\. Technical Architecture Summary**

## **6.1 Stack**

| Frontend | Next.js (App Router) — mobile-first PWA |
| :---- | :---- |
| **Routing API** | C++ HTTP service wrapping VROOM \+ OSRM (source-compiled via Docker) |
| **Geocoding** | OpenStreetMap Nominatim or equivalent open-source (no commercial LLM APIs) |
| **Map Data** | OSM .pbf — US only; initial regions: Texas & California (dev team managed) |
| **Containerization** | Docker Compose with CMake build presets |
| **Hosting (POC)** | Render.com or Vercel (free tier) |
| **Hosting (Future)** | Google Cloud Platform (GCP) |
| **Source Control** | B2 GitHub org (benevolentbandwidth) |
| **License** | BSD-2 (matching VROOM and OSRM upstream licenses) |

## **6.2 Data Flow**

1\.  Route Manager uploads CSV or enters addresses and will be parsed in browser

2\.  Frontend geocodes addresses via OSRM proxy (in-session memory only).

3\.  Frontend POSTs coordinate payload to /api/v1/deliveries/optimize.

4\.  VROOM+OSRM returns optimized route JSON — no data persisted server-side.

5\.  Frontend renders result; Route Manager reviews, edits, and exports.

6\.  Browser tab closed → all JavaScript state released automatically.

| *Privacy note: The backend receives only geocoordinates and constraint parameters — never customer names. No database write occurs at any point in this flow.* |
| :---- |

# **7\. Privacy Requirements (Non-Negotiable)**

* Fully stateless application. No user accounts. No server-side sessions.

* The business-to-customer relationship must never be preserved in any database, log, or file on the server.

* Address coordinates are transmitted to the backend for routing only and must not be logged or stored.

* Data deletion trigger:User saves file, the localStorage timer is up, or the user clicks the “delete” button. No server-side confirmation is sent or possible. A pre-session banner informs the user of this behavior.

* Server logs are strictly limited to operational telemetry (status codes, latency, error types). IP address logging must be minimized or masked.

* The project is open-sourced. The architecture must be transparent and auditable.

# **8\. Phase Scope Summary**

| Feature | Phase 1 (End of March) | Phase 2 (Future) |
| :---- | :---- | :---- |
| CSV / Excel upload \+ address parsing (names stripped) | ✅ In Scope | — |
| Single address manual entry with geocoding | ✅ In Scope | — |
| Depot config \+ vehicle count | ✅ In Scope | — |
| Round-trip loop route optimization (VROOM+OSRM) | ✅ In Scope | — |
| Time windows / delivery start time | ✅ In Scope | — |
| Ordered results list view | ✅ In Scope | — |
| ETA per stop | P1 — Target Phase 1 | — |
| CSV export | ✅ In Scope | — |
| JSON export (driver save-point) | P1 — Target Phase 1 | — |
| Separate export per vehicle | P1 — Target Phase 1 | — |
| Outlier address flagging | ⚠ Open Question (OQ-2) | — |
| Interactive map view of routes | TBD  | ✅ Phase 2 |
| Apple Maps / Google Maps deep-link (full route) | ❌ Not in scope | ✅ Phase 2 |
| Native iOS / Android app | ❌ Not in scope | Phase 2+ |
| Live traffic data | ❌ Not in scope | Phase 2+ |

*Built with ❤️ for Humanity. The Benevolent Bandwidth Foundation (B2)*

