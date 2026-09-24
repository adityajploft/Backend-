const cron = require("node-cron");
const axios = require("axios");
const Follow = require("../models/Follow");
const { sendFlightNotification } = require("../services/sendFlightNotification");

const notifiedEvents = new Set();

cron.schedule("* * * * *", async () => {
  const now = new Date();
  console.log(" Cron running:", now.toLocaleString("en-US", { timeZone: "Asia/Kolkata" }));

  try {

    const followRecords = await Follow.find({ isNotify: true }).populate("following", "_id");
    if (followRecords.length === 0) return;

    const uniquePilotIds = [...new Set(followRecords.map(r => r.following?._id.toString()))];
    console.log(` Updating data for ${uniquePilotIds.length} pilots...`);

    for (const pilotId of uniquePilotIds) {
      if (!pilotId) continue;

      try {
        await axios.post(`http://127.0.0.1:5000/api/flights/trigger-flight-notification`, {
        // await axios.post(`${process.env.Host_URL}/api/flights/trigger-flight-notification`, {
          userId: pilotId
        });
        console.log(` Updated flight data for pilot ${pilotId}`);
      } catch (err) {
        console.error(` aaaaaUpdate failed for pilot ${pilotId}: ${err.message}  ${process.env.Host_URL}`);
      }
    }


    const updatedFollows = await Follow.find({ isNotify: true })
      .populate("follower", "firebaseToken fullName email _id")
      .populate("following", "_id fullName flightNumber flightStatus flightDateTime");

    for (const follow of updatedFollows) {
      const pilot = follow.following;
      const follower = follow.follower;

      if (!pilot || !follower || !follower.firebaseToken) continue;
      if (!pilot.flightStatus || !pilot.flightDateTime) continue;

      for (let i = 0; i < pilot.flightStatus.length; i++) {
        const status = pilot.flightStatus[i];
        const timeString = pilot.flightDateTime[i];
        if (!status || status === "no_data" || status === "error") continue;
        if (!timeString || timeString === "") continue;

        const eventTime = new Date(timeString);
        if (isNaN(eventTime.getTime())) continue;
        const diffMinutes = (now - eventTime) / (1000 * 60);
        const isRecent = diffMinutes >= -2 && diffMinutes <= 5;
        const eventKey = `${pilot._id}-${status}-${follower._id}-${timeString}`;

        if (isRecent && !notifiedEvents.has(eventKey)) {
          const flightIndex = Math.floor(i / 2);
          const flightNum = pilot.flightNumber[flightIndex] || pilot.flightNumber[0] || "Unknown";
          // console.log(`Notify ${follower.email}: ${status.toUpperCase()} for ${flightNum} @ ${timeString}`);
          await sendFlightNotification(
            follower,
            status,
            eventTime.toISOString(),
            pilot._id.toString(),
            pilot.fullName,
            follower.firebaseToken,
            flightNum
          );
          notifiedEvents.add(eventKey);
          setTimeout(() => notifiedEvents.delete(eventKey), 60 * 60 * 1000);
        }
      }
    }
  } catch (error) {
    console.error(" Cron error:", error.message);
  }
});