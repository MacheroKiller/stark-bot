import { Collections } from "../collections";
import type { WeeklySummaryReport } from "../interfaces/weeklySummaryReport.interface";
import { getDb } from "../mongo";

export function getWeeklySummaryReportCollection() {
  return getDb().collection<WeeklySummaryReport>(
    Collections.WEEKLY_SUMMARY_REPORTS,
  );
}
