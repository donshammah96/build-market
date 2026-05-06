// @vitest-environment jsdom
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useCreatePropertiesBatch, propertyKeys } from "@/hooks/useProperties";
import { CreatePropertySchema } from "@/app/lib/validation/properties-validation";

const mockPropertiesClient = vi.hoisted(() => ({
  createPropertiesBatch: vi.fn(),
}));

vi.mock("@/lib/properties-client", async () => {
  const actual = await vi.importActual("@/lib/properties-client");
  return {
    ...actual,
    propertiesClient: mockPropertiesClient,
  };
});

function createWrapper() {
  const queryClient = new QueryClient({
    defaultOptions: {
      queries: { retry: false },
      mutations: { retry: false },
    },
  });

  function Wrapper({ children }: { children: ReactNode }) {
    return (
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    );
  }

  return { Wrapper, queryClient };
}

function buildCreatePropertyInput(overrides: Record<string, unknown> = {}) {
  return CreatePropertySchema.parse({
    title: "Townhouse",
    type: "SALE",
    category: "RESIDENTIAL",
    price: 5000000,
    currency: "KES",
    priceNegotiable: false,
    tenure: "FREEHOLD",
    titleDeedReady: false,
    areaUnit: "SQ_METERS",
    furnishing: "UNFURNISHED",
    completionStatus: "READY_TO_MOVE",
    location: "Nairobi",
    coordinates: {
      lat: -1.286389,
      lng: 36.817223,
    },
    hasBorehole: false,
    hasBackupGenerator: false,
    hasElevator: false,
    hasCCTV: false,
    isGatedCommunity: false,
    features: [],
    featured: false,
    images: [],
    attachments: [],
    documents: [],
    ...overrides,
  });
}

describe("useCreatePropertiesBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("forwards the batch payload and invalidates my-properties plus list caches", async () => {
    const payload = {
      properties: [
        buildCreatePropertyInput(),
        buildCreatePropertyInput({
          title: "Karen Maisonette",
          location: "Karen",
          price: 18500000,
        }),
      ],
      idempotencyKey: "idem-batch-1",
    };
    const response = {
      properties: [
        { id: "property-1", title: "Townhouse" },
        { id: "property-2", title: "Karen Maisonette" },
      ],
      count: 2,
    };
    mockPropertiesClient.createPropertiesBatch.mockResolvedValue({
      success: true,
      data: response,
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePropertiesBatch(), {
      wrapper: Wrapper,
    });

    const data = await result.current.mutateAsync(payload);

    await waitFor(() => expect(result.current.isSuccess).toBe(true));

    expect(data).toEqual(response);
    expect(mockPropertiesClient.createPropertiesBatch).toHaveBeenCalledWith(
      payload,
    );
    expect(invalidateQueriesSpy).toHaveBeenNthCalledWith(1, {
      queryKey: propertyKeys.myProperties(),
    });
    expect(invalidateQueriesSpy).toHaveBeenNthCalledWith(2, {
      queryKey: propertyKeys.lists(),
    });
  });

  it("unwraps API errors and skips cache invalidation when batch creation fails", async () => {
    const payload = {
      properties: [buildCreatePropertyInput()],
      idempotencyKey: "idem-batch-error",
    };
    mockPropertiesClient.createPropertiesBatch.mockResolvedValue({
      success: false,
      error: "Batch property creation failed",
    });

    const { Wrapper, queryClient } = createWrapper();
    const invalidateQueriesSpy = vi.spyOn(queryClient, "invalidateQueries");

    const { result } = renderHook(() => useCreatePropertiesBatch(), {
      wrapper: Wrapper,
    });

    await expect(result.current.mutateAsync(payload)).rejects.toThrow(
      "Batch property creation failed",
    );

    await waitFor(() => expect(result.current.isError).toBe(true));

    expect(mockPropertiesClient.createPropertiesBatch).toHaveBeenCalledWith(
      payload,
    );
    expect(invalidateQueriesSpy).not.toHaveBeenCalled();
  });
});
