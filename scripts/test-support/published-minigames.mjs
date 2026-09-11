export function tagHasClass(tag, className) {
  const classValue = tag.match(/\bclass="([^"]*)"/)?.[1] ?? '';
  return classValue.split(/\s+/).filter(Boolean).includes(className);
}

export function extractPublishedSlugs(markup) {
  const anchors = markup.match(/<a\b[^>]*>/g) || [];
  const slugs = [];
  for (const anchor of anchors) {
    if (!tagHasClass(anchor, 'image-link')) continue;
    const slug = anchor.match(/\bhref="\/([a-z0-9-]+)\/"/)?.[1];
    if (slug) slugs.push(slug);
  }
  return slugs;
}

export function countGameCards(markup) {
  const divs = markup.match(/<div\b[^>]*>/g) || [];
  return divs.filter((tag) => tagHasClass(tag, 'game-card')).length;
}
