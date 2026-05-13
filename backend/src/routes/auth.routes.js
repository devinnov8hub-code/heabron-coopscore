'use strict';

const express = require('express');
const ctrl = require('../controllers/auth.controller');
const asyncHandler = require('../utils/asyncHandler');
const { validate } = require('../middleware/validate');
const { requireAuth } = require('../middleware/auth');
const { authLimiter, otpLimiter } = require('../middleware/rateLimit');
const v = require('../validators/auth');

const router = express.Router();

router.post('/signup', authLimiter, validate(v.signupStep1), asyncHandler(ctrl.signupStep1));
router.post('/verify-otp', authLimiter, validate(v.verifyOtp), asyncHandler(ctrl.verifySignupOtp));
router.post('/resend-otp', otpLimiter, validate(v.resendOtp), asyncHandler(ctrl.resendOtp));
router.post('/signup/complete', requireAuth({ requireActive: false }), validate(v.signupComplete), asyncHandler(ctrl.completeSignup));

router.post('/login', authLimiter, validate(v.login), asyncHandler(ctrl.login));
router.post('/refresh', validate(v.refresh), asyncHandler(ctrl.refresh));
router.post('/logout', requireAuth({ requireActive: false }), asyncHandler(ctrl.logout));

router.post('/forgot-password', authLimiter, validate(v.forgotPassword), asyncHandler(ctrl.forgotPassword));
router.post('/reset-password', authLimiter, validate(v.resetPassword), asyncHandler(ctrl.resetPassword));
router.post('/change-password', requireAuth({ requireActive: false }), validate(v.changePassword), asyncHandler(ctrl.changePassword));

router.get('/me', requireAuth({ requireActive: false }), asyncHandler(ctrl.me));

module.exports = router;
