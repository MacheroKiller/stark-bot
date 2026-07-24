// src/database/services/group.service.test.ts
import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ObjectId } from "mongodb";

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
    const group = {
      _id: new ObjectId(),
      whatsappId: "123-456@g.us",
      name: "Grupo de prueba",
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
    const group = { whatsappId: "123-456@g.us", name: "Grupo de prueba" };
    findOneAndUpdate.mockResolvedValue(group);

    const service = new GroupService();
    await service.findOrCreate(group);

    const [, updateArg] = findOneAndUpdate.mock.calls[0]!;

    // el bug original (Hallazgo #1) era $setOnInsert: { group } —
    // este assert falla si alguien lo reintroduce sin querer
    expect(updateArg.$setOnInsert).not.toHaveProperty("group");
    expect(updateArg.$setOnInsert).toEqual(
      expect.objectContaining({
        whatsappId: "123-456@g.us",
        name: "Grupo de prueba",
      }),
    );
  });
});
