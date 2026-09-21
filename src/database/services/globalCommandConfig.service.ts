import { getGlobalCommandConfigCollection } from "../models/globalCommandConfig.model";

export class GlobalCommandConfigService {
  async findByCommand(command: string) {
    return getGlobalCommandConfigCollection().findOne({ command });
  }

  async findAll() {
    return getGlobalCommandConfigCollection().find({}).toArray();
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

  async seedDefaults(commands: string[]) {
    if (commands.length === 0) return;

    const ops = commands.map((command) => ({
      updateOne: {
        filter: { command },
        update: { $setOnInsert: { command, enabled: true } },
        upsert: true,
      },
    }));

    await getGlobalCommandConfigCollection().bulkWrite(ops);
  }
}
