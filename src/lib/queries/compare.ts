import { ComparisonWarning, InsuranceSearchResultItem } from '@/types/insurance';
import { buildSearchResultItems } from './search';

export interface ComparisonResult {
  options: InsuranceSearchResultItem[];
  warnings: ComparisonWarning[];
  categories: {
    name: string;
    items: {
      code: string;
      name: string;
      values: Record<string, { status: string; text: string; isOverridden: boolean }>;
      hasDifference: boolean;
    }[];
  }[];
}

export function generateComparisonWarnings(options: InsuranceSearchResultItem[]): ComparisonWarning[] {
  const warnings: ComparisonWarning[] = [];

  if (options.length < 2) return warnings;

  // 1. Sum Insured Differences
  const sumInsuredValues = options.map((o) => o.sumInsuredMax ?? o.sumInsuredMin ?? 0);
  const minSum = Math.min(...sumInsuredValues);
  const maxSum = Math.max(...sumInsuredValues);
  if (minSum !== maxSum) {
    warnings.push({
      type: 'sum_insured_diff',
      title: 'ทุนประกันภัยไม่เท่ากัน',
      message: `ตัวเลือกที่เปรียบเทียบมีทุนประกันต่างกัน (ต่ำสุด ฿${minSum.toLocaleString()} ถึง สูงสุด ฿${maxSum.toLocaleString()}) กรุณาคำนึงถึงมูลค่ารถยนต์ขณะเปรียบเทียบเบี้ย`,
      severity: 'warning',
    });
  }

  // 2. Repair Type Differences (Dealer vs Garage)
  const repairTypes = new Set(options.map((o) => o.repairType));
  if (repairTypes.size > 1) {
    warnings.push({
      type: 'repair_type_diff',
      title: 'เงื่อนไขการซ่อมต่างกัน (ซ่อมห้าง / ซ่อมอู่)',
      message: 'มีทั้งตัวเลือกซ่อมห้างและซ่อมอู่ผสมกัน เบี้ยซ่อมห้างตามมาตรฐานจะสูงกว่าซ่อมอู่',
      severity: 'warning',
    });
  }

  // 3. Deductibles
  const deductibles = new Set(options.map((o) => o.deductibleAmount));
  if (deductibles.size > 1) {
    warnings.push({
      type: 'deductible_diff',
      title: 'ค่าเสียหายส่วนแรก (Deductible) ไม่เท่ากัน',
      message: 'บางตัวเลือกมีเงื่อนไขให้ผู้เอาประกันร่วมจ่ายค่าเสียหายส่วนแรกเมื่อเกิดเหตุที่เป็นฝ่ายผิด ทำให้เบี้ยประกันถูกลง',
      severity: 'caution',
    });
  }

  // 4. Price Type Differences
  const priceTypes = new Set(options.map((o) => o.priceType));
  if (priceTypes.size > 1) {
    warnings.push({
      type: 'price_type_diff',
      title: 'ชนิดของราคาไม่เหมือนกัน',
      message: 'ตัวเลือกบางรายการเป็นราคาเริ่มต้นหรือราคาประมาณการ ไม่ใช่ราคาตายตัว',
      severity: 'info',
    });
  }

  // 5. Driver / Vehicle Conditions
  const hasSpecificDriver = options.some((o) => o.driverConditions && o.driverConditions.includes('ระบุผู้ขับขี่'));
  if (hasSpecificDriver) {
    warnings.push({
      type: 'driver_diff',
      title: 'มีเงื่อนไขระบุผู้ขับขี่เฉพาะเจาะจง',
      message: 'บางแพ็กเกจกำหนดอายุหรือชื่อผู้ขับขี่ หากผู้อื่นนำรถไปเกิดเหตุอาจมีเงื่อนไขค่าเสียหายส่วนแรกเพิ่ม',
      severity: 'warning',
    });
  }

  // 6. Unknown / Missing Data Check
  const hasUnknownPrices = options.some((o) => o.premiumTotal === null || o.premiumTotal === undefined);
  if (hasUnknownPrices) {
    warnings.push({
      type: 'unknown_data',
      title: 'มีข้อมูลสำคัญที่ยังไม่ทราบ',
      message: 'บางรายการไม่มีข้อมูลราคาที่แน่นอนในเอกสารต้นทาง ระบบแสดง "ยังไม่มีข้อมูลราคา" และไม่สามารถตัดสินความคุ้มค่าได้ทันที',
      severity: 'caution',
    });
  }

  return warnings;
}

export async function getComparisonData(optionIds: string[]): Promise<ComparisonResult> {
  const all = buildSearchResultItems();
  const selectedOptions = optionIds
    .map((id) => all.find((item) => item.id === id))
    .filter((item): item is InsuranceSearchResultItem => !!item);

  const warnings = generateComparisonWarnings(selectedOptions);

  // Group coverages by category
  const categoriesMap = new Map<string, Map<string, { code: string; name: string }>>();

  for (const opt of selectedOptions) {
    for (const cov of opt.coverages) {
      if (!categoriesMap.has(cov.category)) {
        categoriesMap.set(cov.category, new Map());
      }
      categoriesMap.get(cov.category)!.set(cov.code, {
        code: cov.code,
        name: cov.name,
      });
    }
  }

  const categories = Array.from(categoriesMap.entries()).map(([catName, itemsMap]) => {
    const items = Array.from(itemsMap.values()).map(({ code, name }) => {
      const values: Record<string, { status: string; text: string; isOverridden: boolean }> = {};
      const distinctTexts = new Set<string>();

      for (const opt of selectedOptions) {
        const cov = opt.coverages.find((c) => c.code === code);
        let text = '-';
        let status = 'unknown';
        let isOverridden = false;

        if (cov) {
          status = cov.status;
          isOverridden = cov.isOverridden;
          if (cov.status === 'not_covered') {
            text = 'ไม่คุ้มครอง';
          } else if (cov.status === 'covered') {
            if (cov.limitAmount) {
              text = `฿${cov.limitAmount.toLocaleString()} ${cov.limitBasis ? '(' + cov.limitBasis + ')' : ''}`;
            } else if (cov.limitBasis) {
              text = cov.limitBasis;
            } else {
              text = 'คุ้มครอง (ตามเงื่อนไข)';
            }
          } else if (cov.status === 'optional') {
            text = 'ซื้อเพิ่มได้';
            if (cov.terms) text += ` (${cov.terms})`;
          } else {
            text = 'ยังไม่ระบุ';
          }
        }

        values[opt.id] = { status, text, isOverridden };
        distinctTexts.add(text);
      }

      return {
        code,
        name,
        values,
        hasDifference: distinctTexts.size > 1,
      };
    });

    return {
      name: catName,
      items,
    };
  });

  return {
    options: selectedOptions,
    warnings,
    categories,
  };
}
