import { Collections } from "../collections";
import type { GroupSummaryConfig } from "../interfaces/groupSummaryConfig.interface";
import { getDb } from "../mongo";

export function getGroupSummaryConfigCollection() {
  return getDb().collection<GroupSummaryConfig>(
    Collections.GROUP_SUMMARY_CONFIGS,
  );
}
