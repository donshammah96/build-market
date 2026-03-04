import { useQuery } from "@tanstack/react-query";
import { useState } from "react";

export const useGemini = () => {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [data, setData] = useState(null);

  const generate = async (
    prompt: string,
    systemInstruction: string,
    jsonMode = false,
  ) => {
    setLoading(true);
    setError(null);
    const apiKey = process.env.NEXT_PUBLIC_GEMINI_API_KEY;

    try {
      const payload = {
        contents: [{ parts: [{ text: prompt }] }],
        systemInstruction: { parts: [{ text: systemInstruction }] },
        generationConfig: jsonMode
          ? { responseMimeType: "application/json" }
          : undefined,
      };

      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(payload),
        },
      );

      if (!response.ok) throw new Error("AI Service temporarily unavailable");

      const result = await response.json();
      const text = result.candidates?.[0]?.content?.parts?.[0]?.text;

      setData(jsonMode ? JSON.parse(text) : text);
      return jsonMode ? JSON.parse(text) : text;
    } catch (err: any) {
      setError(err.message);
      return null;
    } finally {
      setLoading(false);
    }
  };

  return { generate, loading, error, data, setData };
};
