import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import { getOwnerJids, isOwner } from "./owner";

const ORIGINAL_ENV = process.env.OWNER_WHATSAPP_IDS;

describe("getOwnerJids", () => {
  afterEach(() => {
    process.env.OWNER_WHATSAPP_IDS = ORIGINAL_ENV;
  });

  test("parsea una lista separada por comas", () => {
    process.env.OWNER_WHATSAPP_IDS =
      "573001111111@s.whatsapp.net,573002222222@s.whatsapp.net";

    expect(getOwnerJids()).toEqual([
      "573001111111@s.whatsapp.net",
      "573002222222@s.whatsapp.net",
    ]);
  });

  test("recorta espacios alrededor de cada JID", () => {
    process.env.OWNER_WHATSAPP_IDS =
      " 573001111111@s.whatsapp.net , 573002222222@s.whatsapp.net ";

    expect(getOwnerJids()).toEqual([
      "573001111111@s.whatsapp.net",
      "573002222222@s.whatsapp.net",
    ]);
  });

  test("descarta entradas vacías (comas de más, trailing comma)", () => {
    process.env.OWNER_WHATSAPP_IDS = "573001111111@s.whatsapp.net,,";

    expect(getOwnerJids()).toEqual(["573001111111@s.whatsapp.net"]);
  });

  test("devuelve un array vacío si la variable no está seteada", () => {
    delete process.env.OWNER_WHATSAPP_IDS;

    expect(getOwnerJids()).toEqual([]);
  });
});

describe("isOwner", () => {
  beforeEach(() => {
    process.env.OWNER_WHATSAPP_IDS =
      "573001111111@s.whatsapp.net,573002222222@s.whatsapp.net";
  });

  afterEach(() => {
    process.env.OWNER_WHATSAPP_IDS = ORIGINAL_ENV;
  });

  test("true si el JID está en la lista", () => {
    expect(isOwner("573001111111@s.whatsapp.net")).toBe(true);
  });

  test("false si el JID no está en la lista", () => {
    expect(isOwner("573009999999@s.whatsapp.net")).toBe(false);
  });

  test("false si la variable de entorno no está seteada", () => {
    delete process.env.OWNER_WHATSAPP_IDS;
    expect(isOwner("573001111111@s.whatsapp.net")).toBe(false);
  });
});
