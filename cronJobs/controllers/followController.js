const Follow = require('../models/Follow');
const User = require('../models/User');
const mongoose = require('mongoose');
const admin = require("../firebase/firebaseSetup");
const { project_id } = require("../firebase/serviceAccountKey.json");
const Notification = require('../models/Notification');
const url = `https://fcm.googleapis.com/v1/projects/${project_id ?? ""}/messages:send`
  console.log("6666666:", url);

/**
 * @desc    Get all pending follow requests for the logged-in user
 * @route   GET /api/follow/requests
 * @access  Private
 */
exports.getFollowRequests = async (req, res, next) => {
  try {
    const requests = await Follow.find({
      following: req.user.id,
      status: 'pending',
    }).populate({
      path: 'follower',
      select: 'fullName email'
    }).select('-isNotify -__v -updatedAt')

    res.status(200).json({
      status: true,
      message: 'Pending follow requests fetched successfully.',
      data: requests
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch follow requests.',
      error: error.message
    });
  }
};

/**
 * @desc    Send a follow request to another user
 * @route   POST /api/follow
 * @access  Private
 */
exports.sendFollowRequest = async (req, res, next) => {
  const { follow_email_or_id } = req.body;
  const followerId = req.user.id;
  try {
    let query;
    if (mongoose.Types.ObjectId.isValid(follow_email_or_id)) {
      query = { $or: [{ _id: follow_email_or_id }, { email: follow_email_or_id }] };
    } else {
      query = { email: follow_email_or_id };
    }

    const userToFollow = await User.findOne(query);

    if (!userToFollow || !req.user) {
      return res.status(404).json({
        status: false,
        message: 'Your Email or User to follow does not exist.'
      });
    }

    const followingId = userToFollow._id;

    if (followerId.toString() === followingId.toString()) {
      return res.status(400).json({
        status: false,
        message: 'You cannot follow yourself.'
      });
    }

    const existingFollow = await Follow.findOne({ follower: followerId, following: followingId });

    if (existingFollow) {
      return res.status(400).json({
        status: false,
        message: `You are already ${existingFollow.status === 'pending' ? 'requesting to follow' : 'following'} this user.`
      });
    }
    
    const title=`${req?.user?.fullName} has sent you a follow request`
    const body = 'Tap to accept the request'
    if(userToFollow?.firebaseToken !== "" && userToFollow?.firebaseToken !== undefined){
      const result = await sendPushNotification(userToFollow?.firebaseToken, title, body, url);
      if (result?.message === 'Failed to send follow request.') {
        return res.status(404).json({
          status: false,
          message: 'Failed to send notification.',
          error: "Firebase token is not valid"
        });
      }
    }
    await Follow.create({ follower: followerId, following: followingId });
    await Notification.insertOne({
      user: followingId,
      title,
      message: body,
      type: "follow_request",
      meta_data: {
        fullName: req?.user?.fullName,
        email: req?.user?.email
      }
    });
    res.status(201).json({
      status: true,
      message: 'Follow request sent successfully.'
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to send follow request.',
      error: error.message
    });
  }
};

// SEND_PUSH_NOTIFICATION
const sendPushNotification = async (fcmToken, title, body, url) => {
  const message = {
    token: fcmToken, // or use tokens: [token1, token2] for multiple
    // token: fcmToken, // or use tokens: [token1, token2] for multiple
    notification: {
      title,
      body,
    },
    data: {
      click_action: 'FLUTTER_NOTIFICATION_CLICK', // for Android
      url, // Custom URL you want to open
      type: "follow"
    },
  };


  console.log("message:", message);
  try {
    const response = await admin.messaging().send(message);
  
    return response;
  } catch (error) {
    console.error('Error sending message:', error);
    if (error?.message === 'Requested entity was not found' || error?.message === 'Exactly one of topic, token or condition is required') {
      return ({
        status: false,
        message: 'Failed to send follow request.',
        error: "Firebase token is not valid"
      });
    }
    
    throw error;
  }
};

/**
 * @desc    Accept or reject a pending follow request
 * @route   PUT /api/follow/requests/:requestId
 * @access  Private
 */
exports.respondToRequest = async (req, res, next) => {
  try {
    const { requestId } = req.params;
    const { action } = req.body;
    const loggedInUserId = req.user.id;

    const request = await Follow.findById(requestId);

    if (!request) {
      return res.status(404).json({
        status: false,
        message: 'Follow request not found.'
      });
    }

    if (request.following.toString() !== loggedInUserId.toString()) {
      return res.status(401).json({
        status: false,
        message: 'Not authorized to perform this action.'
      });
    }

    if (action === 'accept') {
      request.status = 'accepted';
      await request.save();
      res.status(200).json({
        status: true,
        message: 'Follow request accepted.'
      });
    } else if (action === 'reject') {
      await Follow.findByIdAndDelete(requestId)
      res.status(200).json({
        status: true,
        message: 'Follow request rejected.'
      });
    } else {
      return res.status(400).json({
        status: false,
        message: 'Invalid action specified.'
      });
    }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to respond to follow request.',
      error: error.message
    });
  }
};

/**
 * @desc    Unfollow a user or delete a follower (force unfollow)
 * @route   DELETE /api/follow/:userId
 * @access  Private
 */
exports.unfollowOrDelete = async (req, res, next) => {
  try {
    const { userId } = req.params;
    const loggedInUserId = req.user.id;

    const user = await Follow.findOne({ following: loggedInUserId })

    if (user.status === 'pending') {
      return res.status(404).json({status: false, message: `No follower found`})
    }
    const result = await Follow.deleteOne({
      $or: [
        { follower: loggedInUserId, following: userId },
        { follower: userId, following: loggedInUserId }
      ]
    });

    if (result.deletedCount === 0) {
      return res.status(404).json({
        status: false,
        message: 'Follow relationship not found.'
      });
    }

    res.status(200).json({
      status: true,
      message: 'Follow relationship removed.'
    });

  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to remove follow relationship.',
      error: error.message
    });
  }
};

/**
 * @desc    Get all following user list
 * @route   GET /api/follow/following/:userId
 * @access  Private
 */
// exports.getFollowingUser = async (req, res, next) => {
//   try {
    
//     const followDocs = await Follow.find({
//       follower: req.params.userId,
//       status: "accepted",
//       following: { $ne: null },
//       }).select("following").populate({
//         path: 'following',
//         select: {
//           password: 0,
//           confirmPassword: 0,
//           firebaseToken: 0,
//           sessionUuid: 0,
//           resetPasswordOtp: 0,
//           resetPasswordOtpExpires: 0,
//           appleUserId: 0,
//           identityToken: 0,
//         }
//       });

//     const followingUsers = followDocs
//       .filter(doc => doc.following) 
//       .map(doc => {
//         const userObj = doc.following.toObject();
//         userObj.isNotify = doc.following?.isNotify;
//         return userObj;
//       });
      
//       // const followingUsers = followDocs.map(doc => doc.following).filter(Boolean); 

//       const responseData = followingUsers.map(user => {
//         const { airline, ...rest } = user
//         return {
//           ...rest,
//           airlineName: airline,
//         };
//       })

//     res.status(200).json({
//       status: true,
//       message: 'Following users fetched successfully.',
//       data: responseData
//     });
//   } catch (error) {
//     res.status(500).json({
//       status: false,
//       message: 'Failed to fetch following.',
//       error: error.message
//     });
//   }
// };
exports.getFollowingUser = async (req, res, next) => {
  try {
    const followDocs = await Follow.find({
      follower: req.params.userId,
      status: "accepted",
      following: { $ne: null },
    })
    // FIX 1: Select 'isNotify' and 'updatedAt' from the Follow table
    .select("following isNotify updatedAt") 
    .populate({
      path: 'following',
      select: {
        password: 0,
        confirmPassword: 0,
        firebaseToken: 0,
        sessionUuid: 0,
        resetPasswordOtp: 0,
        resetPasswordOtpExpires: 0,
        appleUserId: 0,
        identityToken: 0,
      }
    });

    const followingUsers = followDocs
      .filter(doc => doc.following)
      .map(doc => {
        // Convert the User profile to an object
        const userObj = doc.following.toObject();

        // FIX 2: Get 'isNotify' from the FOLLOW document (the relationship), NOT the user profile
        userObj.isNotify = doc.isNotify; 

        // FIX 3: Overwrite 'updatedAt' with the date the FOLLOW/NOTIFICATION status changed
        // This stops showing the old User Profile date or the midnight reset date.
        userObj.updatedAt = doc.updatedAt; 

        return userObj;
      });

    const responseData = followingUsers.map(user => {
      const { airline, ...rest } = user
      return {
        ...rest,
        airlineName: airline,
      };
    })

    res.status(200).json({
      status: true,
      message: 'Following users fetched successfully.',
      data: responseData
    });
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch following.',
      error: error.message
    });
  }
};
/**
 * @desc    Get all follower user list
 * @route   GET /api/follow/follower/:userId
 * @access  Private
 */
exports.getFollowerUser = async (req, res, next) => {
  try {
    const user = await Follow.find({following: req.params.userId, status: "accepted", follower: { $ne: null }}).populate('follower', 'email fullName');
    if (user) {
      res.status(200).json({
        status: true,
        message: 'Follower users fetched successfully.',
        data: user
      });
    }else{
       res.status(404).json({
        status: false,
        message: 'Follower not found.',
        data: []
      });
    }
    
    // console.log(user,"user",req.params.userId);
    
    // if (user) {
    //   const followDocs = await Follow.find({
    //     following: req.params.userId,
    //     follower: { $ne: null }
    //   }).populate({
    //     path: 'follower',
    //     select: {
    //       password: 0,
    //       confirmPassword: 0,
    //       firebaseToken: 0,
    //       sessionUuid: 0,
    //       resetPasswordOtp: 0,
    //       resetPasswordOtpExpires: 0,
    //       appleUserId: 0,
    //       identityToken: 0,
    //     }
    //   });

    //   const followerUsers = followDocs.map(doc => doc.follower).filter(Boolean); 

    //   const responseData = followerUsers.map(user => {
    //     const { airline, ...rest } = user.toObject();
    //     return {
    //       ...rest,
    //       airlineName: airline,
    //     };
    //   })

    //   res.status(200).json({
    //     status: true,
    //     message: 'Follower users fetched successfully.',
    //     data: responseData
    //   });
    // }else{
    //   res.status(404).json({
    //     status: false,
    //     message: 'Follower not found.',
    //     data: []
    //   });
    // }
  } catch (error) {
    res.status(500).json({
      status: false,
      message: 'Failed to fetch followers.',
      error: error.message
    });
  }
};