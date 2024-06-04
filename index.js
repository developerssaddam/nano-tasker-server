const express = require("express");
const dotenv = require("dotenv").config();
const colors = require("colors");
const cors = require("cors");
const { MongoClient, ServerApiVersion } = require("mongodb");
const jwt = require("jsonwebtoken");
const mongoURI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.flkt4kr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;

// Init Express
const app = express();

// Environment variables
const port = process.env.PORT || 9090;

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: [
      "http://localhost:5173",
      "https://nano-tasker.web.app",
      "https://imgbb.com",
    ],
  })
);

// tokenVerify
const tokenVerify = (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  console.log(token);
  next();
};

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

    /*
     *      Auth api
     *  ====== x ==========
     */

    // Create jsonWebToken
    app.post("/jwt/create", async (req, res) => {
      const userEmail = req.query.email;
      // create token
      const token = jwt.sign(
        { email: userEmail },
        process.env.ACCESS_TOKEN_SECRET,
        {
          expiresIn: "1h",
        }
      );
      res.send({ token });
    });

    // User-Collection
    const userCollection = client.db("NanoTasker").collection("userCollection");
    const taskCollection = client.db("NanoTasker").collection("taskCollection");

    // Get all users
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Get single user
    app.get("/users/singleuser", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
      res.send(result);
    });

    // Update task creator user total coin when create a new task
    app.put("/users/taskcreator", async (req, res) => {
      const updatedData = req.body;
      const { email, updatedCoin } = updatedData;
      const query = { email: email };
      const updateDoc = {
        $set: {
          totalCoin: updatedCoin,
        },
      };
      const result = await userCollection.updateOne(query, updateDoc);
      res.send(result);
    });

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

    /*
     *      TaskCreator api
     *  ====== x ==========
     */

    app.post("/task/create", async (req, res) => {
      const newTask = req.body;
      const result = await taskCollection.insertOne(newTask);
      res.send(result);
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
