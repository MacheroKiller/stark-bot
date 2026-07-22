import type { Group } from "../interfaces/group.interface";
import { groupCollection } from "../models/group.model";

export class GroupService {
  findByWhatsappId(whatsappId: string) {
    return groupCollection.findOne({ whatsappId });
  }

  async findOrCreate(group: Group) {
    return groupCollection.findOneAndUpdate(
      { whatsappId: group.whatsappId },
      {
        $setOnInsert: { ...group },
      },
      { upsert: true, returnDocument: "after" },
    );
  }
}
