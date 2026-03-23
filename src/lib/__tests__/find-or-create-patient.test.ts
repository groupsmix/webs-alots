import { describe, it, expect, vi } from "vitest";
import { findOrCreatePatient } from "../find-or-create-patient";

function createMockSupabase(
  phoneResult: { data: { id: string } | null },
  nameResult: { data: { id: string }[] | null },
  insertResult: { data: { id: string } | null },
) {
  return {
    from: vi.fn().mockReturnValue({
      select: vi.fn().mockReturnValue({
        eq: vi.fn().mockImplementation(() => {
          const chain = {
            eq: vi.fn().mockImplementation(() => {
              const innerChain = {
                eq: vi.fn().mockImplementation(() => ({
                  limit: vi.fn().mockImplementation((n: number) => {
                    if (n === 1) {
                      return { single: vi.fn().mockResolvedValue(phoneResult) };
                    }
                    return Promise.resolve(nameResult);
                  }),
                })),
                limit: vi.fn().mockImplementation((n: number) => {
                  if (n === 1) {
                    return { single: vi.fn().mockResolvedValue(phoneResult) };
                  }
                  return Promise.resolve(nameResult);
                }),
              };
              return innerChain;
            }),
            limit: vi.fn().mockImplementation((n: number) => {
              if (n === 1) {
                return { single: vi.fn().mockResolvedValue(phoneResult) };
              }
              return Promise.resolve(nameResult);
            }),
          };
          return chain;
        }),
      }),
      insert: vi.fn().mockReturnValue({
        select: vi.fn().mockReturnValue({
          single: vi.fn().mockResolvedValue(insertResult),
        }),
      }),
    }),
  };
}

describe("findOrCreatePatient", () => {
  it("returns the ID as-is when it does not start with 'patient-'", async () => {
    const mockSupabase = createMockSupabase(
      { data: null },
      { data: null },
      { data: null },
    );
    const result = await findOrCreatePatient(
      mockSupabase as never,
      "clinic-1",
      "existing-uuid-123",
      "John Doe",
    );
    expect(result).toBe("existing-uuid-123");
    // Should not call supabase at all
    expect(mockSupabase.from).not.toHaveBeenCalled();
  });

  it("returns the ID as-is for UUIDs", async () => {
    const mockSupabase = createMockSupabase(
      { data: null },
      { data: null },
      { data: null },
    );
    const result = await findOrCreatePatient(
      mockSupabase as never,
      "clinic-1",
      "550e8400-e29b-41d4-a716-446655440000",
      "John Doe",
    );
    expect(result).toBe("550e8400-e29b-41d4-a716-446655440000");
  });
});
