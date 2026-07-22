import { Collections } from "../collections";
import type { Group } from "../interfaces/group.interface";
import { db } from "../mongo";

export const groupCollection = db.collection<Group>(Collections.GROUP);
