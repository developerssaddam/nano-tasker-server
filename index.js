const express = require("express");
const dotenv = require("dotenv").config();
const colors = require("colors");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const mongoURI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.flkt4kr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Init Express
const app = express();

// Environment variables
const port = process.env.PORT || 9090;

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://nano-tasker.web.app"],
  })
);

// Create a MongoClient for connection mongoDB
const client = new MongoClient(mongoURI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

async function run() {
  try {
    await client.connect();
    console.log(`MongoDB Connection is successfull!`.bgGreen.black);

    // User-Collection
    const userCollection = client.db("NanoTasker").collection("userCollection");

    // Create user
    app.post("/users", async (req, res) => {
      const userInfo = req.body;
      const email = userInfo.email;
      const query = { email: email };

      // Validation email already exits
      const isExits = await userCollection.findOne(query);
      if (isExits) {
        return res.send({ message: "Email already exits!" });
      } else {
        const result = await userCollection.insertOne(userInfo);
        res.send(result);
      }
    });

    // Test api
    app.get("/", (req, res) => {
      res.send(`NanoTasker server is running on port ${port}`);
    });
  } finally {
    // await client.close();
  }
}
run().catch(console.dir);

// Listen server
app.listen(port, () => {
  console.log(`Server is running on port: ${port}`.bgMagenta.black);
});
