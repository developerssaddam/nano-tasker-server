const express = require("express");
const dotenv = require("dotenv").config();
const colors = require("colors");
const cors = require("cors");

// Init Express
const app = express();

// Environment variables
const port = process.env.PORT || 9090

// Middlewares
app.use(express.json());
app.use(
  cors({
    origin: ["http://localhost:5173", "https://nano-tasker.web.app"],
  })
);

// Listen server
app.listen(port, () => {
    console.log(`Server is running on port: ${port}`.bgMagenta.black);
})
