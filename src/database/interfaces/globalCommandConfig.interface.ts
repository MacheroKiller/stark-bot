import type { ObjectId } from "mongodb";

export interface GlobalCommandConfig {
  _id?: ObjectId;
  command: string;
  enabled: boolean;
  disabledReason?: string;
  disabledBy?: string;
  disabledAt?: Date;
}
