import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ObjectId } from "mongodb";

const findOneAndUpdate = mock();
const bulkWrite = mock();
const countDocuments = mock();
const findOne = mock();

// find() encadena .sort().limit().toArray() — hay que mockear cada eslabón
const toArray = mock();
const limit = mock(() => ({ toArray }));
const sort = mock(() => ({ limit }));
const find = mock(() => ({ sort }));

mock.module("../models/user.model", () => ({
  getUserCollection: () => ({
    findOneAndUpdate,
    bulkWrite,
    countDocuments,
    findOne,
    find,
  }),
}));

const { UserService } = await import("./user.service");

describe("UserService.findOrCreateAndIncrement", () => {
  beforeEach(() => {
    findOneAndUpdate.mockReset();
  });

  test("llama a Mongo con el filtro correcto", async () => {
    findOneAndUpdate.mockResolvedValue({
      whatsappId: "123",
      totalMessagesSent: 1,
    });

    const service = new UserService();
    await service.findOrCreateAndIncrement("123", "456");

    expect(findOneAndUpdate).toHaveBeenCalledWith(
      { whatsappId: "123", groupWhatsappId: "456" },
      expect.objectContaining({ $inc: { totalMessagesSent: 1 } }),
      expect.objectContaining({ upsert: true }),
    );
  });
});

describe("UserService.findPosition", () => {
  beforeEach(() => {
    countDocuments.mockReset();
  });

  test("devuelve 1 cuando nadie tiene más mensajes", async () => {
    countDocuments.mockResolvedValue(0);

    const service = new UserService();
    const position = await service.findPosition({
      whatsappId: "123",
      groupWhatsappId: "456",
      totalMessagesSent: 50,
      isAdmin: false,
    });

    expect(position).toBe(1);
    expect(countDocuments).toHaveBeenCalledWith({
      groupWhatsappId: "456",
      totalMessagesSent: { $gt: 50 },
    });
  });

  test("devuelve N+1 cuando hay N usuarios con más mensajes", async () => {
    countDocuments.mockResolvedValue(4);

    const service = new UserService();
    const position = await service.findPosition({
      whatsappId: "123",
      groupWhatsappId: "456",
      totalMessagesSent: 10,
      isAdmin: false,
    });

    expect(position).toBe(5);
  });

  test("solo cuenta usuarios del mismo grupo", async () => {
    countDocuments.mockResolvedValue(0);

    const service = new UserService();
    await service.findPosition({
      whatsappId: "123",
      groupWhatsappId: "grupo-A",
      totalMessagesSent: 10,
      isAdmin: false,
    });

    // el filtro debe usar el groupWhatsappId del usuario, no un valor fijo
    expect(countDocuments).toHaveBeenCalledWith(
      expect.objectContaining({ groupWhatsappId: "grupo-A" }),
    );
  });
});

describe("UserService.getTopMessageSenders", () => {
  beforeEach(() => {
    find.mockClear();
    sort.mockClear();
    limit.mockClear();
    toArray.mockReset();
  });

  test("consulta por groupWhatsappId, ordena descendente y limita a 5", async () => {
    const fakeUsers = [
      {
        _id: new ObjectId(),
        whatsappId: "1",
        groupWhatsappId: "grupo-A",
        isAdmin: false,
        totalMessagesSent: 99,
      },
    ];
    toArray.mockResolvedValue(fakeUsers);

    const service = new UserService();
    const result = await service.getTopMessageSenders("grupo-A");

    expect(find).toHaveBeenCalledWith({ groupWhatsappId: "grupo-A" });
    expect(sort).toHaveBeenCalledWith({ totalMessagesSent: -1 });
    expect(limit).toHaveBeenCalledWith(5);
    expect(result).toEqual(fakeUsers);
  });

  test("devuelve array vacío si no hay usuarios en el grupo", async () => {
    toArray.mockResolvedValue([]);

    const service = new UserService();
    const result = await service.getTopMessageSenders("grupo-vacio");

    expect(result).toEqual([]);
  });
});

describe("UserService.findUser", () => {
  beforeEach(() => {
    findOne.mockReset();
  });

  test("busca por whatsappId y groupWhatsappId", async () => {
    const fakeUser = {
      _id: new ObjectId(),
      whatsappId: "123",
      groupWhatsappId: "456",
      isAdmin: false,
      totalMessagesSent: 0,
    };
    findOne.mockResolvedValue(fakeUser);

    const service = new UserService();
    const result = await service.findUser("456", "123");

    expect(findOne).toHaveBeenCalledWith({
      whatsappId: "123",
      groupWhatsappId: "456",
    });
    expect(result).toEqual(fakeUser);
  });

  test("devuelve null si el usuario no existe", async () => {
    findOne.mockResolvedValue(null);

    const service = new UserService();
    const result = await service.findUser("456", "no-existe");

    expect(result).toBeNull();
  });
});

describe("UserService.setAdminStatus", () => {
  beforeEach(() => {
    bulkWrite.mockReset();
  });

  test("no llama a Mongo si el array de updates está vacío", async () => {
    const service = new UserService();
    await service.setAdminStatus("grupo-A", []);

    expect(bulkWrite).not.toHaveBeenCalled();
  });

  test("arma un updateOne por cada participante, con upsert", async () => {
    const service = new UserService();
    await service.setAdminStatus("grupo-A", [
      { whatsappId: "111", isAdmin: true },
      { whatsappId: "222", isAdmin: false },
    ]);

    expect(bulkWrite).toHaveBeenCalledWith([
      {
        updateOne: {
          filter: { whatsappId: "111", groupWhatsappId: "grupo-A" },
          update: {
            $setOnInsert: { whatsappId: "111", groupWhatsappId: "grupo-A" },
            $set: { isAdmin: true },
          },
          upsert: true,
        },
      },
      {
        updateOne: {
          filter: { whatsappId: "222", groupWhatsappId: "grupo-A" },
          update: {
            $setOnInsert: { whatsappId: "222", groupWhatsappId: "grupo-A" },
            $set: { isAdmin: false },
          },
          upsert: true,
        },
      },
    ]);
  });
});
