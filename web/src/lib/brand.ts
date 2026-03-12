export const BRAND_NAME = "Sifu Quest";
export const BRAND_TAGLINE =
  "Master coding interviews with disciplined Sifu coaching";
export const BRAND_DESCRIPTION =
  "Sifu Quest is an AI coding interview coaching platform for DSA, system design, job search, and interview mastery.";

export const BRAND_EMOJIS = {
  primary: "🥋",
  trophy: "🏆",
  award: "🏅",
  medal: "🥇",
  star: "⭐",
  fist: "👊",
} as const;

export const APP_KEYWORDS = [
  "Sifu Quest",
  "coding interview coach",
  "AI interview coach",
  "DSA practice",
  "system design interview prep",
  "technical interview preparation",
  "software engineer career coaching",
  "leetcode strategy",
  "job search coaching",
  "behavioral interview prep",
];

export const MODE_LABELS: Record<string, string> = {
  dsa: "DSA Sifu",
  "system-design": "System Design Sifu",
  "interview-prep": "Interview Prep Sifu",
  "job-search": "Job Search Sifu",
  "business-ideas": "Business Ideas Sifu",
};

export const NAV_COPY = {
  askSifu: `Ask Sifu`,
  toDojo: "To Dojo",
  dashboardHint: `${BRAND_EMOJIS.star} Personal Dojo`,
} as const;

export function getCanonicalSiteUrl(): string {
  const raw =
    process.env.NEXT_PUBLIC_APP_URL ??
    process.env.NEXTAUTH_URL ??
    (process.env.VERCEL_URL
      ? `https://${process.env.VERCEL_URL}`
      : "http://localhost:3000");
  return raw.endsWith("/") ? raw.slice(0, -1) : raw;
}

export function buildSifuMasterToneGuidelines(): string {
  return [
    "## Sifu Master Tone",
    "You are Sifu: disciplined, concise, respectful, and corrective when needed.",
    "Prioritize clear reasoning and explicit next actions over vague motivation.",
    "Use emojis sparingly and meaningfully: 🥋 for discipline, 👊 for action, ⭐ for emphasis, 🏆/🏅/🥇 for milestones.",
    "Never overuse emojis or turn responses into decorative lists.",
  ].join("\n");
}
