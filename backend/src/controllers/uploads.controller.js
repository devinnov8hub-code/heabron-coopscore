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

async function signUrl(req, res) {
  const { bucket, path } = req.body;
  if (!bucket || !path) return badRequest(res, 'bucket and path required');
  const url = await getSignedUrl(bucket, path);
  return ok(res, { url });
}

module.exports = { uploadGeneric, signUrl, BUCKETS };
