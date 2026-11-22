import { useState } from "react";
import { canSpeakJapanese, speakJapanese } from "../core/sound";

interface SpeakButtonProps {
  text: string;
  label?: string;
  variant?: "default" | "onCard";
}

export function SpeakButton({
  text,
  label = "Listen",
  variant = "default",
}: SpeakButtonProps) {
  const [speaking, setSpeaking] = useState(false);

  if (!canSpeakJapanese()) return null;

  const handleClick = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (speakJapanese(text)) {
      setSpeaking(true);
      window.setTimeout(() => setSpeaking(false), 650);
    }
  };

  return (
    <button
      type="button"
      className={`btn btn-speak ${variant === "onCard" ? "btn-speak-card" : ""} ${speaking ? "speaking" : ""}`}
      onClick={handleClick}
      title={`Pronounce: ${text}`}
      aria-label={`Pronounce ${text}`}
    >
      🔊{label ? ` ${label}` : ""}
    </button>
  );
}
