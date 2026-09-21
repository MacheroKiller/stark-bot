import { afterEach, beforeEach, describe, expect, mock, test } from "bun:test";

const sendMessageToGroup = mock();

mock.module("../core/whatsapp/send-message", () => ({
  sendMessageToGroup,
}));

const pingExecute = mock();
const banExecute = mock();
const approveExecute = mock();
const purgeExecute = mock(); // locked + requiresAdmin, para probar que el override no lo toca

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
  {
    command: "/purge",
    description: "purge",
    requiresAdmin: true,
    locked: true,
    execute: purgeExecute,
  },
];

mock.module("./command.registry", () => ({
  handlers: fakeHandlers,
}));

const { HandleCommand } = await import("./handle-command");

const findUser = mock();
const fakeUserService = { findUser } as any;

const findByWhatsappId = mock();
const fakeGroupService = { findByWhatsappId } as any;

const findByCommand = mock();
const fakeGlobalCommandConfigService = { findByCommand } as any;

function createHandleCommand() {
  return new HandleCommand(
    fakeUserService,
    fakeGroupService,
    fakeGlobalCommandConfigService,
  );
}

const context = {
  groupJid: "123-456@g.us",
  senderJid: "573001234567@s.whatsapp.net",
};
const fakeMsgObj = {} as any;

describe("HandleCommand.getContext", () => {
  const handleCommand = createHandleCommand();

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
    findByCommand.mockReset().mockResolvedValue(undefined); // sin config global
    findByWhatsappId.mockReset().mockResolvedValue(null); // grupo sin overrides
  });

  test("ejecuta el handler directamente", async () => {
    const handleCommand = createHandleCommand();
    await handleCommand.handle("/ping", context, fakeMsgObj);

    expect(pingExecute).toHaveBeenCalledWith(
      "/ping",
      context.groupJid,
      context.senderJid,
      fakeMsgObj,
    );
  });

  test("no llama a ningún execute si el comando no existe", async () => {
    const handleCommand = createHandleCommand();
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
    findByCommand.mockReset().mockResolvedValue(undefined);
    findByWhatsappId.mockReset().mockResolvedValue(null);
  });

  test("ejecuta el comando si el usuario es admin", async () => {
    findUser.mockResolvedValue({ isAdmin: true });

    const handleCommand = createHandleCommand();
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

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/ban", context, fakeMsgObj);

    expect(banExecute).not.toHaveBeenCalled();
    expect(sendMessageToGroup).toHaveBeenCalledWith(
      context.groupJid,
      "Este comando es solo para administradores.",
    );
  });

  test("bloquea el comando si el usuario no existe en el grupo", async () => {
    findUser.mockResolvedValue(null);

    const handleCommand = createHandleCommand();
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
    findByCommand.mockReset().mockResolvedValue(undefined);
    findByWhatsappId.mockReset().mockResolvedValue(null);
  });

  afterEach(() => {
    process.env.OWNER_WHATSAPP_IDS = ORIGINAL_ENV;
  });

  test("ejecuta el comando si el sender es owner", async () => {
    process.env.OWNER_WHATSAPP_IDS = context.senderJid;

    const handleCommand = createHandleCommand();
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

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/approve 123@g.us", context, fakeMsgObj);

    expect(approveExecute).not.toHaveBeenCalled();
    expect(sendMessageToGroup).not.toHaveBeenCalled();
  });

  test("no consulta UserService.findUser (requiresOwner no depende de isAdmin)", async () => {
    process.env.OWNER_WHATSAPP_IDS = context.senderJid;

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/approve 123@g.us", context, fakeMsgObj);

    expect(findUser).not.toHaveBeenCalled();
  });
});

describe("HandleCommand.handle — GlobalCommandConfig", () => {
  beforeEach(() => {
    banExecute.mockReset();
    approveExecute.mockReset();
    findUser.mockReset().mockResolvedValue({ isAdmin: true }); // no relevante en este describe
    findByCommand.mockReset();
    findByWhatsappId.mockReset().mockResolvedValue(null);
  });

  test("bloquea un comando no exento si está deshabilitado globalmente", async () => {
    findByCommand.mockResolvedValue({ command: "/ban", enabled: false });

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/ban", context, fakeMsgObj);

    expect(banExecute).not.toHaveBeenCalled();
  });

  test("ejecuta un comando no exento si la config global existe pero está habilitada", async () => {
    findByCommand.mockResolvedValue({ command: "/ban", enabled: true });

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/ban", context, fakeMsgObj);

    expect(banExecute).toHaveBeenCalled();
  });

  test("un comando exento (ej. /approve) se ejecuta aunque esté deshabilitado globalmente", async () => {
    findByCommand.mockResolvedValue({ command: "/approve", enabled: false });
    process.env.OWNER_WHATSAPP_IDS = context.senderJid;

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/approve 123@g.us", context, fakeMsgObj);

    expect(approveExecute).toHaveBeenCalled();

    delete process.env.OWNER_WHATSAPP_IDS;
  });

  test("no consulta GlobalCommandConfig para un comando exento", async () => {
    process.env.OWNER_WHATSAPP_IDS = context.senderJid;

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/approve 123@g.us", context, fakeMsgObj);

    expect(findByCommand).not.toHaveBeenCalled();

    delete process.env.OWNER_WHATSAPP_IDS;
  });
});

describe("HandleCommand.handle — commandOverrides por grupo", () => {
  beforeEach(() => {
    pingExecute.mockReset();
    purgeExecute.mockReset();
    findUser.mockReset();
    sendMessageToGroup.mockReset();
    findByCommand.mockReset().mockResolvedValue(undefined);
    findByWhatsappId.mockReset();
  });

  test("override.enabled=false bloquea el comando aunque no requiera admin", async () => {
    findByWhatsappId.mockResolvedValue({
      whatsappId: context.groupJid,
      name: "Grupo",
      status: "approved",
      commandOverrides: { "/ping": { enabled: false } },
    });

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/ping", context, fakeMsgObj);

    expect(pingExecute).not.toHaveBeenCalled();
  });

  test("override.requiresAdmin=true fuerza el chequeo de admin en un comando público", async () => {
    findByWhatsappId.mockResolvedValue({
      whatsappId: context.groupJid,
      name: "Grupo",
      status: "approved",
      commandOverrides: { "/ping": { enabled: true, requiresAdmin: true } },
    });
    findUser.mockResolvedValue({ isAdmin: false });

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/ping", context, fakeMsgObj);

    expect(pingExecute).not.toHaveBeenCalled();
    expect(sendMessageToGroup).toHaveBeenCalledWith(
      context.groupJid,
      "Este comando es solo para administradores.",
    );
  });

  test("un comando locked ignora override.requiresAdmin=false (no se puede volver público)", async () => {
    findByWhatsappId.mockResolvedValue({
      whatsappId: context.groupJid,
      name: "Grupo",
      status: "approved",
      commandOverrides: { "/purge": { enabled: true, requiresAdmin: false } },
    });
    findUser.mockResolvedValue({ isAdmin: false });

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/purge", context, fakeMsgObj);

    // sigue exigiendo admin pese al override, porque /purge es locked
    expect(purgeExecute).not.toHaveBeenCalled();
    expect(sendMessageToGroup).toHaveBeenCalledWith(
      context.groupJid,
      "Este comando es solo para administradores.",
    );
  });

  test("sin override, usa el requiresAdmin por defecto del handler", async () => {
    findByWhatsappId.mockResolvedValue({
      whatsappId: context.groupJid,
      name: "Grupo",
      status: "approved",
    });

    const handleCommand = createHandleCommand();
    await handleCommand.handle("/ping", context, fakeMsgObj);

    expect(pingExecute).toHaveBeenCalled();
    expect(findUser).not.toHaveBeenCalled(); // /ping no requiere admin por defecto
  });
});
