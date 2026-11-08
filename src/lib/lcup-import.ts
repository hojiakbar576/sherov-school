// Moving a branch from LC UP: reads LC UP's Excel exports (teachers, groups,
// students, payments, and the debtor list for checking) and builds this
// app's records for one branch. Nothing is saved here; the owner sees the
// checks first and confirms.
//
// - Courses are shared by every branch; each LC UP course becomes a course with one level.
// - Students keep LC UP's balance on the export date as their opening balance,
//   so debts match LC UP exactly. Payments are brought over as history only
//   (already inside that balance).
// - A student in several groups gets one record with a main group and other groups.

import type {
  Course,
  Enrollment,
  Group,
  ISODate,
  Payment,
  Room,
  SchoolData,
  Student,
  StudentNote,
  Teacher,
  Weekday,
} from "../types";

export type LcupSheet =
  "teachers" | "groups" | "students" | "payments" | "debtors";

/** Columns that identify each LC UP export. */
const SIGNATURE: Record<LcupSheet, string[]> = {
  teachers: ["name", "mobile number", "salary [type]"],
  groups: ["name", "course", "teacher", "days", "room"],
  students: ["name", "phone number", "groups", "balans"],
  payments: ["fish", "telefon raqam", "narx", "to'lov usuli"],
  debtors: ["name", "phone number", "debt"],
};

/** Which LC UP export this is, from its header row; null when unknown. */
export function detectSheet(rows: string[][]): LcupSheet | null {
  const head = (rows[0] ?? []).map((h) => clean(h).toLowerCase());
  const order: LcupSheet[] = [
    "payments",
    "debtors",
    "students",
    "teachers",
    "groups",
  ];
  return order.find((s) => SIGNATURE[s].every((c) => head.includes(c))) ?? null;
}

/** A group's student list (LC UP → group → Students → Excel): rows with each student's status in that group. */
export function isGroupRoster(rows: string[][]): boolean {
  return (
    (rows[0] ?? []).map(lower).join() ===
    "name,phone number,address,birth date,status"
  );
}

/** "Intermediate 3_students_2026-11-08 15_58_22.xlsx" → "Intermediate 3". */
export function rosterGroupName(fileName: string): string | null {
  const m = /^(.*)_students_\d{4}-\d{2}-\d{2}[ _]/.exec(fileName);
  return m ? m[1] : null;
}

export interface GroupRoster {
  group: string;
  rows: string[][];
}

const clean = (v: unknown) =>
  String(v ?? "")
    .replace(/\s+/g, " ")
    .trim();
const lower = (v: unknown) => clean(v).toLowerCase();
const slug = (v: unknown) =>
  lower(v)
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "") || "x";

function table(rows: string[][]): Record<string, string>[] {
  const head = (rows[0] ?? []).map(clean);
  return rows
    .slice(1)
    .filter((r) => r.some((c) => clean(c)))
    .map((r) => Object.fromEntries(head.map((h, i) => [h, r[i] ?? ""])));
}

/** "+(998) 90-900-01-08" → "+998 90 900 01 08". Other numbers are kept as typed. */
export function lcupPhone(v: unknown): string {
  let d = String(v ?? "").replace(/\D/g, "");
  if (d.length === 9) d = `998${d}`;
  if (d.length !== 12 || !d.startsWith("998")) return d ? `+${d}` : "";
  return `+998 ${d.slice(3, 5)} ${d.slice(5, 8)} ${d.slice(8, 10)} ${d.slice(10, 12)}`;
}

/** "580,000" or "-407692.0" → whole som. */
export function lcupMoney(v: unknown): number {
  const s = String(v ?? "").replace(/[,\s]/g, "");
  const n = Number(s);
  return s && Number.isFinite(n) ? Math.round(n) : 0;
}

const ODD = ["chorshanba", "dushanba", "juma"].join();
const EVEN = ["payshanba", "seshanba", "shanba"].join();
const WEEKDAY: Record<string, Weekday> = {
  dushanba: 1,
  seshanba: 2,
  chorshanba: 3,
  payshanba: 4,
  juma: 5,
  shanba: 6,
  yakshanba: 7,
};

/** "Dushanba, Chorshanba, Juma" → odd; other combinations → their exact weekdays. */
export function lcupDays(v: unknown): Pick<Group, "days" | "weekdays"> {
  const names = [
    ...new Set(
      String(v ?? "")
        .split(",")
        .map(lower)
        .filter(Boolean),
    ),
  ].sort();
  if (names.join() === ODD) return { days: "odd" };
  if (names.join() === EVEN) return { days: "even" };
  const weekdays = [
    ...new Set(names.map((n) => WEEKDAY[n]).filter(Boolean)),
  ].sort();
  return { days: "odd", weekdays };
}

/** Excel date cells may arrive as serial numbers ("46331") or text ("2026-11-08"). */
function isoDate(v: unknown): ISODate | "" {
  const s = clean(v);
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  if (/^\d{5}(\.\d+)?$/.test(s))
    return new Date(Date.UTC(1899, 11, 30) + Math.floor(Number(s)) * 86_400_000)
      .toISOString()
      .slice(0, 10);
  return "";
}

const minutes = (t: string) => {
  const [h, m] = t.split(":").map(Number);
  return h * 60 + m;
};

export interface LcupImport {
  branchId: string;
  asOf: ISODate;
  courses: Course[];
  teachers: Teacher[];
  rooms: Room[];
  groups: Group[];
  students: Student[];
  enrollments: Enrollment[];
  payments: Payment[];
  studentNotes: StudentNote[];
  report: {
    /** Group lists read, and how many students in them didn't match the main student list. */
    rosters: number;
    rosterMismatches: string[];
    /** Frozen in all their groups: brought over as paused. */
    paused: number;
    /** Frozen in some groups only, or on a trial lesson: a note on the student says where. */
    partlyFrozen: number;
    onTrial: number;
    studentsInSeveralGroups: number;
    studentsWithoutGroup: number;
    paymentsTotal: number;
    /** Students LC UP listed twice (one row without a group): merged into one. */
    merged: string[];
    /** Same name, phone and group twice: kept as two records, as LC UP has them. */
    keptTwice: string[];
    unmatchedPayments: string[];
    unknownGroups: string[];
    groupsWithoutTeacher: string[];
    otherDayGroups: string[];
    /** From the debtor list, to compare with the balances brought over. */
    lcupDebtors: number | null;
    lcupDebtTotal: number | null;
    debtors: number;
    debtTotal: number;
  };
}

/**
 * Builds one branch's records from LC UP exports. `existing` supplies the
 * courses already in the app (shared by branches), so they are reused by name.
 */
export function buildLcupImport(
  sheets: Partial<Record<LcupSheet, string[][]>>,
  branchId: string,
  asOf: ISODate,
  existing: Pick<SchoolData, "courses">,
  rosters: GroupRoster[] = [],
): LcupImport {
  for (const s of ["teachers", "groups", "students"] as const)
    if (!sheets[s]) throw new Error(`The ${s} export is missing.`);
  const short = branchId.replace(/^br_/, "");
  const source = "LC UP";

  // ---- teachers
  const teachers = new Map<string, Teacher>();
  for (const t of table(sheets.teachers!)) {
    const name = clean(t["Name"]);
    if (!name) continue;
    const m = /([\d.]+)\s*\[(\w+)\]/.exec(t["Salary [type]"] ?? "");
    const amount = m ? Number(m[1]) : 0;
    const percent = !m || m[2].toLowerCase() === "foiz";
    teachers.set(lower(name), {
      id: `tch_${short}_${slug(name)}`,
      fullName: name,
      subject: "",
      phone: lcupPhone(t["Mobile Number"]),
      email: "",
      status: "active",
      joinedOn: asOf,
      branchId,
      salaryPercent: percent ? amount : 0,
      salaryKind: percent ? "percent" : "fixed",
      ...(percent ? {} : { fixedSalary: Math.round(amount) }),
    });
  }

  // ---- courses (reuse the app's by name)
  const groupRows = table(sheets.groups!);
  const courses = new Map<string, Course>(
    existing.courses.map((c) => [lower(c.name), c]),
  );
  const newCourses: Course[] = [];
  const fees = new Map<string, number[]>();
  for (const g of groupRows) {
    const name = clean(g["Course"]);
    if (!name) continue;
    fees.set(lower(name), [
      ...(fees.get(lower(name)) ?? []),
      lcupMoney(g["Cost"]),
    ]);
    if (courses.has(lower(name))) continue;
    const id = `crs_${slug(name)}`;
    const course: Course = {
      id,
      name,
      active: true,
      levels: [{ id: `${id}_main`, name, active: true }],
    };
    courses.set(lower(name), course);
    newCourses.push(course);
  }
  for (const c of newCourses) {
    const list = fees.get(lower(c.name)) ?? [];
    const counts = new Map<number, number>();
    for (const f of list) counts.set(f, (counts.get(f) ?? 0) + 1);
    c.defaultFee = [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
  }

  // ---- rooms and groups (group names are matched exactly; LC UP may have "Beginner" and "BEGINNER")
  const rooms = new Map<string, Room>();
  const groups = new Map<string, Group & { startedOn: string }>();
  const ids = new Set<string>();
  for (const g of groupRows) {
    const name = clean(g["Name"]);
    if (!name) continue;
    const course = courses.get(lower(g["Course"]));
    const level = course?.levels[0];
    const [start = "09:00", end = ""] = String(g["Time"] ?? "")
      .split("-")
      .map((x) => x.trim());
    const room = clean(g["Room"]);
    if (room && !rooms.has(room))
      rooms.set(room, {
        id: `rm_${short}_${slug(room)}`,
        branchId,
        name: room,
      });
    let id = `grp_${short}_${slug(name)}`;
    while (ids.has(id)) id += "-2";
    ids.add(id);
    groups.set(name, {
      id,
      name,
      courseId: course?.id ?? "",
      levelId: level?.id ?? "",
      subject: course?.name ?? "",
      level: level?.name,
      teacherId: teachers.get(lower(g["Teacher"]))?.id ?? "",
      branchId,
      room,
      ...lcupDays(g["Days"]),
      startTime: start.padStart(5, "0"),
      durationMinutes: end ? Math.max(30, minutes(end) - minutes(start)) : 90,
      capacity: 20,
      monthlyFee: lcupMoney(g["Cost"]),
      status:
        lower(g["Status"]) === "faol" || !clean(g["Status"])
          ? "active"
          : "paused",
      startedOn: isoDate(g["Start Course"]),
    });
  }
  const findGroup = (n: unknown) => {
    const name = clean(n);
    if (groups.has(name)) return groups.get(name);
    const same = [...groups.values()].filter(
      (g) => g.name.toLowerCase() === name.toLowerCase(),
    );
    return same.length === 1 ? same[0] : undefined;
  };
  for (const t of teachers.values()) {
    const subjects = [...groups.values()]
      .filter((g) => g.teacherId === t.id)
      .map((g) => g.subject);
    t.subject = mostCommon(subjects) ?? "";
  }

  // ---- students
  const students = new Map<string, Student>();
  const byName = new Map<string, Student[]>();
  const merged: string[] = [];
  const keptTwice: string[] = [];
  const unknownGroups = new Set<string>();
  let n = 0;
  for (const s of table(sheets.students!)) {
    const name = clean(s["Name"]);
    if (!name) continue;
    const phone = lcupPhone(s["Phone Number"]);
    let key = `${lower(name)}|${phone}`;
    const groupIds: string[] = [];
    for (const g of String(s["Groups"] ?? "")
      .split(",")
      .map(clean)
      .filter(Boolean)) {
      const found = findGroup(g);
      if (found) groupIds.push(found.id);
      else unknownGroups.add(g);
    }
    const already = students.get(key);
    if (
      already &&
      groupIds.length &&
      already.groupId &&
      groupIds.every(
        (id) => id === already.groupId || already.extraGroupIds?.includes(id),
      )
    ) {
      keptTwice.push(name);
      key = `${key}|${keptTwice.length}`;
    }
    const st = students.get(key);
    if (st) {
      merged.push(name);
      let rest = groupIds;
      if (rest.length && !st.groupId) {
        // LC UP lists some students twice; the balance that counts is on the row with a group.
        const main = [...groups.values()].find((g) => g.id === rest[0])!;
        st.groupId = main.id;
        st.monthlyTuition = main.monthlyFee;
        st.openingBalance = { amount: lcupMoney(s["Balans"]), asOf, source };
        rest = rest.slice(1);
      }
      for (const id of rest)
        if (id !== st.groupId && !st.extraGroupIds!.includes(id))
          st.extraGroupIds!.push(id);
      continue;
    }
    n += 1;
    const extra = clean(s["Lid Extra Information"]);
    const address =
      clean(s["Address"]) || clean(/Manzil => ([^,]*)/.exec(extra)?.[1]);
    const parent = lcupPhone(s["Parent Numbers"]);
    const born = isoDate(s["Birth Date"]);
    const main = [...groups.values()].find((g) => g.id === groupIds[0]);
    const student: Student = {
      id: `stu_${short}_${String(n).padStart(4, "0")}`,
      fullName: name,
      phone,
      ...(address ? { address } : {}),
      ...(born && born !== asOf ? { dateOfBirth: born } : {}),
      guardians:
        parent && parent.length > 10 && parent !== phone
          ? [
              {
                id: `grd_${short}_${String(n).padStart(4, "0")}`,
                fullName: "Parent",
                relationship: "guardian",
                phone: parent,
              },
            ]
          : [],
      groupId: groupIds[0] ?? null,
      extraGroupIds: groupIds.slice(1),
      branchId,
      enrolledOn:
        main?.startedOn && main.startedOn <= asOf ? main.startedOn : asOf,
      monthlyTuition: main?.monthlyFee ?? 0,
      status: "active",
      openingBalance: { amount: lcupMoney(s["Balans"]), asOf, source },
    };
    students.set(key, student);
    byName.set(lower(name), [...(byName.get(lower(name)) ?? []), student]);
  }

  // ---- enrollments
  const groupById = new Map([...groups.values()].map((g) => [g.id, g]));
  const enrollments: Enrollment[] = [];
  for (const s of students.values()) {
    for (const groupId of [
      ...(s.groupId ? [s.groupId] : []),
      ...(s.extraGroupIds ?? []),
    ]) {
      const g = groupById.get(groupId)!;
      enrollments.push({
        id: `enr_${s.id}_${groupId}`,
        studentId: s.id,
        groupId,
        branchId,
        startedOn:
          g.startedOn && g.startedOn <= asOf ? g.startedOn : s.enrolledOn,
      });
    }
  }

  // ---- payments (history only: they are already inside the opening balances)
  const METHOD: Record<string, string> = {
    "naqd pul": "cash",
    "plastik karta": "card",
    click: "click",
    payme: "payme",
    "bank hisobi": "transfer",
  };
  const payments: Payment[] = [];
  const unmatchedPayments: string[] = [];
  table(sheets.payments ?? []).forEach((p, i) => {
    const name = clean(p["FISH"]);
    const candidates = byName.get(lower(name)) ?? [];
    const student =
      students.get(`${lower(name)}|${lcupPhone(p["Telefon raqam"])}`) ??
      (candidates.length === 1 ? candidates[0] : undefined);
    if (!student) {
      unmatchedPayments.push(name);
      return;
    }
    const date = isoDate(p["Sana"]) || asOf;
    const group = findGroup(p["guruh"]);
    const who = clean(p["Hodim"]);
    const note = [
      clean(p["Izoh"]),
      `From ${source}${who ? `, recorded by ${who}` : ""}`,
    ]
      .filter(Boolean)
      .join(" · ");
    payments.push({
      id: `pay_${short}_${String(i + 1).padStart(5, "0")}`,
      studentId: student.id,
      amount: lcupMoney(p["Narx"]),
      date,
      period: date.slice(0, 7),
      method: METHOD[lower(p["To'lov usuli"])] ?? "cash",
      status: "paid",
      ...(group ? { groupId: group.id } : {}),
      imported: true,
      note,
    });
  });

  // ---- statuses from the group lists (LC UP keeps "frozen" and "trial" per group)
  const all = [...students.values()];
  const studentNotes: StudentNote[] = [];
  const rosterMismatches: string[] = [];
  const frozenIn = new Map<string, string[]>();
  const trialIn = new Map<string, string[]>();
  const seenGroups = new Set<string>();
  for (const r of rosters) {
    const group = findGroup(r.group);
    if (!group) {
      rosterMismatches.push(`${r.group}: no such group`);
      continue;
    }
    if (seenGroups.has(group.id)) continue; // the same list downloaded twice
    seenGroups.add(group.id);
    const members = all.filter(
      (s) => s.groupId === group.id || s.extraGroupIds?.includes(group.id),
    );
    const matched = new Set<string>();
    for (const row of table(r.rows)) {
      const name = lower(row["Name"]);
      const phone = lcupPhone(row["Phone Number"]);
      const st =
        members.find(
          (s) =>
            !matched.has(s.id) &&
            s.fullName.toLowerCase() === name &&
            s.phone === phone,
        ) ??
        members.find(
          (s) => !matched.has(s.id) && s.fullName.toLowerCase() === name,
        );
      if (!st) {
        rosterMismatches.push(`${group.name}: ${clean(row["Name"])}`);
        continue;
      }
      matched.add(st.id);
      const status = lower(row["Status"]);
      const list =
        status === "muzlatilgan"
          ? frozenIn
          : status === "sinov darsida"
            ? trialIn
            : null;
      if (list) list.set(st.id, [...(list.get(st.id) ?? []), group.name]);
    }
    for (const s of members)
      if (!matched.has(s.id))
        rosterMismatches.push(
          `${group.name}: ${s.fullName} (not in the group list)`,
        );
  }
  let paused = 0;
  let partlyFrozen = 0;
  const note = (s: Student, text: string) =>
    studentNotes.push({
      id: `note_${s.id}_lcup${studentNotes.length}`,
      studentId: s.id,
      authorId: "lcup",
      authorName: source,
      text,
      important: false,
      createdAt: `${asOf}T12:00:00.000Z`,
    });
  for (const s of all) {
    const frozen = frozenIn.get(s.id) ?? [];
    const groupsOf = [
      ...(s.groupId ? [s.groupId] : []),
      ...(s.extraGroupIds ?? []),
    ];
    if (frozen.length && frozen.length >= groupsOf.length) {
      s.status = "paused";
      paused += 1;
      note(s, `Frozen in LC UP (${frozen.join(", ")}) on ${asOf}.`);
    } else if (frozen.length) {
      partlyFrozen += 1;
      note(
        s,
        `Frozen in LC UP in ${frozen.join(", ")} on ${asOf}; still studying in the other groups.`,
      );
    }
    const trial = trialIn.get(s.id);
    if (trial)
      note(s, `On a trial lesson in LC UP (${trial.join(", ")}) on ${asOf}.`);
  }

  for (const s of all) if (!s.extraGroupIds?.length) delete s.extraGroupIds;
  const debtorRows = sheets.debtors ? table(sheets.debtors) : null;
  return {
    branchId,
    asOf,
    courses: newCourses,
    teachers: [...teachers.values()],
    rooms: [...rooms.values()],
    groups: [...groups.values()].map((g) => {
      const { startedOn, ...rest } = g;
      void startedOn;
      return rest;
    }),
    students: all,
    enrollments,
    payments,
    studentNotes,
    report: {
      rosters: seenGroups.size,
      rosterMismatches,
      paused,
      partlyFrozen,
      onTrial: trialIn.size,
      studentsInSeveralGroups: all.filter((s) => s.extraGroupIds?.length)
        .length,
      studentsWithoutGroup: all.filter((s) => !s.groupId).length,
      paymentsTotal: payments.reduce((sum, p) => sum + p.amount, 0),
      merged,
      keptTwice,
      unmatchedPayments,
      unknownGroups: [...unknownGroups],
      groupsWithoutTeacher: [...groups.values()]
        .filter((g) => !g.teacherId)
        .map((g) => g.name),
      otherDayGroups: [...groups.values()]
        .filter((g) => g.weekdays)
        .map((g) => g.name),
      lcupDebtors: debtorRows ? debtorRows.length : null,
      lcupDebtTotal: debtorRows
        ? debtorRows.reduce((sum, d) => sum + lcupMoney(d["Debt"]), 0)
        : null,
      debtors: all.filter((s) => (s.openingBalance?.amount ?? 0) < 0).length,
      debtTotal: all.reduce(
        (sum, s) => sum + Math.min(0, s.openingBalance?.amount ?? 0),
        0,
      ),
    },
  };
}

function mostCommon<T>(list: T[]): T | undefined {
  const counts = new Map<T, number>();
  for (const x of list) counts.set(x, (counts.get(x) ?? 0) + 1);
  return [...counts].sort((a, b) => b[1] - a[1])[0]?.[0];
}

/** The branch's data replaced by the import (other branches untouched). */
export function applyLcupImport(d: SchoolData, imp: LcupImport): SchoolData {
  const b = imp.branchId;
  const oldStudents = new Set(
    d.students.filter((s) => s.branchId === b).map((s) => s.id),
  );
  const oldGroups = new Set(
    d.groups.filter((g) => g.branchId === b).map((g) => g.id),
  );
  return {
    ...d,
    courses: [...d.courses, ...imp.courses],
    teachers: [...d.teachers.filter((t) => t.branchId !== b), ...imp.teachers],
    rooms: [...d.rooms.filter((r) => r.branchId !== b), ...imp.rooms],
    groups: [...d.groups.filter((g) => g.branchId !== b), ...imp.groups],
    students: [...d.students.filter((s) => s.branchId !== b), ...imp.students],
    enrollments: [
      ...d.enrollments.filter((e) => !oldStudents.has(e.studentId)),
      ...imp.enrollments,
    ],
    payments: [
      ...d.payments.filter((p) => !oldStudents.has(p.studentId)),
      ...imp.payments,
    ],
    studentEvents: d.studentEvents.filter((e) => !oldStudents.has(e.studentId)),
    studentNotes: [
      ...d.studentNotes.filter((n) => !oldStudents.has(n.studentId)),
      ...imp.studentNotes,
    ],
    attendance: d.attendance.filter((r) => !oldGroups.has(r.groupId)),
    homework: d.homework.filter((h) => !oldGroups.has(h.groupId)),
    homeworkResults: d.homeworkResults.filter(
      (r) => !oldStudents.has(r.studentId),
    ),
    assessments: d.assessments.filter((a) => !oldGroups.has(a.groupId)),
  };
}
