import { describe, expect, it } from "vitest";
import { parseCustomerForm } from "./customer-form";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseCustomerForm", () => {
  it("accepts a complete customer", () => {
    const result = parseCustomerForm(
      form({
        name: "Ramesh Yadav",
        phone: "9876543210",
        note: "Sharma Construction, Alambagh site",
      }),
    );

    expect(result).toEqual({
      ok: true,
      value: {
        name: "Ramesh Yadav",
        phone: "9876543210",
        note: "Sharma Construction, Alambagh site",
      },
    });
  });

  it("tidies whitespace in the name", () => {
    const result = parseCustomerForm(
      form({ name: "  Ramesh   Yadav  ", phone: "9876543210" }),
    );
    expect(result.ok && result.value.name).toBe("Ramesh Yadav");
  });

  it("treats a blank note as no note", () => {
    const result = parseCustomerForm(
      form({ name: "Ramesh", phone: "9876543210", note: "   " }),
    );
    expect(result.ok && result.value.note).toBeNull();
  });

  it("accepts the ways a number actually gets typed", () => {
    for (const typed of [
      "9876543210",
      "98765 43210",
      "+91 98765 43210",
      "09876543210",
      "+919876543210",
      "98765-43210",
    ]) {
      const result = parseCustomerForm(form({ name: "Ramesh", phone: typed }));
      expect(result.ok && result.value.phone, typed).toBe("9876543210");
    }
  });

  it("rejects numbers that are not Indian mobiles", () => {
    for (const bad of ["1234567890", "5876543210", "987654321", "98765432101"]) {
      const result = parseCustomerForm(form({ name: "Ramesh", phone: bad }));
      expect(result.ok, bad).toBe(false);
    }
  });

  it("names the field that is wrong", () => {
    const result = parseCustomerForm(form({ name: "", phone: "" }));
    expect(result).toEqual({
      ok: false,
      errors: { name: "Enter a name", phone: "Enter a mobile number" },
    });
  });

  it("separates a missing number from an invalid one", () => {
    const missing = parseCustomerForm(form({ name: "Ramesh", phone: "" }));
    const invalid = parseCustomerForm(form({ name: "Ramesh", phone: "12345" }));

    expect(missing.ok).toBe(false);
    expect(invalid.ok).toBe(false);
    expect(!missing.ok && missing.errors.phone).toBe("Enter a mobile number");
    expect(!invalid.ok && invalid.errors.phone).toBe(
      "Enter a valid 10-digit mobile number",
    );
  });

  it("rejects an absurdly long name", () => {
    const result = parseCustomerForm(
      form({ name: "x".repeat(81), phone: "9876543210" }),
    );
    expect(!result.ok && result.errors.name).toBe("Name is too long");
  });
});
