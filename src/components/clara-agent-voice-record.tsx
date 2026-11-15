"use client";

import { formatClaraVoiceDuration } from "@/lib/clara-chat-session";
import { cn } from "@/lib/utils";

const WAVE_LEVELS = [0.35, 0.7, 0.45, 0.95, 0.55, 0.8, 0.4, 0.65, 0.5];

type ClaraAgentVoiceRecordProps = {
  event?: "started" | "ended";
  durationMs?: number;
  compact?: boolean;
};

export function ClaraAgentVoiceRecord({
  event = "ended",
  durationMs = 0,
  compact,
}: ClaraAgentVoiceRecordProps) {
  const ended = event === "ended";

  return (
    <div
      className={cn("clara-agent-voice-record", compact && "is-compact")}
      role="status"
    >
      <div className="clara-agent-voice-record-inner">
        <span className="clara-agent-voice-record-wave" aria-hidden>
          {WAVE_LEVELS.map((level, index) => (
            <span
              key={index}
              className="clara-agent-voice-record-bar"
              style={{ height: `${Math.max(20, Math.round(level * 100))}%` }}
            />
          ))}
        </span>
        {ended ? (
          <>
            <span>Sessão de voz encerrada</span>
            <span aria-hidden>·</span>
            <span className="clara-agent-voice-record-time tabular-nums">
              {formatClaraVoiceDuration(durationMs)}
            </span>
          </>
        ) : (
          <span>Sessão de voz iniciada</span>
        )}
      </div>
    </div>
  );
}
