import { Collections } from "../collections";
import type { User } from "../interfaces/user.interface";
import { db } from "../mongo";

export const userCollection = db.collection<User>(Collections.USER);
