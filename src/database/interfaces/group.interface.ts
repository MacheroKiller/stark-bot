import type { ObjectId } from "mongodb";

export type GroupStatus = "pending" | "approved" | "rejected";

export interface Group {
  _id?: ObjectId;
  whatsappId: string;
  name: string;
  status: GroupStatus;
  requestedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
}
