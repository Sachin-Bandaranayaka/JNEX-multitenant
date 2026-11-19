import Papa from 'papaparse';
import { z } from 'zod';

// --- FINAL FIX: The helper function no longer removes duplicates ---
function extractAndNormalizePhoneNumbers(text: string | null | undefined): string[] {
    if (!text) return [];

    // This regex finds all sequences of 9 to 11 digits.
    const potentialNumbers = text.match(/\d{9,11}/g) || [];
    const normalizedNumbers: string[] = [];

    for (const p of potentialNumbers) {
        let cleaned = p.trim();

        // Case 1: Starts with '94' and is 11 digits long
        if (cleaned.startsWith('94') && cleaned.length === 11) {
            normalizedNumbers.push('0' + cleaned.substring(2));
            continue;
        }
        // Case 2: Is 10 digits and starts with '0' (already correct)
        if (cleaned.startsWith('0') && cleaned.length === 10) {
            normalizedNumbers.push(cleaned);
            continue;
        }
        // Case 3: Is 9 digits (missing the leading '0')
        if (cleaned.length === 9 && !cleaned.startsWith('0')) {
            normalizedNumbers.push('0' + cleaned);
            continue;
        }
    }
    
    // Return all normalized numbers found, including duplicates.
    return normalizedNumbers;
}


// The Zod schema now uses the more robust extraction and normalization logic.
export const LeadSchema = z.object({
  customer_name: z.string().min(1, "Customer name is required"),
  phone: z.string().min(1, "Phone number is required"),
  second_phone: z.string().optional(),
  address: z.string().min(1, "Address is required"),
  product_code: z.string().min(1, "Product code is required"),
  product_name: z.string().optional(),
  email: z.string().email().optional(),
  notes: z.string().optional(),
}).transform((data) => {
    // Extract numbers from both phone fields
    const primaryNumbers = extractAndNormalizePhoneNumbers(data.phone);
    const secondaryNumbers = extractAndNormalizePhoneNumbers(data.second_phone);

    // Combine all found numbers (primary first) and drop duplicates. Numbers are
    // already normalized, so "+94771234567" and "0771234567" collapse to one.
    // Customers often repeat their primary number as the secondary one.
    const allNumbers = [...new Set([...primaryNumbers, ...secondaryNumbers])];

    return {
        ...data,
        phone: allNumbers[0] || '',
        second_phone: allNumbers[1] || '',
    };
});


export type LeadData = z.infer<typeof LeadSchema>;

export interface ParseResult {
  validLeads: LeadData[];
  errors: Array<{
    row: number;
    errors: string[];
  }>;
}

export function parseCSV(file: File): Promise<ParseResult> {
  return new Promise((resolve, reject) => {
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      transformHeader: header => header.toLowerCase().trim().replace(/\s+/g, '_'),
      complete: (results) => {
        const validLeads: LeadData[] = [];
        const errors: ParseResult['errors'] = [];

        results.data.forEach((row: any, index: number) => {
          // The safeParse method now validates and transforms the data in one step
          const result = LeadSchema.safeParse(row);

          if (!result.success) {
            errors.push({
              row: index + 2, // +2 because of 1-based indexing and the header row
              errors: result.error.errors.map(err =>
                `${err.path.join('.')}: ${err.message}`
              ),
            });
          } else {
            // The data is already normalized by the schema's transform, so we can push it directly
            validLeads.push(result.data);
          }
        });

        resolve({ validLeads, errors });
      },
      error: (error: Error) => {
        reject(error);
      },
    });
  });
}
