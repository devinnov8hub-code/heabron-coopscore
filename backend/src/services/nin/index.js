'use strict';

const axios = require('axios');
const config = require('../../config');
const logger = require('../../utils/logger');

/**
 * NIN verification service.
 *
 * Provider: NINAuth (NIMC's official authentication service).
 *
 * NINAuth Overview
 * ----------------
 * NINAuth is NIMC's official, free-to-integrate platform for verifying NINs
 * across government and regulated services. Unlike commercial aggregators
 * (Prembly, Youverify, Smile, etc.) which charge per-lookup fees, NINAuth
 * is provided by NIMC directly. Organizations register at
 *   https://app.ninauth.nimc.gov.ng/developers
 * to obtain a Client ID and Client Secret.
 *
 * Integration notes:
 *   - NINAuth's API surface is OAuth2-style. Once approved, you receive
 *     client credentials that the backend uses to fetch a short-lived
 *     bearer token, then call the verification endpoint.
 *   - Until NIMC publishes complete public docs for every endpoint, the
 *     exact request/response shape may change. This wrapper isolates the
 *     rest of the system from those changes — only this file needs to be
 *     updated when the schema is finalised.
 *   - In dev mode (NIN_DEV_MODE=true with no credentials configured) the
 *     service returns a deterministic stub so the rest of the app can be
 *     exercised end-to-end without spending live verifications.
 *
 * Returned shape (always):
 *   {
 *     status: 'verified' | 'mismatch' | 'failed',
 *     reference: string|null,
 *     details: { firstName, lastName, middleName, gender, dateOfBirth,
 *                phone, photo, address } | null,
 *     raw: <provider response>
 *   }
 */

let cachedToken = null;
let cachedTokenExpiresAt = 0;

async function getNinAuthToken() {
  const { ninauth } = config.nin;
  if (!ninauth.clientId || !ninauth.clientSecret) {
    throw new Error('NINAuth client credentials not configured');
  }

  const now = Date.now();
  if (cachedToken && cachedTokenExpiresAt > now + 30_000) {
    return cachedToken;
  }

  const url = `${ninauth.baseUrl}/oauth/token`;
  const res = await axios.post(
    url,
    {
      grant_type: 'client_credentials',
      client_id: ninauth.clientId,
      client_secret: ninauth.clientSecret,
    },
    { timeout: 15_000 }
  );

  cachedToken = res.data.access_token;
  cachedTokenExpiresAt = now + (res.data.expires_in || 3600) * 1000;
  return cachedToken;
}

async function verifyWithNinAuth({ nin, firstName, lastName, dateOfBirth }) {
  const { ninauth } = config.nin;
  const token = await getNinAuthToken();

  const url = `${ninauth.baseUrl}/v1/verification/nin/match`;
  const body = {
    nin,
    firstname: firstName || undefined,
    surname: lastName || undefined,
    dateOfBirth: dateOfBirth || undefined,
  };

  const res = await axios.post(url, body, {
    timeout: 20_000,
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = res.data || {};
  const found = data.status === true || data.status === 'success' || data.statusCode === 200;
  if (!found) {
    return {
      status: 'failed',
      reference: data.reference || null,
      details: null,
      raw: data,
    };
  }

  const d = data.data || data;
  const details = {
    firstName: d.firstname || d.first_name,
    lastName: d.surname || d.last_name,
    middleName: d.middlename || d.middle_name,
    gender: d.gender,
    dateOfBirth: d.birthdate || d.date_of_birth,
    phone: d.telephoneno || d.phone || d.phone_number,
    photo: d.photo || d.image,
    address: d.residence_address || d.address || null,
  };

  // If caller provided names, decide match vs mismatch
  let status = 'verified';
  if (firstName && lastName) {
    const norm = (s) => (s || '').trim().toLowerCase();
    const fnMatch = norm(details.firstName).includes(norm(firstName)) || norm(firstName).includes(norm(details.firstName));
    const lnMatch = norm(details.lastName).includes(norm(lastName)) || norm(lastName).includes(norm(details.lastName));
    if (!(fnMatch && lnMatch)) status = 'mismatch';
  }

  return {
    status,
    reference: data.reference || data.reportID || null,
    details,
    raw: data,
  };
}

function devModeVerify({ nin, firstName, lastName }) {
  return {
    status: 'verified',
    reference: 'DEV-' + nin,
    details: {
      firstName: firstName || 'Test',
      lastName: lastName || 'User',
      middleName: 'Dev',
      gender: 'male',
      dateOfBirth: '1990-01-01',
      phone: '08000000000',
      photo: null,
      address: 'Lagos, Nigeria',
    },
    raw: { devMode: true, message: 'NIN_DEV_MODE=true — no provider call made' },
  };
}

/**
 * Public entry point used by controllers.
 */
async function verifyNin({ nin, firstName, lastName, dateOfBirth }) {
  if (!/^\d{11}$/.test(nin || '')) {
    return {
      status: 'failed',
      reference: null,
      details: null,
      raw: { error: 'NIN must be exactly 11 digits' },
    };
  }

  const { ninauth, provider } = config.nin;
  const hasCreds = ninauth.clientId && ninauth.clientSecret;

  if (config.nin.devMode || !hasCreds) {
    logger.warn(
      { devMode: config.nin.devMode, hasCreds },
      'verifyNin running in DEV mode — stub response'
    );
    return devModeVerify({ nin, firstName, lastName });
  }

  try {
    if (provider === 'ninauth') {
      return await verifyWithNinAuth({ nin, firstName, lastName, dateOfBirth });
    }
    throw new Error(`Unknown NIN provider: ${provider}`);
  } catch (err) {
    logger.error({ err: err.message, status: err.response?.status }, 'NIN verification error');
    return {
      status: 'failed',
      reference: null,
      details: null,
      raw: {
        error: err.message,
        providerStatus: err.response?.status,
        providerData: err.response?.data,
      },
    };
  }
}

module.exports = { verifyNin };
