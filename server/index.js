import express from 'express';
import cors from 'cors';
import dotenv from 'dotenv';
import fetch from 'node-fetch';

dotenv.config();
const app = express();
app.use(cors());
app.use(express.json({ limit: '25mb' }));

// helper: wait a bit
const wait = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// helper: call Gemini with automatic retry on overload/rate-limit
async function callGemini(payload, retries = 3) {
  for (let attempt = 0; attempt < retries; attempt++) {
    const response = await fetch(
      "https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-latest:generateContent?key=" + process.env.GEMINI_API_KEY,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      }
    );

    const data = await response.json();

    const isOverloaded = data.error && (data.error.code === 503 || data.error.code === 429);

    if (isOverloaded && attempt < retries - 1) {
      console.log(`Gemini busy (attempt ${attempt + 1}/${retries}), retrying in ${(attempt + 1) * 2}s...`);
      await wait((attempt + 1) * 2000); // 2s, 4s, 6s backoff
      continue;
    }

    return data;
  }
}

app.post('/generate-notes', async (req, res) => {
  const { concept, style } = req.body;

  const prompts = {
    brief: `Give a short 5-bullet summary of: ${concept}`,
    detailed: `Give detailed notes with examples on: ${concept}`,
    exam: `Give exam-focused notes with key definitions and formulas for: ${concept}`
  };

  try {
    const data = await callGemini({
      contents: [{ parts: [{ text: prompts[style] }] }]
    });

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      if (data.error) {
        return res.status(503).json({ error: "Gemini is currently busy. Please try again shortly." });
      }
      console.error("Unexpected Gemini response shape:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini couldn't generate notes" });
    }

    const text = data.candidates[0].content.parts[0].text;
    res.json({ text });
  } catch (err) {
    console.error("generate-notes error:", err);
    res.status(500).json({ error: "Failed to generate notes" });
  }
});

app.post('/extract-image-text', async (req, res) => {
  const { imageBase64, mimeType } = req.body;

  if (!imageBase64 || !mimeType) {
    return res.status(400).json({ error: "Missing image data" });
  }

  try {
    const data = await callGemini({
      contents: [{
        parts: [
          { text: "Extract all readable text from this image. Return only the extracted text, nothing else." },
          { inline_data: { mime_type: mimeType, data: imageBase64 } }
        ]
      }]
    });

    if (!data.candidates || !data.candidates[0] || !data.candidates[0].content) {
      if (data.error) {
        return res.status(503).json({ error: "Gemini is currently busy. Please try again shortly." });
      }
      console.error("Unexpected Gemini response shape:", JSON.stringify(data));
      return res.status(500).json({ error: "Gemini couldn't process this image" });
    }

    const text = data.candidates[0].content.parts[0].text;
    res.json({ text });
  } catch (err) {
    console.error("extract-image-text error:", err);
    res.status(500).json({ error: "Failed to extract text from image" });
  }
});

app.listen(3001, () => console.log("Server running on http://localhost:3001"));