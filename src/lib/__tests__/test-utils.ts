import { vi } from "vitest";

interface MockQueryState {
  table: string;
  rows: unknown[];
  head: boolean;
  filters: Array<{ op: string; column: string; value: unknown }>;
  orderBy: string | null;
  ascending: boolean;
  limit: number;
}

function createMockQueryBuilder(table: string, rows: unknown[]) {
  const state: MockQueryState = {
    table,
    rows,
    head: false,
    filters: [],
    orderBy: null,
    ascending: true,
    limit: Number.MAX_SAFE_INTEGER,
  };

  const builder = {
    select: vi.fn((columns?: string, options?: { count?: "exact"; head?: boolean }) => {
      if (options?.head) state.head = true;
      return builder;
    }),
    eq: vi.fn((column: string, value: unknown) => {
      state.filters.push({ op: "eq", column, value });
      return builder;
    }),
    in: vi.fn((column: string, value: unknown[]) => {
      state.filters.push({ op: "in", column, value });
      return builder;
    }),
    gte: vi.fn((column: string, value: unknown) => {
      state.filters.push({ op: "gte", column, value });
      return builder;
    }),
    lte: vi.fn((column: string, value: unknown) => {
      state.filters.push({ op: "lte", column, value });
      return builder;
    }),
    order: vi.fn((column: string, options?: { ascending?: boolean }) => {
      state.orderBy = column;
      state.ascending = options?.ascending ?? true;
      return builder;
    }),
    limit: vi.fn((n: number) => {
      state.limit = n;
      return builder;
    }),
    single: vi.fn(() => builder),
    then: vi.fn((onfulfilled?: (value: unknown) => unknown) => {
      let result = [...state.rows];

      for (const filter of state.filters) {
        result = result.filter((row) => {
          const value = (row as Record<string, unknown>)[filter.column];
          switch (filter.op) {
            case "eq":
              return value === filter.value;
            case "in":
              return (filter.value as unknown[]).includes(value);
            case "gte":
              return typeof value === "string" && value >= (filter.value as string);
            case "lte":
              return typeof value === "string" && value <= (filter.value as string);
            default:
              return true;
          }
        });
      }

      if (state.orderBy) {
        result.sort((a, b) => {
          const aVal = (a as Record<string, unknown>)[state.orderBy as string];
          const bVal = (b as Record<string, unknown>)[state.orderBy as string];
          if (aVal === bVal) return 0;
          if (aVal == null) return 1;
          if (bVal == null) return -1;
          const cmp = aVal < bVal ? -1 : 1;
          return state.ascending ? cmp : -cmp;
        });
      }

      result = result.slice(0, state.limit);

      if (state.head) {
        return onfulfilled?.({ count: result.length, data: null });
      }

      return onfulfilled?.({ data: result });
    }),
    _state: state,
  };

  return builder;
}

export function createMockSupabaseClient(rows: Record<string, unknown[]> = {}) {
  const supabase = {
    from: vi.fn((table: string) => createMockQueryBuilder(table, rows[table] ?? [])),
  };
  return supabase as unknown as {
    from: (table: string) => ReturnType<typeof createMockQueryBuilder>;
  };
}
