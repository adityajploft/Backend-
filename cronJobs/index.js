// --- Core Dependencies ---

require('dotenv').config();
const express = require('express');
const dotenv = require('dotenv');
const mongoose = require('mongoose');

// --- Custom Modules & Middleware ---
const setupSwagger = require('./swaggerConfig');
const { notFound, errorHandler } = require('./middleware/errorMiddleware');
const authRoutes = require('./routes/authRoutes');
const userRoutes = require('./routes/userRoutes');
const followRoutes = require('./routes/followRoutes'); 
const notificationRoutes = require('./routes/notificationRoutes'); 
const flightRoutes = require('./routes/flightRoutes');
require('./cronJobs/flightNotifier');

// --- Configuration ---
// Load environment variables from .env file
// dotenv.config();

// --- Database Connection ---
mongoose.connect(process.env.MONGO_URI, {
    useNewUrlParser: true,
    useUnifiedTopology: true,
  })
  .then(() => console.log('MongoDB Connected Successfully.'))
  .catch((err) => {
    console.error('MongoDB Connection Failed:');
    console.error(err);
    process.exit(1); 
  });

// --- Initialize Express App ---
const app = express();

app.use(express.json());

// To parse incoming URL-encoded requests (form data)
app.use(express.urlencoded({ extended: true }));


// --- API Documentation Setup ---
// Sets up the /api-docs route to serve the Swagger UI
setupSwagger(app);

// --- API Routes ---
// Mount the routers for specific API endpoints
app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/follow', followRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/flights', flightRoutes);


// --- A simple root route for health checks or welcome messages ---
app.get('/', (req, res) => {
    res.status(200).json({ message: 'Welcome to the Crew Radar API!' });
});

app.use(notFound);
app.use(errorHandler);


// --- Start Server ---
const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
  console.log(`Server is running in ${process.env.NODE_ENV || 'development'} mode on http://localhost:${PORT}`);
  console.log(`API documentation available at http://localhost:${PORT}/api-docs`);
});