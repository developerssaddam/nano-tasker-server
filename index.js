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
      return res.status(400).send({ message: "Forbidden!" });
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

    // Collections
    const notificationCollection = client
      .db("NanoTasker")
      .collection("notificationCollection");
    const userCollection = client.db("NanoTasker").collection("userCollection");
    const taskCollection = client.db("NanoTasker").collection("taskCollection");
    const withdrawCollection = client
      .db("NanoTasker")
      .collection("withdrawCollection");
    const submissionCollection = client
      .db("NanoTasker")
      .collection("submissionCollection");

    const paymentCollection = client
      .db("NanoTasker")
      .collection("paymentCollection");

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

    // varifyAdmin
    const verifyAdmin = async (req, res, next) => {
      const email = req.email.email;
      const query = { email: email };
      const getUser = await userCollection.findOne(query);
      const isAdmin = getUser.role === "Admin";
      if (!isAdmin) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // varifyTaskCreator
    const verifyTaskCreator = async (req, res, next) => {
      const email = req.email.email;
      const query = { email: email };
      const getUser = await userCollection.findOne(query);
      const isTaskCreator = getUser.role === "TaskCreator";
      if (!isTaskCreator) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

    // varifyWorker
    const verifyWorker = async (req, res, next) => {
      const email = req.email.email;
      const query = { email: email };
      const getUser = await userCollection.findOne(query);
      const isWorker = getUser?.role === "Worker";
      if (!isWorker) {
        return res.status(403).send({ message: "Forbidden access" });
      }
      next();
    };

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
    app.get("/alltask", tokenVerify, async (req, res) => {
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

    // Get all submissiondata in this worker where are status is approve only
    app.get("/my/submission/approve", tokenVerify, async (req, res) => {
      const email = req.query.email;
      const query = { worker_email: email };
      const result = await submissionCollection.find(query).toArray();

      const approveSubmission = result.filter(
        (data) => data.status === "Approve"
      );
      res.send(approveSubmission);
    });

    // Save data when an worker submission an single task
    app.post(
      "/submission/create",
      tokenVerify,
      verifyWorker,
      async (req, res) => {
        const submissionDetails = req.body;
        const result = await submissionCollection.insertOne(submissionDetails);
        res.send(result);
      }
    );

    // Worker withdraw api
    app.post(
      "/withdraw/worker",
      tokenVerify,
      verifyWorker,
      async (req, res) => {
        const withdrawInfo = req.body;
        const result = await withdrawCollection.insertOne(withdrawInfo);
        res.status(201).send(result);
      }
    );

    // Get myAll-Submission
    app.get("/my/all/submission", async (req, res) => {
      const email = req.query.email;
      const query = { worker_email: email };
      const totalItems = await submissionCollection.countDocuments(query);
      res.send({ totalItems });
    });

    // Pagination api
    app.get("/nanotasker/pagination", async (req, res) => {
      const email = req.query.email;
      const query = { worker_email: email };
      const page = parseInt(req.query.page);
      const size = parseInt(req.query.size);
      const result = await submissionCollection
        .find(query)
        .skip(page * size)
        .limit(size)
        .toArray();
      res.send(result);
    });

    // Get worker stats data.
    app.get(
      "/worker/stats/:email",
      tokenVerify,
      verifyWorker,
      async (req, res) => {
        const { email } = req.params;
        const query = { email: email };
        const submissionQuery = { worker_email: email };

        const currentUser = await userCollection.findOne(query);
        const totalCoin = currentUser?.totalCoin;

        const workerTotalSubmission = await submissionCollection
          .find(submissionQuery)
          .toArray();
        const totalSubmission = workerTotalSubmission.length;

        const submissionApprove = workerTotalSubmission.filter(
          (item) => item.status === "Approve"
        );
        const totalSubmissionApprove = submissionApprove.reduce(
          (current, item) => current + item.amount,
          0
        );

        res.send([
          { name: "AvailableCoin", value: totalCoin },
          { name: "TotalSubmission", value: totalSubmission },
          { name: "TotalEarning", value: totalSubmissionApprove },
        ]);
      }
    );

    /*
     *   TaskCreator api
     *  ====== x ==========
     */

    // Get all task by creator email
    app.get(
      "/all/task/mycreated",
      tokenVerify,
      verifyTaskCreator,
      async (req, res) => {
        const tokenEmail = req.email.email;
        const email = req.query.email;

        // validate token mail
        if (tokenEmail !== email) {
          return res.status(401).send({ message: "Unauthorize-access!" });
        }

        const query = { creator_email: email };
        const result = await taskCollection.find(query).toArray();
        res.send(result);
      }
    );

    // Create a newTask
    app.post(
      "/task/create",
      tokenVerify,
      verifyTaskCreator,
      async (req, res) => {
        const newTask = req.body;
        const result = await taskCollection.insertOne(newTask);
        res.send(result);
      }
    );

    // Update task creator totalCoin when create and delete an task and purchase coin
    app.put(
      "/users/updatecoin/task",
      tokenVerify,
      verifyTaskCreator,
      async (req, res) => {
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
      }
    );

    // Get an single task.
    app.get("/task/:id", tokenVerify, async (req, res) => {
      const { id } = req.params;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.findOne(query);
      res.send(result);
    });

    // Update an single task
    app.patch(
      "/task/update/:id",
      tokenVerify,
      verifyTaskCreator,
      async (req, res) => {
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
      }
    );

    // Delete an task
    app.delete(
      "/task/delete/:id",
      tokenVerify,
      verifyTaskCreator,
      async (req, res) => {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const result = await taskCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Get all pending submission data where is match taskCreator email
    app.get(
      "/mytask/worker/submission/status/pending",
      tokenVerify,
      verifyTaskCreator,
      tokenVerify,
      async (req, res) => {
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
      }
    );

    // Get single SubmissionData by id (id get query)
    app.get("/single/submission/data", tokenVerify, async (req, res) => {
      const id = req.query.id;
      const query = { _id: new ObjectId(id) };
      const result = await submissionCollection.findOne(query);
      res.send(result);
    });

    // Update worker totalCoin and submission status approved;
    app.patch(
      "/update/worker/totalcoin/and/submission/approve",
      tokenVerify,
      verifyTaskCreator,
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
            total_task_completetion: worker?.total_task_completetion + 1,
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
    app.patch(
      "/update/worker/status/rejected",
      tokenVerify,
      verifyTaskCreator,
      async (req, res) => {
        const { id } = req.body;
        const query = { _id: new ObjectId(id) };
        const updatedDoc = {
          $set: {
            status: "Rejected",
          },
        };
        const result = await submissionCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    // Set a notification object when an task creator approve an worker submission.
    app.post("/notification", async (req, res) => {
      const newNotification = req.body;
      const result = await notificationCollection.insertOne(newNotification);
      res.send(result);
    });

    // Get all notification data.
    app.get("/notification", async (req, res) => {
      const email = req.query.email;
      const query = { ToEmail: email };
      const result = await notificationCollection.find(query).toArray();
      res.send(result);
    });

    // TaskCreator states
    app.get(
      "/taskcreator/stats/:email",
      tokenVerify,
      verifyTaskCreator,
      async (req, res) => {
        const { email } = req.params;
        const coinQuery = { email: email };
        const currentUser = await userCollection.findOne(coinQuery);
        const coin = currentUser?.totalCoin;

        const pendingQuery = { creator_email: email };
        const totalSubmission = await submissionCollection
          .find(pendingQuery)
          .toArray();
        const totalPending = totalSubmission.filter(
          (submissionData) => submissionData.status === "Pending"
        );

        const totalApprove = totalSubmission.filter(
          (submissionData) => submissionData.status === "Approve"
        );

        const totalPayUser = totalApprove.reduce(
          (current, item) => current + item.amount,
          0
        );

        res.send([
          { name: "AvailableCoin", value: coin },
          { name: "PendingTask", value: totalPending.length },
          { name: "TotalPaymentPaid", value: totalPayUser },
        ]);
      }
    );

    /*
     *    Admin api
     *  ===== x ====
     */

    // Get all withdraw data
    app.get("/withdraw", tokenVerify, verifyAdmin, async (req, res) => {
      const email = req.query.email;
      const tokenEmail = req.email.email;
      if (email !== tokenEmail) {
        return res.status(401).send({ message: "Unauthorize-access!" });
      }
      const result = await withdrawCollection.find().toArray();
      res.status(200).send(result);
    });

    // delete an withdraw data when payment success btn clicked
    app.delete(
      "/withdraw/remove/:id",
      tokenVerify,
      verifyAdmin,
      async (req, res) => {
        const { id } = req.params;
        const query = { _id: new ObjectId(id) };
        const result = await withdrawCollection.deleteOne(query);
        res.send(result);
      }
    );

    // Update user coin.
    app.put(
      "/withdraw/workercoin/update",
      tokenVerify,
      verifyAdmin,
      async (req, res) => {
        const data = req.body;
        const query = { email: data.worker_email };
        const currentWorker = await userCollection.findOne(query);
        const updatedDoc = {
          $set: {
            totalCoin: currentWorker.totalCoin - data.withdraw_coin,
          },
        };
        const result = await userCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    // Delete User by admin
    app.delete(
      "/user/delete/byadmin",
      tokenVerify,
      verifyAdmin,
      async (req, res) => {
        const id = req.query.id;
        const query = { _id: new ObjectId(id) };
        const result = await userCollection.deleteOne(query);
        res.send(result);
      }
    );

    // update user role
    app.put(
      "/update/userrole/byadmin",
      tokenVerify,
      verifyAdmin,
      async (req, res) => {
        const data = req.body;
        const query = { _id: new ObjectId(data.id) };
        const updatedDoc = {
          $set: {
            role: data.value,
          },
        };
        const result = await userCollection.updateOne(query, updatedDoc);
        res.send(result);
      }
    );

    // Delete an task.
    app.delete("/task/:id", tokenVerify, verifyAdmin, async (req, res) => {
      const id = req.params.id;
      const query = { _id: new ObjectId(id) };
      const result = await taskCollection.deleteOne(query);
      res.send(result);
    });

    // Get admin states data.
    app.get("/admin/stats", tokenVerify, verifyAdmin, async (req, res) => {
      const usersData = await userCollection.find().toArray();
      const totalUsers = usersData.length;
      const totalCoin = usersData.reduce(
        (current, user) => current + user.totalCoin,
        0
      );

      const paymentsData = await paymentCollection.find().toArray();
      const totalPayment = paymentsData.reduce(
        (current, paymentItem) => current + paymentItem.payableAmoutn,
        0
      );

      res.send([
        { name: "TotalUser", value: totalUsers },
        { name: "TotalCoin", value: totalCoin },
        { name: "TotalPayment", value: totalPayment },
      ]);
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
    app.get("/payment", tokenVerify, verifyTaskCreator, async (req, res) => {
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
    app.post("/payment", tokenVerify, verifyTaskCreator, async (req, res) => {
      const paymentInfo = req.body;
      const result = await paymentCollection.insertOne(paymentInfo);
      res.send(result);
    });
    /*
     *    Top Earner api
     *  ====== x ========
     */
    app.get("/users/topearner", async (req, res) => {
      const allUsers = await userCollection.find().toArray();
      const workers = allUsers.filter((user) => user.role === "Worker");
      const topearnerUsers = workers.sort((a, b) => {
        return b.totalCoin - a.totalCoin;
      });
      res.send(topearnerUsers.slice(0, 6));
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
