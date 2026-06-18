import { parseCSV, parseCSVLine } from "../src/basic-parser";
import * as path from "path";
import { z } from "zod";

const PEOPLE_CSV_PATH = path.join(__dirname, "../data/people.csv");

// --- parseCSVLine unit tests ---

test("parseCSVLine splits a plain row", () => {
  expect(parseCSVLine("Alice, 23")).toEqual(["Alice", "23"]);
});

test("parseCSVLine handles a quoted field containing a comma", () => {
  expect(parseCSVLine('Caesar, Julius, "veni, vidi, vici"')).toEqual([
    "Caesar",
    "Julius",
    "veni, vidi, vici",
  ]);
});

test("parseCSVLine handles escaped double-quotes inside a quoted field", () => {
  expect(parseCSVLine('"say ""hello""", world')).toEqual([
    'say "hello"',
    "world",
  ]);
});

test("parseCSVLine handles an empty field", () => {
  expect(parseCSVLine("Alice,,23")).toEqual(["Alice", "", "23"]);
});

// --- parseCSV integration tests ---

const rowSchema = z.array(z.string());

test("parseCSV with hasHeaders=true skips the header row", async () => {
  const results = await parseCSV(PEOPLE_CSV_PATH, rowSchema, true);
  expect(results).toHaveLength(4);
  expect(results[0]).toEqual(["Alice", "23"]);
});

test("parseCSV with hasHeaders=false includes all rows", async () => {
  const results = await parseCSV(PEOPLE_CSV_PATH, rowSchema, false);
  expect(results).toHaveLength(5);
  expect(results[0]).toEqual(["name", "age"]);
});

test("parseCSV rows are arrays, not strings", async () => {
  const results = await parseCSV(PEOPLE_CSV_PATH, rowSchema, true);
  for (const row of results) {
    expect(Array.isArray(row)).toBe(true);
  }
});

// --- Zod schema transformation test ---

const PersonSchema = z
  .array(z.string())
  .transform(([name, age]) => ({ name, age: Number(age) }));

test("parseCSV transforms rows into typed objects via Zod schema", async () => {
  const people = await parseCSV(PEOPLE_CSV_PATH, PersonSchema, true);
  expect(people).toHaveLength(4);
  expect(people[0]).toEqual({ name: "Alice", age: 23 });
  expect(people[1]).toEqual({ name: "Bob", age: NaN }); // "thirty" can't be coerced
});
