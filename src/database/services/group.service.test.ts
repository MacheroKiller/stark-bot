import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ObjectId } from "mongodb";
import type { Group } from "../interfaces/group.interface";

const findOne = mock();
const findOneAndUpdate = mock();

mock.module("../models/group.model", () => ({
  getGroupCollection: () => ({ findOne, findOneAndUpdate }),
}));

const { GroupService } = await import("./group.service");

describe("GroupService.findByWhatsappId", () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  test("busca por whatsappId", async () => {
    const fakeGroup = {
      _id: new ObjectId(),
      whatsappId: "123-456@g.us",
      name: "Grupo de prueba",
      status: "approved" as const,
    };
    findOne.mockResolvedValue(fakeGroup);

    const service = new GroupService();
    const result = await service.findByWhatsappId("123-456@g.us");

    expect(findOne).toHaveBeenCalledWith({ whatsappId: "123-456@g.us" });
    expect(result).toEqual(fakeGroup);
  });

  test("devuelve null si el grupo no existe", async () => {
    findOne.mockResolvedValue(null);

    const service = new GroupService();
    const result = await service.findByWhatsappId("no-existe@g.us");

    expect(result).toBeNull();
  });
});

describe("GroupService.findOrCreate", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  test("usa whatsappId como filtro y hace upsert con returnDocument after", async () => {
    const group: Group = {
      whatsappId: "123-456@g.us",
      name: "Grupo de prueba",
      status: "pending",
    };
    findOneAndUpdate.mockResolvedValue(group);

    const service = new GroupService();
    await service.findOrCreate(group);

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { whatsappId: "123-456@g.us" },
      { $setOnInsert: group },
      { upsert: true, returnDocument: "after" },
    );
  });

  test("$setOnInsert coloca los campos en la raíz del documento, no anidados", async () => {
    const group: Group = {
      whatsappId: "123-456@g.us",
      name: "Grupo de prueba",
      status: "pending",
    };
    findOneAndUpdate.mockResolvedValue(group);

    const service = new GroupService();
    await service.findOrCreate(group);

    const [, updateArg] = findOneAndUpdate.mock.calls[0]!;

    expect(updateArg.$setOnInsert).not.toHaveProperty("group");
    expect(updateArg.$setOnInsert).toEqual(
      expect.objectContaining({
        whatsappId: "123-456@g.us",
        name: "Grupo de prueba",
        status: "pending",
      }),
    );
  });
});

describe("GroupService.updateStatus", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  test("actualiza status, resolvedBy, y setea resolvedAt", async () => {
    const updatedGroup = {
      _id: new ObjectId(),
      whatsappId: "123-456@g.us",
      name: "Grupo de prueba",
      status: "approved" as const,
      resolvedBy: "573001111111@s.whatsapp.net",
    };
    findOneAndUpdate.mockResolvedValue(updatedGroup);

    const service = new GroupService();
    const result = await service.updateStatus(
      "123-456@g.us",
      "approved",
      "573001111111@s.whatsapp.net",
    );

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { whatsappId: "123-456@g.us" },
      {
        $set: {
          status: "approved",
          resolvedAt: expect.any(Date),
          resolvedBy: "573001111111@s.whatsapp.net",
        },
      },
      { returnDocument: "after" },
    );
    expect(result).toEqual(updatedGroup);
  });

  test("funciona igual para status 'rejected'", async () => {
    const updatedGroup = {
      _id: new ObjectId(),
      whatsappId: "123-456@g.us",
      name: "Grupo de prueba",
      status: "rejected" as const,
    };
    findOneAndUpdate.mockResolvedValue(updatedGroup);

    const service = new GroupService();
    await service.updateStatus(
      "123-456@g.us",
      "rejected",
      "573001111111@s.whatsapp.net",
    );

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { whatsappId: "123-456@g.us" },
      expect.objectContaining({
        $set: expect.objectContaining({ status: "rejected" }),
      }),
      expect.anything(),
    );
  });

  test("no toca whatsappId ni name del documento existente", async () => {
    findOneAndUpdate.mockResolvedValue({});

    const service = new GroupService();
    await service.updateStatus(
      "123-456@g.us",
      "approved",
      "573001111111@s.whatsapp.net",
    );

    const [, updateArg] = findOneAndUpdate.mock.calls[0]!;

    expect(updateArg.$set).not.toHaveProperty("whatsappId");
    expect(updateArg.$set).not.toHaveProperty("name");
  });
  describe("GroupService.setLastResetAt", () => {
    beforeEach(() => {
      findOneAndUpdate.mockReset();
    });

    test("setea lastResetAt con la fecha dada", async () => {
      const fixedDate = new Date("2026-01-01T00:00:00Z");
      findOneAndUpdate.mockResolvedValue({});

      const service = new GroupService();
      await service.setLastResetAt("123-456@g.us", fixedDate);

      expect(findOneAndUpdate).toHaveBeenCalledWith(
        { whatsappId: "123-456@g.us" },
        { $set: { lastResetAt: fixedDate } },
        { returnDocument: "after" },
      );
    });

    test("usa new Date() por defecto si no se pasa fecha", async () => {
      findOneAndUpdate.mockResolvedValue({});

      const service = new GroupService();
      await service.setLastResetAt("123-456@g.us");

      const [, updateArg] = findOneAndUpdate.mock.calls[0]!;
      expect(updateArg.$set.lastResetAt).toBeInstanceOf(Date);
    });
  });
});
