const GEMINI_BASE_URL =
  "https://generativelanguage.googleapis.com/v1beta/models";

const safetySettings = [
  { category: "HARM_CATEGORY_HATE_SPEECH", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_HARASSMENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_SEXUALLY_EXPLICIT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
  { category: "HARM_CATEGORY_DANGEROUS_CONTENT", threshold: "BLOCK_MEDIUM_AND_ABOVE" },
];

type GeminiInlineData = {
  mimeType?: string;
  mime_type?: string;
  data: string;
};

type GeminiPart =
  | { text: string }
  | { inlineData: GeminiInlineData }
  | { inline_data: GeminiInlineData };

async function callGemini(model: string, body: Record<string, unknown>) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const response = await fetch(
    `${GEMINI_BASE_URL}/${model}:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        safetySettings,
        ...body,
      }),
    }
  );

  const data = await response.json();
  if (!response.ok) {
    const message = data?.error?.message || "Gemini API error";
    throw new Error(message);
  }

  return data;
}

function extractText(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  return parts
    .map((part: any) => (typeof part.text === "string" ? part.text : ""))
    .join("");
}

function extractImage(data: any) {
  const parts = data?.candidates?.[0]?.content?.parts || [];
  for (const part of parts) {
    const inline = part?.inlineData || part?.inline_data;
    if (inline?.data) {
      return {
        base64: inline.data as string,
        mimeType:
          (inline.mimeType as string) ||
          (inline.mime_type as string) ||
          "image/png",
      };
    }
  }
  return null;
}

export async function generateText({
  model,
  prompt,
  images,
}: {
  model: string;
  prompt: string;
  images?: { base64: string; mimeType: string }[];
}) {
  const parts: GeminiPart[] = [{ text: prompt }];
  if (images?.length) {
    images.forEach((image) => {
      parts.push({
        inlineData: { mimeType: image.mimeType, data: image.base64 },
      });
    });
  }

  const data = await callGemini(model, {
    contents: [{ role: "user", parts }],
    generationConfig: { temperature: 0.8 },
  });

  return extractText(data).trim();
}

export async function generateImage({
  model,
  prompt,
  images,
}: {
  model: string;
  prompt: string;
  images?: { base64: string; mimeType: string }[];
}) {
  const parts: GeminiPart[] = [{ text: prompt }];
  if (images?.length) {
    images.forEach((image) => {
      parts.push({
        inlineData: { mimeType: image.mimeType, data: image.base64 },
      });
    });
  }

  const data = await callGemini(model, {
    contents: [{ role: "user", parts }],
    generationConfig: {
      temperature: 0.7,
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const image = extractImage(data);
  if (!image) {
    const finishReason =
      data?.candidates?.[0]?.finishReason || data?.candidates?.[0]?.finish_reason;
    const text = extractText(data);
    const detail = [
      "Gemini image response missing image data",
      finishReason ? `finishReason=${finishReason}` : null,
      text ? `text=${text.slice(0, 200)}` : null,
    ]
      .filter(Boolean)
      .join(" | ");
    throw new Error(detail);
  }

  return image;
}
