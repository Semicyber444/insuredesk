import { z } from 'zod';

export const InsurerSchema = z.object({
  name: z.string().min(1, 'กรุณากรอกชื่อบริษัทประกันภัย'),
  contact_channels: z.string().optional().nullable(),
  website: z.string().url('URL ไม่ถูกต้อง').optional().or(z.literal('')).nullable(),
  is_active: z.boolean().default(true),
});

export const PlanSchema = z.object({
  insurer_id: z.string().uuid('กรุณาเลือกบริษัทประกันภัย'),
  name: z.string().min(1, 'กรุณากรอกชื่อแพ็กเกจประกัน'),
  insurance_type: z.enum(['ชั้น 1', 'ชั้น 2+', 'ชั้น 3+', 'ชั้น 2', 'ชั้น 3']),
});

export const PlanVersionSchema = z.object({
  plan_id: z.string().uuid(),
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
  message: 'วันสิ้นสุดต้องไม่ก่อนวันเริ่มต้น',
  path: ['effective_to']
});

export const EligibilityRuleSchema = z.object({
  plan_version_id: z.string().uuid(),
  scope_type: z.enum(['specific_model', 'all_models', 'unknown']),
  vehicle_model_id: z.string().uuid().optional().nullable(),
  min_age: z.number().int().min(0, 'อายุรถต้องไม่ติดลบ').optional().nullable(),
  max_age: z.number().int().min(0, 'อายุรถต้องไม่ติดลบ').optional().nullable(),
  age_basis: z.enum(['registration_year', 'manufacture_year']).optional().nullable(),
  usage_type: z.enum(['private', 'commercial', 'all']).optional().nullable(),
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
  eligibility_rule_id: z.string().uuid(),
  label: z.string().min(1, 'กรุณากรอกชื่อตัวเลือกราคา'),
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
  if (data.sum_insured_min && data.sum_insured_max) {
    return data.sum_insured_max >= data.sum_insured_min;
  }
  return true;
}, {
  message: 'ทุนประกันสูงสุดต้องไม่น้อยกว่าทุนประกันขั้นต่ำ',
  path: ['sum_insured_max']
});

export const ReviewActionSchema = z.object({
  plan_version_id: z.string().uuid(),
  action: z.enum(['publish', 'reject']),
  reason: z.string().min(1, 'กรุณาระบุเหตุผลในการดำเนินการ'),
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
