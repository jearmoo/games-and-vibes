import { WordProvider } from './types.js';

const BASE_URL = 'https://randomwordgenerator.com/charades.php';

const DIFFICULTY_NAMES = ['easy', 'medium', 'hard', 'really_hard'] as const;
const DIFFICULTY_IDS: Record<string, number> = {
  easy: 6,
  medium: 7,
  hard: 8,
  really_hard: 9,
};

export const charadesProvider: WordProvider = async (count, difficulty) => {
  const name = DIFFICULTY_NAMES[Math.min(Math.max(difficulty - 1, 0), 3)];
  const categoryId = DIFFICULTY_IDS[name];

  const pageRes = await fetch(BASE_URL);
  const pageHtml = await pageRes.text();

  const csrfMatch = pageHtml.match(/meta name="csrf-token" content="([^"]+)"/);
  if (!csrfMatch) throw new Error('Failed to extract CSRF token');
  const csrf = csrfMatch[1];

  const setCookie = pageRes.headers.get('set-cookie');
  const cookie = setCookie
    ? setCookie
        .split(',')
        .map((c) => c.split(';')[0].trim())
        .join('; ')
    : '';

  const body = new URLSearchParams({
    _csrf: csrf,
    count: String(count),
    category: String(categoryId),
  });

  const res = await fetch(BASE_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded',
      'X-Requested-With': 'XMLHttpRequest',
      Cookie: cookie,
    },
    body: body.toString(),
  });

  if (!res.ok) throw new Error(`charades API returned ${res.status}`);
  return (await res.json()) as string[];
};
