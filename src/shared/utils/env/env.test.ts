import { afterEach, beforeEach, describe, expect, test } from "bun:test";
import {
  getDevAllowedGroupJids,
  isDevelopment,
  isGroupAllowedInCurrentEnv,
} from "./env";

const ORIGINAL_BOT_ENV = process.env.BOT_ENV;
const ORIGINAL_DEV_GROUPS = process.env.DEV_ALLOWED_GROUP_JIDS;

afterEach(() => {
  process.env.BOT_ENV = ORIGINAL_BOT_ENV;
  process.env.DEV_ALLOWED_GROUP_JIDS = ORIGINAL_DEV_GROUPS;
});

describe("isDevelopment", () => {
  test("true cuando BOT_ENV es 'development'", () => {
    process.env.BOT_ENV = "development";
    expect(isDevelopment()).toBe(true);
  });

  test("false para cualquier otro valor, incluido undefined", () => {
    process.env.BOT_ENV = "production";
    expect(isDevelopment()).toBe(false);

    delete process.env.BOT_ENV;
    expect(isDevelopment()).toBe(false);
  });
});

describe("getDevAllowedGroupJids", () => {
  test("parsea, recorta espacios, y descarta vacíos — igual que getOwnerJids", () => {
    process.env.DEV_ALLOWED_GROUP_JIDS = " 111@g.us , 222@g.us ,";
    expect(getDevAllowedGroupJids()).toEqual(["111@g.us", "222@g.us"]);
  });

  test("devuelve array vacío si no está seteada", () => {
    delete process.env.DEV_ALLOWED_GROUP_JIDS;
    expect(getDevAllowedGroupJids()).toEqual([]);
  });
});

describe("isGroupAllowedInCurrentEnv", () => {
  test("en producción, siempre true sin importar la lista", () => {
    process.env.BOT_ENV = "production";
    process.env.DEV_ALLOWED_GROUP_JIDS = "";

    expect(isGroupAllowedInCurrentEnv("cualquier-grupo@g.us")).toBe(true);
  });

  test("en desarrollo, true solo si el grupo está en la allowlist", () => {
    process.env.BOT_ENV = "development";
    process.env.DEV_ALLOWED_GROUP_JIDS = "111@g.us";

    expect(isGroupAllowedInCurrentEnv("111@g.us")).toBe(true);
    expect(isGroupAllowedInCurrentEnv("222@g.us")).toBe(false);
  });

  test("en desarrollo sin lista configurada, ningún grupo pasa", () => {
    process.env.BOT_ENV = "development";
    delete process.env.DEV_ALLOWED_GROUP_JIDS;

    expect(isGroupAllowedInCurrentEnv("111@g.us")).toBe(false);
  });
});
