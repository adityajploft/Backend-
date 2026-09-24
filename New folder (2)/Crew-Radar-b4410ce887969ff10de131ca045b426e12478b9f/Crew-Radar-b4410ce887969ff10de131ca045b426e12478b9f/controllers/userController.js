const Follow = require('../models/Follow');
const User = require('../models/User');
const admin = require("../firebase/firebaseSetup");
const { project_id } = require("../firebase/serviceAccountKey.json");
const Notification = require('../models/Notification');
const CalenderDayOff = require('../models/CalenderDayOff');
const url = `https://fcm.googleapis.com/v1/projects/${project_id ?? ""}/messages:send`
const mongoose = require("mongoose")
// 4. Update User Preferences
exports.updatePreferences = async (req, res) => {
  const { allowCalendarAccess, allowNotifications, allowContactsAccess } = req.body;
  const userId = req.user.id; // From authMiddleware

  try {
    const user = await User.findById(userId);

    if (!user) {
      return res.status(404).json({ status: false, message: 'User not found' });
    }

    user.preferences.allowCalendarAccess = allowCalendarAccess ?? user.preferences.allowCalendarAccess;
    user.preferences.allowNotifications = allowNotifications ?? user.preferences.allowNotifications;
    user.preferences.allowContactsAccess = allowContactsAccess ?? user.preferences.allowContactsAccess;

    const updatedUser = await user.save();

    res.json({
      status: true,
      message: 'Preferences updated successfully.',
      preferences: updatedUser.preferences,
    });
  } catch (error) {
    res.status(500).json({ status: false, message: 'Server Error' });
  }
};

exports.deleteAccount = async (req, res) => {
  const userId = req.params.id;
  try {
    const deleteFollowData = await Follow.deleteMany({ $or: [{ follower: userId }, { following: userId }] });
    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ status: false, message: "User not found" });
    }

    await User.findByIdAndDelete(userId);
    res.status(200).json({ status: true, message: 'Your account has been permanently deleted.' });
  } catch (error) {
    console.error('[DELETE ACCOUNT ERROR]:', error);
    res.status(500).json({ status: false, error: 'An unexpected server error occurred while deleting your account.' })
  }
};

/**
 * @desc    POST mark a day off
 * @route   POST /api/user/day-off
 * @access  Private
 */
exports.setUserPayOff = async (req, res, next) => {
  const { isDayOff } = req.body
  try {

    // const followerUsers = await Follow.find({
    //   following: req.user._id,
    //   follower: { $ne: null }, // exclude null followers
    // })
    //   .populate({
    //     path: 'follower',
    //     match: {} | null, // optional: add conditions if needed
    //   })
    //   .then(follows => follows
    //     .filter(f => f.follower) // ensure only non-null populated users
    //     .map(f => f.follower)    // return just the populated user
    //   );

    const followerUsers = await Follow.find({
      following: req.user._id,
      status: "accepted",
      follower: { $ne: null }
    }).populate("follower", "email fullName token firebaseToken");

    const title = `The pilot has a day off today.`
    const body = 'The pilot you follow is taking a day off today. We’ll notify you when they’re back in the air!'
    if (isDayOff === "true" || isDayOff === true) {
      let fcmToken = followerUsers?.map((val) => ({ userId: val?.follower?._id, email: val?.follower?.email, token: val?.follower?.firebaseToken }));
      await sendMultiplePushNotification(fcmToken, followerUsers, title, body, url);

      followerUsers?.forEach(async (user) => {
        const notification = await Notification.insertOne({
          user: user?.follower?._id,
          title,
          message: body,
          type: "flight_dayoff_notification",
          meta_data: {
            pilotId: req?.user?._id,
            isDayOff: true
          }
        });
      })
      return res.status(200).json({
        status: true,
        message: 'Dayoff applied successfully.',
      });
    } else {
      return res.status(200).json({
        status: false,
        message: 'No dayoff applied yet.',
      })
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch data.',
      error: error.message
    });
  }
};

exports.setFlightNumber = async (req, res, next) => {
  const flightNumber = req.body.flightNumber
  const userId  = req.params.id

  if(!userId){
    return res.status(404).json({status: false, message:"Invalid URL"})
  }
  
  if(!flightNumber){
    return res.status(404).json({status: false, message:"Field flightNumber is required"})
  }

  if(!Array.isArray(flightNumber)){
    return res.status(404).json({status: false, message:"Field flightNumber must be array"})
  }

  try {
    await User.findOneAndUpdate({_id:userId}, {$set:{flightNumber}})
    res.status(200).json({status: true, message:"Updated the flight number"})
    
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to set payload.',
      error: error.message
    });
  }
};

// SEND_PUSH_NOTIFICATION
const sendMultiplePushNotification = async (fcmToken, followerUsers, title, body, url) => {
  const message = fcmToken?.map((val) => ({
    token: val?.token, // or use tokens: [token1, token2] for multiple
    notification: {
      title,
      body,
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // for Android
      url,
      type: "dayOff"
    },
  }))

  try {
    const response = admin.messaging().sendEach(message)

    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    throw error;
  }
};

// SEND_PUSH_NOTIFICATION (single device)
// SEND_PUSH_NOTIFICATION (single device)
const sendPushNotification = async (fcmToken, title, body, url, flightStatus, flightDateTime) => {
  const message = {
    token: fcmToken,
    notification: {
      title,
      body,
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // required for Android
      type: 'flight_alert',
      url,
      flightStatus: JSON.stringify(flightStatus || ''),
      flightDateTime: JSON.stringify(flightDateTime || ''),
    },
  };

  try {
    const response = await admin.messaging().send(message);
    console.log('Push notification sent successfully:', response);
    return response;
  } catch (error) {
    console.error('Error sending push notification:', error);
    throw error;
  }
};



/**
 * @desc    POST flight notifications to Login Pilot User's Follower 
 * @route   POST /api/user/flight-notification
 * @access  Private
 */

exports.notifyFollowersOfFlightEvent = async (req, res) => {
  try {
    const pilotId = req?.user?.id;
    let { flightStatus, flightDateTime, isNotify, followingId } = req.body;
    const formatflightStatus = String(flightStatus).replace(/[\[\]"]/g, '');
    const formatflightDateTime = new Date(
    String(flightDateTime).replace(/[\[\]"]/g, '')
    ).toLocaleString('en-GB', { timeZone: 'UTC' });
    
    const updatePilotFlightTime = await User.findByIdAndUpdate(pilotId, { $set: { flightStatus, flightDateTime } }, { new: true })
    if (updatePilotFlightTime) {
      await Follow.updateOne(
        { following: followingId, follower: pilotId },
        { $set: { isNotify } }
      );
      if (isNotify) {
        await User.updateOne(
          { _id: followingId },
          { $set: { isNotify: true } }
        );
      }

      const notificationSentToFollower = await Follow.find({ following: followingId, isNotify: true }).populate("follower", "fullName firebaseToken email flightStatus flightDateTime")

      for (const follow of notificationSentToFollower) {
        const follower = follow.follower;
        if (follower.firebaseToken) {

         const sent =  await sendPushNotification(
            follower.firebaseToken,
            `Flight ${formatflightStatus} Notification`,
            `${updatePilotFlightTime.fullName}’s flight is ${formatflightStatus} at ${new Date(formatflightDateTime).toLocaleString()}`,
            url,
            flightStatus,
            flightDateTime,
          )
          // (fcmToken, title, body, url, flightStatus, flightDateTime) 
          // await this.sendPushNotificationToFlight(
          //   follower.firebaseToken,
          //   `Flight ${flightStatus} Notification`,
          //   `${updatePilotFlightTime.fullName}’s flight is ${flightStatus} at ${new Date(flightDateTime).toLocaleString()}`,
          //   url,
          //   flightStatus,
          //   flightDateTime,
          // );
          console.log(`Immediate notification sent to ${follower.email}`);
        }
      }
    }
    return res.status(201).json({
      status: true,
      message: 'Flight notification alerts are now active.',
    });

  } catch (error) {
    console.error('❌ Notification Error:', error);
    return res.status(500).json({
      status: false,
      message: 'An unexpected error occurred during the notification process.',
      error: error.message
    });
  }
}

exports.getAirLineLists = async (req, res) => {
  try {
    const response = {
      "status": true,
      "message": "Airline list fetched successfully",
      "data": [
        {
          "id": 1,
          "airline_code": "EZY",
          "airline_name": "EasyJet"
        }
      ]
    }

    return res.status(200).json(response)
  } catch (error) {
    console.error('Error fetching list:', error);
    throw error;
  }
};

exports.calenderDayOff = async (req, res) => {
 try {
    const data = req.body;

    if (!Array.isArray(data) || data.length < 1) {
      return res.status(404).json({
        status: false,
        message: "Data cannot be empty",
      });
    }

    // Get the userId from the first element (assuming all objects have same userId)
    const userId = data[0].userId;
    const objectId = new mongoose.Types.ObjectId(userId);

    // Delete all previous records for this user
    await CalenderDayOff.deleteMany({ userId: objectId });

    // Insert new data
    // Make sure to convert userId in each object to ObjectId
    const dataToInsert = data.map(item => ({
      ...item,
      userId: new mongoose.Types.ObjectId(item.userId),
    }));

    await CalenderDayOff.insertMany(dataToInsert);

    return res.status(201).json({
      status: true,
      message: "Data added successfully.",
    });
  } catch (error) {
    console.error("Error saving day offs:", error);
    return res.status(500).json({
      status: false,
      message: "Server error while saving day offs",
      error: error.message,
    });
  }
}

exports.calenderDayOffList = async (req, res) => {
  try {
    const { userId } = req.params;

    // Check if the user has any accepted followers
    const hasFollowers = await Follow.exists({ following: userId, status: "accepted" });
    if (!hasFollowers) {
      return res.status(404).json({
        status: false,
        message: "No followers found.",
        data: [],
      });
    }

    // Fetch all follower IDs
    const followDocs = await Follow.find({
      following: userId,
      follower: { $ne: null },
      status: "accepted",
    }).select("follower -_id");

    const followerIds = followDocs.map(doc => doc.follower);

    // Fetch day off data for all followers and populate only required user fields
    const dayOffListData = await CalenderDayOff.find({
      userId: { $in: followerIds },
    }).populate({
      path: "userId",
      select: "_id fullName email",
    });

    return res.status(200).json({
      status: true,
      message: "Follower IDs fetched successfully.",
      data: dayOffListData,
    });
  } catch (error) {
    console.error("Error fetching followers:", error);
    return res.status(500).json({
      status: false,
      message: "Server error while fetching followers.",
      error: error.message,
    });
  }
};
