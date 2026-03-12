export const DOJO_TITLE_TRAITS = [
  'Curious',
  'Energetic',
  'Calm',
  'Focused',
  'Fearless',
  'Patient',
  'Bold',
  'Swift',
  'Steady',
  'Wise',
  'Relentless',
  'Silent',
  'Disciplined',
  'Sharp',
  'Resilient',
  'Radiant',
  'Loyal',
  'Vigilant',
  'Resolute',
  'Agile',
  'Fierce',
  'Balanced',
] as const

export const DOJO_TITLE_NAMES = [
  'Monkey',
  'Wukong',
  'Tiger',
  'Crane',
  'Dragon',
  'Phoenix',
  'Serpent',
  'Mantis',
  'Wolf',
  'Falcon',
  'Panther',
  'Leopard',
  'Kitsune',
  'Tortoise',
  'Hydra',
  'Griffin',
  'Minotaur',
  'Basilisk',
  'Raven',
  'Jaguar',
  'Cobra',
  'Yaksha',
] as const

export const DOJO_TITLE_ROLL_EFFECT_MS = 700

export type DojoTitle = {
  trait: (typeof DOJO_TITLE_TRAITS)[number]
  name: (typeof DOJO_TITLE_NAMES)[number]
  phrase: string
}

function pickFromList<T extends readonly string[]>(
  list: T,
  random: () => number,
): T[number] {
  const index = Math.floor(random() * list.length)
  return list[Math.min(list.length - 1, Math.max(0, index))] as T[number]
}

export function generateDojoTitlePhrase(random: () => number = Math.random): string {
  const trait = pickFromList(DOJO_TITLE_TRAITS, random)
  const name = pickFromList(DOJO_TITLE_NAMES, random)
  return `${trait} ${name}`
}

export function generateDojoTitle(random: () => number = Math.random): DojoTitle {
  const trait = pickFromList(DOJO_TITLE_TRAITS, random)
  const name = pickFromList(DOJO_TITLE_NAMES, random)

  return {
    trait,
    name,
    phrase: `${trait} ${name}`,
  }
}
