import React, { useEffect, useState } from 'react';

const MESSAGES = [
  'There is nothing to finish here.',
  'One line at a time.',
  'You can begin again.',
  'Let the thoughts pass.',
  'For now, just rake.',
  "You don't need to figure everything out tonight.",
  'Nothing here needs to be perfect.',
  "It's okay to start over.",
  'Breathe into the quiet space.'
];

interface MindfulMessageProps {
  enabled: boolean;
}

export const MindfulMessage: React.FC<MindfulMessageProps> = ({ enabled }) => {
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!enabled) {
      setCurrentMessage(null);
      return;
    }

    // Show initial message after a short delay
    const initialTimer = setTimeout(() => {
      const idx = Math.floor(Math.random() * MESSAGES.length);
      setCurrentMessage(MESSAGES[idx]);
    }, 4000);

    // Periodically change message sparingly every 45-60 seconds
    const interval = setInterval(() => {
      const idx = Math.floor(Math.random() * MESSAGES.length);
      setCurrentMessage(MESSAGES[idx]);
    }, 50000);

    return () => {
      clearTimeout(initialTimer);
      clearInterval(interval);
    };
  }, [enabled]);

  if (!enabled || !currentMessage) return null;

  return (
    <div
      key={currentMessage}
      className="fixed bottom-24 left-1/2 -translate-x-1/2 pointer-events-none z-20 text-center animate-message"
    >
      <span className="font-serif italic text-base md:text-lg text-[#777269] tracking-wide px-4 py-1.5 rounded-full bg-[rgba(243,237,226,0.6)] backdrop-blur-xs shadow-xs">
        "{currentMessage}"
      </span>
    </div>
  );
};
