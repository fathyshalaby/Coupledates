import seoMetadata from './seo-metadata.json';

export function updateRouteMetadata(location: string, configuredBasePath: string) {
  const basePath = configuredBasePath.replace(/\/$/, '');
  const seg = location.split('/');
  const key = seg[1] === 'dates' && seg[2] ? 'date-detail' : seg[1] || '';
  const names: Record<string, string> = {
    '': 'A private space for two',
    'how-it-works': 'How it works',
    'couples-journal': 'Private couples journal',
    'at-home-date-ideas': 'Romantic at-home date ideas',
    'long-distance': 'Long-distance dates',
    pricing: 'Pricing',
    home: 'Our space',
    memories: 'Our memories',
    dates: 'Date night',
    streaks: 'Daily connection',
    recap: 'Our year together',
    settings: 'Our settings',
    'date-detail': 'Date details',
    preferences: 'Date preferences',
    assistant: 'Date ideas',
    calendar: 'Calendar',
    billing: 'Our plan',
    'sign-in': 'Sign in',
    'sign-up': 'Create your account',
  };
  names['recover-space'] = 'Recover your existing space';
  const publicPage = ['', 'how-it-works', 'couples-journal', 'at-home-date-ideas', 'long-distance', 'pricing'].includes(key);
  const title = key === ''
    ? 'Couple Dates | Your Next Favorite Memory Starts With a Date'
    : key === 'couples-journal'
      ? seoMetadata.couplesJournal.title
      : key === 'at-home-date-ideas'
        ? 'Romantic At-Home Date Ideas for Two | Couple Dates'
        : `${names[key] ?? 'Page not found'} · Couple Dates`;
  const descriptions: Record<string, string> = {
    '': 'Find date ideas, make plans you both choose, and save the photos and little details that bring them back. Couple Dates is free during beta.',
    'how-it-works': 'Couple Dates helps turn her date idea into a plan both partners choose, then keeps photos and memories private unless they choose to share.',
    'couples-journal': seoMetadata.couplesJournal.description,
    'at-home-date-ideas': 'Find romantic at-home date ideas for every budget and schedule, including long-distance options. Plan a date together in Couple Dates, free during beta.',
    'long-distance': 'Plan online dates across different schedules, add a call link you already use, and keep the moments you share in Couple Dates.',
    pricing: 'Couple Dates is free for both partners during beta. Try date planning, date ideas, shared memories, and the yearly recap before checkout returns.',
  };
  const description = descriptions[key] ?? 'A private shared space for exactly two to plan dates together and remember everyday moments.';
  document.title = title;
  document.querySelector('meta[name="description"]')?.setAttribute('content', description);
  document.querySelector('meta[property="og:title"]')?.setAttribute('content', title);
  document.querySelector('meta[property="og:description"]')?.setAttribute('content', description);
  document.querySelector('meta[name="twitter:title"]')?.setAttribute('content', title);
  document.querySelector('meta[name="twitter:description"]')?.setAttribute('content', description);

  const pageUrl = new URL(`${basePath}${location === '/' ? '/' : location}`, window.location.origin).href;
  const imagePath = key === 'couples-journal'
    ? seoMetadata.couplesJournal.image
    : key === 'at-home-date-ideas'
      ? 'product-shots/dates-mobile.jpg'
      : 'product-shots/home-mobile.jpg';
  const imageUrl = new URL(`${basePath}/${imagePath}`, window.location.origin).href;
  let ogUrl = document.querySelector<HTMLMetaElement>('meta[property="og:url"]');
  if (!ogUrl) {
    ogUrl = document.createElement('meta');
    ogUrl.setAttribute('property', 'og:url');
    document.head.appendChild(ogUrl);
  }
  ogUrl.content = pageUrl;
  document.querySelector('meta[property="og:image"]')?.setAttribute('content', imageUrl);
  document.querySelector('meta[name="twitter:image"]')?.setAttribute('content', imageUrl);
  let canonical = document.querySelector<HTMLLinkElement>('link[rel="canonical"]');
  if (!canonical) {
    canonical = document.createElement('link');
    canonical.rel = 'canonical';
    document.head.appendChild(canonical);
  }
  canonical.href = pageUrl;
  document.querySelector('meta[name="robots"]')?.setAttribute('content', publicPage ? 'index, follow' : 'noindex, nofollow');
}
