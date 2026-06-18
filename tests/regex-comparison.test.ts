/**
 * REGEX EXPLANATIONS
 *
 * regex1: /[^,]+/g
 *   Matches one-or-more non-comma characters. Dead-simple split on commas.
 *   No quote awareness at all. The `+` (not `*`) means it skips empty fields.
 *
 * regex2: /"([^"]*)"|[^,]+/g
 *   Two alternatives tried left-to-right:
 *     1. `"([^"]*)"` — a quoted field; group 1 captures content WITHOUT the
 *        surrounding quotes. [^"]* matches anything except a double-quote, so
 *        escaped double-quotes ("") inside the field are NOT handled.
 *     2. `[^,]+`     — fallback: one-or-more non-comma chars (same as regex1).
 *   Still uses `+`/`*` so quoted fields work, but empty fields are still skipped
 *   because the unquoted branch requires at least one character.
 *
 * regex3: /("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)/g
 *   Outer group 1 = the full field; inner group 2 = quoted content (no quotes).
 *   Quoted branch: handles "" as an escaped double-quote via `(?:""[^"]*)* `.
 *   Unquoted branch: `[^,]*` (zero-or-more) so empty fields are captured.
 *   `(,|$)` consumes the comma/end-of-string delimiter — which means after the
 *   last real field the engine can fire once more at $, producing a SPURIOUS
 *   EXTRA EMPTY MATCH at the very end of every input.
 *
 * regex4: /(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))/g
 *   Anchors on start-of-string or a preceding comma (non-capturing) before
 *   each field. Group 1 = quoted content (no quotes), group 2 = unquoted content.
 *   Handles "" inside quotes. No trailing empty match (unlike regex3) because
 *   there is no (,|$) suffix.
 *   Flaw: the unquoted branch is `[^",]*` — it excludes both commas AND
 *   double-quotes. A literal " inside an unquoted field truncates the value.
 */

// ─── helpers ────────────────────────────────────────────────────────────────

// Returns the full text of every match (no capture-group handling).
const raw = (input: string, re: RegExp): string[] =>
  [...input.matchAll(new RegExp(re.source, "g"))].map((m) => m[0]);

// Best-effort "field value" for each regex.
// For regex1 the full match IS the value.
const fields1 = (input: string): string[] =>
  raw(input, /[^,]+/);

// For regex2: quoted fields use group 1 (no outer quotes); unquoted use m[0].
const fields2 = (input: string): string[] =>
  [...input.matchAll(new RegExp(`"([^"]*)"|[^,]+`, "g"))].map(
    (m) => m[1] ?? m[0]
  );

// For regex3: group 1 is the field without the trailing comma/$.
// group 2 is quoted content (no outer quotes); for unquoted, group 2 is undefined.
const fields3 = (input: string): string[] =>
  [
    ...input.matchAll(
      new RegExp(`("([^"]*(?:""[^"]*)*)"|[^,]*)(,|$)`, "g")
    ),
  ].map((m) => m[2] ?? m[1]);

// For regex4: group 1 = quoted content, group 2 = unquoted content.
const fields4 = (input: string): string[] =>
  [
    ...input.matchAll(
      new RegExp(`(?:^|,)(?:"((?:[^"]|"")*)"|([^",]*))`, "g")
    ),
  ].map((m) => m[1] ?? m[2]);

// ─── DISTINGUISHING TESTS (all 6 pairs) ─────────────────────────────────────

// Pair 1 — regex1 vs regex2
// A quoted field containing a comma splits regex1 into multiple tokens;
// regex2's first alternative matches the whole quoted string.
test("[regex1 vs regex2] quoted field with comma: regex1 splits it, regex2 keeps it whole", () => {
  const input = '"veni, vidi, vici"';
  expect(fields1(input)).toEqual(['"veni', ' vidi', ' vici"']); // 3 wrong tokens
  expect(fields2(input)).toEqual(["veni, vidi, vici"]);         // 1 correct token
});

// Pair 2 — regex1 vs regex3
// An empty field (two consecutive commas) is skipped by regex1 (`+` requires ≥1 char)
// but captured by regex3 (`[^,]*` allows zero chars).
test("[regex1 vs regex3] empty field between commas: regex1 skips it, regex3 keeps it", () => {
  const input = "a,,b";
  expect(fields1(input)).toEqual(["a", "b"]);     // empty field missing
  expect(fields3(input)).toContain("");            // empty field present
  expect(fields3(input)).toEqual(["a", "", "b", ""]); // (includes trailing flaw — see flaw tests)
});

// Pair 3 — regex1 vs regex4
// regex1 returns quoted strings with the quote characters intact.
// regex4 strips the surrounding quotes (group 1 captures only the content).
test("[regex1 vs regex4] quoted field: regex1 keeps the quotes, regex4 strips them", () => {
  const input = '"hello"';
  expect(fields1(input)).toEqual(['"hello"']); // quotes included
  expect(fields4(input)).toEqual(["hello"]);   // quotes stripped
});

// Pair 4 — regex2 vs regex3
// regex2's quoted branch ([^"]*) stops at the first closing quote, so it
// cannot handle "" as an escaped double-quote inside a field.
// regex3's quoted branch ((?:""[^"]*)*) handles "" correctly.
test("[regex2 vs regex3] escaped double-quote inside quoted field: regex2 mishandles it, regex3 handles it", () => {
  const input = '"say ""hello"""';
  // regex2 closes the first quoted span at pos 5 (the " after "say "), then
  // opens another quoted span at pos 6 matching "hello", then a third for "".
  // Three tokens instead of one:
  expect(fields2(input)).not.toEqual(['say "hello"']); // the right answer it can't produce
  expect(fields2(input)).toEqual(['say ', 'hello', '']); // actual (broken) output

  // regex3's (?:""[^"]*)* clause handles "" as an escaped quote, so it keeps
  // the whole thing as one field. Group 2 captures content between outer quotes
  // (""→" unescaping is left to the caller; the regex itself doesn't unescape).
  // The second entry is the spurious trailing empty — that's regex3's own flaw.
  expect(fields3(input)).toEqual(['say ""hello""', '']);
});

// Pair 5 — regex2 vs regex4
// regex2's unquoted branch ([^,]+) matches ANY non-comma character, including ".
// regex4's unquoted branch ([^",]*) stops at a double-quote character.
test("[regex2 vs regex4] unquoted field containing a double-quote: regex2 includes it, regex4 truncates", () => {
  const input = '5"4\'';          // the string: 5"4'
  expect(fields2(input)).toEqual(['5"4\'']); // includes the " — full value
  expect(fields4(input)).toEqual(["5"]);     // stops at " — truncated
});

// Pair 6 — regex3 vs regex4
// regex3 uses (,|$) to consume the delimiter, which fires one extra time
// at the very end of the string, yielding a spurious trailing empty string.
// regex4 uses a leading (?:^|,) anchor instead, so it stops cleanly.
test("[regex3 vs regex4] trailing empty match: regex3 produces a spurious extra entry, regex4 does not", () => {
  const input = "a,b";
  const r3 = fields3(input);
  const r4 = fields4(input);
  expect(r3).toHaveLength(3); // "a", "b", "" — the trailing "" is the flaw
  expect(r4).toHaveLength(2); // "a", "b" — clean
});

// ─── FLAW TESTS (one flaw per regex) ─────────────────────────────────────────

// regex1 FLAW: no quote handling — a quoted comma is treated as a field separator
// WRONG:  produces 3 tokens: ['"veni', ' vidi', ' vici"']
// RIGHT:  should produce 1 token: ['veni, vidi, vici']
test("[regex1 FLAW] quoted comma is incorrectly split into multiple fields", () => {
  const input = '"veni, vidi, vici"';
  const result = fields1(input);
  expect(result).not.toHaveLength(1); // wrong — it should be 1 field
  expect(result).toHaveLength(3);     // actually gives 3 broken tokens
});

// regex2 FLAW: [^"]* in the quoted branch cannot handle "" (escaped quote)
// WRONG:  closes the quoted field at the first ", splitting the rest as a
//         separate unquoted token
// RIGHT:  should produce exactly 1 field: ['say "hello"']
test("[regex2 FLAW] escaped double-quote inside a quoted field is not handled", () => {
  const input = '"say ""hello"""';
  const result = fields2(input);
  expect(result).not.toEqual(['say "hello"']); // the right answer it can't produce
  expect(result).toHaveLength(3);              // incorrectly split into 3 tokens: 'say ', 'hello', ''
});

// regex3 FLAW: (,|$) consumes the end-of-string anchor, allowing a zero-length
// match to fire one extra time after the last real field.
// WRONG:  ["a", "b", ""] — extra trailing empty string
// RIGHT:  should produce exactly ["a", "b"]
test("[regex3 FLAW] produces a spurious trailing empty entry for every input", () => {
  expect(fields3("a,b")).toEqual(["a", "b", ""]); // third entry is the flaw
  expect(fields3("x")).toEqual(["x", ""]);         // same flaw on single-field input
});

// regex4 FLAW: unquoted branch [^",]* stops at a double-quote character,
// truncating any unquoted value that legitimately contains a ".
// WRONG:  ["5"] — truncated at the double-quote
// RIGHT:  should produce ["5\"4'"]
test("[regex4 FLAW] a double-quote inside an unquoted field truncates the value", () => {
  const input = '5"4\'';
  const result = fields4(input);
  expect(result).not.toEqual(["5\"4'"]); // the right answer it can't produce
  expect(result).toEqual(["5"]);         // incorrectly truncated
});
