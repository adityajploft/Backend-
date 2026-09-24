const Notification = require('../models/Notification');
const { project_id } = require("../firebase/serviceAccountKey.json");
const admin = require("../firebase/firebaseSetup");

async function sendPushNotificationToFlight(fcmToken, title, body, flightStatus, flightDateTime, flightNumber) {

  // console.log("FCM Trigger. Token:", fcmToken ? fcmToken.substring(0, 10) + "..." : "UNDEFINED");

  if (!fcmToken) return null;

  const message = {
    token: fcmToken,
    notification: {
      title: title,
      body: body,
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK',
      type: 'flight_alert',
      flightStatus: String(flightStatus),
      flightDateTime: String(flightDateTime),
      flightNumber: String(flightNumber)
    },
    android: { priority: "high" },
    apns: { payload: { aps: { sound: "default" } } },
  };

  try {
    const response = await admin.messaging().send(message);
    // console.log('FCM Sent ID:', response);
    return response;
  } catch (error) {
    console.error('FCM Error:', error.message);
    return null;
  }
};

exports.sendFlightNotification = async (
  follower,    
  status,       
  timeStr,      
  pilotId,      
  pilotName,    
  fcmToken,    
  flightNumber
) => {

  const title = `Flight ${status.toUpperCase()}`;
  const messageBody = `${pilotName}'s flight (${flightNumber}) has ${status} at ${timeStr}`;

  // 1. Send Push
  await sendPushNotificationToFlight(
    fcmToken,
    title,
    messageBody,
    status,
    timeStr,
    flightNumber
  );

  // 2. Save to DB
  try {
    if (!follower || !follower._id) {
        throw new Error("Follower ID is missing. Cannot save to DB.");
    }

    await Notification.create({
      user: follower._id, 
      title: title,
      message: messageBody,
      type: "flight_notification",
      meta_data: {
        pilotId: String(pilotId),       
        flightStatus: String(status),
        flightDateTime: String(timeStr),
        flightNumber: String(flightNumber)
      }
    });
    // console.log(` DB Saved for ${follower.email}`);
  } catch (dbError) {
    console.error(" DB Save Error:", dbError.message);
  }
};