// Validation utilities for CIP2 JSON data
export interface ValidationResult {
  fatal: string[];
  warnings: string[];
}

export function validateCIP2Data(obj: any): ValidationResult {
  const fatal: string[] = [];
  const warnings: string[] = [];
  if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
    fatal.push('Top-level JSON must be an object mapping FoI names to objects.');
    return { fatal, warnings };
  }
  for (const [foiName, foiVal] of Object.entries(obj)) {
    if (typeof foiVal !== 'object' || foiVal === null || Array.isArray(foiVal)) {
      fatal.push(`FoI "${foiName}" must be an object.`);
      continue;
    }
    // included
    if (!('included' in foiVal)) {
      fatal.push(`FoI "${foiName}" missing required 'included' field.`);
    } else if (typeof (foiVal as any).included !== 'boolean') {
      fatal.push(`FoI "${foiName}" field 'included' must be boolean.`);
    }
    // population
    if (!('population' in foiVal)) {
      warnings.push(`FoI "${foiName}" missing 'population' field; will display as N/A.`);
    } else {
      const pop = (foiVal as any).population;
      if (typeof pop !== 'object' || pop === null) {
        warnings.push(`FoI "${foiName}" population is not an object; will display as N/A.`);
      } else {
        if (!('count' in pop) || typeof pop.count !== 'number') {
          warnings.push(`FoI "${foiName}" population.count missing or invalid; display as N/A.`);
        }
        if (!('as_of' in pop) || typeof pop.as_of !== 'string') {
          warnings.push(`FoI "${foiName}" population.as_of missing or invalid; display as N/A.`);
        }
      }
    }
    // programs
    if (!('programs' in foiVal)) {
      fatal.push(`FoI "${foiName}" missing required 'programs' array.`);
      continue;
    }
    const programs = (foiVal as any).programs;
    if (!Array.isArray(programs)) {
      fatal.push(`FoI "${foiName}" field 'programs' must be an array.`);
      continue;
    }
    programs.forEach((prog: any, idx: number) => {
      if (typeof prog !== 'object' || prog === null) {
        fatal.push(`Program index ${idx} in FoI "${foiName}" must be an object.`);
        return;
      }
      if (!('name' in prog) || typeof prog.name !== 'string') {
        fatal.push(`FoI "${foiName}" program index ${idx} missing required 'name' field.`);
      }
      if (!('link' in prog) || typeof prog.link !== 'string') {
        fatal.push(`FoI "${foiName}" program index ${idx} missing required 'link' field.`);
      } else {
        try {
          // Validate URL
          // eslint-disable-next-line no-new
          new URL(prog.link);
        } catch {
          fatal.push(`FoI "${foiName}" program index ${idx} field 'link' is not a valid URL.`);
        }
      }
      if (!('included' in prog)) {
        fatal.push(`FoI "${foiName}" program index ${idx} missing required 'included' field.`);
      } else if (typeof prog.included !== 'boolean') {
        fatal.push(`FoI "${foiName}" program index ${idx} field 'included' must be boolean.`);
      }
      if (!('degree' in prog)) {
        warnings.push(`FoI "${foiName}" program index ${idx} missing optional 'degree'; will display empty.`);
      }
      if (!('description' in prog)) {
        warnings.push(`FoI "${foiName}" program index ${idx} missing optional 'description'; will display empty.`);
      }
    });
  }
  return { fatal, warnings };
}