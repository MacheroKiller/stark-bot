import type { ObjectId } from "mongodb";

export interface User {
  _id?: ObjectId;
  groupWhatsappId: string;
  whatsappId: string;
  totalMessagesSent: number;
}
