import type { User } from "../interfaces/user.interface";
import { getUserCollection } from "../models/user.model";

/**
 * Service responsible for managing users stored in the database.
 *
 * Responsibilities:
 * - Create users when they do not exist.
 * - Track the total number of messages sent.
 * - Retrieve user rankings.
 * - Manage administrator status.
 */
export class UserService {
  /**
   * Finds a user by WhatsApp and group identifiers.
   *
   * - Creates the user if it does not exist.
   * - Increments the total message counter.
   * - Returns the updated user document.
   *
   * @param whatsappId - User WhatsApp identifier.
   * @param groupWhatsappId - WhatsApp group identifier.
   * @returns The created or updated user document.
   */
  async findOrCreateAndIncrement(whatsappId: string, groupWhatsappId: string) {
    return getUserCollection().findOneAndUpdate(
      { whatsappId, groupWhatsappId },
      {
        $setOnInsert: {
          whatsappId,
          groupWhatsappId,
          isAdmin: false,
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

  /**
   * Retrieves the top five users with the highest message count
   * in a specific WhatsApp group.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @returns An array containing the top message senders.
   */
  async getTopMessageSenders(groupWhatsappId: string): Promise<User[]> {
    return getUserCollection()
      .find({ groupWhatsappId })
      .sort({ totalMessagesSent: -1 })
      .limit(5)
      .toArray();
  }

  /**
   * Finds a specific user within a WhatsApp group.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param whatsappId - User WhatsApp identifier.
   * @returns The matching user or null if no user is found.
   */
  async findUser(
    groupWhatsappId: string,
    whatsappId: string,
  ): Promise<User | null> {
    return getUserCollection().findOne({ whatsappId, groupWhatsappId });
  }

  /**
   * Finds a group of users within a WhatsApp group.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param whatsappId[] - User WhatsApp identifier.
   * @returns The matching user or null if no user is found.
   */
  async findUserList(
    groupWhatsappId: string,
    whatsappId: string[],
  ): Promise<User[]> {
    return getUserCollection()
      .find({
        groupWhatsappId,
        whatsappId: { $in: whatsappId },
      })
      .toArray();
  }

  /**
   * Finds the user at the specified ranking position within a group.
   *
   * Rankings are based on the total number of messages sent in descending
   * order (highest message count first). The first position is `1`; position
   * `0` is considered invalid.
   *
   * Returns the user together with their ranking position and total messages.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param position - Ranking position to retrieve (starting from 1).
   * @returns The ranked user, or `null` if no user exists at that position.
   */
  async findUserByPosition(groupWhatsappId: string, position: number) {
    if (position < 1) {
      return null;
    }

    const user = await getUserCollection()
      .find({ groupWhatsappId })
      .sort({ totalMessagesSent: -1 })
      .skip(position - 1)
      .limit(1)
      .next();

    if (!user) {
      return null;
    }

    return {
      ...user,
      position,
    };
  }

  async findUserPositionList(
    groupWhatsappId: string,
    whatsappIds: string[],
  ): Promise<Map<string, number>> {
    const ranking = await getUserCollection()
      .find({ groupWhatsappId })
      .sort({ totalMessagesSent: -1 })
      .project({ whatsappId: 1, totalMessagesSent: 1 })
      .toArray();

    const positions = new Map<string, number>();

    ranking.forEach((user, index) => {
      positions.set(user.whatsappId, index + 1);
    });

    const result = new Map<string, number>();

    for (const whatsappId of whatsappIds) {
      const position = positions.get(whatsappId);

      if (position !== undefined) {
        result.set(whatsappId, position);
      }
    }

    return result;
  }

  /**
   * Updates the administrator status of multiple users.
   *
   * - Creates users if they do not exist.
   * - Updates the administrator flag.
   * - Executes all updates as a single bulk operation.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @param updates - List of administrator status updates.
   */
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

  /**
   * Resets the message counter for every user in a WhatsApp group.
   *
   * Sets the `totalMessagesSent` field to `0` for all users that belong
   * to the specified group.
   *
   * @param groupWhatsappId - WhatsApp group identifier.
   * @returns The number of users whose message counter was modified.
   */
  async resetTotalMessagesSent(groupWhatsappId: string): Promise<number> {
    const result = await getUserCollection().updateMany(
      { groupWhatsappId },
      {
        $set: {
          totalMessagesSent: 0,
        },
      },
    );

    return result.modifiedCount;
  }

  async findInactiveUsers(
    groupWhatsappId: string,
    maxMessages: number,
  ): Promise<User[]> {
    return getUserCollection()
      .find({
        groupWhatsappId,
        isAdmin: { $ne: true },
        totalMessagesSent: { $lt: maxMessages },
      })
      .toArray();
  }
}
