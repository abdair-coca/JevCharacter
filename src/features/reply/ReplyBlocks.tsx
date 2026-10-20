import type { SpeechBlock } from "../../creature/brain/speechBlocks";

/** Plain, semantic rendering of each catalog block; text is always rendered as text. */
export function ReplyBlocks({ blocks }: { blocks: SpeechBlock[] }) {
  return (
    <div className="reply-blocks">
      {blocks.map((block, index) => <ReplyBlock key={index} block={block} />)}
    </div>
  );
}

function ReplyBlock({ block }: { block: SpeechBlock }) {
  switch (block.type) {
    case "paragraph":
      return <p className="reply-block reply-block--paragraph">{block.text}</p>;
    case "list":
      return <ul className="reply-block reply-block--list">{block.items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
    case "steps":
      return <ol className="reply-block reply-block--steps">{block.items.map((item, index) => <li key={index}>{item}</li>)}</ol>;
    case "compare":
      return (
        <div className="reply-block reply-block--compare">
          {block.columns.map((column, index) => (
            <section key={index}>
              <h3>{column.title}</h3>
              <ul>{column.points.map((point, pointIndex) => <li key={pointIndex}>{point}</li>)}</ul>
            </section>
          ))}
        </div>
      );
    case "highlight":
      return <p className="reply-block reply-block--highlight"><strong>{block.value}</strong> <span>{block.label}</span></p>;
    case "callout":
      return <p className="reply-block reply-block--callout" data-tone={block.tone}>{block.text}</p>;
    case "chips":
      return <ul className="reply-block reply-block--chips">{block.items.map((item, index) => <li key={index}>{item}</li>)}</ul>;
  }
}
