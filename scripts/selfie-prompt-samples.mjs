/**
 * Simulate selfie prompt diversity (no network / no Seedream).
 * Run: node scripts/selfie-prompt-samples.mjs
 */

const SELFIE_CAMERA_ANGLES = [
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
];
const SELFIE_SHOT_TYPES = [
  "tight facial close-up with ambient background blur",
  "head-and-shoulders framing",
  "waist-up framing",
  "half-body framing from mid-thigh up",
  "three-quarter body framing",
  "full-body framing with visible surroundings",
  "environmental medium shot with the subject not filling the whole frame",
];
const SELFIE_SCENES = [
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
];
const SELFIE_POSES = [
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
];
const SELFIE_LIGHTING = [
  "soft natural daylight",
  "warm indoor light",
  "gentle morning light",
  "golden hour sunset light",
  "cool overcast daylight",
  "soft evening lamp light",
];
const SELFIE_COMPOSITION_HINTS = [
  "varied framing with breathing room around the subject",
  "asymmetrical composition",
  "avoid repetitive centered portrait composition",
  "natural candid composition",
  "do not always place the face centered and front-facing",
  "subject slightly off-center following rule of thirds",
];

const recent = [];
const RECENT_LIMIT = 3;

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}
function pickAvoid(items, avoided) {
  const preferred = items.filter((i) => !avoided.has(i));
  return pick(preferred.length ? preferred : items);
}

function build(appearance = "金黄色及腰长发，碧蓝大眼，青春靓丽") {
  const avoidedA = new Set(recent.map((r) => r.cameraAngle));
  const avoidedS = new Set(recent.map((r) => r.shotType));
  const avoidedSc = new Set(recent.map((r) => r.scene));
  const lastShot = recent[recent.length - 1]?.shotType || "";
  if (lastShot.toLowerCase().includes("close-up")) {
    for (const s of SELFIE_SHOT_TYPES) {
      if (s.toLowerCase().includes("close-up")) avoidedS.add(s);
    }
  }
  const dims = {
    cameraAngle: pickAvoid(SELFIE_CAMERA_ANGLES, avoidedA),
    shotType: pickAvoid(SELFIE_SHOT_TYPES, avoidedS),
    scene: pickAvoid(SELFIE_SCENES, avoidedSc),
    pose: pick(SELFIE_POSES),
    lighting: pick(SELFIE_LIGHTING),
    composition: pick(SELFIE_COMPOSITION_HINTS),
  };
  recent.push(dims);
  if (recent.length > RECENT_LIMIT) recent.shift();

  const prompt = [
    `Photorealistic lifestyle photo of 小柠, the same young Asian woman as the reference avatar image.`,
    `Keep consistent identity with the reference: ${appearance}.`,
    `Match face, hair, and overall look to the reference avatar; do not invent a different person.`,
    `Camera angle: ${dims.cameraAngle}.`,
    `Shot type / framing: ${dims.shotType}.`,
    `Location: ${dims.scene}.`,
    `Action / pose: ${dims.pose}.`,
    `Lighting: ${dims.lighting}.`,
    `Composition: ${dims.composition}.`,
    `Allow natural variation in camera angle, distance, and scene.`,
    `Avoid always generating a centered front-facing close-up ID-photo style portrait.`,
    `Do not force 85mm studio portrait framing every time.`,
    `Casual real-world photo, natural skin texture, realistic depth of field.`,
  ].join(" ");
  return { dims, prompt };
}

let frontClose = 0;
const keys = new Set();
console.log("=== 10 simulated selfie prompts ===\n");
for (let i = 1; i <= 10; i++) {
  const { dims, prompt } = build();
  const key = `${dims.cameraAngle}|${dims.shotType}|${dims.scene}`;
  keys.add(key);
  const isFrontClose =
    dims.cameraAngle.includes("front-facing") &&
    dims.shotType.toLowerCase().includes("close-up");
  if (isFrontClose) frontClose += 1;
  console.log(`#${i}`);
  console.log(`  angle: ${dims.cameraAngle}`);
  console.log(`  shot:  ${dims.shotType}`);
  console.log(`  scene: ${dims.scene}`);
  console.log(`  pose:  ${dims.pose}`);
  console.log(`  light: ${dims.lighting}`);
  console.log(`  prompt_len=${prompt.length}`);
  console.log("");
}

console.log("unique combos:", keys.size, "/ 10");
console.log("front-facing+close-up count:", frontClose);
if (keys.size < 8) {
  console.error("FAIL: too many repeated combos");
  process.exit(1);
}
if (frontClose > 2) {
  console.error("FAIL: too many front close-ups");
  process.exit(1);
}
console.log("OK diversity check passed");
