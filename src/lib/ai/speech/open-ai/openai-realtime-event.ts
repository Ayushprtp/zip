export interface OpenAIRealtimeServerEvent {
  type:
    | "error"
    | "session.created"
    | "session.updated"
    | "conversation.item.created"
    | "conversation.item.input_audio_transcription.completed"
    | "conversation.item.input_audio_transcription.failed"
    | "conversation.item.truncated"
    | "conversation.item.deleted"
    | "input_audio_buffer.committed"
    | "input_audio_buffer.cleared"
    | "input_audio_buffer.speech_started"
    | "input_audio_buffer.speech_stopped"
    | "response.created"
    | "response.done"
    | "response.output_item.added"
    | "response.output_item.done"
    | "response.content_part.added"
    | "response.content_part.done"
    | "response.text.delta"
    | "response.text.done"
    | "response.audio_transcript.delta"
    | "response.audio_transcript.done"
    | "response.audio.delta"
    | "response.audio.done"
    | "response.function_call_arguments.delta"
    | "response.function_call_arguments.done"
    | "output_audio_buffer.stopped"
    | "rate_limits.updated";
  event_id: string;
  [key: string]: any;
}

export interface OpenAIRealtimeSession {
  id: string;
  object: "realtime.session";
  model: string;
  expires_at: number;
  client_secret: {
    value: string;
    expires_at: number;
  };
  modalities: string[];
  instructions: string;
  voice: string;
  input_audio_format: string;
  output_audio_format: string;
  input_audio_transcription: {
    model: string;
  } | null;
  turn_detection: {
    type: string;
    threshold: number;
    prefix_padding_ms: number;
    silence_duration_ms: number;
  } | null;
  tools: any[];
  tool_choice: string;
  temperature: number;
  max_response_output_tokens: string | number;
}
