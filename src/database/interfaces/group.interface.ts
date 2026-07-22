import type { ObjectId } from "mongodb";

export interface Group {
  _id?: ObjectId;
  whatsappId: string;
  name: string;
}
