import type { ObjectId } from "mongodb";

export type GroupStatus = "pending" | "approved" | "rejected";

export interface CommandOverride {
  enabled: boolean;
  requiresAdmin?: boolean;
}

export interface Group {
  _id?: ObjectId;
  whatsappId: string;
  name: string;
  status: GroupStatus;
  requestedAt?: Date;
  resolvedAt?: Date;
  resolvedBy?: string;
  commandOverrides?: Record<string, CommandOverride>;
}
