#!/usr/bin/env python3
import json
import os
import subprocess
import tempfile
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.error import HTTPError, URLError
from urllib.parse import urlparse
from urllib.request import Request, urlopen


PORT = int(os.getenv("PORT", "5000"))
VROOM_BIN = os.getenv("VROOM_BIN", "/usr/local/bin/vroom")
VROOM_ROUTER = os.getenv("VROOM_ROUTER", "osrm")
VROOM_HOST = os.getenv("VROOM_HOST", "osrm")
VROOM_PORT = os.getenv("VROOM_PORT", "5001")
VROOM_TIMEOUT_SECONDS = int(os.getenv("VROOM_TIMEOUT_SECONDS", "30"))
OSRM_URL = os.getenv("OSRM_URL", f"http://{VROOM_HOST}:{VROOM_PORT}").rstrip("/")


def json_response(handler, status_code, payload):
    encoded = json.dumps(payload).encode("utf-8")
    handler.send_response(status_code)
    handler.send_header("Content-Type", "application/json")
    handler.send_header("Content-Length", str(len(encoded)))
    handler.end_headers()
    handler.wfile.write(encoded)


def is_coord(value):
    if not isinstance(value, list) or len(value) != 2:
        return False
    if not all(isinstance(item, (int, float)) for item in value):
        return False
    lon, lat = value
    return -180 <= lon <= 180 and -90 <= lat <= 90


def check_osrm():
    probe = (
        f"{OSRM_URL}/nearest/v1/driving/7.4236,43.7384"
        "?number=1&generate_hints=false"
    )
    request = Request(probe, method="GET")
    with urlopen(request, timeout=4) as response:
        if response.status != 200:
            return False, f"HTTP {response.status}"
        payload = json.loads(response.read().decode("utf-8"))
        return payload.get("code") == "Ok", payload.get("code", "unknown")


def validate_payload(payload):
    errors = []
    if not isinstance(payload, dict):
        return ["Payload must be a JSON object."]

    depot = payload.get("depot")
    if not isinstance(depot, dict):
        errors.append("`depot` is required and must be an object.")
    elif not is_coord(depot.get("location")):
        errors.append("`depot.location` must be [lon, lat].")

    vehicles = payload.get("vehicles")
    if not isinstance(vehicles, list) or len(vehicles) == 0:
        errors.append("`vehicles` is required and must be a non-empty array.")
    else:
        for idx, vehicle in enumerate(vehicles, start=1):
            if not isinstance(vehicle, dict):
                errors.append(f"`vehicles[{idx}]` must be an object.")
                continue
            capacity = vehicle.get("capacity")
            if not isinstance(capacity, int) or capacity <= 0:
                errors.append(f"`vehicles[{idx}].capacity` must be a positive integer.")
            if "start" in vehicle and not is_coord(vehicle.get("start")):
                errors.append(f"`vehicles[{idx}].start` must be [lon, lat].")
            if "end" in vehicle and not is_coord(vehicle.get("end")):
                errors.append(f"`vehicles[{idx}].end` must be [lon, lat].")
            tw = vehicle.get("time_window")
            if "time_window" in vehicle:
                if (
                    not isinstance(tw, list)
                    or len(tw) != 2
                    or not all(isinstance(value, int) for value in tw)
                    or tw[0] > tw[1]
                ):
                    errors.append(
                        f"`vehicles[{idx}].time_window` must be [start, end] in epoch seconds."
                    )

    jobs = payload.get("jobs")
    if not isinstance(jobs, list) or len(jobs) == 0:
        errors.append("`jobs` is required and must be a non-empty array.")
    else:
        for idx, job in enumerate(jobs, start=1):
            if not isinstance(job, dict):
                errors.append(f"`jobs[{idx}]` must be an object.")
                continue
            if not is_coord(job.get("location")):
                errors.append(f"`jobs[{idx}].location` must be [lon, lat].")
            demand = job.get("demand", 1)
            if not isinstance(demand, int) or demand <= 0:
                errors.append(f"`jobs[{idx}].demand` must be a positive integer.")
            service = job.get("service")
            if service is not None and (not isinstance(service, int) or service < 0):
                errors.append(
                    f"`jobs[{idx}].service` must be a non-negative integer in seconds."
                )
            tws = job.get("time_windows")
            if "time_windows" in job:
                if not isinstance(tws, list) or len(tws) == 0:
                    errors.append(
                        f"`jobs[{idx}].time_windows` must be a non-empty array of [start, end]."
                    )
                else:
                    for tw in tws:
                        if (
                            not isinstance(tw, list)
                            or len(tw) != 2
                            or not all(isinstance(value, int) for value in tw)
                            or tw[0] > tw[1]
                        ):
                            errors.append(
                                f"`jobs[{idx}].time_windows` entries must be [start, end] epoch seconds."
                            )
                            break

    return errors


def build_vroom_request(payload):
    depot_location = payload["depot"]["location"]

    vroom_vehicles = []
    vehicle_map = {}
    for idx, vehicle in enumerate(payload["vehicles"], start=1):
        vehicle_map[idx] = str(vehicle.get("id", f"vehicle-{idx}"))
        entry = {
            "id": idx,
            "capacity": [vehicle["capacity"]],
            "start": vehicle.get("start", depot_location),
            "end": vehicle.get("end", depot_location),
        }
        tw = vehicle.get("time_window")
        if tw is not None:
            entry["time_window"] = tw
        vroom_vehicles.append(entry)

    vroom_jobs = []
    job_map = {}
    for idx, job in enumerate(payload["jobs"], start=1):
        job_map[idx] = str(job.get("id", f"job-{idx}"))
        demand = job.get("demand", 1)
        entry = {
            "id": idx,
            "location": job["location"],
            "service": job.get("service", 300),
            "delivery": [demand],
        }
        tws = job.get("time_windows")
        if tws is not None:
            entry["time_windows"] = tws
        vroom_jobs.append(entry)

    return {"vehicles": vroom_vehicles, "jobs": vroom_jobs}, vehicle_map, job_map


def run_vroom(vroom_request):
    with tempfile.NamedTemporaryFile("w", delete=False, suffix=".json") as handle:
        json.dump(vroom_request, handle)
        handle.flush()
        input_path = handle.name

    args = [
        VROOM_BIN,
        "-r",
        VROOM_ROUTER,
        "-a",
        VROOM_HOST,
        "-p",
        str(VROOM_PORT),
        "-i",
        input_path,
    ]

    try:
        result = subprocess.run(
            args,
            capture_output=True,
            text=True,
            timeout=VROOM_TIMEOUT_SECONDS,
            check=False,
        )
    finally:
        try:
            os.unlink(input_path)
        except OSError:
            pass

    if result.returncode != 0:
        stderr = result.stderr.strip() or "Unknown VROOM error"
        raise RuntimeError(stderr)

    if not result.stdout.strip():
        raise RuntimeError("VROOM returned no output.")

    return json.loads(result.stdout)


def add_external_ids(solution, vehicle_map, job_map):
    for route in solution.get("routes", []):
        internal_vehicle = route.get("vehicle")
        if internal_vehicle in vehicle_map:
            route["vehicle_external_id"] = vehicle_map[internal_vehicle]
        for step in route.get("steps", []):
            internal_job = step.get("job")
            if internal_job in job_map:
                step["job_external_id"] = job_map[internal_job]
    for unassigned in solution.get("unassigned", []):
        internal_job = unassigned.get("id")
        if internal_job in job_map:
            unassigned["job_external_id"] = job_map[internal_job]
    return solution


def proxy_to_osrm(path_and_query):
    request = Request(f"{OSRM_URL}{path_and_query}", method="GET")
    with urlopen(request, timeout=10) as response:
        body = response.read()
        return response.status, body, response.headers.get("Content-Type", "application/json")


class RoutingHandler(BaseHTTPRequestHandler):
    def log_message(self, fmt, *args):
        return

    def do_GET(self):
        parsed = urlparse(self.path)
        if parsed.path == "/health":
            self.handle_health()
            return

        if parsed.path.startswith("/api/v1/osrm/"):
            upstream_path = parsed.path.removeprefix("/api/v1/osrm")
            if parsed.params:
                upstream_path = f"{upstream_path};{parsed.params}"
            if parsed.query:
                upstream_path = f"{upstream_path}?{parsed.query}"
            self.handle_osrm_proxy(upstream_path)
            return

        json_response(
            self,
            404,
            {
                "error": "Not found.",
                "available_endpoints": [
                    "GET /health",
                    "POST /api/v1/deliveries/optimize",
                    "GET /api/v1/osrm/*",
                ],
            },
        )

    def do_POST(self):
        parsed = urlparse(self.path)
        if parsed.path == "/api/v1/deliveries/optimize":
            self.handle_optimize()
            return
        json_response(self, 404, {"error": "Not found."})

    def handle_health(self):
        vroom_ready = os.path.exists(VROOM_BIN)
        osrm_ready = False
        detail = "Unavailable"
        try:
            osrm_ready, detail = check_osrm()
        except (HTTPError, URLError, TimeoutError, json.JSONDecodeError) as err:
            detail = str(err)

        overall_ready = vroom_ready and osrm_ready
        status_code = 200 if overall_ready else 503
        status_text = "ok" if overall_ready else "degraded"

        json_response(
            self,
            status_code,
            {
                "status": status_text,
                "checks": {
                    "vroom_binary": "ok" if vroom_ready else "missing",
                    "osrm": "ok" if osrm_ready else "down",
                    "osrm_detail": detail,
                },
            },
        )

    def handle_osrm_proxy(self, path_and_query):
        try:
            status, body, content_type = proxy_to_osrm(path_and_query)
            self.send_response(status)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except HTTPError as err:
            body = err.read()
            if not body:
                body = json.dumps({"error": "OSRM upstream returned an error."}).encode(
                    "utf-8"
                )
            content_type = "application/json"
            if err.headers is not None:
                content_type = err.headers.get("Content-Type", content_type)
            self.send_response(err.code)
            self.send_header("Content-Type", content_type)
            self.send_header("Content-Length", str(len(body)))
            self.end_headers()
            self.wfile.write(body)
        except (URLError, TimeoutError) as err:
            json_response(self, 502, {"error": "OSRM upstream unavailable.", "details": str(err)})

    def handle_optimize(self):
        content_length = self.headers.get("Content-Length", "")
        if not content_length.isdigit():
            json_response(self, 400, {"error": "Content-Length header must be set."})
            return

        try:
            body = self.rfile.read(int(content_length))
            payload = json.loads(body.decode("utf-8"))
        except (UnicodeDecodeError, json.JSONDecodeError):
            json_response(self, 400, {"error": "Request body must be valid JSON."})
            return

        errors = validate_payload(payload)
        if errors:
            json_response(self, 400, {"error": "Validation failed.", "issues": errors})
            return

        try:
            vroom_request, vehicle_map, job_map = build_vroom_request(payload)
            solution = run_vroom(vroom_request)
            solution = add_external_ids(solution, vehicle_map, job_map)
        except subprocess.TimeoutExpired:
            json_response(self, 504, {"error": "Optimization timed out."})
            return
        except RuntimeError as err:
            json_response(self, 502, {"error": "VROOM optimization failed.", "details": str(err)})
            return
        except json.JSONDecodeError:
            json_response(self, 502, {"error": "VROOM returned invalid JSON."})
            return

        json_response(
            self,
            200,
            {
                "status": "ok",
                "summary": solution.get("summary", {}),
                "routes": solution.get("routes", []),
                "unassigned": solution.get("unassigned", []),
                "raw": solution,
            },
        )


def main():
    server = ThreadingHTTPServer(("0.0.0.0", PORT), RoutingHandler)
    print(f"deliveryoptimizer-api listening on 0.0.0.0:{PORT}")
    server.serve_forever()


if __name__ == "__main__":
    main()
