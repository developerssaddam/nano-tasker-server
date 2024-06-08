const express = require("express");
const dotenv = require("dotenv").config();
const colors = require("colors");
const cors = require("cors");
const { MongoClient, ServerApiVersion, ObjectId } = require("mongodb");
const jwt = require("jsonwebtoken");
const mongoURI = `mongodb+srv://${process.env.DB_USER}:${process.env.DB_PASS}@cluster0.flkt4kr.mongodb.net/?retryWrites=true&w=majority&appName=Cluster0`;
const stripe = require("stripe")(process.env.STRIPE_SECRET_KEY);

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
const tokenVerify = async (req, res, next) => {
  const token = req.headers.authorization.split(" ")[1];
  // validation
  if (!token) {
    return res.status(401).send({ message: "Unauthorized access!" });
  }
  // now verify token
  jwt.verify(token, process.env.ACCESS_TOKEN_SECRET, (err, decoded) => {
    if (err) {
      return res.status(403).send({ message: "Forbidden!" });
    } else {
      req.email = decoded;
      next();
    }
  });
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
    const submissionCollection = client
      .db("NanoTasker")
      .collection("submissionCollection");

    const paymentCollection = client
      .db("NanoTasker")
      .collection("paymentCollection");

    // Get all users
    app.get("/users", async (req, res) => {
      const result = await userCollection.find().toArray();
      res.send(result);
    });

    // Get single user by email
    app.get("/users/singleuser", async (req, res) => {
      const email = req.query.email;
      const query = { email: email };
      const result = await userCollection.findOne(query);
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
     *     Worker-api
     *  ====== x ==========
     */
    // Get all task.
    app.get("/alltask", async (req, res) => {
      const result = await taskCollection.find().toArray();
      res.send(result);
    });

    // Get single task.
    app.get("/task/:id", async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.findOne(query);
      res.send(result);
    });

    // Get submissionData from submissionCollection base on worker Email
    app.get("/my/submission", tokenVerify, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.email.email;
      const query = { worker_email: email };

      if (email !== tokenEmail) {
        return res.status(401).send({ message: "Unauthorize-access!" });
      } else {
        const result = await submissionCollection.find(query).toArray();
        res.send(result);
      }
    });

    // Save data when an worker submission an single task
    app.post("/submission/create", tokenVerify, async (req, res) => {
      const submissionDetails = req.body;
      const result = await submissionCollection.insertOne(submissionDetails);
      res.send(result);
    });

    /*
     *   TaskCreator api
     *  ====== x ==========
     */

    // Get all task by creator email
    app.get("/all/task/mycreated", tokenVerify, async (req, res) => {
      const tokenEmail = req.email.email;
      const email = req.query.email;

      // validate token mail
      if (tokenEmail !== email) {
        return res.status(401).send({ message: "Unauthorize-access!" });
      }

      const query = { creator_email: email };
      const result = await taskCollection.find(query).toArray();
      res.send(result);
    });

    // Create a newTask
    app.post("/task/create", tokenVerify, async (req, res) => {
      const newTask = req.body;
      const result = await taskCollection.insertOne(newTask);
      res.send(result);
    });

    // Update task creator totalCoin when create and delete an task and purchase coin
    app.put("/users/updatecoin/task", async (req, res) => {
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

    // Get an single task.
    app.get("/task/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.findOne(query);
      res.send(result);
    });

    // Update an single task
    app.patch("/task/update/:id", async (req, res) => {
      const { id } = req.params;
      const updatedData = req.body;
      const query = { _id: new ObjectId(id) };

      const updateDoc = {
        $set: {
          title: updatedData.title,
          details: updatedData.details,
          submissionInfo: updatedData.submissionInfo,
        },
      };

      // Now find data and update
      const result = await taskCollection.updateOne(query, updateDoc);
      res.send(result);
    });

    // Delete an task
    app.delete("/task/delete/:id", async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.deleteOne(query);
      res.send(result);
    });

    // Get all pending submission data where is match taskCreator email
    app.get("/mytask/worker/submission", tokenVerify, async (req, res) => {
      const tokenEmail = req.email.email;
      const email = req.query.email;

      // validate token mail
      if (tokenEmail !== email) {
        return res.status(401).send({ message: "Unauthorize-access!" });
      }

      const query = { creator_email: email };

      // Get all submission data from submissionCollection by creator_email match.
      const myTask = await submissionCollection.find(query).toArray();

      // Now filter data which is status is pending;
      const result = myTask.filter((task) => task.status === "Pending");
      res.send(result);
    });

    // Get single SubmissionData by id (id get query)
    app.get("/single/submission/data", async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await submissionCollection.findOne(query);
      res.send(result);
    });

    // Update worker totalCoin and submission status approved;
    app.patch(
      "/update/worker/totalcoin/and/submission/approve",
      async (req, res) => {
        const data = req.body;
        const { _id, amount, worker_email } = data;
        const queryOne = { _id: new ObjectId(_id) };
        const queryTwo = { email: worker_email };
        const worker = await userCollection.findOne(queryTwo);

        const updatedStatus = {
          $set: {
            status: "Approve",
          },
        };

        const increaseWorkerCoin = {
          $set: {
            totalCoin: worker?.totalCoin + amount,
          },
        };

        const updateStatus = await submissionCollection.updateOne(
          queryOne,
          updatedStatus
        );

        const increaseWorkerTotalCoin = await userCollection.updateOne(
          queryTwo,
          increaseWorkerCoin
        );

        res.send({ updateStatus, increaseWorkerTotalCoin });
      }
    );

    // Update worker submission status to rejected
    app.patch("/update/worker/status/rejected", async (req, res) => {
      const { id } = req.body;
      const query = { _id: new ObjectId(id) };
      const updatedDoc = {
        $set: {
          status: "Rejected",
        },
      };
      const result = await submissionCollection.updateOne(query, updatedDoc);
      res.send(result);
    });

    /*
     *    Payment related api
     *  ========== x ===========
     */

    // Create stripe payment intent
    app.post("/create-payment-intent", async (req, res) => {
      const { amount } = req.body;
      const payableAmount = parseInt(amount) * 100;

      // Create payment intent
      const paymentIntent = await stripe.paymentIntents.create({
        amount: payableAmount,
        currency: "usd",
        payment_method_types: ["card"],
      });

      res.send({
        clientSecret: paymentIntent.client_secret,
      });
    });

    // Get all payment data by email
    app.get("/payment", tokenVerify, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.email.email;
      const query = { email: email };

      // validate token mail
      if (tokenEmail !== email) {
        return res.status(401).send({ message: "Unauthorize-access!" });
      }

      const result = await paymentCollection.find(query).toArray();
      res.send(result);
    });

    // Save payment data to payment collection
    app.post("/payment", tokenVerify, async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);
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
