'use strict';

const Joi = require('joi');

const uuid = Joi.string().guid({ version: ['uuidv4', 'uuidv1'] });
const gpsLat = Joi.number().min(-90).max(90);
const gpsLng = Joi.number().min(-180).max(180);

// =============================================================================
// COOPERATIVES
// =============================================================================
const createCooperative = Joi.object({
  name: Joi.string().min(2).max(150).required(),
  registrationNumber: Joi.string().max(60).optional(),
  leaderName: Joi.string().max(120).optional(),
  leaderPhone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional(),
  cropsSupported: Joi.array().items(Joi.string()).default([]),
  state: Joi.string().required(),
  lga: Joi.string().required(),
  address: Joi.string().max(500).optional(),
  estimatedLandSize: Joi.number().min(0).optional(),
  logoUrl: Joi.string().uri().optional(),
  gpsLat: gpsLat.optional(),
  gpsLng: gpsLng.optional(),
  gpsPolygon: Joi.array().items(Joi.object({ lat: gpsLat, lng: gpsLng })).optional(),
});

const updateCooperative = createCooperative.fork(Object.keys(createCooperative.describe().keys), (s) => s.optional());

// =============================================================================
// FARMERS
// =============================================================================
const createFarmer = Joi.object({
  cooperativeId: uuid.required(),
  fullName: Joi.string().min(2).max(150).required(),
  dateOfBirth: Joi.date().iso().less('now').optional(),
  gender: Joi.string().valid('male', 'female', 'other').optional(),
  phone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional(),
  altPhone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional(),
  address: Joi.string().max(500).optional(),
  state: Joi.string().optional(),
  lga: Joi.string().optional(),
  householdSize: Joi.number().integer().min(1).default(1),
  dependents: Joi.number().integer().min(0).default(0),
  educationLevel: Joi.string().max(60).optional(),
  nin: Joi.string().pattern(/^\d{11}$/).optional(),
  bvn: Joi.string().pattern(/^\d{11}$/).optional(),
  idImageUrl: Joi.string().uri().optional(),
  farmerPhotoUrl: Joi.string().uri().optional(),
  // Nested farm profile
  farm: Joi.object({
    farmSizeAcres: Joi.number().min(0).required(),
    cropType: Joi.string().required(),
    secondaryCrops: Joi.array().items(Joi.string()).optional(),
    soilType: Joi.string().optional(),
    irrigationAccess: Joi.boolean().default(false),
    waterSource: Joi.string().optional(),
    landOwnership: Joi.string().optional(),
    yearsExperience: Joi.number().integer().min(0).default(0),
    gpsLat: gpsLat.optional(),
    gpsLng: gpsLng.optional(),
    gpsPolygon: Joi.array().items(Joi.object({ lat: gpsLat, lng: gpsLng })).optional(),
    landDocumentUrl: Joi.string().uri().optional(),
    landDocumentType: Joi.string().optional(),
    farmPhotoUrls: Joi.array().items(Joi.string().uri()).optional(),
  }).optional(),
});

const updateFarmer = createFarmer.fork(Object.keys(createFarmer.describe().keys), (s) => s.optional());

// =============================================================================
// DELIVERIES
// =============================================================================
const createDelivery = Joi.object({
  farmerId: uuid.required(),
  cooperativeId: uuid.optional(),
  crop: Joi.string().required(),
  quantityKg: Joi.number().positive().required(),
  qualityGrade: Joi.string().valid('A', 'B', 'C', 'D').optional(),
  pricePerKg: Joi.number().min(0).optional(),
  dateDelivered: Joi.date().iso().max('now').optional(),
  receiptNumber: Joi.string().max(60).optional(),
  proofPhotoUrls: Joi.array().items(Joi.string().uri()).optional(),
  notes: Joi.string().max(500).optional(),
});

// =============================================================================
// FINANCING
// =============================================================================
const createFinancingRequest = Joi.object({
  cooperativeId: uuid.required(),
  farmerId: uuid.optional(),
  loanAmount: Joi.number().positive().required(),
  purpose: Joi.string().max(500).required(),
  season: Joi.string().valid('wet', 'dry', 'all_year').required(),
  repaymentWindowDays: Joi.number().integer().min(30).max(540).default(180),
});

const adminDecideFinancing = Joi.object({
  decision: Joi.string().valid('approved', 'rejected', 'disbursed').required(),
  approvedAmount: Joi.number().positive().optional(),
  rejectionReason: Joi.string().max(500).when('decision', { is: 'rejected', then: Joi.required() }),
  adminComments: Joi.string().max(500).optional(),
  forwardToPartnerId: uuid.optional(),
  dueDate: Joi.date().iso().optional(),
});

const partnerDecideFinancing = Joi.object({
  decision: Joi.string().valid('approved', 'rejected').required(),
  approvedAmount: Joi.number().positive().optional(),
  partnerComments: Joi.string().max(500).optional(),
  rejectionReason: Joi.string().max(500).when('decision', { is: 'rejected', then: Joi.required() }),
});

// =============================================================================
// REPAYMENTS
// =============================================================================
const createRepayment = Joi.object({
  financingRequestId: uuid.required(),
  farmerId: uuid.required(),
  amountPaid: Joi.number().positive().required(),
  paymentDate: Joi.date().iso().max('now').optional(),
  paymentMethod: Joi.string().valid('cash', 'bank_transfer', 'mobile_money', 'in_kind').required(),
  referenceNumber: Joi.string().max(100).optional(),
  proofPhotoUrl: Joi.string().uri().optional(),
  contextFlag: Joi.string().valid('none', 'weather', 'market', 'health').default('none'),
  contextNotes: Joi.string().max(500).optional(),
});

// =============================================================================
// PRODUCTION (yield)
// =============================================================================
const createProduction = Joi.object({
  farmerId: uuid.required(),
  cycleNumber: Joi.number().integer().min(1).default(1),
  season: Joi.string().required(),
  crop: Joi.string().required(),
  expectedPlantingDate: Joi.date().iso().optional(),
  expectedHarvestDate: Joi.date().iso().optional(),
  expectedYieldTonnes: Joi.number().min(0).optional(),
  actualYieldTonnes: Joi.number().min(0).optional(),
  benchmarkYieldTonnes: Joi.number().min(0).optional(),
  notes: Joi.string().max(500).optional(),
});

// =============================================================================
// WALLET / SETTLEMENT
// =============================================================================
const createSettlement = Joi.object({
  amount: Joi.number().positive().required(),
  bankName: Joi.string().required(),
  accountNumber: Joi.string().pattern(/^\d{10}$/).required(),
  accountName: Joi.string().required(),
});

// Save / update the agent's default bank account (mirrors settlement bank rules)
const saveBankAccount = Joi.object({
  bankName: Joi.string().min(2).max(120).required(),
  accountNumber: Joi.string().pattern(/^\d{10}$/).required(),
  accountName: Joi.string().min(2).max(120).required(),
});

// =============================================================================
// PARTNERS
// =============================================================================
const createPartner = Joi.object({
  organizationName: Joi.string().min(2).max(200).required(),
  organizationEmail: Joi.string().email().lowercase().required(),
  contactPhone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional(),
  address: Joi.string().max(500).optional(),
  state: Joi.string().optional(),
  logoUrl: Joi.string().uri().optional(),
  contactName: Joi.string().max(120).optional(),
});

const updatePartner = createPartner.fork(Object.keys(createPartner.describe().keys), (s) => s.optional());

// =============================================================================
// AGENT MANAGEMENT (admin)
// =============================================================================
const decideAgentApplication = Joi.object({
  decision: Joi.string().valid('approve', 'reject').required(),
  rejectionReason: Joi.string().max(500).when('decision', { is: 'reject', then: Joi.required() }),
});

const suspendAgent = Joi.object({
  reason: Joi.string().max(500).required(),
});

// =============================================================================
// PROFILE
// =============================================================================
const updateProfile = Joi.object({
  fullName: Joi.string().min(2).max(120).optional(),
  phone: Joi.string().pattern(/^\+?[0-9]{7,15}$/).optional(),
  state: Joi.string().optional(),
  lga: Joi.string().optional(),
  avatarUrl: Joi.string().uri().optional(),
});

// =============================================================================
// LIST / PAGINATION
// =============================================================================
// =============================================================================
// LIST / PAGINATION
// -----------------------------------------------------------------------------
// The web UI sends empty query params like ?search=&status=&tier= for filters
// the user hasn't set. Joi rejects '' for .string()/.valid()/.uuid() by
// default, which produced spurious 422 "Validation failed" responses on every
// admin list page. `.empty('')` converts an empty string to "absent" BEFORE
// the rule runs, so unset filters are simply ignored.
// =============================================================================
const listQuery = Joi.object({
  page: Joi.number().integer().min(1).default(1),
  pageSize: Joi.number().integer().min(1).max(100).default(20),
  search: Joi.string().max(120).empty('').optional(),
  status: Joi.string().empty('').optional(),
  cooperativeId: uuid.empty('').optional(),
  agentId: uuid.empty('').optional(),
  state: Joi.string().empty('').optional(),
  lga: Joi.string().empty('').optional(),
  crop: Joi.string().empty('').optional(),
  tier: Joi.string().valid('A', 'B', 'C', 'D').empty('').optional(),
  startDate: Joi.date().iso().empty('').optional(),
  endDate: Joi.date().iso().empty('').optional(),
}).options({ stripUnknown: true });

module.exports = {
  createCooperative,
  updateCooperative,
  createFarmer,
  updateFarmer,
  createDelivery,
  createFinancingRequest,
  adminDecideFinancing,
  partnerDecideFinancing,
  createRepayment,
  createProduction,
  createSettlement,
  saveBankAccount,
  createPartner,
  updatePartner,
  decideAgentApplication,
  suspendAgent,
  updateProfile,
  listQuery,
};
