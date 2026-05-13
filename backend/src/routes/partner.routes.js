'use strict';

const express = require('express');
const asyncHandler = require('../utils/asyncHandler');
const { requireAuth, requirePartner } = require('../middleware/auth');
const { validate, requireParamUuid } = require('../middleware/validate');
const v = require('../validators/domain');

const dashboard = require('../controllers/dashboard.controller');
const partner = require('../controllers/partner.controller');
const credit = require('../controllers/credit.controller');
const financing = require('../controllers/financing.controller');
const notifications = require('../controllers/notifications.controller');
const profile = require('../controllers/profile.controller');

const router = express.Router();
router.use(requireAuth(), requirePartner);

router.get('/dashboard', asyncHandler(dashboard.partnerDashboard));
router.patch('/profile', validate(v.updateProfile), asyncHandler(profile.updateProfile));

// Borrower search + credit reports
router.get('/search', asyncHandler(partner.search));
router.get('/portfolio', asyncHandler(partner.portfolio));
router.get('/watchlist', asyncHandler(partner.watchlist));

router.get('/credit/farmers/:farmerId/report', requireParamUuid('farmerId'), asyncHandler(credit.farmerCreditReport));
router.get('/credit/cooperatives/:cooperativeId/report', requireParamUuid('cooperativeId'), asyncHandler(credit.cooperativeCreditReport));

// Financing requests forwarded to this partner
router.get('/financing-requests', validate(v.listQuery, 'query'), asyncHandler(financing.list));
router.get('/financing-requests/:requestId', requireParamUuid('requestId'), asyncHandler(financing.getById));
router.post('/financing-requests/:requestId/decision', requireParamUuid('requestId'), validate(v.partnerDecideFinancing), asyncHandler(financing.partnerDecide));

// Notifications
router.get('/notifications', asyncHandler(notifications.list));
router.get('/notifications/unread-count', asyncHandler(notifications.unreadCount));
router.patch('/notifications/:notificationId/read', requireParamUuid('notificationId'), asyncHandler(notifications.markRead));
router.patch('/notifications/read-all', asyncHandler(notifications.markAllRead));

module.exports = router;
