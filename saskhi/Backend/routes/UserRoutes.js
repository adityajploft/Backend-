const express = require('express');
const router = express.Router()
const UserController = require('../controllers/UserController');
const {verifyUser, verifyAdmin} = require('../utils/middleware')


router
.post('/register', UserController.register )
.post('/login', UserController.register )
.get('/profile', [verifyUser], UserController.myProfile)
.get('/users', [verifyAdmin], UserController.usersList)

module.exports = router;
