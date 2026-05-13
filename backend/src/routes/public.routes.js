'use strict';

const express = require('express');
const router = express.Router();
const config = require('../config');

router.get('/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'ok',
      service: 'heabron-coopscore-api',
      version: '1.0.0',
      env: config.env,
      timestamp: new Date().toISOString(),
    },
  });
});

router.get('/', (req, res) => {
  res.json({
    success: true,
    data: {
      name: 'Heabron CoopScore API',
      version: '1.0.0',
      docs: '/api/docs',
      health: '/api/health',
    },
  });
});

module.exports = router;
