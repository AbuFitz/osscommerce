import { test } from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeRichText as s, toRichText, plainText, safeHref } from './rich-text.ts';

test('what a merchant can format is kept', () => {
  assert.equal(s('<h2>Care</h2><p>Hand <strong>wash</strong> and <em>air dry</em>.</p><ul><li>One</li><li>Two</li></ul>'), '<h2>Care</h2><p>Hand <strong>wash</strong> and <em>air dry</em>.</p><ul><li>One</li><li>Two</li></ul>');
  assert.equal(s('<b>x</b> <i>y</i> <h1>t</h1>'), '<strong>x</strong> <em>y</em> <h2>t</h2>', 'old tags become the supported ones');
});
test('script and anything that runs is removed', () => {
  assert.equal(s('<p>Hi</p><script>alert(1)</script><p>there</p>'), '<p>Hi</p><p>there</p>');
  assert.equal(s('<img src=x onerror=alert(1)>text'), 'text'); assert.equal(s('<p onclick="x()" style="color:red">a</p>'), '<p>a</p>');
  assert.equal(s('<iframe src="//evil"></iframe>ok<style>p{}</style>'), 'ok'); assert.equal(s('<svg><script>1</script></svg>after'), 'after');
  assert.ok(!/<script|onerror|javascript:/i.test(s('<scr<script>ipt>alert(1)</script><a href="jav&#x61;script:alert(1)">x</a>')));
});
test('links: web and email only, always safe to follow', () => {
  assert.equal(s('<a href="https://example.com/a?b=1&c=2" target="_blank" onclick="x">shop</a>'), '<a href="https://example.com/a?b=1&amp;c=2" rel="noopener noreferrer nofollow">shop</a>');
  assert.equal(s('<a href="mailto:hi@example.com">mail</a>'), '<a href="mailto:hi@example.com" rel="noopener noreferrer nofollow">mail</a>');
  for (const bad of ['javascript:alert(1)', 'JaVaScRiPt:alert(1)', 'java\nscript:alert(1)', 'jav&#x61;script:alert(1)', 'data:text/html,<b>', 'vbscript:x', '//evil.com', '/relative', ' javascript:alert(1)']) assert.equal(s(`<a href="${bad}">x</a>`), 'x', bad);
  assert.equal(safeHref('https://ok.example'), 'https://ok.example'); assert.equal(safeHref('ftp://x'), null);
});
test('text is escaped, tags are balanced, and the result never grows markup out of text', () => {
  assert.equal(s('1 < 2 & 3 > 2'), '1 &lt; 2 &amp; 3 &gt; 2'); assert.equal(s('<p><strong>open'), '<p><strong>open</strong></p>'); assert.equal(s('</p></strong>stray'), 'stray');
  assert.equal(s('&lt;script&gt;alert(1)&lt;/script&gt;'), '&lt;script&gt;alert(1)&lt;/script&gt;', 'escaped input stays text'); assert.equal(s('<p></p><p> </p>'), '');
  assert.equal(s(s('<p>a &amp; <a href="https://x.test">b</a></p>')), s('<p>a &amp; <a href="https://x.test">b</a></p>'), 'cleaning twice changes nothing');
});
test('old plain-text descriptions become paragraphs, safely', () => {
  assert.equal(toRichText('Line one\nline two\n\nNext & more'), '<p>Line one<br>line two</p><p>Next &amp; more</p>');
  assert.equal(toRichText('Plain\n\nText'), '<p>Plain</p><p>Text</p>'); assert.equal(toRichText('  '), ''); assert.equal(toRichText('a < b'), '<p>a &lt; b</p>');
});
test('plain text for previews and counts', () => { assert.equal(plainText('<h2>Care</h2><p>Hand <strong>wash</strong> &amp; dry.</p><ul><li>One</li><li>Two</li></ul>'), 'Care Hand wash & dry. One Two'); assert.equal(plainText(''), ''); });
