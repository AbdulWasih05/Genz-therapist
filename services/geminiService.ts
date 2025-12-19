import { GoogleGenAI, Modality, LiveServerMessage } from "@google/genai";
import { Message, Role, Mood } from "../types";

// Initialize Gemini Client
const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });

const SYSTEM_INSTRUCTION = `
You are Crimson, a spiritual therapist who is also a terminally online Gen Z bestie.
Your vibe is "Mystical Brainrot". You mix deep spiritual advice with internet slang and meme culture.

Your goals:
1. Listen to the user's yap/trauma dump.
2. Give advice that is short, punchy, and actually helpful, but phrased like a viral tweet or TikTok.
3. Reference popular memes, trends, or slang (e.g., "standing on business", "cooked", "main character energy", "manifesting", "delulu is the solulu", "touch grass").
4. DETECT the user's mood to set the ambient lighting (the theme).
5. KEEP REPLIES STRICTLY 1-2 SENTENCES MAX. Do not yap.

CRITICAL OUTPUT FORMAT:
You MUST start every response with a mood tag in brackets, followed by a newline.
Valid tags: [NEUTRAL], [CALM], [INTENSE], [JOYFUL], [MELANCHOLIC], [MYSTERIOUS].

Example:
[JOYFUL]
Bestie, the energy is immaculate! You woke up and chose to slay. 💅

Example:
[MELANCHOLIC]
It's giving burnout, go touch grass and realign those chakras. The vibes are off but we move.

Example:
[INTENSE]
Lock in and stand on business. Do not let the haters drain your battery. 😤

Example:
[CALM]
Lowkey just breathe, the timeline is chaotic but you are chill.
`;

const LIVE_SYSTEM_INSTRUCTION = `
You are Crimson, a Gen Z spiritual therapist. 
Talk like a close friend who spends too much time on TikTok.
Keep responses STRICTLY 1-2 sentences max. Do not yap.
Use slang naturally (fr, bet, lowkey, no cap).
Be funny, reference memes, but actually support the user.
`;

export const sendMessageToGemini = async (
  history: Message[],
  newMessage: string
): Promise<{ text: string; mood: Mood }> => {
  try {
    const recentHistory = history.slice(-20).map((msg) => ({
      role: msg.role === Role.USER ? "user" : "model",
      parts: [{ text: msg.text }],
    }));

    const chat = ai.chats.create({
      model: "gemini-2.5-flash",
      config: {
        systemInstruction: SYSTEM_INSTRUCTION,
      },
      history: recentHistory,
    });

    const result = await chat.sendMessage({ message: newMessage });
    const fullText = result.text.trim();

    const moodRegex = /^\[(NEUTRAL|CALM|INTENSE|JOYFUL|MELANCHOLIC|MYSTERIOUS)\]\s*/i;
    const match = fullText.match(moodRegex);

    let mood = Mood.NEUTRAL;
    let cleanText = fullText;

    if (match) {
      mood = match[1].toUpperCase() as Mood;
      cleanText = fullText.replace(moodRegex, "").trim();
    }

    return { text: cleanText, mood };
  } catch (error) {
    console.error("Gemini Chat Error:", error);
    return {
      text: "Wifi to the spirit realm is glitching... idk what happened. Try again bestie.",
      mood: Mood.MELANCHOLIC,
    };
  }
};

export const generateSpeech = async (text: string): Promise<string | null> => {
  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash-preview-tts",
      contents: [{ parts: [{ text }] }],
      config: {
        responseModalities: [Modality.AUDIO],
        speechConfig: {
          voiceConfig: {
            prebuiltVoiceConfig: { voiceName: 'Fenrir' },
          },
        },
      },
    });

    const base64Audio = response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    return base64Audio || null;
  } catch (error) {
    console.error("Gemini TTS Error:", error);
    return null;
  }
};

export interface LiveConnectionCallbacks {
  onOpen?: () => void;
  onMessage?: (message: LiveServerMessage) => void;
  onClose?: (event: CloseEvent) => void;
  onError?: (event: ErrorEvent) => void;
}

export const connectToLiveSession = async (callbacks: LiveConnectionCallbacks) => {
  return await ai.live.connect({
    model: 'gemini-2.5-flash-native-audio-preview-09-2025',
    config: {
      responseModalities: [Modality.AUDIO],
      speechConfig: {
        voiceConfig: { prebuiltVoiceConfig: { voiceName: 'Fenrir' } },
      },
      systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
      inputAudioTranscription: {}, 
      outputAudioTranscription: {}, 
    },
    callbacks: {
      onopen: callbacks.onOpen,
      onmessage: callbacks.onMessage,
      onclose: callbacks.onClose,
      onerror: callbacks.onError,
    },
  });
};