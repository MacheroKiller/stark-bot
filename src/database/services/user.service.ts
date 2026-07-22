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
}
