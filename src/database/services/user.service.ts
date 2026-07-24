import type { User } from "../interfaces/user.interface";
import { getUserCollection } from "../models/user.model";

export class UserService {
  async findOrCreateAndIncrement(whatsappId: string, groupWhatsappId: string) {
    return getUserCollection().findOneAndUpdate(
      { whatsappId, groupWhatsappId },
      {
        $setOnInsert: {
          whatsappId,
          groupWhatsappId,
        },
        $inc: {
          totalMessagesSent: 1,
        },
      },
      {
        upsert: true,
        returnDocument: "after",
      },
    );
  }

  async getTopMessageSenders(groupWhatsappId: string): Promise<User[]> {
    return getUserCollection()
      .find({ groupWhatsappId })
      .sort({ totalMessagesSent: -1 })
      .limit(5)
      .toArray();
  }

  async findUser(
    groupWhatsappId: string,
    whatsappId: string,
  ): Promise<User | null> {
    return getUserCollection().findOne({ whatsappId, groupWhatsappId });
  }

  async findPosition(user: User) {
    return (
      (await getUserCollection().countDocuments({
        groupWhatsappId: user.groupWhatsappId,
        totalMessagesSent: { $gt: user.totalMessagesSent },
      })) + 1
    );
  }

  async setAdminStatus(
    groupWhatsappId: string,
    updates: { whatsappId: string; isAdmin: boolean }[],
  ) {
    if (updates.length === 0) return;

    const ops = updates.map(({ whatsappId, isAdmin }) => ({
      updateOne: {
        filter: { whatsappId, groupWhatsappId },
        update: {
          $setOnInsert: { whatsappId, groupWhatsappId },
          $set: { isAdmin },
        },
        upsert: true,
      },
    }));

    await getUserCollection().bulkWrite(ops);
  }
}
