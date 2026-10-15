import { parseFragment, type DefaultTreeAdapterTypes } from 'parse5';
import { ensure } from './errors.js';
import type { Json } from './store.js';

type Node = DefaultTreeAdapterTypes.Node;
type Entry = { text: string; image?: Json; link?: Json };
const PART_BYTES = 24 * 1024;
const BLOCK = /^(p|div|section|article|header|footer|h[1-6]|blockquote|pre|tr|ul|ol|figure|figcaption)$/;
const SKIP = new Set(['script', 'style', 'template']);
const bytes = (v: unknown) => Buffer.byteLength(JSON.stringify(v));

// These are source references only: never fetch, resolve against a guessed host, or execute HTML.
function reference(value: string | undefined): string | undefined {
  const s = value?.trim();
  if (!s || /[\u0000-\u0020\u007f\\]/.test(s)) return undefined;
  if (/^[a-z][a-z0-9+.-]*:/i.test(s) && !/^https?:\/\//i.test(s)) return undefined;
  if (/^https?:\/\//i.test(s) || s.startsWith('//')) {
    try { const url = new URL(s.startsWith('//') ? `https:${s}` : s); if (!url.hostname || url.username || url.password) return undefined; }
    catch { return undefined; }
  }
  return s;
}

/** Ordered text and media references, split without dropping the tail of a long article. */
export function knowledgeParts(html: string) {
  const entries: Entry[] = []; const warnings = new Set<string>(); let imageIndex = 0; let linkIndex = 0;
  const text = (s: string) => {
    if (!s) return;
    const last = entries.at(-1);
    if (last && !last.image && !last.link) last.text += s; else entries.push({ text: s });
  };
  const url = (s: string | undefined) => {
    const value = reference(s);
    if (s && !value) warnings.add('CONTENT_URL_OMITTED');
    return value;
  };
  // Iterative traversal handles deeply nested source HTML without recursive stack overflow.
  const root = parseFragment(html); const stack: { node: Node; exit?: boolean; pre?: boolean }[] = [{ node: root }];
  while (stack.length) {
    const { node, exit, pre } = stack.pop()!;
    if (node.nodeName === '#text') { const s = (node as DefaultTreeAdapterTypes.TextNode).value; text(pre ? s : s.replace(/\s+/g, ' ')); continue; }
    if (!('childNodes' in node)) continue;
    const tag = 'tagName' in node ? node.tagName : '';
    if (SKIP.has(tag)) continue;
    const attrs = 'attrs' in node ? Object.fromEntries(node.attrs.map(a => [a.name, a.value])) : {};
    if (exit) {
      if (tag === 'a') {
        const href = url(attrs.href);
        if (href) { const position = ++linkIndex; entries.push({ text: ` [Link ${position}]`, link: { position, url: href, ...(attrs.title ? { title: attrs.title } : {}) } }); }
      }
      if (tag === 'td' || tag === 'th') text('\t');
      if (BLOCK.test(tag) || tag === 'li') text('\n');
      continue;
    }
    if (attrs.style && /url\s*\(/i.test(attrs.style)) warnings.add('CONTENT_UNSUPPORTED_MEDIA');
    if (BLOCK.test(tag)) text('\n');
    if (tag === 'li') text('- ');
    if (tag === 'br') text('\n');
    if (tag === 'img' || tag === 'source') {
      const sources: Json[] = [];
      for (const attr of ['src', 'data-src', 'srcset', 'data-srcset']) {
        if (!attrs[attr]) continue;
        if (attr.endsWith('srcset')) {
          // Data URLs contain commas; exclude that whole attribute instead of turning fragments into relative URLs.
          if (/data:/i.test(attrs[attr])) { warnings.add('CONTENT_URL_OMITTED'); continue; }
          for (const candidate of attrs[attr].split(',')) {
            const [value, descriptor, ...extra] = candidate.trim().split(/\s+/);
            const ref = url(value);
            if (ref && !extra.length && (!descriptor || /^\d+(?:\.\d+)?[wx]$/.test(descriptor))) sources.push({ url: ref, attribute: attr, ...(descriptor ? { descriptor } : {}) });
            else warnings.add('CONTENT_URL_OMITTED');
          }
        } else { const ref = url(attrs[attr]); if (ref) sources.push({ url: ref, attribute: attr }); }
      }
      if (sources.length) {
        const position = ++imageIndex;
        entries.push({ text: `[Image ${position}]`, image: { position, tag, sources, ...(attrs.alt !== undefined ? { alt: attrs.alt } : {}), ...(attrs.title !== undefined ? { title: attrs.title } : {}) } });
      } else { text(attrs.alt ?? ''); warnings.add('CONTENT_UNSUPPORTED_MEDIA'); }
    }
    if (['iframe', 'video', 'audio', 'object', 'embed'].includes(tag)) {
      for (const attr of ['src', 'data', 'poster']) {
        const ref = url(attrs[attr]);
        if (ref) { const position = ++linkIndex; entries.push({ text: `[Link ${position}]`, link: { position, url: ref, kind: tag, attribute: attr } }); }
      }
      warnings.add('CONTENT_UNSUPPORTED_MEDIA'); // URL retained; embedded content has not been read.
    }
    stack.push({ node, exit: true, pre });
    for (const child of [...node.childNodes].reverse()) stack.push({ node: child, pre: pre || tag === 'pre' });
  }
  if (entries[0] && !entries[0].image && !entries[0].link) entries[0].text = entries[0].text.trimStart();
  const last = entries.at(-1); if (last && !last.image && !last.link) last.text = last.text.trimEnd();
  const empty = () => ({ Content: '', contentImages: [] as Json[], contentLinks: [] as Json[] });
  const parts: ReturnType<typeof empty>[] = []; let part = empty();
  for (const entry of entries) {
    // Split text at Unicode code-point boundaries; media references are indivisible.
    const chars = entry.image || entry.link ? null : Array.from(entry.text);
    const pieces = chars ? Array.from({ length: Math.ceil(chars.length / 2000) }, (_, i) => chars.slice(i * 2000, (i + 1) * 2000).join('')) : [entry.text];
    for (const piece of pieces) {
      const append = () => ({ Content: part.Content + piece, contentImages: entry.image ? [...part.contentImages, entry.image] : part.contentImages, contentLinks: entry.link ? [...part.contentLinks, entry.link] : part.contentLinks });
      let next = append();
      if (bytes(next) > PART_BYTES) { if (part.Content || part.contentImages.length || part.contentLinks.length) parts.push(part); part = empty(); next = append(); }
      ensure(bytes(next) <= PART_BYTES); part = next;
    }
  }
  if (part.Content || part.contentImages.length || part.contentLinks.length || !parts.length) parts.push(part);
  return { parts: parts.map((p, i) => ({ ...p, contentFormat: 'text-with-media', contentPart: { index: i + 1, total: parts.length }, contentTruncated: false })), warnings: [...warnings] };
}

/** A response may contain several consecutive parts of the same source article. */
export function knowledgePage(items: Json[], offset = 0) {
  const fragments: { item: Json; article: number }[] = []; const warnings = new Set<string>();
  items.forEach((item, article) => {
    if (typeof item.Content !== 'string') { fragments.push({ item, article }); return; } // preserve null/missing
    const { parts, warnings: notices } = knowledgeParts(item.Content); notices.forEach(w => warnings.add(w));
    for (const part of parts) fragments.push({ item: { ...item, ...part }, article });
  });
  ensure(Number.isSafeInteger(offset) && offset >= 0 && (offset === 0 || offset < fragments.length));
  const selected: Json[] = []; const articles = new Set<number>(); let end = offset;
  for (; end < fragments.length; end++) {
    const fragment = fragments[end]!;
    if (bytes([...selected, fragment.item]) > 64 * 1024 || selected.length >= 100) break;
    selected.push(fragment.item); articles.add(fragment.article);
  }
  ensure(end > offset || !fragments.length);
  return { items: selected, nextOffset: end < fragments.length ? end : null, returnedArticles: articles.size, warnings: [...warnings] };
}
