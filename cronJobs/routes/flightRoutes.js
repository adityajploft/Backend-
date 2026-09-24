const express = require('express');
const router = express.Router();
const { triggerFlightNotification ,forceFlightTest } = require('../controllers/flightController');

// Define the POST route
router.post('/trigger-flight-notification', triggerFlightNotification);
router.post('/test-force-notification', forceFlightTest);
module.exports = router;