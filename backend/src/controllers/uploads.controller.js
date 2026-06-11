'use strict';

const { uploadFile, getSignedUrl } = require('../services/storage');
const { ok, created, badRequest } = require('../utils/response');

const BUCKETS = {
  selfie: { bucket: 'agent-documents', folder: 'selfies', isPublic: false },
  farmer_id: { bucket: 'farmer-documents', folder: 'ids', isPublic: false },
  farmer_photo: { bucket: 'farmer-documents', folder: 'photos', isPublic: false },
  land_doc: { bucket: 'farmer-documents', folder: 'land-docs', isPublic: false },
  farm_photo: { bucket: 'farmer-documents', folder: 'farm-photos', isPublic: false },
  delivery_proof: { bucket: 'delivery-proofs', folder: '', isPublic: false },
  transaction_receipt: { bucket: 'transaction-receipts', folder: '', isPublic: false },
  partner_logo: { bucket: 'partner-logos', folder: '', isPublic: true },
  cooperative_logo: { bucket: 'partner-logos', folder: 'cooperatives', isPublic: true },
  avatar: { bucket: 'agent-documents', folder: 'avatars', isPublic: false },
};

async function uploadGeneric(req, res) {
  const kind = req.params.kind;
  const spec = BUCKETS[kind];
  if (!spec) return badRequest(res, `Unknown upload kind: ${kind}`);
  if (!req.file) return badRequest(res, 'No file uploaded (use field name "file")');

  const result = await uploadFile({
    bucket: spec.bucket,
    folder: spec.folder,
    file: req.file,
    isPublic: spec.isPublic,
  });
  return created(res, { kind, ...result });
}

/**
 * Restricted version used by the pre-activation /auth/uploads/:kind route.
 * Only kinds needed during signup (avatar, selfie) are allowed here so that
 * an account in pending/suspended state can't reach the broader upload set.
 */
const PRE_ACTIVATION_KINDS = new Set(['avatar', 'selfie']);
async function uploadPreActivation(req, res) {
  const kind = req.params.kind;
  if (!PRE_ACTIVATION_KINDS.has(kind)) {
    return badRequest(res, `Upload kind not allowed before activation: ${kind}`);
  }
  return uploadGeneric(req, res);
}

async function signUrl(req, res) {
  const { bucket, path } = req.body;
  if (!bucket || !path) return badRequest(res, 'bucket and path required');
  const url = await getSignedUrl(bucket, path);
  return ok(res, { url });
}

module.exports = { uploadGeneric, uploadPreActivation, signUrl, BUCKETS };
