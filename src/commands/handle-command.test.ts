import { describe, expect, test } from "bun:test";
import { HandleCommand } from "./handle-command";

describe("HandleCommand.getContext", () => {
  const handleCommand = new HandleCommand();

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
