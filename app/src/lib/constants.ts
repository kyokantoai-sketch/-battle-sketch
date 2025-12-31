export type StyleOption = {
  id: string;
  label: string;
  prompt: string;
};

export const STYLE_POOL: StyleOption[] = [
  {
    id: "hardboiled",
    label: "ハードボイルド",
    prompt:
      "hard-boiled pulp illustration, cinematic lighting, gritty textures, dramatic shadows",
  },
  {
    id: "deformed",
    label: "デフォルメ",
    prompt:
      "cute chibi proportions, big expressive eyes, rounded shapes, playful color palette",
  },
  {
    id: "real",
    label: "リアル",
    prompt:
      "realistic fantasy portrait, detailed materials, lifelike lighting, high clarity",
  },
  {
    id: "storybook",
    label: "絵本",
    prompt:
      "storybook illustration, soft brush strokes, warm pastel palette, gentle atmosphere",
  },
  {
    id: "anime",
    label: "アニメ",
    prompt:
      "anime illustration, clean line art, vibrant highlights, dynamic pose",
  },
  {
    id: "ink",
    label: "水墨",
    prompt:
      "ink wash painting style, sumi-e textures, flowing brush lines, restrained colors",
  },
];

export const SAFE_CONTENT_RULES =
  "Keep it safe for kids: no gore, no blood, no sexual content, no hate, no real-world violence. Avoid text or logos.";

export const ROOM_CODE_LENGTH = 6;

export const DEFAULT_LIMITS = {
  charLimit: 50,
  storyMin: 300,
  storyMax: 500,
};

