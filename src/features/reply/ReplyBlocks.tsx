import { useId, type CSSProperties, type ReactNode } from "react";
import type { SpeechBlock } from "../../creature/brain/speechBlocks";
import { useTranslation } from "../../i18n/useTranslation";

type Indexed = CSSProperties & { "--i"?: number; "--w"?: number };

// Each block rises in turn; its words come into focus one after another.
const WORDS_STAGGERED = 40;

/** Splits text into word spans for the entrance; whitespace stays as plain text. */
export function Words({ text, from = 0 }: { text: string; from?: number }) {
  let word = from;
  return text.split(/(\s+)/u).map((part, index) => {
    if (!part || /^\s+$/u.test(part)) return part;
    const style: Indexed = { "--w": Math.min(word++, WORDS_STAGGERED) };
    return <span key={index} className="reply-word" style={style}>{part}</span>;
  });
}

// Marks the model's emphasis phrases inside a paragraph, keeping the word count running.
function emphasized(text: string, phrases: string[] = []): ReactNode[] {
  const nodes: ReactNode[] = [];
  let rest = text;
  let words = 0;
  const count = (part: string) => part.split(/\s+/u).filter(Boolean).length;
  while (rest) {
    const hits = phrases.map(phrase => ({ phrase, at: rest.indexOf(phrase) })).filter(hit => hit.at >= 0);
    if (hits.length === 0) {
      nodes.push(<Words key={nodes.length} text={rest} from={words} />);
      break;
    }
    const first = hits.reduce((best, hit) => hit.at < best.at ? hit : best);
    const before = rest.slice(0, first.at);
    if (before) nodes.push(<Words key={nodes.length} text={before} from={words} />);
    words += count(before);
    nodes.push(<strong key={nodes.length} className="reply-emphasis"><Words text={first.phrase} from={words} /></strong>);
    words += count(first.phrase);
    rest = rest.slice(first.at + first.phrase.length);
  }
  return nodes;
}

function TipIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M9 18h6M10 21h4M12 3a6 6 0 0 0-3.5 10.9c.6.5 1 1.2 1 2.1h5c0-.9.4-1.6 1-2.1A6 6 0 0 0 12 3z" /></svg>;
}

function WarningIcon() {
  return <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 4l9 16H3zM12 10v4M12 17.5v.01" /></svg>;
}

type ChoicesBlock = Extract<SpeechBlock, { type: "choices" }>;

/** Answers to Jev's question; each one is sent like a typed message. */
export function ChoiceButtons({ block, onAsk, labelledBy }: { block: ChoicesBlock; onAsk?: (answer: string) => void; labelledBy: string }) {
  return (
    <ul className="reply-choices__options" role="group" aria-labelledby={labelledBy}>
      {block.options.map((option, index) => (
        <li key={index}><button type="button" className="reply-choice" onClick={() => onAsk?.(option)} disabled={!onAsk}>{option}</button></li>
      ))}
    </ul>
  );
}

function Choices({ block, onAsk }: { block: ChoicesBlock; onAsk?: (answer: string) => void }) {
  const t = useTranslation();
  const questionId = useId();
  return (
    <div className="reply-choices">
      <p id={questionId} className="reply-choices__question"><Words text={block.question} /></p>
      <ChoiceButtons block={block} onAsk={onAsk} labelledBy={questionId} />
      <p className="reply-choices__hint">{t.replyChoicesHint}</p>
    </div>
  );
}

function ReplyBlock({ block, onAsk }: { block: SpeechBlock; onAsk?: (question: string) => void }) {
  const t = useTranslation();
  switch (block.type) {
    case "paragraph":
      return <p className="reply-block__text">{emphasized(block.text, block.emphasis)}</p>;
    case "list":
      return <ul className="reply-list">{block.items.map((item, index) => <li key={index}><Words text={item} /></li>)}</ul>;
    case "steps":
      return <ol className="reply-steps">{block.items.map((item, index) => <li key={index}><Words text={item} /></li>)}</ol>;
    case "compare":
      return (
        <div className="reply-compare">
          {block.columns.map((column, index) => (
            <section key={index} className="reply-compare__column">
              <h3><Words text={column.title} /></h3>
              <ul>{column.points.map((point, pointIndex) => <li key={pointIndex}><Words text={point} /></li>)}</ul>
            </section>
          ))}
        </div>
      );
    case "highlight":
      return (
        <p className="reply-highlight">
          <strong className="reply-highlight__value">{block.value}</strong>
          <span className="reply-highlight__label"><Words text={block.label} /></span>
        </p>
      );
    case "callout":
      return (
        <div className="reply-callout" data-tone={block.tone}>
          {block.tone === "warning" ? <WarningIcon /> : <TipIcon />}
          <p><strong>{block.tone === "warning" ? t.replyWarning : t.replyTip}</strong> <Words text={block.text} /></p>
        </div>
      );
    case "chips":
      return (
        <nav className="reply-chips" aria-label={t.replyFollowUp}>
          <ul>
            {block.items.map((item, index) => (
              <li key={index}><button type="button" className="reply-chip" onClick={() => onAsk?.(item)} disabled={!onAsk}>{item}</button></li>
            ))}
          </ul>
        </nav>
      );
    case "choices":
      return <Choices block={block} onAsk={onAsk} />;
  }
}

/** The catalog blocks of a reply, each rising in turn; text is always rendered as text. */
export function ReplyBlocks({ blocks, onAsk }: { blocks: SpeechBlock[]; onAsk?: (question: string) => void }) {
  return (
    <div className="reply-blocks">
      {blocks.map((block, index) => {
        // The spoken lead is the first item of the cascade.
        const style: Indexed = { "--i": index + 1 };
        return <div key={index} className={`reply-block reply-block--${block.type}`} style={style}><ReplyBlock block={block} onAsk={onAsk} /></div>;
      })}
    </div>
  );
}
