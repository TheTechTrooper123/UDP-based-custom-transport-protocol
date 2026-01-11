import { GoogleGenAI } from "@google/genai";
import { ConnectionState, Packet } from "../types";

const apiKey = process.env.API_KEY || '';

// Safely initialize the client only if key exists, otherwise we handle it gracefully in calls
const getAiClient = () => {
  if (!apiKey) return null;
  return new GoogleGenAI({ apiKey });
};

export const analyzePacket = async (packet: Packet, state: ConnectionState): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "API Key not configured. Cannot analyze packet.";

  const prompt = `
    You are a network security expert analyzing a custom UDP transport protocol.
    Analyze this packet in the context of the connection state: "${state}".
    
    Packet Details:
    - Flag: ${packet.flag}
    - Sequence: ${packet.seq}
    - Ack: ${packet.ack}
    - Payload: "${packet.payload}"
    - SessionID: ${packet.sessionId || 'None'}

    Explain briefly (max 2 sentences) what this packet does in the handshake or data transfer process and if it looks valid.
  `;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: prompt,
    });
    return response.text || "No analysis available.";
  } catch (error) {
    console.error("Gemini analysis failed", error);
    return "Analysis failed due to network error.";
  }
};

export const generateSecurePayload = async (): Promise<string> => {
  const ai = getAiClient();
  if (!ai) return "Mock Secure Data Payload";

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: "Generate a short, hex-encoded string representing a secure encrypted payload (e.g. '0x4A...'). Max 20 chars.",
    });
    return response.text?.trim() || "0xDEADBEEF";
  } catch (error) {
    return "0xCAFEBABE";
  }
};
