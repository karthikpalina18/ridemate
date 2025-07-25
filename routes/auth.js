// backend/routes/auth.js
const express = require('express');
const router = express.Router();
const { registerUser, loginUser } = require('../controllers/authController');

// Register Route
router.post('/signup', registerUser);

// Login Route
router.post('/login', loginUser);

module.exports = router;
