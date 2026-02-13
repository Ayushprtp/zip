"use client";

import { useState, useCallback, useRef, useEffect } from "react";
import { UIMessageWithCompleted, VoiceChatOptions, VoiceChatSession } from "..";
import { generateUUID } from "lib/utils";
import { ChatModel } from "app-types/chat";

export const PICCY_VOICES = {
  Alloy: "alloy",
  Echo: "echo",
  Fable: "fable",
  Onyx: "onyx",
  Nova: "nova",
  Shimmer: "shimmer",
} as const;

export type PiccyVoice = (typeof PICCY_VOICES)[keyof typeof PICCY_VOICES];

export interface PiccyVoiceChatOptions extends VoiceChatOptions {
  chatModel?: ChatModel;
  voice?: string;
}

const createUIMessage = (m: {
  id?: string;
  role: "user" | "assistant";
  text: string;
  completed?: boolean;
}): UIMessageWithCompleted => {
  return {
    id: m.id ?? generateUUID(),
    role: m.role,
    parts: [{ type: "text", text: m.text }],
    completed: m.completed ?? false,
  };
};

export function usePiccyVoiceChat(
  props?: PiccyVoiceChatOptions,
): VoiceChatSession {
  const { voice = PICCY_VOICES.Alloy, chatModel } = props || {};

  const [isUserSpeaking, setIsUserSpeaking] = useState(false);
  const [isAssistantSpeaking, setIsAssistantSpeaking] = useState(false);
  const [isActive, setIsActive] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [messages, setMessages] = useState<UIMessageWithCompleted[]>([]);

  const recognitionRef = useRef<any>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const conversationRef = useRef<{ role: string; content: string }[]>([]);
  const isProcessingRef = useRef(false);
  const activeRef = useRef(false);
  const listeningRef = useRef(false);

  // VAD (Voice Activity Detection) refs
  const audioContextRef = useRef<AudioContext | null>(null);
  const analyserRef = useRef<AnalyserNode | null>(null);
  const micStreamRef = useRef<MediaStream | null>(null);
  const vadFrameRef = useRef<number>(0);
  const vadSpeakingRef = useRef(false);
  const vadSilenceStartRef = useRef<number>(0);

  // Latest props in refs
  const voiceRef = useRef(voice);
  const chatModelRef = useRef(chatModel);
  useEffect(() => {
    voiceRef.current = voice;
  }, [voice]);
  useEffect(() => {
    chatModelRef.current = chatModel;
  }, [chatModel]);

  // VAD constants
  const VAD_SPEECH_THRESHOLD = 0.015; // RMS threshold to consider as speech
  const VAD_SILENCE_DURATION = 1000; // ms of silence to trigger submit

  // ---- Audio helpers ----

  const stopAudio = useCallback(() => {
    if (audioRef.current) {
      audioRef.current.pause();
      audioRef.current.currentTime = 0;
      audioRef.current = null;
    }
    setIsAssistantSpeaking(false);
  }, []);

  const cleanupVAD = useCallback(() => {
    if (vadFrameRef.current) {
      cancelAnimationFrame(vadFrameRef.current);
      vadFrameRef.current = 0;
    }
    if (audioContextRef.current && audioContextRef.current.state !== "closed") {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    analyserRef.current = null;
    if (micStreamRef.current) {
      micStreamRef.current.getTracks().forEach((t) => t.stop());
      micStreamRef.current = null;
    }
  }, []);

  // ---- TTS ----

  const speakText = useCallback(async (text: string): Promise<void> => {
    try {
      setIsAssistantSpeaking(true);
      const response = await fetch("/api/chat/voice-tts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ voice: voiceRef.current, text }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData?.error?.message || `TTS failed (${response.status})`,
        );
      }

      const audioBlob = await response.blob();
      if (audioBlob.size === 0) throw new Error("Empty audio response");
      const audioUrl = URL.createObjectURL(audioBlob);

      return new Promise<void>((resolve, reject) => {
        const audio = new Audio(audioUrl);
        audioRef.current = audio;
        audio.onended = () => {
          URL.revokeObjectURL(audioUrl);
          setIsAssistantSpeaking(false);
          audioRef.current = null;
          resolve();
        };
        audio.onerror = () => {
          URL.revokeObjectURL(audioUrl);
          setIsAssistantSpeaking(false);
          audioRef.current = null;
          reject(new Error("Audio playback failed"));
        };
        audio.play().catch((e) => {
          URL.revokeObjectURL(audioUrl);
          setIsAssistantSpeaking(false);
          audioRef.current = null;
          reject(e);
        });
      });
    } catch (err) {
      setIsAssistantSpeaking(false);
      throw err;
    }
  }, []);

  // ---- LLM completion ----

  const getCompletion = useCallback(
    async (userText: string): Promise<string> => {
      conversationRef.current.push({ role: "user", content: userText });

      const selectedModel = chatModelRef.current || {
        provider: "custom",
        model: "gpt-4o-mini",
      };

      const response = await fetch("/api/chat/voice-completion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: conversationRef.current,
          chatModel: selectedModel,
        }),
      });

      if (!response.ok) {
        const errData = await response.json().catch(() => ({}));
        throw new Error(
          errData?.error?.message || `Completion failed (${response.status})`,
        );
      }

      const data = await response.json();
      const assistantText = data.text || "";
      conversationRef.current.push({
        role: "assistant",
        content: assistantText,
      });
      return assistantText;
    },
    [],
  );

  // ---- Process speech ----

  const processUserSpeech = useCallback(
    async (transcript: string) => {
      if (isProcessingRef.current || !transcript.trim()) return;
      isProcessingRef.current = true;

      setMessages((prev) => [
        ...prev,
        createUIMessage({ role: "user", text: transcript, completed: true }),
      ]);

      const assistantId = generateUUID();
      setMessages((prev) => [
        ...prev,
        createUIMessage({
          id: assistantId,
          role: "assistant",
          text: "",
          completed: false,
        }),
      ]);

      try {
        const responseText = await getCompletion(transcript);

        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [{ type: "text" as const, text: responseText }],
                  completed: true,
                }
              : m,
          ),
        );

        try {
          await speakText(responseText);
        } catch (e) {
          console.warn("TTS failed:", e);
        }
      } catch (err) {
        console.error("Voice chat error:", err);
        setMessages((prev) =>
          prev.map((m) =>
            m.id === assistantId
              ? {
                  ...m,
                  parts: [
                    {
                      type: "text" as const,
                      text:
                        err instanceof Error
                          ? `Error: ${err.message}`
                          : "Something went wrong",
                    },
                  ],
                  completed: true,
                }
              : m,
          ),
        );
      } finally {
        isProcessingRef.current = false;
      }
    },
    [getCompletion, speakText],
  );

  const processRef = useRef(processUserSpeech);
  useEffect(() => {
    processRef.current = processUserSpeech;
  }, [processUserSpeech]);

  // ---- VAD: real-time voice activity detection via AudioContext ----

  const startVAD = useCallback(async () => {
    if (audioContextRef.current) return;

    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
        },
      });
      micStreamRef.current = stream;

      const ctx = new AudioContext();
      audioContextRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 512;
      analyser.smoothingTimeConstant = 0.3;
      source.connect(analyser);
      analyserRef.current = analyser;

      const dataArray = new Float32Array(analyser.fftSize);

      const checkVAD = () => {
        if (!activeRef.current || !listeningRef.current) {
          vadFrameRef.current = 0;
          return;
        }

        analyser.getFloatTimeDomainData(dataArray);

        // Calculate RMS (root mean square) for volume level
        let sum = 0;
        for (let i = 0; i < dataArray.length; i++) {
          sum += dataArray[i] * dataArray[i];
        }
        const rms = Math.sqrt(sum / dataArray.length);

        const now = Date.now();

        if (rms > VAD_SPEECH_THRESHOLD) {
          // Voice detected
          if (!vadSpeakingRef.current) {
            vadSpeakingRef.current = true;
            setIsUserSpeaking(true);
          }
          vadSilenceStartRef.current = 0;
        } else {
          // Silence
          if (vadSpeakingRef.current) {
            if (vadSilenceStartRef.current === 0) {
              vadSilenceStartRef.current = now;
            } else if (
              now - vadSilenceStartRef.current >
              VAD_SILENCE_DURATION
            ) {
              vadSpeakingRef.current = false;
              vadSilenceStartRef.current = 0;
              setIsUserSpeaking(false);
            }
          }
        }

        vadFrameRef.current = requestAnimationFrame(checkVAD);
      };

      vadFrameRef.current = requestAnimationFrame(checkVAD);
    } catch (err) {
      console.warn("VAD init failed:", err);
    }
  }, []);

  // ---- Speech recognition ----

  const startRecognition = useCallback(() => {
    if (typeof window === "undefined") return;

    const SpeechRecognitionClass =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;

    if (!SpeechRecognitionClass) {
      setError(
        new Error("Speech recognition not supported. Use Chrome or Edge."),
      );
      return;
    }

    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }

    const createAndStartRecognition = () => {
      const recognition = new SpeechRecognitionClass();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = "en-US";
      recognition.maxAlternatives = 3;

      let finalTranscript = "";
      let interimTranscript = "";
      let submitTimer: ReturnType<typeof setTimeout> | null = null;

      const SUBMIT_DELAY = 900; // ms — fast submit after final result + silence

      const clearSubmitTimer = () => {
        if (submitTimer) {
          clearTimeout(submitTimer);
          submitTimer = null;
        }
      };

      const submitTranscript = () => {
        clearSubmitTimer();
        const text = (finalTranscript || interimTranscript).trim();
        finalTranscript = "";
        interimTranscript = "";

        if (text && !isProcessingRef.current) {
          try {
            recognition.stop();
          } catch {}
          processRef.current(text);
        }
      };

      recognition.onresult = (event: any) => {
        let interim = "";
        let final = "";

        for (let i = 0; i < event.results.length; i++) {
          const result = event.results[i];
          if (result.isFinal) {
            let best = result[0];
            for (let j = 1; j < result.length; j++) {
              if (result[j].confidence > best.confidence) best = result[j];
            }
            final += best.transcript;
          } else {
            interim += result[0].transcript;
          }
        }

        if (final) {
          finalTranscript = final;
          interimTranscript = "";
          // Submit quickly once we have a final result and VAD says silence
          clearSubmitTimer();
          submitTimer = setTimeout(() => {
            if (!vadSpeakingRef.current) {
              submitTranscript();
            } else {
              // User still speaking — wait a bit more
              submitTimer = setTimeout(submitTranscript, SUBMIT_DELAY);
            }
          }, SUBMIT_DELAY);
        } else if (interim) {
          interimTranscript = interim;
          // If we've been waiting with interim for too long, submit
          clearSubmitTimer();
          submitTimer = setTimeout(submitTranscript, SUBMIT_DELAY * 2);
        }
      };

      recognition.onspeechend = () => {
        if (finalTranscript || interimTranscript) {
          clearSubmitTimer();
          submitTimer = setTimeout(submitTranscript, 500);
        }
      };

      recognition.onend = () => {
        clearSubmitTimer();

        const text = (finalTranscript || interimTranscript).trim();
        if (text && !isProcessingRef.current) {
          finalTranscript = "";
          interimTranscript = "";
          processRef.current(text);
        }

        // Auto-restart
        if (activeRef.current && listeningRef.current) {
          setTimeout(() => {
            if (activeRef.current && listeningRef.current) {
              try {
                recognitionRef.current = createAndStartRecognition();
              } catch (err) {
                console.warn("Restart failed:", err);
              }
            }
          }, 150); // faster restart
        }
      };

      recognition.onerror = (event: any) => {
        if (event.error === "no-speech" || event.error === "aborted") return;
        console.error("Speech recognition error:", event.error);
        if (event.error === "not-allowed") {
          setError(new Error("Microphone access denied. Allow mic and retry."));
        }
      };

      recognition.start();
      return recognition;
    };

    try {
      recognitionRef.current = createAndStartRecognition();
      listeningRef.current = true;
      setIsListening(true);
    } catch (err) {
      setError(
        err instanceof Error ? err : new Error("Failed to start recognition"),
      );
    }
  }, []);

  const stopRecognition = useCallback(() => {
    listeningRef.current = false;
    if (recognitionRef.current) {
      try {
        recognitionRef.current.abort();
      } catch {}
      recognitionRef.current = null;
    }
    setIsListening(false);
    setIsUserSpeaking(false);
    vadSpeakingRef.current = false;
  }, []);

  // ---- Public API ----

  const start = useCallback(async () => {
    if (isActive || isLoading) return;
    setIsLoading(true);
    setError(null);
    setMessages([]);
    conversationRef.current = [];

    try {
      if (typeof window === "undefined") throw new Error("Not in browser");

      const SpeechRecognitionClass =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (!SpeechRecognitionClass)
        throw new Error(
          "Speech recognition not supported. Use Chrome or Edge.",
        );

      activeRef.current = true;
      setIsActive(true);
      setIsLoading(false);

      // Start VAD + speech recognition in parallel
      await startVAD();
      startRecognition();
    } catch (err) {
      setError(err instanceof Error ? err : new Error(String(err)));
      setIsActive(false);
      setIsLoading(false);
      activeRef.current = false;
    }
  }, [isActive, isLoading, startRecognition, startVAD]);

  const stop = useCallback(async () => {
    activeRef.current = false;
    stopRecognition();
    cleanupVAD();
    stopAudio();
    setIsActive(false);
    setIsListening(false);
    setIsLoading(false);
    isProcessingRef.current = false;
  }, [stopRecognition, cleanupVAD, stopAudio]);

  const startListening = useCallback(async () => {
    if (!isActive) return;
    await startVAD();
    startRecognition();
  }, [isActive, startRecognition, startVAD]);

  const stopListening = useCallback(async () => {
    stopRecognition();
    cleanupVAD();
  }, [stopRecognition, cleanupVAD]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      activeRef.current = false;
      listeningRef.current = false;
      if (recognitionRef.current) {
        try {
          recognitionRef.current.abort();
        } catch {}
      }
      cleanupVAD();
      stopAudio();
    };
  }, [cleanupVAD, stopAudio]);

  return {
    isActive,
    isUserSpeaking,
    isAssistantSpeaking,
    isListening,
    isLoading,
    error,
    messages,
    start,
    stop,
    startListening,
    stopListening,
  };
}
