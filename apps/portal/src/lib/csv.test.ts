import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCsv, toCsv, parseProducts } from './csv.ts';

test('parseCsv: quotes, commas, escaped quotes, CRLF, BOM and blank lines', () => {
  assert.deepEqual(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\r\n\r\n1,2\n'), [['a', 'b'], ['x, y', 'say "hi"'], ['1', '2']]);
  assert.deepEqual(parseCsv('a,"multi\nline"\n'), [['a', 'multi\nline']]);
});
test('toCsv neutralises spreadsheet formulas and round-trips awkward text', () => {
  const out = toCsv([['name', 'note'], ['=HYPERLINK("http://evil")', 'a,b'], ['+1', '@x'], ['plain', '"q"']]); assert.ok(out.includes("'=HYPERLINK"), 'formula neutralised'); assert.ok(!/(^|,)=/.test(out.split('\r\n')[1]));
  assert.deepEqual(parseCsv(out)[2], ["'+1", "'@x"]);
});
test('parseProducts: accepts common column names, prices with £ and commas, defaults to draft', () => {
  const r = parseProducts('Name,Price (GBP),SKU,Status,Quantity\nMug,"£1,200.50",mug-1,Published,5\nBowl,12,,draft,');
  assert.deepEqual(r.problems, []); assert.equal(r.rows[0].priceMinor, 120050); assert.equal(r.rows[0].sku, 'MUG-1'); assert.equal(r.rows[0].status, 'published'); assert.equal(r.rows[1].onHand, 0); assert.equal(r.rows[1].status, 'draft');
});
test('parseProducts: names each problem with its line and keeps the good rows', () => {
  const r = parseProducts('title,price,sku,stock\nOK,5,A,1\n,5,B,1\nBad price,abc,C,1\nBad stock,5,D,x\nDup,5,A,1');
  assert.equal(r.rows.length, 1); assert.deepEqual(r.problems.map(p => p.line), [3, 4, 5, 6]); assert.match(r.problems[1].message, /Bad price/); assert.match(r.problems[3].message, /twice/);
});
test('parseProducts: missing required columns are reported, not guessed', () => { const r = parseProducts('foo,bar\n1,2'); assert.deepEqual(r.missing, ['title', 'price']); assert.equal(r.rows.length, 0); });
