import { describe, expect, it, vi, beforeEach, afterEach } from "vitest";
import { GET } from "@/app/api/optimization-jobs/[jobId]/result/route";
import {
  getOptimizationJobResult,
  type DeliveryOptimizerClientError,
} from "@/lib/solver/deliveryOptimizerClient";

vi.mock("@/lib/solver/deliveryOptimizerClient", () => ({
  getOptimizationJobResult: vi.fn(),
  isDeliveryOptimizerClientError: vi.fn(
    (error: unknown) =>
      Boolean(error) &&
      typeof error === "object" &&
      (error as { source?: unknown }).source === "deliveryoptimizer-api"
  ),
}));

const mockGetOptimizationJobResult = vi.mocked(getOptimizationJobResult);

function context(jobId: string) {
  return {
    params: Promise.resolve({ jobId }),
  };
}

function request(jobId: string) {
  return new Request(`http://localhost/api/optimization-jobs/${jobId}/result`);
}

function deliveryOptimizerError(
  status: number,
  body: unknown
): DeliveryOptimizerClientError {
  const error = new Error("upstream error") as DeliveryOptimizerClientError;
  error.source = "deliveryoptimizer-api";
  error.retryable = false;
  error.status = status;
  error.body = body;
  return error;
}

describe("optimization job result route", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("proxies result responses through the backend client", async () => {
    const body = {
      routes: [{ vehicle: 1, steps: [] }],
    };
    mockGetOptimizationJobResult.mockResolvedValue({ status: 200, body });

    const response = await GET(request("job-123"), context("job-123"));

    expect(mockGetOptimizationJobResult).toHaveBeenCalledWith("job-123");
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual(body);
  });

  it("preserves accepted upstream result status", async () => {
    const body = { status: "running" };
    mockGetOptimizationJobResult.mockResolvedValue({ status: 202, body });

    const response = await GET(request("job-456"), context("job-456"));

    expect(response.status).toBe(202);
    expect(await response.json()).toEqual(body);
  });

  it("maps upstream conflicts with the shared delivery optimizer error handling", async () => {
    vi.spyOn(console, "error").mockImplementation(() => {});
    mockGetOptimizationJobResult.mockRejectedValue(
      deliveryOptimizerError(409, { error: "Optimization job has no result." })
    );

    const response = await GET(request("job-789"), context("job-789"));

    expect(response.status).toBe(409);
    expect(await response.json()).toEqual({
      error: "Optimization job has no result.",
    });
  });
});
