import { useState } from "react";
import { useNavigate } from "react-router";
import {
  AlertTriangle,
  CheckCircle2,
  FileSpreadsheet,
  Upload,
} from "lucide-react";
import { useSchool } from "../../data/school-context";
import { useToast } from "../../components/ui/toast-context";
import { PageHeader } from "../../components/ui/PageHeader";
import { Panel } from "../../components/ui/Panel";
import { Button } from "../../components/ui/Button";
import { Field, Select } from "../../components/ui/Field";
import { ConfirmDialog } from "../../components/ui/Dialog";
import { readSpreadsheet, readSpreadsheetsInZip } from "../../lib/xlsx-read";
import {
  buildLcupImport,
  detectSheet,
  isGroupRoster,
  rosterGroupName,
  type GroupRoster,
  type LcupImport,
  type LcupSheet,
} from "../../lib/lcup-import";
import { toISODate } from "../../lib/dates";
import { formatDate, formatNumber, formatUZS } from "../../lib/format";
import { tr } from "../../i18n";

const SHEET_LABEL: Record<LcupSheet, string> = {
  teachers: tr("Teachers"),
  groups: tr("Groups"),
  students: tr("Students"),
  payments: tr("Payments"),
  debtors: tr("Debtors"),
};
const NEEDED: LcupSheet[] = ["teachers", "groups", "students"];

interface Loaded {
  sheets: Partial<Record<LcupSheet, string[][]>>;
  rosters: GroupRoster[];
  skipped: string[];
  asOf: string;
}

/** Owner only: brings one branch over from LC UP's Excel exports, after showing the checks. */
export function LcupImportPage() {
  const { owner, actions } = useSchool();
  const toast = useToast();
  const navigate = useNavigate();
  const data = owner!.data;
  const [branchId, setBranchId] = useState("");
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [reading, setReading] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [confirm, setConfirm] = useState(false);

  async function read(files: FileList | null) {
    if (!files?.length) return;
    setReading(true);
    setProblem(null);
    const next: Loaded = loaded
      ? {
          ...loaded,
          sheets: { ...loaded.sheets },
          rosters: [...loaded.rosters],
          skipped: [...loaded.skipped],
        }
      : { sheets: {}, rosters: [], skipped: [], asOf: "" };
    try {
      for (const file of Array.from(files)) {
        const parts = /\.zip$/i.test(file.name)
          ? await readSpreadsheetsInZip(file)
          : [{ name: file.name, rows: await readSpreadsheet(file) }];
        for (const { name, rows } of parts) {
          const group = rosterGroupName(name);
          const kind = detectSheet(rows);
          if (isGroupRoster(rows) && group) next.rosters.push({ group, rows });
          else if (kind) {
            next.sheets[kind] = rows;
            const date = /(\d{4}-\d{2}-\d{2})/.exec(name)?.[1];
            if (kind === "students" && date) next.asOf = date;
          } else next.skipped.push(name);
        }
      }
      setLoaded({ ...next, asOf: next.asOf || toISODate(new Date()) });
    } catch (e) {
      setProblem(e instanceof Error ? e.message : String(e));
    } finally {
      setReading(false);
    }
  }

  const missing = loaded ? NEEDED.filter((s) => !loaded.sheets[s]) : NEEDED;
  let imp: LcupImport | null = null;
  let buildError: string | null = null;
  if (loaded && branchId && !missing.length) {
    try {
      imp = buildLcupImport(
        loaded.sheets,
        branchId,
        loaded.asOf,
        { courses: data.courses },
        loaded.rosters,
      );
    } catch (e) {
      buildError = e instanceof Error ? e.message : String(e);
    }
  }
  const branch = data.branches.find((b) => b.id === branchId);
  const existing = data.students.filter((s) => s.branchId === branchId).length;
  const r = imp?.report;

  return (
    <>
      <PageHeader
        title={tr("Move from LC UP")}
        description={tr(
          "Bring a branch’s teachers, groups, students, balances and payments over from LC UP’s Excel files. Nothing is saved until you check the numbers and confirm.",
        )}
      />
      <div className="grid items-start gap-6 xl:grid-cols-2">
        <Panel title={tr("1. Choose the branch and the files")}>
          <div className="space-y-4 text-sm">
            <Field label={tr("Branch")}>
              {(control) => (
                <Select
                  {...control}
                  value={branchId}
                  onChange={(e) => setBranchId(e.target.value)}
                >
                  <option value="">{tr("Choose…")}</option>
                  {data.branches.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name}
                    </option>
                  ))}
                </Select>
              )}
            </Field>
            <p className="text-ink-muted">
              {tr(
                "In LC UP download these as Excel: Teachers, Groups, Students, Payments and Debtors. You can also add the group student lists (a .zip is fine): they tell which students are frozen or on a trial lesson.",
              )}
            </p>
            <label className="flex cursor-pointer items-center justify-center gap-2 rounded-control border border-dashed border-line px-4 py-6 text-ink-muted hover:bg-subtle">
              <Upload aria-hidden className="size-4" />
              {reading ? tr("Reading…") : tr("Choose Excel or .zip files")}
              <input
                type="file"
                multiple
                accept=".xlsx,.zip"
                className="sr-only"
                disabled={reading}
                onChange={(e) => (read(e.target.files), (e.target.value = ""))}
              />
            </label>
            {problem && <p className="text-danger">{problem}</p>}
            {loaded && (
              <ul className="space-y-1">
                {(Object.keys(SHEET_LABEL) as LcupSheet[]).map((s) => (
                  <li key={s} className="flex items-center gap-2">
                    {loaded.sheets[s] ? (
                      <CheckCircle2
                        aria-hidden
                        className="size-4 text-success"
                      />
                    ) : (
                      <FileSpreadsheet
                        aria-hidden
                        className="size-4 text-ink-muted"
                      />
                    )}
                    {SHEET_LABEL[s]}
                    {!loaded.sheets[s] && (
                      <span className="text-ink-muted">
                        — {NEEDED.includes(s) ? tr("needed") : tr("optional")}
                      </span>
                    )}
                  </li>
                ))}
                <li className="flex items-center gap-2">
                  {loaded.rosters.length ? (
                    <CheckCircle2 aria-hidden className="size-4 text-success" />
                  ) : (
                    <FileSpreadsheet
                      aria-hidden
                      className="size-4 text-ink-muted"
                    />
                  )}
                  {tr("Group student lists: {0}", loaded.rosters.length)}
                </li>
                {loaded.skipped.length > 0 && (
                  <li className="text-ink-muted">
                    {tr(
                      "Not recognised, skipped: {0}",
                      loaded.skipped.join(", "),
                    )}
                  </li>
                )}
              </ul>
            )}
            {loaded && (
              <Button variant="ghost" onClick={() => setLoaded(null)}>
                {tr("Start again")}
              </Button>
            )}
          </div>
        </Panel>

        <Panel title={tr("2. Check the numbers")}>
          {!imp ? (
            <p className="text-sm text-ink-muted">
              {buildError ??
                (!branchId
                  ? tr("Choose the branch first.")
                  : tr("Add the Teachers, Groups and Students files."))}
            </p>
          ) : (
            <div className="space-y-4 text-sm">
              <dl className="divide-y divide-line">
                {(
                  [
                    [tr("Balances as of"), formatDate(imp.asOf)],
                    [tr("Teachers"), formatNumber(imp.teachers.length)],
                    [tr("New courses"), formatNumber(imp.courses.length)],
                    [tr("Rooms"), formatNumber(imp.rooms.length)],
                    [tr("Groups"), formatNumber(imp.groups.length)],
                    [tr("Students"), formatNumber(imp.students.length)],
                    [
                      tr("In two or more groups"),
                      formatNumber(r!.studentsInSeveralGroups),
                    ],
                    [
                      tr("Not in a group yet (waiting)"),
                      formatNumber(r!.studentsWithoutGroup),
                    ],
                    [tr("Paused (frozen in LC UP)"), formatNumber(r!.paused)],
                    [
                      tr("Payments"),
                      `${formatNumber(imp.payments.length)} · ${formatUZS(r!.paymentsTotal)}`,
                    ],
                    [tr("Students who owe"), formatNumber(r!.debtors)],
                    [tr("Total owed"), formatUZS(-r!.debtTotal)],
                  ] as const
                ).map(([label, value]) => (
                  <div key={label} className="flex justify-between gap-3 py-2">
                    <dt className="text-ink-muted">{label}</dt>
                    <dd className="num text-right font-medium">{value}</dd>
                  </div>
                ))}
              </dl>

              {r!.lcupDebtTotal !== null && (
                <p className="flex gap-2">
                  {r!.lcupDebtTotal === r!.debtTotal ? (
                    <CheckCircle2
                      aria-hidden
                      className="size-4 shrink-0 text-success"
                    />
                  ) : (
                    <AlertTriangle
                      aria-hidden
                      className="size-4 shrink-0 text-warning"
                    />
                  )}
                  <span>
                    {tr(
                      "LC UP’s debtor list: {0} students owe {1}.",
                      formatNumber(r!.lcupDebtors!),
                      formatUZS(-r!.lcupDebtTotal),
                    )}{" "}
                    {r!.lcupDebtTotal !== r!.debtTotal &&
                      tr(
                        "The difference is {0}: LC UP’s debtor list leaves out some small debts that its student list shows.",
                        formatUZS(r!.lcupDebtTotal - r!.debtTotal),
                      )}
                  </span>
                </p>
              )}

              <Notes
                title={tr("Groups without a teacher")}
                items={r!.groupsWithoutTeacher}
              />
              <Notes
                title={tr(
                  "Listed twice in LC UP, kept as two students (check if it’s the same child)",
                )}
                items={r!.keptTwice}
              />
              <Notes
                title={tr("Students LC UP listed twice, joined into one")}
                items={r!.merged}
              />
              <Notes
                title={tr(
                  "Payments with no matching student (not brought over)",
                )}
                items={r!.unmatchedPayments}
              />
              <Notes
                title={tr(
                  "Group names in the student list that aren’t in the group list",
                )}
                items={r!.unknownGroups}
              />
              <Notes
                title={tr("Group lists that don’t match the student list")}
                items={r!.rosterMismatches}
              />

              <div className="border-t border-line pt-4">
                <Button onClick={() => setConfirm(true)}>
                  {tr("Bring over to {0}", branch?.name ?? "")}
                </Button>
              </div>
            </div>
          )}
        </Panel>
      </div>

      <ConfirmDialog
        open={confirm && !!imp}
        title={tr("Bring {0} over from LC UP?", branch?.name ?? "")}
        confirmLabel={tr("Bring over")}
        onClose={() => setConfirm(false)}
        onConfirm={() => {
          actions.importFromLcup(imp!);
          toast.show(
            tr(
              "Saving {0} students. Keep this page open for a minute.",
              formatNumber(imp!.students.length),
            ),
          );
          navigate("/students");
        }}
      >
        <p>
          {existing
            ? tr(
                "The {0} students now in {1}, with their groups, teachers, payments, attendance and homework, will be replaced by LC UP’s. Other branches are not touched.",
                formatNumber(existing),
                branch?.name ?? "",
              )
            : tr(
                "{0} is empty now, so nothing is replaced. Other branches are not touched.",
                branch?.name ?? "",
              )}
        </p>
        <p>
          {tr(
            "Old versions are kept, so this can be undone if something is wrong.",
          )}
        </p>
      </ConfirmDialog>
    </>
  );
}

function Notes({ title, items }: { title: string; items: string[] }) {
  if (!items.length) return null;
  return (
    <details className="rounded-control bg-subtle px-3 py-2">
      <summary className="cursor-pointer">
        {title}: <span className="num font-medium">{items.length}</span>
      </summary>
      <ul className="mt-2 list-disc space-y-0.5 pl-5 text-ink-muted">
        {items.map((x, i) => (
          <li key={i}>{x}</li>
        ))}
      </ul>
    </details>
  );
}
