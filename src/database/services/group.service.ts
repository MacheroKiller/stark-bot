import type { Group } from "../interfaces/group.interface";
import { getGroupCollection } from "../models/group.model";

/**
 * Service responsible for managing WhatsApp groups stored in the database.
 *
 * Responsibilities:
 * - Retrieve groups by their WhatsApp identifier.
 * - Create groups when they do not already exist.
 */
export class GroupService {
  /**
   * Finds a group by its WhatsApp identifier.
   *
   * @param whatsappId - WhatsApp group identifier.
   * @returns The matching group or null if no group is found.
   */
  findByWhatsappId(whatsappId: string) {
    return getGroupCollection().findOne({ whatsappId });
  }

  /**
   * Finds a group by its WhatsApp identifier.
   *
   * - Creates the group if it does not already exist.
   * - Returns the existing or newly created group document.
   *
   * @param group - Group information used for creation.
   * @returns The existing or created group document.
   */
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
