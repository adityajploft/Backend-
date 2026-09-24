const express = require('express');
const { protect } = require('../middleware/authMiddleware');
const {
  getFollowRequests,
  sendFollowRequest,
  respondToRequest,
  unfollowOrDelete,
  getFollowingUser,
  getFollowerUser
} = require('../controllers/followController');
const {
  sendFollowRequest: sendFollowValidator,
  respondToRequest: respondValidator
} = require('../requests/followRequest');

const router = express.Router();

// All follow routes are protected
router.use(protect);

router.route('/')
  .post(sendFollowValidator, sendFollowRequest);

router.route('/requests')
  .get(getFollowRequests);

router.route('/requests/:requestId')
  .put(respondValidator, respondToRequest);

router.route('/:userId')
  .delete(unfollowOrDelete);

router.route('/following/:userId')
  .get(getFollowingUser);

router.route('/follower/:userId')
  .get(getFollowerUser);

module.exports = router;