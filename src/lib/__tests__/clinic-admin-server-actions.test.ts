import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  createClinicDepartment,
  createClinicRoom,
  setClinicDepartmentActive,
} from "@/lib/admin/department-actions";
import {
  createClinicDialysisMachine,
  updateClinicDialysisMachineStatus,
} from "@/lib/admin/dialysis-actions";
import {
  createClinicLabInvoice,
  createClinicLabMaterial,
  restockClinicLabMaterial,
  updateClinicLabInvoiceStatus,
} from "@/lib/admin/lab-actions";
import {
  createClinicService,
  deleteClinicService,
  setClinicServiceActive,
  updateClinicService,
} from "@/lib/admin/service-actions";
import {
  createClinicUser,
  deleteClinicUser,
  setClinicUserActive,
  updateClinicUser,
} from "@/lib/admin/user-actions";

const CLINIC_ID = "11110000-1111-1111-1111-111100001111";

type DbResult<T> = Promise<{ data: T; error: { message: string } | null }>;

const mockSingle = vi.fn<() => DbResult<Record<string, unknown> | null>>();
const mockMaybeSingle = vi.fn<() => DbResult<Record<string, unknown> | null>>();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockSelect = vi.fn();
const mockFrom = vi.fn();
const mockMutationEq = vi.fn();
const mockLookupEq = vi.fn();

let mutationResult: { error: { message: string } | null } = { error: null };

const mutationChain = {
  eq: mockMutationEq,
  then: (resolve: (value: { error: { message: string } | null }) => void) =>
    resolve(mutationResult),
};

const lookupChain = {
  eq: mockLookupEq,
  maybeSingle: mockMaybeSingle,
  single: mockSingle,
};

const mockSupabase = {
  from: mockFrom,
};

const mockAdminContext = vi.fn();
const mockSendEmail = vi.fn();
const mockStaffWelcomeEmail = vi.fn();
const mockCreateScopedAdminClient = vi.fn();
const mockGetSupabaseServiceRoleKey = vi.fn();
const mockGetSiteUrl = vi.fn();

vi.mock("@/lib/admin/base", async () => {
  const actual = await vi.importActual<typeof import("@/lib/admin/base")>("@/lib/admin/base");
  return {
    ...actual,
    adminContext: (...args: unknown[]) => mockAdminContext(...args),
  };
});

vi.mock("@/lib/email", () => ({ sendEmail: (...args: unknown[]) => mockSendEmail(...args) }));
vi.mock("@/lib/email-templates", () => ({
  staffWelcomeEmail: (...args: unknown[]) => mockStaffWelcomeEmail(...args),
}));
vi.mock("@/lib/env", () => ({
  getLoginRateLimitMax: () => 5,
  getLoginRateLimitWindowMs: () => 60_000,
  getSupabaseServiceRoleKey: (...args: unknown[]) => mockGetSupabaseServiceRoleKey(...args),
  getSiteUrl: (...args: unknown[]) => mockGetSiteUrl(...args),
}));
vi.mock("@/lib/supabase-server", () => ({
  createScopedAdminClient: (...args: unknown[]) => mockCreateScopedAdminClient(...args),
}));
vi.mock("@/lib/logger", () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn(), debug: vi.fn() },
}));

function makeMutatingChain() {
  return {
    select: mockSelect,
    single: mockSingle,
  };
}

beforeEach(() => {
  vi.clearAllMocks();

  mockAdminContext.mockResolvedValue({ clinicId: CLINIC_ID, supabase: mockSupabase });
  mockGetSupabaseServiceRoleKey.mockReturnValue("");
  mockGetSiteUrl.mockReturnValue("https://oltigo.com");
  mockStaffWelcomeEmail.mockReturnValue({ subject: "Welcome", html: "<p>Hello</p>" });

  mutationResult = { error: null };
  mockMutationEq.mockImplementation(() => mutationChain);
  mockLookupEq.mockImplementation(() => lookupChain);
  mockSelect.mockImplementation(() => lookupChain);
  mockInsert.mockReturnValue(makeMutatingChain());
  mockUpdate.mockReturnValue(mutationChain);
  mockDelete.mockReturnValue(mutationChain);
  mockMaybeSingle.mockResolvedValue({ data: null, error: null });
  mockSingle.mockResolvedValue({ data: null, error: null });

  mockFrom.mockImplementation((table: string) => {
    if (table === "users") {
      return {
        select: mockSelect,
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      };
    }
    if (table === "services") {
      return {
        insert: mockInsert,
        update: mockUpdate,
        delete: mockDelete,
      };
    }
    if (table === "departments") {
      return {
        insert: mockInsert,
        update: mockUpdate,
      };
    }
    if (table === "rooms") {
      return {
        insert: mockInsert,
      };
    }
    if (table === "beds") {
      return {
        insert: mockInsert,
      };
    }
    return {
      select: mockSelect,
      insert: mockInsert,
      update: mockUpdate,
      delete: mockDelete,
    };
  });
});

describe("clinic-admin server actions", () => {
  it("createClinicService returns the inserted service row", async () => {
    const persisted = { id: "svc-1", clinic_id: CLINIC_ID, name: "Consultation", is_active: true };
    mockSingle.mockResolvedValueOnce({ data: persisted, error: null });

    const result = await createClinicService({
      name: " Consultation ",
      duration_minutes: 30,
      price: 200,
    });

    expect(mockFrom).toHaveBeenCalledWith("services");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC_ID,
        name: "Consultation",
        duration_minutes: 30,
        price: 200,
        currency: "MAD",
      }),
    );
    expect(result).toEqual(persisted);
  });

  it("updateClinicService writes the patch scoped by clinic_id", async () => {
    mutationResult = { error: null };

    await updateClinicService("svc-1", {
      name: "  Updated service ",
      description: "  Follow-up ",
      category: "  General ",
      is_active: false,
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated service",
        description: "Follow-up",
        category: "General",
        is_active: false,
      }),
    );
    expect(mockMutationEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
  });

  it("setClinicServiceActive and deleteClinicService resolve without error on success", async () => {
    mutationResult = { error: null };

    await expect(setClinicServiceActive("svc-1", true)).resolves.toBeUndefined();
    await expect(deleteClinicService("svc-1")).resolves.toBeUndefined();
  });

  it("createClinicUser returns the inserted user row", async () => {
    const persisted = { id: "user-1", clinic_id: CLINIC_ID, role: "doctor", name: "Dr Test" };
    mockSingle.mockResolvedValueOnce({ data: persisted, error: null });

    const result = await createClinicUser({
      role: "doctor",
      name: "  Dr Test ",
      email: "doctor@example.com",
      phone: " +212600000000 ",
      metadata: { specialty: "Cardiology" },
    });

    expect(mockFrom).toHaveBeenCalledWith("users");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC_ID,
        role: "doctor",
        name: "Dr Test",
        email: "doctor@example.com",
        phone: "+212600000000",
        metadata: { specialty: "Cardiology" },
      }),
    );
    expect(result).toEqual(persisted);
    expect(mockSendEmail).not.toHaveBeenCalled();
  });

  it("updateClinicUser shallow-merges metadata and scopes the write by clinic_id", async () => {
    mockSelect.mockReturnValueOnce(lookupChain);
    mockMaybeSingle.mockResolvedValueOnce({
      data: { metadata: { specialty: "Cardiology" } },
      error: null,
    });
    mutationResult = { error: null };

    await updateClinicUser("user-1", {
      name: "  Updated User ",
      metadata: { languages: ["fr"] },
    });

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        name: "Updated User",
        metadata: { specialty: "Cardiology", languages: ["fr"] },
      }),
    );
    expect(mockMutationEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
  });

  it("setClinicUserActive and deleteClinicUser resolve without error on success", async () => {
    mutationResult = { error: null };

    await expect(setClinicUserActive("user-1", false)).resolves.toBeUndefined();
    await expect(deleteClinicUser("user-1")).resolves.toBeUndefined();
  });

  it("createClinicDepartment returns the inserted department row", async () => {
    const persisted = { id: "dept-1", clinic_id: CLINIC_ID, name: "Radiology", is_active: true };
    mockSingle.mockResolvedValueOnce({ data: persisted, error: null });

    const result = await createClinicDepartment({
      name: " Radiology ",
      nameAr: " الأشعة ",
      floor: " 2 ",
      description: " Imaging ",
    });

    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC_ID,
        name: "Radiology",
        name_ar: "الأشعة",
        floor: "2",
        description: "Imaging",
        is_active: true,
      }),
    );
    expect(result).toEqual(persisted);
  });

  it("setClinicDepartmentActive resolves without error on success", async () => {
    mutationResult = { error: null };

    await expect(setClinicDepartmentActive("dept-1", false)).resolves.toBeUndefined();
  });

  it("createClinicRoom creates the room and the expected number of bed rows", async () => {
    const room = { id: "room-1", department_id: "dept-1", room_number: "101" };
    mockSingle.mockResolvedValueOnce({ data: room, error: null });
    mockInsert
      .mockReturnValueOnce({ select: mockSelect })
      .mockReturnValueOnce(Promise.resolve({ error: null }));

    const result = await createClinicRoom({
      roomNumber: " 101 ",
      roomType: "consultation",
      floor: " 1 ",
      totalBeds: 3,
    });

    expect(mockFrom).toHaveBeenCalledWith("rooms");
    expect(mockFrom).toHaveBeenCalledWith("beds");
    expect(mockInsert).toHaveBeenNthCalledWith(
      2,
      expect.arrayContaining([
        expect.objectContaining({ clinic_id: CLINIC_ID, room_id: "room-1", bed_number: "1" }),
        expect.objectContaining({ clinic_id: CLINIC_ID, room_id: "room-1", bed_number: "2" }),
        expect.objectContaining({ clinic_id: CLINIC_ID, room_id: "room-1", bed_number: "3" }),
      ]),
    );
    expect(result).toEqual(room);
  });

  it("createClinicLabMaterial returns the inserted material row", async () => {
    const persisted = { id: "mat-1", clinic_id: CLINIC_ID, name: "Tube", quantity: 10 };
    mockSingle.mockResolvedValueOnce({ data: persisted, error: null });

    const result = await createClinicLabMaterial({
      name: " Tube ",
      category: " Consumables ",
      quantity: 10,
      unit: " box ",
      minThreshold: 2,
      unitCost: 25,
      supplier: " Supplier A ",
    });

    expect(mockFrom).toHaveBeenCalledWith("lab_materials");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC_ID,
        name: "Tube",
        category: "Consumables",
        quantity: 10,
        unit: "box",
        min_threshold: 2,
        unit_cost: 25,
        supplier: "Supplier A",
      }),
    );
    expect(result).toEqual(persisted);
  });

  it("restockClinicLabMaterial loads current quantity and writes the incremented total", async () => {
    mockSingle.mockResolvedValueOnce({ data: { quantity: 7 }, error: null });
    mutationResult = { error: null };

    await expect(restockClinicLabMaterial("mat-1", 5)).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        quantity: 12,
      }),
    );
    expect(mockMutationEq).toHaveBeenCalledWith("clinic_id", CLINIC_ID);
  });

  it("createClinicLabInvoice computes subtotal and returns the inserted invoice row", async () => {
    const persisted = { id: "inv-1", clinic_id: CLINIC_ID, invoice_number: "INV-001", total: 650 };
    mockSingle.mockResolvedValueOnce({ data: persisted, error: null });

    const result = await createClinicLabInvoice({
      invoiceNumber: " INV-001 ",
      dentistName: " Dr Smile ",
      dueDate: "2026-08-01",
      notes: " Urgent ",
      items: [
        { description: "Crown", quantity: 1, unitPrice: 400, total: 400 },
        { description: "Retainer", quantity: 1, unitPrice: 250, total: 250 },
      ],
    });

    expect(mockFrom).toHaveBeenCalledWith("lab_invoices");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC_ID,
        invoice_number: "INV-001",
        dentist_name: "Dr Smile",
        due_date: "2026-08-01",
        notes: "Urgent",
        subtotal: 650,
        total: 650,
        currency: "MAD",
        status: "draft",
      }),
    );
    expect(result).toEqual(persisted);
  });

  it("updateClinicLabInvoiceStatus resolves and writes paid_date when status is paid", async () => {
    mutationResult = { error: null };

    await expect(updateClinicLabInvoiceStatus("inv-1", "paid")).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "paid",
        paid_date: expect.any(String),
      }),
    );
  });

  it("createClinicDialysisMachine returns the inserted machine row", async () => {
    const persisted = { id: "machine-1", clinic_id: CLINIC_ID, machine_name: "HD-01" };
    mockSingle.mockResolvedValueOnce({ data: persisted, error: null });

    const result = await createClinicDialysisMachine({
      machineName: " HD-01 ",
      machineModel: " Fresenius ",
      serialNumber: " SN-001 ",
    });

    expect(mockFrom).toHaveBeenCalledWith("dialysis_machines");
    expect(mockInsert).toHaveBeenCalledWith(
      expect.objectContaining({
        clinic_id: CLINIC_ID,
        machine_name: "HD-01",
        machine_model: "Fresenius",
        serial_number: "SN-001",
        status: "available",
      }),
    );
    expect(result).toEqual(persisted);
  });

  it("updateClinicDialysisMachineStatus resolves and adds maintenance timestamp when available", async () => {
    mutationResult = { error: null };

    await expect(
      updateClinicDialysisMachineStatus("machine-1", "available"),
    ).resolves.toBeUndefined();

    expect(mockUpdate).toHaveBeenCalledWith(
      expect.objectContaining({
        status: "available",
        last_maintenance: expect.any(String),
      }),
    );
  });

  it("throws when restockClinicLabMaterial cannot load the current material", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "missing" } });

    await expect(restockClinicLabMaterial("mat-1", 5)).rejects.toThrow(
      /Failed to load lab material/,
    );
  });

  it("throws when createClinicLabInvoice fails", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "constraint" } });

    await expect(
      createClinicLabInvoice({
        invoiceNumber: "INV-001",
        items: [{ description: "Crown", quantity: 1, unitPrice: 400, total: 400 }],
      }),
    ).rejects.toThrow(/Failed to create lab invoice/);
  });

  it("throws when updateClinicDialysisMachineStatus fails", async () => {
    mutationResult = { error: { message: "denied" } };

    await expect(updateClinicDialysisMachineStatus("machine-1", "maintenance")).rejects.toThrow(
      /Failed to update machine status/,
    );
  });

  it("throws a clear error when createClinicService fails", async () => {
    mockSingle.mockResolvedValueOnce({ data: null, error: { message: "constraint" } });

    await expect(createClinicService({ name: "Test", duration_minutes: 30 })).rejects.toThrow(
      /Failed to create service/,
    );
  });
});
