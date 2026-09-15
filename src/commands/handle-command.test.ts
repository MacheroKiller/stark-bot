import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const sendMessageToGroup = mock();

mock.module("../core/whatsapp/send-message", () => ({
  sendMessageToGroup,
}));

const pingExecute = mock();
const banExecute = mock();
const approveExecute = mock();

const fakeHandlers = [
  { command: "/ping", description: "ping", execute: pingExecute },
  {
    command: "/ban",
    description: "ban",
    requiresAdmin: true,
    execute: banExecute,
  },
  {
    command: "/approve",
    description: "approve",
    requiresOwner: true,
    execute: approveExecute,
  },
];

mock.module("./command.registry", () => ({
  handlers: fakeHandlers,
}));

const { HandleCommand } = await import("./handle-command");

const findUser = mock();
const fakeUserService = { findUser } as any;

const context = {
  groupJid: "123-456@g.us",
  senderJid: "573001234567@s.whatsapp.net",
};
const fakeMsgObj = {} as any;

describe("HandleCommand.getContext", () => {
  const handleCommand = new HandleCommand(fakeUserService);

  test("extrae groupJid y senderJid correctamente", () => {
    const msg = {
      key: {
        remoteJid: "123-456@g.us",
        participant: "573001234567@s.whatsapp.net",
      },
    };
    expect(handleCommand.getContext(msg as any)).toEqual({
      groupJid: "123-456@g.us",
      senderJid: "573001234567@s.whatsapp.net",
    });
  });

  test("devuelve null si falta remoteJid", () => {
    const msg = { key: { participant: "573001234567@s.whatsapp.net" } };
    expect(handleCommand.getContext(msg as any)).toBeNull();
  });
});

describe("HandleCommand.handle — comando sin restricciones", () => {
  beforeEach(() => {
    pingExecute.mockReset();
  });

  test("ejecuta el handler directamente", async () => {
    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/ping", context, fakeMsgObj);

    expect(pingExecute).toHaveBeenCalledWith(
      "/ping",
      context.groupJid,
      context.senderJid,
      fakeMsgObj,
    );
  });

  test("no llama a ningún execute si el comando no existe", async () => {
    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/noexiste", context, fakeMsgObj);

    expect(pingExecute).not.toHaveBeenCalled();
    expect(banExecute).not.toHaveBeenCalled();
    expect(approveExecute).not.toHaveBeenCalled();
  });
});

describe("HandleCommand.handle — requiresAdmin", () => {
  beforeEach(() => {
    banExecute.mockReset();
    findUser.mockReset();
    sendMessageToGroup.mockReset();
  });

  test("ejecuta el comando si el usuario es admin", async () => {
    findUser.mockResolvedValue({ isAdmin: true });

    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/ban", context, fakeMsgObj);

    expect(findUser).toHaveBeenCalledWith(context.groupJid, context.senderJid);
    expect(banExecute).toHaveBeenCalledWith(
      "/ban",
      context.groupJid,
      context.senderJid,
      fakeMsgObj,
    );
  });

  test("bloquea el comando y avisa si el usuario no es admin", async () => {
    findUser.mockResolvedValue({ isAdmin: false });

    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/ban", context, fakeMsgObj);

    expect(banExecute).not.toHaveBeenCalled();
    expect(sendMessageToGroup).toHaveBeenCalledWith(
      context.groupJid,
      "Este comando es solo para administradores.",
    );
  });

  test("bloquea el comando si el usuario no existe en el grupo", async () => {
    findUser.mockResolvedValue(null);

    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/ban", context, fakeMsgObj);

    expect(banExecute).not.toHaveBeenCalled();
    expect(sendMessageToGroup).toHaveBeenCalled();
  });
});

describe("HandleCommand.handle — requiresOwner", () => {
  const ORIGINAL_ENV = process.env.OWNER_WHATSAPP_IDS;

  beforeEach(() => {
    approveExecute.mockReset();
    findUser.mockReset();
    sendMessageToGroup.mockReset();
  });

  afterEach(() => {
    process.env.OWNER_WHATSAPP_IDS = ORIGINAL_ENV;
  });

  test("ejecuta el comando si el sender es owner", async () => {
    process.env.OWNER_WHATSAPP_IDS = context.senderJid;

    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/approve 123@g.us", context, fakeMsgObj);

    expect(approveExecute).toHaveBeenCalledWith(
      "/approve 123@g.us",
      context.groupJid,
      context.senderJid,
      fakeMsgObj,
    );
  });

  test("no ejecuta ni avisa nada si el sender no es owner", async () => {
    process.env.OWNER_WHATSAPP_IDS = "573009999999@s.whatsapp.net";

    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/approve 123@g.us", context, fakeMsgObj);

    expect(approveExecute).not.toHaveBeenCalled();
    expect(sendMessageToGroup).not.toHaveBeenCalled();
  });

  test("no consulta UserService.findUser (requiresOwner no depende de isAdmin)", async () => {
    process.env.OWNER_WHATSAPP_IDS = context.senderJid;

    const handleCommand = new HandleCommand(fakeUserService);
    await handleCommand.handle("/approve 123@g.us", context, fakeMsgObj);

    expect(findUser).not.toHaveBeenCalled();
  });
});
