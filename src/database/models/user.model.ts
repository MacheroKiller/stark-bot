import { Collections } from "../collections";
import type { User } from "../interfaces/user.interface";
import { getDb } from "../mongo";

export function getUserCollection() {
  return getDb().collection<User>(Collections.USER);
}
