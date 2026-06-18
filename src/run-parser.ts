import { parseCSV } from "./basic-parser";
import { z } from "zod";

const DATA_FILE = "./data/people.csv";

const PersonSchema = z
  .array(z.string())
  .transform(([name, age]) => ({ name, age: Number(age) }));

async function main() {
  const people = await parseCSV(DATA_FILE, PersonSchema, true);

  for (const person of people) {
    console.log(person);
  }
}

main();