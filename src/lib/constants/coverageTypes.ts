import type { CoverageType } from '@/types/database';

/** Mirrors db/migrations/002_coverage_types.sql; used by the plan form's presets and layout. */
export const STANDARD_COVERAGE_TYPES: CoverageType[] = [
  { id: '10000000-0000-0000-0000-000000000001', code: 'own_damage', name: 'ความเสียหายต่อตัวรถยนต์ผู้เอาประกัน', category: 'ตัวรถยนต์', sort_order: 1 },
  { id: '10000000-0000-0000-0000-000000000016', code: 'rollover_offroad', name: 'รถพลิกคว่ำหรือตกทาง', category: 'ตัวรถยนต์', sort_order: 2 },
  { id: '10000000-0000-0000-0000-000000000002', code: 'theft_fire', name: 'รถยนต์สูญหาย/ไฟไหม้', category: 'ตัวรถยนต์', sort_order: 3 },
  { id: '10000000-0000-0000-0000-000000000003', code: 'flood', name: 'น้ำท่วม (ภัยธรรมชาติ)', category: 'ตัวรถยนต์', sort_order: 4 },
  { id: '10000000-0000-0000-0000-000000000004', code: 'windshield', name: 'กระจกบังลมเสียหาย', category: 'ตัวรถยนต์', sort_order: 5 },
  { id: '10000000-0000-0000-0000-000000000005', code: 'theft_personal_prop', name: 'ทรัพย์สินส่วนบุคคลภายในรถถูกโจรกรรม', category: 'ตัวรถยนต์', sort_order: 6 },
  { id: '10000000-0000-0000-0000-000000000015', code: 'accessories', name: 'อุปกรณ์ตกแต่งเพิ่มเติม', category: 'ตัวรถยนต์', sort_order: 7 },
  { id: '10000000-0000-0000-0000-000000000006', code: 'tp_life_person', name: 'ความรับผิดต่อชีวิต/ร่างกายบุคคลภายนอก (ต่อคน)', category: 'บุคคลภายนอก', sort_order: 8 },
  { id: '10000000-0000-0000-0000-000000000007', code: 'tp_life_event', name: 'ความรับผิดต่อชีวิต/ร่างกายบุคคลภายนอก (ต่อครั้ง)', category: 'บุคคลภายนอก', sort_order: 9 },
  { id: '10000000-0000-0000-0000-000000000008', code: 'tp_property', name: 'ความเสียหายต่อทรัพย์สินบุคคลภายนอก', category: 'บุคคลภายนอก', sort_order: 10 },
  { id: '10000000-0000-0000-0000-000000000009', code: 'pa_driver_passenger', name: 'อุบัติเหตุส่วนบุคคล (ผู้ขับขี่และผู้โดยสาร)', category: 'เอกสารแนบท้าย', sort_order: 11 },
  { id: '10000000-0000-0000-0000-000000000010', code: 'medical_expenses', name: 'ค่ารักษาพยาบาล', category: 'เอกสารแนบท้าย', sort_order: 12 },
  { id: '10000000-0000-0000-0000-000000000011', code: 'bail_bond', name: 'การประกันตัวผู้ขับขี่', category: 'เอกสารแนบท้าย', sort_order: 13 },
  { id: '10000000-0000-0000-0000-000000000012', code: 'roadside_assist', name: 'บริการช่วยเหลือฉุกเฉินบนท้องถนน 24 ชม.', category: 'บริการเสริม', sort_order: 14 },
  { id: '10000000-0000-0000-0000-000000000013', code: 'towing', name: 'บริการยกรถ/ลากรถฉุกเฉิน', category: 'บริการเสริม', sort_order: 15 },
  { id: '10000000-0000-0000-0000-000000000014', code: 'loss_of_use', name: 'เงินชดเชยค่าเดินทางระหว่างนำรถเข้าซ่อม', category: 'บริการเสริม', sort_order: 16 },
];
