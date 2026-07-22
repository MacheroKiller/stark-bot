import { MongoClient } from "mongodb";

const uri = process.env.DB_URI;
const dbName = process.env.DB_NAME;

if (!uri) {
  throw new Error("DB_URI no está definida");
}

if (!dbName) {
  throw new Error("DB_NAME no está definida");
}

export const client = new MongoClient(uri);

export const db = client.db(dbName);
