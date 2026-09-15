import { getGlobalCommandConfigCollection } from "../models/globalCommandConfig.model";

export class GlobalCommandConfigService {
  async findByCommand(command: string) {
    return getGlobalCommandConfigCollection().findOne({ command });
  }

  async disable(command: string, disabledBy: string, reason?: string) {
    return getGlobalCommandConfigCollection().findOneAndUpdate(
      { command },
      {
        $set: {
          command,
          enabled: false,
          disabledBy,
          disabledReason: reason,
          disabledAt: new Date(),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  }

  async enable(command: string) {
    return getGlobalCommandConfigCollection().findOneAndUpdate(
      { command },
      {
        $set: { enabled: true },
        $unset: { disabledBy: "", disabledReason: "", disabledAt: "" },
      },
      { upsert: true, returnDocument: "after" },
    );
  }
}
