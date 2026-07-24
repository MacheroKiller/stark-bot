import { describe, expect, test } from "bun:test";
import { extractSenderJid, isGroupJid } from "./jid";

describe("extractSenderJid", () => {
  test("usa participant cuando existe", () => {
    const msg = {
      key: {
        participant: "573001234567@s.whatsapp.net",
        remoteJid: "123-456@g.us",
      },
    };
    expect(extractSenderJid(msg as any)).toBe("573001234567@s.whatsapp.net");
  });

  test("cae a remoteJid si no hay participant", () => {
    const msg = { key: { remoteJid: "573001234567@s.whatsapp.net" } };
    expect(extractSenderJid(msg as any)).toBe("573001234567@s.whatsapp.net");
  });

  test("devuelve undefined si no hay ninguno", () => {
    const msg = { key: {} };
    expect(extractSenderJid(msg as any)).toBeUndefined();
  });
});

describe("isGroupJid", () => {
  test("reconoce un JID de grupo", () => {
    expect(isGroupJid("123456-789@g.us")).toBe(true);
  });

  test("rechaza un JID de usuario", () => {
    expect(isGroupJid("573001234567@s.whatsapp.net")).toBe(false);
  });
});
