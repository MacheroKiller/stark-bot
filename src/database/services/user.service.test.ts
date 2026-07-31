import { beforeEach, describe, expect, mock, test } from "bun:test";
import { ObjectId } from "mongodb";

const findOneAndUpdate = mock();
const bulkWrite = mock();
const countDocuments = mock();
const findOne = mock();

// find() encadena .sort().skip().limit().project().toArray()/.next() —
// hay que mockear cada eslabón. sort/skip/limit/project devuelven `this`
// (el propio cursor) para poder encadenar sin reconstruir la cadena en
// cada test.
const toArray = mock();
const next = mock();
const cursor = {
  sort: mock().mockReturnThis(),
  skip: mock().mockReturnThis(),
  limit: mock().mockReturnThis(),
  project: mock().mockReturnThis(),
  toArray,
  next,
};

const find = mock(() => cursor);

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

describe("UserService.findUserByPosition", () => {
  beforeEach(() => {
    find.mockReset();
    find.mockImplementation(() => cursor);

    cursor.sort.mockClear();
    cursor.skip.mockClear();
    cursor.limit.mockClear();
    next.mockReset();
  });

  test("returns null when position is less than 1", async () => {
    const service = new UserService();

    const result = await service.findUserByPosition("group-1", 0);

    expect(result).toBeNull();
    expect(find).not.toHaveBeenCalled();
  });

  test("returns null when no user exists at the given position", async () => {
    next.mockResolvedValue(null);

    const service = new UserService();

    const result = await service.findUserByPosition("group-1", 3);

    expect(result).toBeNull();

    expect(find).toHaveBeenCalledWith({
      groupWhatsappId: "group-1",
    });

    expect(cursor.sort).toHaveBeenCalledWith({
      totalMessagesSent: -1,
    });

    expect(cursor.skip).toHaveBeenCalledWith(2);

    expect(cursor.limit).toHaveBeenCalledWith(1);
  });

  test("returns the ranked user", async () => {
    const fakeUserId = new ObjectId();

    next.mockResolvedValue({
      _id: fakeUserId,
      whatsappId: "123",
      groupWhatsappId: "group-1",
      totalMessagesSent: 42,
      isAdmin: false,
    });

    const service = new UserService();

    const result = await service.findUserByPosition("group-1", 2);

    expect(find).toHaveBeenCalledWith({
      groupWhatsappId: "group-1",
    });

    expect(cursor.sort).toHaveBeenCalledWith({
      totalMessagesSent: -1,
    });

    expect(cursor.skip).toHaveBeenCalledWith(1);

    expect(cursor.limit).toHaveBeenCalledWith(1);

    expect(result).toEqual({
      _id: fakeUserId,
      whatsappId: "123",
      groupWhatsappId: "group-1",
      totalMessagesSent: 42,
      isAdmin: false,
      position: 2,
    });
  });
});

describe("UserService.getTopMessageSenders", () => {
  beforeEach(() => {
    find.mockReset();
    find.mockImplementation(() => cursor);

    cursor.sort.mockClear();
    cursor.skip.mockClear();
    cursor.limit.mockClear();
    cursor.project.mockClear();
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
    expect(cursor.sort).toHaveBeenCalledWith({ totalMessagesSent: -1 });
    expect(cursor.limit).toHaveBeenCalledWith(5);
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

describe("UserService.findUserList", () => {
  beforeEach(() => {
    find.mockReset();
    find.mockImplementation(() => cursor);
    toArray.mockReset();
  });

  test("finds users by whatsapp ids", async () => {
    const users = [
      {
        _id: new ObjectId(),
        whatsappId: "111",
        groupWhatsappId: "group-1",
        totalMessagesSent: 10,
        isAdmin: false,
      },
      {
        _id: new ObjectId(),
        whatsappId: "222",
        groupWhatsappId: "group-1",
        totalMessagesSent: 5,
        isAdmin: true,
      },
    ];

    toArray.mockResolvedValue(users);

    const service = new UserService();

    const result = await service.findUserList("group-1", ["111", "222"]);

    expect(find).toHaveBeenCalledWith({
      groupWhatsappId: "group-1",
      whatsappId: {
        $in: ["111", "222"],
      },
    });

    expect(result).toEqual(users);
  });
});

describe("UserService.findUserPositionList", () => {
  beforeEach(() => {
    find.mockReset();
    find.mockImplementation(() => cursor);
    toArray.mockReset();

    cursor.sort.mockClear();
    cursor.project.mockClear();
  });

  test("returns the positions of the requested users", async () => {
    toArray.mockResolvedValue([
      {
        whatsappId: "333",
        totalMessagesSent: 100,
      },
      {
        whatsappId: "111",
        totalMessagesSent: 90,
      },
      {
        whatsappId: "222",
        totalMessagesSent: 80,
      },
    ]);

    const service = new UserService();

    const result = await service.findUserPositionList("group-1", [
      "111",
      "222",
    ]);

    expect(find).toHaveBeenCalledWith({
      groupWhatsappId: "group-1",
    });

    expect(cursor.sort).toHaveBeenCalledWith({
      totalMessagesSent: -1,
    });

    expect(cursor.project).toHaveBeenCalledWith({
      whatsappId: 1,
      totalMessagesSent: 1,
    });

    expect(result.get("111")).toBe(2);
    expect(result.get("222")).toBe(3);
  });
});
