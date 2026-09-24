const cron = require("node-cron");
const axios = require("axios");
const Follow = require("../models/Follow");
const Notification = require("../models/Notification");
const { sendFlightNotification } = require("../services/sendFlightNotification");

// Keep in-memory for short-term debounce, but rely on DB for persistence
const notifiedEvents = new Set();

cron.schedule("* * * * *", async () => {
  const now = new Date();
  console.log(" Cron running:", now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  try {
    // 1. Find all active follow relationships
    const followRecords = await Follow.find({ isNotify: true }).populate("following", "_id");
    if (followRecords.length === 0) return;

    // 2. Identify Unique Pilots to Trigger
    // We only care about pilots that someone is actually following and wants notifications for
    const uniquePilotIds = [...new Set(followRecords.map(r => r.following?._id.toString()))].filter(Boolean);
    console.log(` Updating data for ${uniquePilotIds.length} pilots...`);

    // 3. Process each pilot sequentially or in parallel
    for (const pilotId of uniquePilotIds) {
      try {
        // A. TRIGGER UPDATE
        const triggerUrl = `http://127.0.0.1:5000/api/flights/trigger-flight-notification`;
        // const triggerUrl = `${process.env.Host_URL}/api/flights/trigger-flight-notification`;
        
        const triggerResponse = await axios.post(triggerUrl, { userId: pilotId });

        // B. CHECK IF SUCCESSFUL
        if (triggerResponse.data && triggerResponse.data.status) {
             const updatedPilotData = triggerResponse.data.updatedPilot || triggerResponse.data.pilot; // Adjust based on actual API response structure
             
             // If the API returns the updated pilot, we can use it. 
             // Otherwise, we might need to re-fetch or rely on what trigger returned.
             // Looking at flightController.js, it returns `results` and `data` but not always the full pilot object with populated fields if not requested.
             // actually flightController returns `pilot` object saved in DB.
            
             if (!updatedPilotData) {
                 console.log(` No pilot data returned for ${pilotId}, skipping notification check.`);
                 continue;
             }

             await checkAndSendNotificationsForPilot(pilotId, updatedPilotData, now);
        } else {
            console.log(` Trigger reported false status for ${pilotId}`);
        }

      } catch (err) {
        console.error(` Update failed for pilot ${pilotId}: ${err.message}`);
        // If trigger fails, WE DO NOT SEND NOTIFICATIONS. This meets Requirement 1.
      }
    }

  } catch (error) {
    console.error(" Cron error:", error.message);
  }
});

async function checkAndSendNotificationsForPilot(pilotId, pilotData, now) {
    // 1. Find followers for this specific pilot
    const followers = await Follow.find({ following: pilotId, isNotify: true })
        .populate("follower", "firebaseToken fullName email _id");

    if (!followers.length) return;

    if (!pilotData.flightStatus || !pilotData.flightDateTime) return;

    for (let i = 0; i < pilotData.flightStatus.length; i++) {
        const status = pilotData.flightStatus[i];
        const timeString = pilotData.flightDateTime[i];
        
        if (!status || status === "no_data" || status === "error") continue;
        if (!timeString) continue;

        const eventTime = new Date(timeString);
        if (isNaN(eventTime.getTime())) continue;

        // Requirement 2: Strict 2 minute window
        // logic: if now is 10:05 and event was 10:03, diff is 2 mins.
        // We want to notify if we are within roughly 2 mins of the event happening.
        // Let's say we allow checking from 2 mins before to 2 mins after?
        // Usually "within 2 min of takeoff" implies recently happened.
        // Let's allow a window: [EventTime - 2m, EventTime + 2m]
        // diffMinutes = (now - eventTime) / 60000
        // If now > eventTime, diff is positive.
        // If we want "within 2 mins AFTER", diff should be 0 to 2.
        
        const diffMinutes = (now - eventTime) / (1000 * 60);

        // Allow slightly wider buffer for crons running every minute: 
        // e.g., if cron runs at 10:00:30 and event was 09:58:00 (2.5 mins ago), maybe too late?
        // User requested: "if we hit within 2 min of takeoff or land"
        // Let's stick to abs(diff) <= 2 or similar.
        const isRecent = Math.abs(diffMinutes) <= 2; 

        if (isRecent) {
             const flightIndex = Math.floor(i / 2); // Assuming pairs of status? Or just sequential list logic from before
             // In previous code: flightIndex = Math.floor(i / 2) suggests structure [Takeoff1, Landing1, Takeoff2, Landing2] ??
             // flightController.js pushes: takeoff, then landing. So yes, pairs logic seems implied if they map to flightNumber array.
             // But `pilot.flightNumber` is an array. `pilot.flightStatus` is also array.
             // It seems they are synchronized. 
             // Let's assume the previous logic for flightNum was correct or we fallback to index 0.
             
             let flightNum = "Unknown";
             if (pilotData.flightNumber && Array.isArray(pilotData.flightNumber)) {
                 // The previous code mapped status index to flight number index via Math.floor(i/2).
                 // We will keep that heuristic.
                 flightNum = pilotData.flightNumber[Math.floor(i/2)] || pilotData.flightNumber[0];
             }

             for (const follow of followers) {
                 const follower = follow.follower;
                 if (!follower || !follower.firebaseToken) continue;

                 // Requirement 3: Prevent duplicate notifications (DB Persistence)
                 // Check if we already sent a notification to this USER for this STATUS and TIME.
                 
                 const alreadySent = await Notification.findOne({
                     user: follower._id,
                     type: "flight_notification",
                     "meta_data.flightStatus": String(status),
                     "meta_data.flightDateTime": String(timeString),
                     "meta_data.pilotId": String(pilotId)
                 });
                 
                 if (!alreadySent) {
                      // Double check in-memory set just in case of tight loops
                      const eventKey = `${pilotId}-${status}-${follower._id}-${timeString}`;
                      if (notifiedEvents.has(eventKey)) continue;

                      await sendFlightNotification(
                          follower,
                          status,
                          eventTime.toISOString(),
                          pilotId,
                          pilotData.fullName,
                          follower.firebaseToken,
                          flightNum
                      );

                      // Update local debounce
                      notifiedEvents.add(eventKey);
                      setTimeout(() => notifiedEvents.delete(eventKey), 5 * 60 * 1000); // 5 mins cache
                 }
             }
        }
    }
}