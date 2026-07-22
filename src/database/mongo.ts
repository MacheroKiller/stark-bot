import { Db, MongoClient } from "mongodb";

let client: MongoClient | undefined;
let db: Db | undefined;

function requireEnv(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} no está definida`);
  }
  return value;
}

export function getMongoClient(): MongoClient {
  if (!client) {
    client = new MongoClient(requireEnv("DB_URI"));
  }
  return client;
}

export function getDb(): Db {
  if (!db) {
    db = getMongoClient().db(requireEnv("DB_NAME"));
  }
  return db;
}
