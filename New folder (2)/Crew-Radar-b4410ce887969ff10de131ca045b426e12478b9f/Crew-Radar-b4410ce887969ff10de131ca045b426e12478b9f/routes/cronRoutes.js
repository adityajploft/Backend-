// routes/cronRoutes.js
const express = require('express');
const router = express.Router();
const { runFlightNotifications } = require('../cronJobs/flightNotifier');

// Manually trigger cron via URL
router.get('/run-flight-notifications', async (req, res) => {
  try {
    await runFlightNotifications(); 
    res.json({ status: true, message: 'Flight notifications triggered manually' });
  } catch (err) {
    console.error(err);
    res.status(500).json({ status: false, message: 'Error triggering notifications', error: err.message });
  }
});

module.exports = router;
