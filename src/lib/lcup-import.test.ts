import { describe, expect, it } from "vitest";
import {
  applyLcupImport,
  buildLcupImport,
  detectSheet,
  isGroupRoster,
  lcupDays,
  lcupMoney,
  lcupPhone,
  rosterGroupName,
  type LcupSheet,
} from "./lcup-import";
import { createDemoData } from "../data/seed";
import { computeBalances } from "./metrics";

// Made-up people only: the real exports never go into the code.
const sheets: Record<LcupSheet, string[][]> = {
  teachers: [
    ["Name", "Mobile Number", "Salary [type]"],
    ["Teacher One", "+(998) 90-111-11-11", "50 [Foiz]"],
    ["Teacher Two", "+(998) 90-222-22-22", "3000000 [Fiks]"],
  ],
  groups: [
    [
      "Name",
      "Course",
      "Teacher",
      "Days",
      "Room",
      "Start Course",
      "Time",
      "Cost",
      "Status",
    ],
    [
      "Beginner",
      "ENGLISH",
      "Teacher One",
      "Dushanba, Chorshanba, Juma",
      "1",
      "2026-02-01",
      "09:00 - 10:30",
      "500,000",
      "Faol",
    ],
    [
      "BEGINNER",
      "ENGLISH",
      "Teacher One",
      "Seshanba, Payshanba, Shanba",
      "1",
      "2026-02-01",
      "11:00 - 12:30",
      "500,000",
      "Faol",
    ],
    [
      "Chess",
      "CHESS",
      "Teacher Two",
      "Shanba, Yakshanba",
      "2",
      "2026-03-01",
      "10:00 - 11:00",
      "300,000",
      "Faol",
    ],
  ],
  students: [
    [
      "Name",
      "Phone Number",
      "Address",
      "Birth Date",
      "Groups",
      "Parent Numbers",
      "Lid Extra Information",
      "Balans",
    ],
    [
      "Ali Valiyev",
      "+(998) 91-000-00-01",
      "Street 1",
      "2015-05-05",
      "Beginner, Chess",
      "+(998) 93-000-00-01",
      "",
      "-400,000",
    ],
    [
      "Ali Valiyev",
      "+(998) 91-000-00-01",
      "Street 1",
      "2026-11-08",
      "",
      "",
      "",
      "0",
    ],
    [
      "Vali Aliyev",
      "+(998) 91-000-00-02",
      "",
      "2026-11-08",
      "BEGINNER",
      "",
      "Manzil => Street 2, Yosh => 10",
      "100,000",
    ],
    ["Waiting Student", "+(998) 91-000-00-03", "", "", "", "", "", "-50,000"],
  ],
  payments: [
    [
      "FISH",
      "Telefon raqam",
      "guruh",
      "Narx",
      "To'lov usuli",
      "Sana",
      "Hodim",
      "Izoh",
    ],
    [
      "Ali Valiyev",
      "+(998) 91-000-00-01",
      "Chess",
      "300,000",
      "Plastik karta",
      "2026-11-02",
      "Admin",
      "",
    ],
  ],
  debtors: [
    ["Name", "Phone Number", "Debt"],
    ["Ali Valiyev", "+(998) 91-000-00-01", "-400,000"],
    ["Waiting Student", "+(998) 91-000-00-03", "-50,000"],
  ],
};
const roster = (group: string, rows: string[][]) => ({
  group,
  rows: [["Name", "Phone Number", "Address", "Birth Date", "Status"], ...rows],
});

describe("moving a branch from LC UP", () => {
  const imp = buildLcupImport(
    sheets,
    "br_test",
    "2026-11-08",
    { courses: [] },
    [
      roster("Chess", [
        ["Ali Valiyev", "+(998) 91-000-00-01", "", "", "Muzlatilgan"],
      ]),
      roster("Beginner", [
        ["Ali Valiyev", "+(998) 91-000-00-01", "", "", "Aktiv"],
      ]),
      roster("BEGINNER", [
        ["Vali Aliyev", "+(998) 91-000-00-02", "", "", "Muzlatilgan"],
      ]),
    ],
  );

  it("recognises each export by its columns", () => {
    for (const [kind, rows] of Object.entries(sheets))
      expect(detectSheet(rows)).toBe(kind);
    expect(isGroupRoster(roster("x", []).rows)).toBe(true);
    expect(
      rosterGroupName("rus tili  4_students_2026-11-08 16_00_13.xlsx"),
    ).toBe("rus tili  4");
    expect(rosterGroupName("students_2026-11-08_15_47_55.xlsx")).toBeNull();
  });

  it("reads LC UP numbers, phones and days", () => {
    expect(lcupMoney("-407,692.0")).toBe(-407692);
    expect(lcupPhone("+(998) 90-900-01-08")).toBe("+998 90 900 01 08");
    expect(lcupDays("Dushanba, Chorshanba, Juma")).toEqual({ days: "odd" });
    expect(lcupDays("Shanba, Yakshanba")).toEqual({
      days: "odd",
      weekdays: [6, 7],
    });
  });

  it('keeps "Beginner" and "BEGINNER" as two groups and builds teachers and courses', () => {
    expect(imp.groups.map((g) => g.name)).toEqual([
      "Beginner",
      "BEGINNER",
      "Chess",
    ]);
    expect(
      imp.teachers.map((t) => [t.salaryKind, t.salaryPercent, t.fixedSalary]),
    ).toEqual([
      ["percent", 50, undefined],
      ["fixed", 0, 3_000_000],
    ]);
    expect(imp.courses.map((c) => [c.name, c.defaultFee])).toEqual([
      ["ENGLISH", 500_000],
      ["CHESS", 300_000],
    ]);
    expect(imp.groups[2]).toMatchObject({
      weekdays: [6, 7],
      durationMinutes: 60,
      monthlyFee: 300_000,
    });
  });

  it("joins a student listed twice, with several groups and the balance of the row with a group", () => {
    const ali = imp.students.find((s) => s.fullName === "Ali Valiyev")!;
    expect(imp.students).toHaveLength(3);
    expect(ali.groupId).toBe(imp.groups[0].id);
    expect(ali.extraGroupIds).toEqual([imp.groups[2].id]);
    expect(ali.openingBalance?.amount).toBe(-400_000);
    expect(ali.guardians[0].phone).toBe("+998 93 000 00 01");
    expect(imp.enrollments.filter((e) => e.studentId === ali.id)).toHaveLength(
      2,
    );
    expect(
      imp.students.find((s) => s.fullName === "Waiting Student")!.groupId,
    ).toBeNull();
    expect(
      imp.students.find((s) => s.fullName === "Vali Aliyev")!.address,
    ).toBe("Street 2");
  });

  it("takes frozen students from the group lists", () => {
    const vali = imp.students.find((s) => s.fullName === "Vali Aliyev")!;
    const ali = imp.students.find((s) => s.fullName === "Ali Valiyev")!;
    expect(vali.status).toBe("paused");
    expect(ali.status).toBe("active");
    expect(imp.report).toMatchObject({
      paused: 1,
      partlyFrozen: 1,
      rosterMismatches: [],
    });
    expect(
      imp.studentNotes.find((n) => n.studentId === ali.id)?.text,
    ).toContain("Chess");
  });

  it("brings payments over as history, linked to their group", () => {
    expect(imp.payments).toEqual([
      expect.objectContaining({
        amount: 300_000,
        method: "card",
        imported: true,
        groupId: imp.groups[2].id,
        date: "2026-11-02",
      }),
    ]);
    expect(imp.report).toMatchObject({
      paymentsTotal: 300_000,
      debtors: 2,
      debtTotal: -450_000,
      lcupDebtors: 2,
      lcupDebtTotal: -450_000,
    });
  });

  it("replaces only that branch, and debts match LC UP", () => {
    const demo = createDemoData(new Date("2026-11-08T09:00:00"));
    const other = demo.students.filter((s) => s.branchId !== "br_test").length;
    const d = applyLcupImport(demo, imp);
    expect(d.students.filter((s) => s.branchId !== "br_test")).toHaveLength(
      other,
    );
    const owed = computeBalances(d, new Date("2026-11-10T10:00:00"));
    expect(imp.students.map((s) => owed.get(s.id)?.owed ?? 0)).toEqual([
      400_000, 0, 50_000,
    ]);
  });
});
