import { z } from 'zod';

const WEB_URL = /^https?:\/\/\S+$/i;
const WEB_URL_MESSAGE = 'รูปแบบ URL ไม่ถูกต้อง (ต้องขึ้นต้นด้วย http:// หรือ https://)';
const DATE_MESSAGE = 'รูปแบบวันที่ไม่ถูกต้อง';
const MAX_AMOUNT = 9_999_999_999.99;

const shortText = z.string().max(255, 'ข้อความยาวเกิน 255 ตัวอักษร');
const longText = z.string().max(5000, 'ข้อความยาวเกิน 5,000 ตัวอักษร');
const amount = z.number().min(0, 'จำนวนเงินต้องไม่ติดลบ').max(MAX_AMOUNT, 'จำนวนเงินเกินกำหนด');
const isoDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, DATE_MESSAGE)
  .refine((value) => !Number.isNaN(Date.parse(value)), DATE_MESSAGE);

/** Row ids. Not z.uuid(): seed ids such as 40000000-0000-... aren't RFC 4122 versions. */
export const IdSchema = z
  .string()
  .regex(/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i, 'รหัสอ้างอิงไม่ถูกต้อง');

export const ReasonSchema = z
  .string()
  .trim()
  .min(1, 'กรุณาระบุเหตุผลในการดำเนินการ')
  .max(2000, 'เหตุผลยาวเกิน 2,000 ตัวอักษร');

export const InsurerSchema = z.object({
  name: shortText.trim().min(1, 'กรุณากรอกชื่อบริษัทประกันภัย'),
  contact_channels: z.string().max(1000, 'ข้อความยาวเกิน 1,000 ตัวอักษร').optional().nullable(),
  website: z
    .string()
    .trim()
    .max(2048, WEB_URL_MESSAGE)
    .regex(WEB_URL, WEB_URL_MESSAGE)
    .optional()
    .or(z.literal(''))
    .nullable(),
  is_active: z.boolean().default(true),
});

export const SaveInsurerSchema = InsurerSchema.extend({ id: IdSchema.optional() });

const priceOptionInput = z
  .object({
    // Client-side tier keys are allowed here: the store only honours ids already on this rule.
    id: z.string().max(64).optional(),
    label: shortText.optional(),
    repairType: z.enum(['dealer', 'garage']),
    priceType: z.enum(['starting', 'indicative', 'fixed_for_conditions', 'unknown']).optional(),
    premiumTotal: amount.nullable().optional(),
    sumInsuredMin: amount.nullable().optional(),
    sumInsuredMax: amount.nullable().optional(),
    deductibleAmount: amount.optional(),
    deductibleTerms: longText.optional(),
    driverConditions: longText.optional(),
    compulsoryIncluded: z.enum(['included', 'excluded', 'unspecified']).optional(),
    validFrom: isoDate.nullable().optional(),
    validTo: isoDate.nullable().optional(),
  })
  .refine(
    (o) => o.sumInsuredMin == null || o.sumInsuredMax == null || o.sumInsuredMax >= o.sumInsuredMin,
    { message: 'ทุนประกันสูงสุดต้องไม่น้อยกว่าทุนประกันขั้นต่ำ' }
  )
  .refine((o) => !o.validFrom || !o.validTo || o.validTo >= o.validFrom, {
    message: 'วันสิ้นสุดของราคาต้องไม่ก่อนวันเริ่มต้น',
  });

const coverageInput = z.object({
  code: z.string().max(64),
  status: z.enum(['covered', 'not_covered', 'optional', 'unknown']),
  limitAmount: amount.nullable().optional(),
  limitBasis: shortText.optional(),
  terms: longText.optional(),
  exclusions: longText.optional(),
});

/** Everything savePlanAction accepts. Fields it doesn't list are dropped. */
export const SavePlanSchema = z
  .object({
    planId: IdSchema.optional(),
    versionId: IdSchema.optional(),
    insurerId: IdSchema,
    name: shortText.trim().min(1, 'กรุณากรอกชื่อแพ็กเกจประกัน'),
    insuranceType: z.enum(['ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3']),
    workflowStatus: z.enum(['draft', 'in_review', 'published', 'archived']).optional(),
    effectiveFrom: isoDate.nullable().optional(),
    effectiveTo: isoDate.nullable().optional(),
    reviewDueAt: isoDate.nullable().optional(),
    notes: longText.optional(),
    scopeType: z.enum(['specific_model', 'all_models', 'unknown']).optional(),
    vehicleModelId: IdSchema.nullable().optional(),
    minCarAge: z.number().int().min(0, 'อายุรถต้องไม่ติดลบ').max(150).nullable().optional(),
    maxCarAge: z.number().int().min(0, 'อายุรถต้องไม่ติดลบ').max(150).nullable().optional(),
    ageBasis: z.enum(['registration_year', 'manufacture_year']).nullable().optional(),
    usageType: z.enum(['private', 'commercial', 'all']).nullable().optional(),
    registrationZone: z.enum(['all', 'bangkok_only', 'bangkok_metro', 'upcountry_only']).nullable().optional(),
    inspectionRequired: z.boolean().optional(),
    priceOptions: z.array(priceOptionInput).max(100, 'ตัวเลือกราคามากเกินไป').optional(),
    coverages: z.array(coverageInput).max(100, 'รายการความคุ้มครองมากเกินไป').optional(),
    sourceType: z.enum(['policy_schedule', 'rate_sheet', 'brochure', 'endorsement', 'manual_note', 'other']).optional(),
    documentTitle: shortText.optional(),
    documentRef: shortText.optional(),
    documentStoragePath: z
      .string()
      .max(1024)
      .regex(/^(?!\/)(?!.*\.\.)[\w./-]+$/, 'ตำแหน่งไฟล์เอกสารไม่ถูกต้อง')
      .nullable()
      .optional(),
    // Rendered as a link on the plan page, so anything else (javascript:) must not get through.
    documentSourceUrl: z
      .string()
      .max(2048, WEB_URL_MESSAGE)
      .regex(/^(https?:\/\/\S+|\/api\/documents\/[\w.-]+)$/i, WEB_URL_MESSAGE)
      .nullable()
      .optional(),
    documentFileSize: z.number().int().min(0).nullable().optional(),
    documentMimeType: shortText.nullable().optional(),
  })
  .refine((p) => !p.effectiveFrom || !p.effectiveTo || p.effectiveTo >= p.effectiveFrom, {
    message: 'วันสิ้นสุดผลบังคับใช้ต้องไม่ก่อนวันเริ่มต้น',
  })
  .refine((p) => p.minCarAge == null || p.maxCarAge == null || p.maxCarAge >= p.minCarAge, {
    message: 'อายุรถสูงสุดต้องไม่น้อยกว่าอายุรถขั้นต่ำ',
  })
  .refine((p) => p.scopeType !== 'specific_model' || Boolean(p.vehicleModelId), {
    message: 'กรุณาเลือกรุ่นรถสำหรับเงื่อนไขระบุรุ่นเฉพาะ',
  });

export const LoginSchema = z.object({
  email: z.string().trim().toLowerCase().min(1).max(255),
  // scrypt work grows with input, so cap what a request can make the server hash.
  password: z.string().min(1).max(1024),
});

export const AppRoleSchema = z.enum(['viewer', 'editor', 'reviewer', 'admin']);

export const PlanSchema = z.object({
  insurer_id: z.string().min(1, 'กรุณาเลือกบริษัทประกันภัย'),
  name: z.string().trim().min(1, 'กรุณากรอกชื่อแพ็กเกจประกัน'),
  insurance_type: z.enum(['ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3']),
});

export const PlanVersionSchema = z.object({
  plan_id: z.string().min(1),
  version_no: z.number().int().positive('หมายเลขเวอร์ชันต้องมากกว่า 0'),
  effective_from: z.string().optional().nullable(),
  effective_to: z.string().optional().nullable(),
  review_due_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(data => {
  if (data.effective_from && data.effective_to) {
    return new Date(data.effective_to) >= new Date(data.effective_from);
  }
  return true;
}, {
  message: 'วันสิ้นสุดผลบังคับใช้ต้องไม่ก่อนวันเริ่มต้น',
  path: ['effective_to']
});

export const EligibilityRuleSchema = z.object({
  plan_version_id: z.string().min(1),
  scope_type: z.enum(['specific_model', 'all_models', 'unknown']),
  vehicle_model_id: z.string().min(1).optional().nullable(),
  min_age: z.number().int().min(0, 'อายุรถต้องไม่ติดลบ').optional().nullable(),
  max_age: z.number().int().min(0, 'อายุรถต้องไม่ติดลบ').optional().nullable(),
  age_basis: z.enum(['registration_year', 'manufacture_year']).optional().nullable(),
  usage_type: z.enum(['private', 'commercial', 'all']).optional().nullable(),
  registration_zone: z
    .enum(['all', 'bangkok_only', 'bangkok_metro', 'upcountry_only'])
    .optional()
    .nullable(),
  inspection_required: z.boolean().optional().nullable(),
  notes: z.string().optional().nullable(),
}).refine(data => {
  if (data.scope_type === 'specific_model' && !data.vehicle_model_id) {
    return false;
  }
  return true;
}, {
  message: 'กรุณาเลือกรุ่นรถสำหรับเงื่อนไขระบุรุ่นเฉพาะ',
  path: ['vehicle_model_id']
}).refine(data => {
  if (data.min_age !== undefined && data.max_age !== undefined && data.min_age !== null && data.max_age !== null) {
    return data.max_age >= data.min_age;
  }
  return true;
}, {
  message: 'อายุรถสูงสุดต้องไม่น้อยกว่าอายุรถขั้นต่ำ',
  path: ['max_age']
});

export const PriceOptionSchema = z.object({
  eligibility_rule_id: z.string().min(1),
  label: z.string().trim().min(1, 'กรุณากรอกชื่อตัวเลือกราคา'),
  repair_type: z.enum(['dealer', 'garage']),
  price_type: z.enum(['starting', 'indicative', 'fixed_for_conditions', 'unknown']),
  net_premium: z.number().min(0, 'เบี้ยสุทธิต้องไม่ติดลบ').optional().nullable(),
  tax_stamp: z.number().min(0, 'ภาษี/อากรต้องไม่ติดลบ').optional().nullable(),
  premium_total: z.number().min(0, 'เบี้ยรวมต้องไม่ติดลบ').optional().nullable(),
  compulsory_included: z.enum(['included', 'excluded', 'unspecified']).default('unspecified'),
  sum_insured_min: z.number().min(0, 'ทุนประกันต้องไม่ติดลบ').optional().nullable(),
  sum_insured_max: z.number().min(0, 'ทุนประกันต้องไม่ติดลบ').optional().nullable(),
  deductible_amount: z.number().min(0, 'ค่าเสียหายส่วนแรกต้องไม่ติดลบ').default(0),
  deductible_terms: z.string().optional().nullable(),
  driver_conditions: z.string().optional().nullable(),
  valid_from: z.string().optional().nullable(),
  valid_to: z.string().optional().nullable(),
}).refine(data => {
  if (data.sum_insured_min !== null && data.sum_insured_min !== undefined && data.sum_insured_max !== null && data.sum_insured_max !== undefined) {
    return data.sum_insured_max >= data.sum_insured_min;
  }
  return true;
}, {
  message: 'ทุนประกันสูงสุดต้องไม่น้อยกว่าทุนประกันขั้นต่ำ',
  path: ['sum_insured_max']
});

export const ReviewActionSchema = z.object({
  plan_version_id: z.string().min(1),
  action: z.enum(['publish', 'reject']),
  reason: z.string().trim().min(1, 'กรุณาระบุเหตุผลในการดำเนินการ'),
});

export const SearchQuerySchema = z.object({
  query: z.string().optional(),
  insurerIds: z.array(z.string()).optional(),
  insuranceTypes: z.array(z.string()).optional(),
  repairTypes: z.array(z.string()).optional(),
  vehicleBrand: z.string().optional(),
  vehicleModelId: z.string().optional(),
  carAge: z.number().optional(),
  usageType: z.string().optional(),
  registrationPlate: z
    .enum(['bangkok', 'metro', 'upcountry', 'bangkok_only_strict'])
    .optional(),
  minPremium: z.number().optional(),
  maxPremium: z.number().optional(),
  minSumInsured: z.number().optional(),
  maxSumInsured: z.number().optional(),
  includeUnknownPrice: z.boolean().optional(),
  requiredCoverageCodes: z.array(z.string()).optional(),
  sortBy: z.enum(['premium_asc', 'premium_desc', 'sum_insured_desc', 'name_asc']).optional(),
  page: z.number().int().min(1).default(1),
  pageSize: z.number().int().min(1).max(100).default(20),
});
