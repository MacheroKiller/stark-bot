import { beforeEach, describe, expect, test } from "bun:test";
import {
  clearPendingConfirmation,
  getPendingConfirmation,
  setPendingConfirmation,
} from "./pendingConfirmationStore";

const KEY_A = "purge:group-a@g.us";
const KEY_B = "reset:group-a@g.us"; // mismo grupo, distinto namespace de comando

describe("pendingConfirmationStore", () => {
  beforeEach(() => {
    clearPendingConfirmation(KEY_A);
    clearPendingConfirmation(KEY_B);
  });

  test("getPendingConfirmation devuelve null si nunca se seteó nada para esa key", () => {
    expect(getPendingConfirmation<string[]>(KEY_A)).toBeNull();
  });

  test("setPendingConfirmation + getPendingConfirmation devuelve la misma data mientras no expire", () => {
    setPendingConfirmation(KEY_A, ["111", "222"], 5000);
    expect(getPendingConfirmation<string[]>(KEY_A)).toEqual(["111", "222"]);
  });

  test("purge y reset del mismo grupo no se mezclan (namespaces distintos)", () => {
    setPendingConfirmation(KEY_A, ["111"], 5000);
    setPendingConfirmation(KEY_B, true, 5000);

    expect(getPendingConfirmation<string[]>(KEY_A)).toEqual(["111"]);
    expect(getPendingConfirmation<boolean>(KEY_B)).toBe(true);
  });

  test("clearPendingConfirmation borra solo la entrada de esa key", () => {
    setPendingConfirmation(KEY_A, ["111"], 5000);
    clearPendingConfirmation(KEY_A);

    expect(getPendingConfirmation<string[]>(KEY_A)).toBeNull();
  });

  test("getPendingConfirmation devuelve null después de que expira el TTL", async () => {
    setPendingConfirmation(KEY_A, ["111"], 20);

    await new Promise((resolve) => setTimeout(resolve, 40));

    expect(getPendingConfirmation<string[]>(KEY_A)).toBeNull();
  });

  test("un segundo setPendingConfirmation reemplaza al anterior, no lo acumula", () => {
    setPendingConfirmation(KEY_A, ["111"], 5000);
    setPendingConfirmation(KEY_A, ["222", "333"], 5000);

    expect(getPendingConfirmation<string[]>(KEY_A)).toEqual(["222", "333"]);
  });

  test("soporta cualquier tipo de data (boolean, no solo arrays)", () => {
    setPendingConfirmation(KEY_B, true, 5000);
    expect(getPendingConfirmation<boolean>(KEY_B)).toBe(true);
  });
});
