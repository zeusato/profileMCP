import test from 'node:test';
import assert from 'node:assert/strict';
import { knowledgeParts, knowledgePage } from '../src/knowledge.js';

test('KMS-01: image-only body, responsive/lazy images, links and decoded entities survive in order', () => {
  const parsed = knowledgeParts('<p>&#272;i&#7873;u ki&#7879;n &amp; phí</p><a href="https://example.com/rules?a=1&amp;b=2"><img alt="Nội dung > bìa" src="https://example.com/body.webp" data-src="/uploads/full.webp"></a><picture><source srcset="//example.com/a.webp 1x, /uploads/b.webp 2x"><img src=/uploads/c.webp></picture><p>Cuối bài</p>');
  assert.equal(parsed.parts.length, 1); assert.deepEqual(parsed.warnings, []);
  const item = parsed.parts[0]!;
  assert.match(item.Content, /Điều kiện & phí/);
  assert.match(item.Content, /\[Image 1\] \[Link 1\].*\[Image 2\].*\[Image 3\]/s);
  assert.match(item.Content, /Cuối bài$/);
  assert.deepEqual(item.contentImages.map(i => i.position), [1, 2, 3]);
  assert.equal(item.contentImages[0]!.alt, 'Nội dung > bìa');
  assert.deepEqual(item.contentImages[0]!.sources, [{ url: 'https://example.com/body.webp', attribute: 'src' }, { url: '/uploads/full.webp', attribute: 'data-src' }]);
  assert.deepEqual(item.contentImages[1]!.sources, [{ url: '//example.com/a.webp', attribute: 'srcset', descriptor: '1x' }, { url: '/uploads/b.webp', attribute: 'srcset', descriptor: '2x' }]);
  assert.equal(item.contentLinks[0]!.url, 'https://example.com/rules?a=1&b=2');
  assert.equal(knowledgeParts('<img src="https://example.com/body.webp">').parts[0]!.Content, '[Image 1]');
});

test('KMS-02: inactive HTML, unsafe references, malformed markup and unsupported media are handled explicitly', () => {
  const parsed = knowledgeParts('<script>secret()</script><style>secret{}</style><!-- secret --><p onclick="secret()">Read <a href="java&#115;cript:secret()">label</a><img src="data:image/png;base64,secret" alt="alt"><a href="https://user:password@example.com/a">bad</a><iframe src="https://example.com/embed"></iframe><div style="background-image:url(/hidden.webp)">end');
  const json = JSON.stringify(parsed.parts);
  assert.ok(!json.includes('secret') && !json.includes('password') && !json.includes('onclick'));
  assert.match(parsed.parts[0]!.Content, /Read labelaltbad/);
  assert.equal(parsed.parts[0]!.contentLinks[0]!.url, 'https://example.com/embed');
  assert.deepEqual(new Set(parsed.warnings), new Set(['CONTENT_URL_OMITTED', 'CONTENT_UNSUPPORTED_MEDIA']));
});

test('KMS-03: full Unicode text, table cells, preformatted text and hundreds of media references survive all parts', () => {
  const body = 'Đại ca 😀 '.repeat(18000);
  const images = Array.from({ length: 250 }, (_, i) => `<img src="https://example.com/${i}.webp">`).join('');
  const { parts } = knowledgeParts(`<pre>${body}</pre><table><tr><td>A</td><td>B</td></tr></table>${images}`);
  assert.ok(parts.length > 2);
  const combined = parts.map(p => p.Content).join('');
  assert.ok(combined.startsWith(body)); assert.match(combined, /A\tB\t/);
  assert.deepEqual(parts.flatMap(p => p.contentImages).map(i => i.sources[0].url), Array.from({ length: 250 }, (_, i) => `https://example.com/${i}.webp`));
  for (const [i, part] of parts.entries()) {
    assert.deepEqual(part.contentPart, { index: i + 1, total: parts.length });
    assert.equal(part.contentTruncated, false);
    assert.ok(!/[\uD800-\uDBFF]$/.test(part.Content) && !/^[\uDC00-\uDFFF]/.test(part.Content));
  }
});

test('KMS-04: bounded output continuation reconstructs every article part without losing null/missing', () => {
  const body = 'x'.repeat(260000);
  const items = [{ id: '1', Content: body }, { id: '2', Content: null }, { id: '3' }];
  let offset: number | null = 0; const collected: any[] = []; let calls = 0;
  while (offset !== null) {
    const page = knowledgePage(items, offset); calls++;
    assert.ok(Buffer.byteLength(JSON.stringify(page.items)) <= 64 * 1024);
    assert.ok(page.nextOffset === null || page.nextOffset > offset);
    collected.push(...page.items); offset = page.nextOffset;
  }
  assert.ok(calls > 1);
  assert.equal(collected.filter(i => i.id === '1').map(i => i.Content).join(''), body);
  assert.equal(collected.at(-2).Content, null); assert.equal(Object.hasOwn(collected.at(-1), 'Content'), false);
  assert.deepEqual(knowledgeParts('').parts[0]!.contentImages, []);
});
