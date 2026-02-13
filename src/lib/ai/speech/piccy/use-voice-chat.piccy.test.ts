/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { renderHook, act, waitFor } from "@testing-library/react";
import { usePiccyVoiceChat, PICCY_VOICES } from "./use-voice-chat.piccy";

// ---- Mock browser APIs ----

// Audio mock
class MockAudio {
  src = "";
  onended: (() => void) | null = null;
  onerror: (() => void) | null = null;
  async play() {
    // Simulate playback completing after a tick
    setTimeout(() => this.onended?.(), 10);
  }
  pause() {}
  set currentTime(_: number) {}
}

// SpeechRecognition mock
class MockSpeechRecognition {
  continuous = false;
  interimResults = false;
  lang = "";
  maxAlternatives = 1;
  onresult: ((event: any) => void) | null = null;
  onspeechstart: (() => void) | null = null;
  onspeechend: (() => void) | null = null;
  onend: (() => void) | null = null;
  onerror: ((event: any) => void) | null = null;
  _started = false;

  start() {
    this._started = true;
  }
  stop() {
    this._started = false;
    // Schedule onend like the real API
    setTimeout(() => this.onend?.(), 5);
  }
  abort() {
    this._started = false;
  }

  // Test helper: simulate a final speech result
  simulateFinalResult(text: string, confidence = 0.95) {
    this.onresult?.({
      results: [
        {
          isFinal: true,
          length: 1,
          0: { transcript: text, confidence },
          [Symbol.iterator]: function* () {
            yield { transcript: text, confidence };
          },
        },
      ],
      length: 1,
    });
  }

  // Test helper: simulate an interim speech result
  simulateInterimResult(text: string) {
    this.onresult?.({
      results: [
        {
          isFinal: false,
          length: 1,
          0: { transcript: text, confidence: 0.5 },
        },
      ],
      length: 1,
    });
  }

  // Test helper: simulate speech end
  simulateSpeechEnd() {
    this.onspeechend?.();
  }

  // Test helper: simulate recognition end
  simulateEnd() {
    this.onend?.();
  }

  // Test helper: simulate error
  simulateError(error: string) {
    this.onerror?.({ error });
  }
}

// AudioContext / AnalyserNode mock
class MockAnalyserNode {
  fftSize = 2048;
  smoothingTimeConstant = 0.8;
  getFloatTimeDomainData(arr: Float32Array) {
    // Simulate silence by default
    arr.fill(0);
  }
  connect() {}
  disconnect() {}
}

class MockMediaStreamSource {
  connect() {}
  disconnect() {}
}

class MockAudioContext {
  state = "running";
  createMediaStreamSource() {
    return new MockMediaStreamSource();
  }
  createAnalyser() {
    return new MockAnalyserNode();
  }
  async close() {
    this.state = "closed";
  }
}

// MediaStream mock
class MockMediaStream {
  _tracks = [{ stop: vi.fn(), kind: "audio" }];
  getTracks() {
    return this._tracks;
  }
}

// ---- Globals setup ----

let lastRecognition: MockSpeechRecognition | null = null;

beforeEach(() => {
  vi.useFakeTimers({ shouldAdvanceTime: true });

  // Patch globals
  (globalThis as any).Audio = MockAudio;
  (globalThis as any).AudioContext = MockAudioContext;
  (globalThis as any).SpeechRecognition = class extends MockSpeechRecognition {
    constructor() {
      super();
      lastRecognition = this;
    }
  };

  // navigator.mediaDevices.getUserMedia
  const mockGetUserMedia = vi.fn().mockResolvedValue(new MockMediaStream());
  Object.defineProperty(navigator, "mediaDevices", {
    value: { getUserMedia: mockGetUserMedia },
    writable: true,
    configurable: true,
  });

  // URL.createObjectURL / revokeObjectURL
  globalThis.URL.createObjectURL = vi.fn(() => "blob:mock-url");
  globalThis.URL.revokeObjectURL = vi.fn();

  // requestAnimationFrame / cancelAnimationFrame
  let rafId = 0;
  (globalThis as any).requestAnimationFrame = vi.fn((_cb: () => void) => {
    rafId++;
    // Don't auto-invoke — tests control timing
    return rafId;
  });
  (globalThis as any).cancelAnimationFrame = vi.fn();

  lastRecognition = null;
});

afterEach(() => {
  vi.useRealTimers();
  vi.restoreAllMocks();
  lastRecognition = null;
});

// ---- fetch mock helper ----
function mockFetch(responses: Record<string, { ok: boolean; body: any }>) {
  return vi.fn(async (url: string) => {
    const match = Object.entries(responses).find(([key]) => url.includes(key));
    if (!match) throw new Error(`Unmocked fetch: ${url}`);
    const [, res] = match;
    return {
      ok: res.ok,
      status: res.ok ? 200 : 500,
      json: async () => res.body,
      blob: async () =>
        new Blob([JSON.stringify(res.body)], { type: "audio/mpeg" }),
    };
  });
}

// =========================================================
// Tests
// =========================================================

describe("PICCY_VOICES", () => {
  it("exports all 6 voices", () => {
    expect(Object.keys(PICCY_VOICES)).toHaveLength(6);
    expect(PICCY_VOICES.Alloy).toBe("alloy");
    expect(PICCY_VOICES.Echo).toBe("echo");
    expect(PICCY_VOICES.Fable).toBe("fable");
    expect(PICCY_VOICES.Onyx).toBe("onyx");
    expect(PICCY_VOICES.Nova).toBe("nova");
    expect(PICCY_VOICES.Shimmer).toBe("shimmer");
  });
});

describe("usePiccyVoiceChat", () => {
  it("returns the correct initial state", () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    expect(result.current.isActive).toBe(false);
    expect(result.current.isUserSpeaking).toBe(false);
    expect(result.current.isAssistantSpeaking).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isLoading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(result.current.messages).toEqual([]);
  });

  it("start() activates the session and begins listening", async () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.isActive).toBe(true);
    expect(result.current.isListening).toBe(true);
    expect(result.current.isLoading).toBe(false);
    expect(lastRecognition).not.toBeNull();
    expect(lastRecognition!._started).toBe(true);
  });

  it("start() configures recognition with correct settings", async () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    expect(lastRecognition!.continuous).toBe(true);
    expect(lastRecognition!.interimResults).toBe(true);
    expect(lastRecognition!.lang).toBe("en-US");
    expect(lastRecognition!.maxAlternatives).toBe(3);
  });

  it("stop() deactivates the session completely", async () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isActive).toBe(true);

    await act(async () => {
      await result.current.stop();
    });

    expect(result.current.isActive).toBe(false);
    expect(result.current.isListening).toBe(false);
    expect(result.current.isLoading).toBe(false);
  });

  it("sets error when SpeechRecognition is not supported", async () => {
    delete (globalThis as any).SpeechRecognition;
    delete (globalThis as any).webkitSpeechRecognition;

    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toMatch(/not supported/i);
    expect(result.current.isActive).toBe(false);
  });

  it("processes a final transcript through completion and TTS", async () => {
    (globalThis as any).fetch = mockFetch({
      "/api/chat/voice-completion": {
        ok: true,
        body: { text: "Hello! How can I help?" },
      },
      "/api/chat/voice-tts": {
        ok: true,
        body: { audio: "mock" },
      },
    });

    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    const recognition = lastRecognition!;

    // Simulate user saying "hello"
    await act(async () => {
      recognition.simulateFinalResult("hello");
    });

    // Advance past the SUBMIT_DELAY (900ms) + onspeechend timer
    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    // Wait for processing to complete
    await waitFor(
      () => {
        const msgs = result.current.messages;
        return expect(msgs.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 5000 },
    );

    const msgs = result.current.messages;
    // User message
    expect(msgs[0].role).toBe("user");
    expect(msgs[0].parts[0]).toEqual({ type: "text", text: "hello" });
    expect(msgs[0].completed).toBe(true);

    // Assistant message
    expect(msgs[1].role).toBe("assistant");
    expect(msgs[1].parts[0]).toEqual({
      type: "text",
      text: "Hello! How can I help?",
    });
    expect(msgs[1].completed).toBe(true);

    // Verify fetch was called correctly
    expect((globalThis as any).fetch).toHaveBeenCalledWith(
      "/api/chat/voice-completion",
      expect.objectContaining({ method: "POST" }),
    );
  });

  it("handles completion API errors gracefully", async () => {
    (globalThis as any).fetch = mockFetch({
      "/api/chat/voice-completion": {
        ok: false,
        body: { error: { message: "Server error" } },
      },
    });

    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    const recognition = lastRecognition!;

    await act(async () => {
      recognition.simulateFinalResult("test error");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(
      () => {
        const msgs = result.current.messages;
        if (msgs.length >= 2) {
          expect(msgs[1].parts[0].text).toContain("Error");
          expect(msgs[1].completed).toBe(true);
        }
        return expect(msgs.length).toBeGreaterThanOrEqual(2);
      },
      { timeout: 5000 },
    );
  });

  it("selects highest-confidence alternative from multi-alternative results", async () => {
    (globalThis as any).fetch = mockFetch({
      "/api/chat/voice-completion": {
        ok: true,
        body: { text: "Response" },
      },
      "/api/chat/voice-tts": {
        ok: true,
        body: { audio: "mock" },
      },
    });

    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    const recognition = lastRecognition!;

    // Simulate a result with multiple alternatives
    await act(async () => {
      recognition.onresult?.({
        results: [
          {
            isFinal: true,
            length: 3,
            0: { transcript: "help me", confidence: 0.6 },
            1: { transcript: "help me please", confidence: 0.9 },
            2: { transcript: "held me", confidence: 0.3 },
          },
        ],
        length: 1,
      });
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(
      () => {
        const msgs = result.current.messages;
        return expect(msgs.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 },
    );

    // Should pick "help me please" (confidence 0.9)
    expect(result.current.messages[0].parts[0].text).toBe("help me please");
  });

  it("stopListening pauses recognition, startListening resumes", async () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });
    expect(result.current.isListening).toBe(true);

    await act(async () => {
      await result.current.stopListening();
    });
    expect(result.current.isListening).toBe(false);

    await act(async () => {
      await result.current.startListening();
    });
    expect(result.current.isListening).toBe(true);
  });

  it("sets mic denied error on not-allowed recognition error", async () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    const recognition = lastRecognition!;

    await act(async () => {
      recognition.simulateError("not-allowed");
    });

    expect(result.current.error).not.toBeNull();
    expect(result.current.error!.message).toMatch(/microphone/i);
  });

  it("ignores no-speech and aborted errors", async () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    const recognition = lastRecognition!;

    await act(async () => {
      recognition.simulateError("no-speech");
    });
    expect(result.current.error).toBeNull();

    await act(async () => {
      recognition.simulateError("aborted");
    });
    expect(result.current.error).toBeNull();
  });

  it("passes correct voice to TTS API", async () => {
    const fetchMock = mockFetch({
      "/api/chat/voice-completion": {
        ok: true,
        body: { text: "hi" },
      },
      "/api/chat/voice-tts": {
        ok: true,
        body: { audio: "mock" },
      },
    });
    (globalThis as any).fetch = fetchMock;

    const { result } = renderHook(() =>
      usePiccyVoiceChat({ voice: PICCY_VOICES.Nova }),
    );

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      lastRecognition!.simulateFinalResult("test");
    });

    await act(async () => {
      vi.advanceTimersByTime(1000);
    });

    await waitFor(
      () => {
        const ttsCall = fetchMock.mock.calls.find(
          ([url]: [string]) =>
            typeof url === "string" && url.includes("voice-tts"),
        );
        return expect(ttsCall).toBeTruthy();
      },
      { timeout: 5000 },
    );

    const ttsCall = fetchMock.mock.calls.find(
      ([url]: [string]) => typeof url === "string" && url.includes("voice-tts"),
    );
    const body = JSON.parse(ttsCall![1].body);
    expect(body.voice).toBe("nova");
  });

  it("requests VAD microphone access on start", async () => {
    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    expect(navigator.mediaDevices.getUserMedia).toHaveBeenCalledWith({
      audio: {
        echoCancellation: true,
        noiseSuppression: true,
        autoGainControl: true,
      },
    });
  });

  it("cleans up on unmount", async () => {
    const { result, unmount } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    const _recognition = lastRecognition;

    unmount();

    // Should not throw or leave dangling resources
    expect(cancelAnimationFrame).toHaveBeenCalled();
  });

  it("doesn't process empty transcript", async () => {
    (globalThis as any).fetch = vi.fn();

    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    await act(async () => {
      lastRecognition!.simulateFinalResult("   ");
    });

    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    // fetch should not be called for empty input
    expect((globalThis as any).fetch).not.toHaveBeenCalled();
    expect(result.current.messages).toHaveLength(0);
  });

  it("submits interim transcript if no final result arrives", async () => {
    (globalThis as any).fetch = mockFetch({
      "/api/chat/voice-completion": {
        ok: true,
        body: { text: "Got it." },
      },
      "/api/chat/voice-tts": {
        ok: true,
        body: { audio: "mock" },
      },
    });

    const { result } = renderHook(() => usePiccyVoiceChat());

    await act(async () => {
      await result.current.start();
    });

    // Only interim, no final
    await act(async () => {
      lastRecognition!.simulateInterimResult("some interim text");
    });

    // Advance past SUBMIT_DELAY * 2 = 1800ms
    await act(async () => {
      vi.advanceTimersByTime(2000);
    });

    await waitFor(
      () => {
        return expect(result.current.messages.length).toBeGreaterThanOrEqual(1);
      },
      { timeout: 5000 },
    );

    expect(result.current.messages[0].parts[0].text).toBe("some interim text");
  });
});
