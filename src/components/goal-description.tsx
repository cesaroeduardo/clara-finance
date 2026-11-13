export function GoalDescription({ text }: { text: string }) {
  const parts = text.split(/((?:https?:\/\/|www\.)[^\s<>]+)/gi);
  return (
    <p className="goal-description">
      {parts.map((part, index) => {
        if (!/^(?:https?:\/\/|www\.)/i.test(part)) return part;
        const link = part.replace(/[.,;:!?]+$/, "");
        const suffix = part.slice(link.length);
        const href = /^www\./i.test(link) ? `https://${link}` : link;
        try {
          new URL(href);
        } catch {
          return part;
        }
        return (
          <span key={index}>
            <a href={href} target="_blank" rel="noopener noreferrer">
              {link}
            </a>
            {suffix}
          </span>
        );
      })}
    </p>
  );
}
