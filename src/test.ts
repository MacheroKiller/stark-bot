import { MongoClient } from "mongodb";

async function testConnection() {
  const client = new MongoClient(process.env.DB_URI!);

  try {
    await client.connect();

    await client.db("admin").command({ ping: 1 });

    console.log("✅ Conexión exitosa");
  } catch (error) {
    console.error("❌ Error de conexión:", error);
  } finally {
    await client.close();
  }
}

testConnection();
