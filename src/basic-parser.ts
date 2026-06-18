import * as fs from "fs";
import * as readline from "readline";
import { z } from "zod";

/**
 * Splits one CSV line into fields, respecting double-quoted fields that may
 * contain commas. A double-quote inside a quoted field is escaped as "".
 * E.g.: Caesar, Julius, "veni, vidi, vici"  →  ["Caesar", "Julius", "veni, vidi, vici"]
 */
export function parseCSVLine(line: string): string[] {
  const fields: string[] = [];
  let current = "";
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (inQuotes) {
      if (ch === '"') {
        if (i + 1 < line.length && line[i + 1] === '"') {
          current += '"';
          i++; // skip the escaped second quote
        } else {
          inQuotes = false;
        }
      } else {
        current += ch;
      }
    } else {
      if (ch === '"') {
        inQuotes = true;
      } else if (ch === ',') {
        fields.push(current.trim());
        current = "";
      } else {
        current += ch;
      }
    }
  }
  fields.push(current.trim());
  return fields;
}

/**
 * Parses a CSV file and returns a typed array using the provided Zod schema.
 * The schema is applied to each row (as a string[]), so it defines how raw
 * string fields are validated and/or transformed into the output type T.
 *
 * @param path       Path to the CSV file.
 * @param rowSchema  Zod schema that validates/transforms one row (string[]) → T.
 * @param hasHeaders If true, the first row is treated as column headers and skipped.
 * @returns A promise resolving to T[], one entry per data row.
 */
export async function parseCSV<T>(
  path: string,
  rowSchema: z.ZodType<T>,
  hasHeaders: boolean = false
): Promise<T[]> {
  const fileStream = fs.createReadStream(path);
  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const result: T[] = [];
  let isFirstRow = true;

  for await (const line of rl) {
    if (isFirstRow && hasHeaders) {
      isFirstRow = false;
      continue;
    }
    isFirstRow = false;

    const fields = parseCSVLine(line);
    result.push(rowSchema.parse(fields));
  }
  return result;
}
