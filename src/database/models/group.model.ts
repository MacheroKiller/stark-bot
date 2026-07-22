import { Collections } from "../collections";
import type { Group } from "../interfaces/group.interface";
import { getDb } from "../mongo";

export function getGroupCollection() {
  return getDb().collection<Group>(Collections.GROUP);
}
