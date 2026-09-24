require("dotenv").config();
const express = require("express");
const cors = require("cors");
const connectDB = require("./config/db");

const app = express();
app.use(cors());
app.use(express.json());

connectDB();

// Routes
app.use("/api/users", require("./routes/userRoutes"));
app.use("/api/flights", require("./routes/flightRoutes"));
app.use("/api/aircrafts", require("./routes/aircraftRoutes"));
app.use("/api/schedules", require("./routes/scheduleRoutes"));

app.listen(5000, () => console.log("Server running on 5000"));
