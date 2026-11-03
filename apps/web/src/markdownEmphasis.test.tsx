import { renderToStaticMarkup } from "react-dom/server";
import ReactMarkdown from "react-markdown";
import { expect, it } from "vite-plus/test";
import { remarkSlackEmphasis } from "./markdownEmphasis";

it("renders Slack-style user emphasis while standard Markdown and code keep their rules", () => {
  const source = "*bold* _italic_ `*literal*`";
  const slack = renderToStaticMarkup(
    <ReactMarkdown remarkPlugins={[remarkSlackEmphasis]}>{source}</ReactMarkdown>,
  );
  expect(slack).toContain("<strong>bold</strong>");
  expect(slack).toContain("<em>italic</em>");
  expect(slack).toContain("<code>*literal*</code>");
  const standard = renderToStaticMarkup(<ReactMarkdown>{source}</ReactMarkdown>);
  expect(standard).toContain("<em>bold</em>");
  expect(standard).not.toContain("<strong>");
});
