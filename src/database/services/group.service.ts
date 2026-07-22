import type { Group } from "../interfaces/group.interface";
import { getGroupCollection } from "../models/group.model";

export class GroupService {
  findByWhatsappId(whatsappId: string) {
    return getGroupCollection().findOne({ whatsappId });
  }

  async findOrCreate(group: Group) {
    return getGroupCollection().findOneAndUpdate(
      { whatsappId: group.whatsappId },
      {
        $setOnInsert: { ...group },
      },
      { upsert: true, returnDocument: "after" },
    );
  }
}
