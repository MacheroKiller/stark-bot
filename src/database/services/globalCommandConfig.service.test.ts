import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ObjectId } from "mongodb";

const findOne = mock();
const findOneAndUpdate = mock();

mock.module("../models/globalCommandConfig.model", () => ({
  getGlobalCommandConfigCollection: () => ({ findOne, findOneAndUpdate }),
}));

const { GlobalCommandConfigService } =
  await import("./globalCommandConfig.service");

describe("GlobalCommandConfigService.findByCommand", () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  test("busca por command", async () => {
    const fakeConfig = { _id: new ObjectId(), command: "/ban", enabled: false };
    findOne.mockResolvedValue(fakeConfig);

    const service = new GlobalCommandConfigService();
    const result = await service.findByCommand("/ban");

    expect(findOne).toHaveBeenCalledWith({ command: "/ban" });
    expect(result).toEqual(fakeConfig);
  });

  test("devuelve null si no hay configuración para ese comando", async () => {
    findOne.mockResolvedValue(null);

    const service = new GlobalCommandConfigService();
    const result = await service.findByCommand("/ping");

    expect(result).toBeNull();
  });
});

describe("GlobalCommandConfigService.disable", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  test("setea enabled=false, disabledBy, y disabledAt, con upsert", async () => {
    findOneAndUpdate.mockResolvedValue({
      command: "/purge",
      enabled: false,
    });

    const service = new GlobalCommandConfigService();
    await service.disable(
      "/purge",
      "573001111111@s.whatsapp.net",
      "en pruebas",
    );

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { command: "/purge" },
      {
        $set: {
          command: "/purge",
          enabled: false,
          disabledBy: "573001111111@s.whatsapp.net",
          disabledReason: "en pruebas",
          disabledAt: expect.any(Date),
        },
      },
      { upsert: true, returnDocument: "after" },
    );
  });

  test("funciona sin razón explícita (disabledReason queda undefined)", async () => {
    findOneAndUpdate.mockResolvedValue({});

    const service = new GlobalCommandConfigService();
    await service.disable("/purge", "573001111111@s.whatsapp.net");

    const [, updateArg] = findOneAndUpdate.mock.calls[0]!;

    expect(updateArg.$set.disabledReason).toBeUndefined();
  });
});

describe("GlobalCommandConfigService.enable", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  test("setea enabled=true y limpia los campos de deshabilitación", async () => {
    findOneAndUpdate.mockResolvedValue({ command: "/purge", enabled: true });

    const service = new GlobalCommandConfigService();
    await service.enable("/purge");

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { command: "/purge" },
      {
        $set: { enabled: true },
        $unset: { disabledBy: "", disabledReason: "", disabledAt: "" },
      },
      { upsert: true, returnDocument: "after" },
    );
  });

  test("hace upsert incluso si el comando nunca fue deshabilitado antes", async () => {
    findOneAndUpdate.mockResolvedValue({ command: "/find", enabled: true });

    const service = new GlobalCommandConfigService();
    await service.enable("/find");

    const [, , options] = findOneAndUpdate.mock.calls[0]!;
    expect(options).toEqual(expect.objectContaining({ upsert: true }));
  });
});
