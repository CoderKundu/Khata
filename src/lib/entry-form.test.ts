import { describe, expect, it } from "vitest";
import {
  formatEntryDate,
  parseEntryDate,
  parseEntryForm,
  todayISO,
} from "./entry-form";

function form(fields: Record<string, string>): FormData {
  const fd = new FormData();
  for (const [k, v] of Object.entries(fields)) fd.set(k, v);
  return fd;
}

describe("parseEntryDate", () => {
  it("lands at midday UTC so no timezone can shift the day", () => {
    const date = parseEntryDate("2026-09-16");
    expect(date?.toISOString()).toBe("2026-09-16T12:00:00.000Z");
  });

  function dayIn(date: Date, timeZone: string): string {
    return new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    }).format(date);
  }

  it("survives every offset from UTC-12 to UTC+11", () => {
    const date = parseEntryDate("2026-09-16") as Date;
    for (const timeZone of [
      "Asia/Kolkata",
      "America/Los_Angeles",
      "Pacific/Midway",
      "Asia/Tokyo",
      "UTC",
    ]) {
      expect(dayIn(date, timeZone), timeZone).toBe("2026-09-16");
    }
  });

  /**
   * Midday UTC is not enough on its own: at UTC+13 it is already 1am the next
   * day. This is why the app formats entry dates in UTC rather than in the
   * device's timezone — it documents the hazard the pinning protects against.
   */
  it("would shift a day at UTC+13 if it were rendered in local time", () => {
    const date = parseEntryDate("2026-09-16") as Date;
    expect(dayIn(date, "Pacific/Auckland")).toBe("2026-09-17");
    expect(dayIn(date, "UTC")).toBe("2026-09-16");
  });

  it("rejects days that do not exist", () => {
    expect(parseEntryDate("2026-02-31")).toBeNull();
    expect(parseEntryDate("2026-13-01")).toBeNull();
    expect(parseEntryDate("2026-00-10")).toBeNull();
  });

  it("rejects anything not an ISO date", () => {
    expect(parseEntryDate("")).toBeNull();
    expect(parseEntryDate("16/09/2026")).toBeNull();
    expect(parseEntryDate("2026-9-16")).toBeNull();
    expect(parseEntryDate("yesterday")).toBeNull();
  });

  it("accepts a leap day in a leap year and not otherwise", () => {
    expect(parseEntryDate("2028-02-29")).not.toBeNull();
    expect(parseEntryDate("2027-02-29")).toBeNull();
  });
});

describe("formatEntryDate", () => {
  const now = new Date(2026, 8, 16);

  it("drops the year when it is the current one", () => {
    expect(formatEntryDate(parseEntryDate("2026-09-16") as Date, now)).toBe(
      "16 Sep",
    );
    expect(formatEntryDate(parseEntryDate("2026-01-05") as Date, now)).toBe(
      "5 Jan",
    );
  });

  it("shows a short year for any other year", () => {
    expect(formatEntryDate(parseEntryDate("2025-12-31") as Date, now)).toBe(
      "31 Dec 25",
    );
  });
});

describe("todayISO", () => {
  it("formats the local date, zero-padded", () => {
    expect(todayISO(new Date(2026, 0, 5))).toBe("2026-01-05");
    expect(todayISO(new Date(2026, 11, 31))).toBe("2026-12-31");
  });
});

describe("parseEntryForm", () => {
  const now = new Date(2026, 8, 16, 15, 0);

  it("accepts an amount, note and date", () => {
    const result = parseEntryForm(
      form({ amount: "4,500.50", note: "  Cement  10  bori ", date: "2026-09-16" }),
      now,
    );

    expect(result.ok).toBe(true);
    if (!result.ok) return;
    expect(result.value.amountPaise).toBe(450050);
    expect(result.value.note).toBe("Cement 10 bori");
    expect(result.value.entryDate.toISOString()).toBe("2026-09-16T12:00:00.000Z");
  });

  it("treats a blank note as no note", () => {
    const result = parseEntryForm(
      form({ amount: "100", note: "   ", date: "2026-09-16" }),
      now,
    );
    expect(result.ok && result.value.note).toBeNull();
  });

  it("passes through the money errors", () => {
    for (const bad of ["", "abc", "0", "-5", "1.234"]) {
      const result = parseEntryForm(
        form({ amount: bad, date: "2026-09-16" }),
        now,
      );
      expect(result.ok, bad).toBe(false);
      expect(!result.ok && result.errors.amount, bad).toBeTruthy();
    }
  });

  it("allows today, including later in the day than now", () => {
    const result = parseEntryForm(
      form({ amount: "100", date: "2026-09-16" }),
      new Date(2026, 8, 16, 0, 1),
    );
    expect(result.ok).toBe(true);
  });

  it("allows backdating, which is the normal case", () => {
    const result = parseEntryForm(
      form({ amount: "100", date: "2026-08-02" }),
      now,
    );
    expect(result.ok).toBe(true);
  });

  it("refuses a date in the future", () => {
    const result = parseEntryForm(
      form({ amount: "100", date: "2026-09-17" }),
      now,
    );
    expect(!result.ok && result.errors.date).toBe("Date cannot be in the future");
  });

  it("reports both a bad amount and a bad date at once", () => {
    const result = parseEntryForm(form({ amount: "", date: "nope" }), now);
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.errors.amount).toBeTruthy();
    expect(result.errors.date).toBe("Pick a date");
  });
});
