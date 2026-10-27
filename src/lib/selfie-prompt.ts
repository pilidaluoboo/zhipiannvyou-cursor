/**
 * Multi-dimensional selfie prompt builder.
 * Keeps identity via appearance + reference avatar; varies angle / shot / scene.
 */

export const SELFIE_CAMERA_ANGLES = [
  "front-facing photo from a natural conversational distance",
  "slight high-angle view looking gently downward",
  "three-quarter left view of the face and upper body",
  "three-quarter right view of the face and upper body",
  "soft side-profile with the face partially turned away",
  "mirror reflection with a phone lightly visible at the edge",
  "candid angle as if shot from across a small table",
  "over-the-shoulder mirror angle",
  "low seated angle looking slightly upward",
  "dutch-tilted casual handheld angle",
] as const;

export const SELFIE_SHOT_TYPES = [
  "tight facial close-up with ambient background blur",
  "head-and-shoulders framing",
  "waist-up framing",
  "half-body framing from mid-thigh up",
  "three-quarter body framing",
  "full-body framing with visible surroundings",
  "environmental medium shot with the subject not filling the whole frame",
] as const;

export const SELFIE_SCENES = [
  "in a cozy bedroom with soft textiles",
  "by a sunlit window with sheer curtains",
  "in a quiet cafe with wooden tables",
  "in a bookstore aisle between shelves",
  "on a balcony at sunset",
  "at a desk with books and a cup of tea",
  "in front of a bathroom mirror",
  "in a softly lit kitchen",
  "on a quiet city street sidewalk",
  "in a small indoor plant corner",
  "sitting on a sofa in a lived-in living room",
] as const;

export const SELFIE_POSES = [
  "looking toward the camera with a natural expression",
  "glancing slightly away from the lens",
  "holding a cup near the chest",
  "holding an open book",
  "adjusting hair with one hand",
  "sitting casually by the window",
  "leaning lightly against a wall",
  "captured mid-step while walking",
  "resting one hand on a table",
  "chin resting lightly on the back of the hand",
] as const;

export const SELFIE_LIGHTING = [
  "soft natural daylight",
  "warm indoor light",
  "gentle morning light",
  "golden hour sunset light",
  "cool overcast daylight",
  "soft evening lamp light",
] as const;

export const SELFIE_COMPOSITION_HINTS = [
  "varied framing with breathing room around the subject",
  "asymmetrical composition",
  "avoid repetitive centered portrait composition",
  "natural candid composition",
  "do not always place the face centered and front-facing",
  "subject slightly off-center following rule of thirds",
] as const;

export type SelfiePromptDimensions = {
  cameraAngle: string;
  shotType: string;
  scene: string;
  pose: string;
  lighting: string;
  composition: string;
};

export type SelfiePromptResult = {
  prompt: string;
  dimensions: SelfiePromptDimensions;
};

type RecentEntry = {
  cameraAngle: string;
  shotType: string;
  scene: string;
};

/** Session-local recent combos per character (module memory, no DB). */
const recentByGirlfriend = new Map<string, RecentEntry[]>();
const RECENT_LIMIT = 3;

function pickRandom<T>(items: readonly T[]): T {
  return items[Math.floor(Math.random() * items.length)]!;
}

function pickAvoiding(
  items: readonly string[],
  avoided: Set<string>
): string {
  const preferred = items.filter((item) => !avoided.has(item));
  const pool = preferred.length > 0 ? preferred : [...items];
  return pickRandom(pool);
}

function getRecent(girlfriendId: string): RecentEntry[] {
  return recentByGirlfriend.get(girlfriendId) ?? [];
}

function remember(girlfriendId: string, entry: RecentEntry) {
  const next = [...getRecent(girlfriendId), entry].slice(-RECENT_LIMIT);
  recentByGirlfriend.set(girlfriendId, next);
}

/** Exposed for tests / debugging. */
export function resetSelfiePromptHistory(girlfriendId?: string) {
  if (girlfriendId) recentByGirlfriend.delete(girlfriendId);
  else recentByGirlfriend.clear();
}

export function buildSelfiePrompt(options: {
  girlfriendId: string;
  name: string;
  appearance: string;
  /** Optional character-flavored pose hints (legacy selfieVariations). */
  characterPoseHints?: string[];
}): SelfiePromptResult {
  const recent = getRecent(options.girlfriendId);
  const avoidedAngles = new Set(recent.map((r) => r.cameraAngle));
  const avoidedShots = new Set(recent.map((r) => r.shotType));
  const avoidedScenes = new Set(recent.map((r) => r.scene));

  // If the last shot was a close-up, prefer non-close-up this round.
  const lastShot = recent[recent.length - 1]?.shotType ?? "";
  if (lastShot.toLowerCase().includes("close-up")) {
    for (const shot of SELFIE_SHOT_TYPES) {
      if (shot.toLowerCase().includes("close-up")) avoidedShots.add(shot);
    }
  }

  const cameraAngle = pickAvoiding(SELFIE_CAMERA_ANGLES, avoidedAngles);
  const shotType = pickAvoiding(SELFIE_SHOT_TYPES, avoidedShots);
  const scene = pickAvoiding(SELFIE_SCENES, avoidedScenes);
  const posePool =
    options.characterPoseHints && options.characterPoseHints.length > 0
      ? [...SELFIE_POSES, ...options.characterPoseHints]
      : SELFIE_POSES;
  const pose = pickRandom(posePool);
  const lighting = pickRandom(SELFIE_LIGHTING);
  const composition = pickRandom(SELFIE_COMPOSITION_HINTS);

  const dimensions: SelfiePromptDimensions = {
    cameraAngle,
    shotType,
    scene,
    pose,
    lighting,
    composition,
  };

  remember(options.girlfriendId, {
    cameraAngle,
    shotType,
    scene,
  });

  const prompt = [
    `Photorealistic lifestyle photo of ${options.name}, the same young Asian woman as the reference avatar image.`,
    `Keep consistent identity with the reference: ${options.appearance}.`,
    `Match face, hair, and overall look to the reference avatar; do not invent a different person.`,
    `Camera angle: ${cameraAngle}.`,
    `Shot type / framing: ${shotType}.`,
    `Location: ${scene}.`,
    `Action / pose: ${pose}.`,
    `Lighting: ${lighting}.`,
    `Composition: ${composition}.`,
    `Allow natural variation in camera angle, distance, and scene.`,
    `Avoid always generating a centered front-facing close-up ID-photo style portrait.`,
    `Do not force 85mm studio portrait framing every time.`,
    `Casual real-world photo, natural skin texture, realistic depth of field.`,
  ].join(" ");

  return { prompt, dimensions };
}
