import type { SpeechPlugin } from "../../src/creature/brain/speechProtocol.js";
import { githubTools } from "./github.js";

/** What a tool hands back: JSON for the model and the GitHub pages it is allowed to link. */
export type ToolResult = { content: string; urls: string[] };

export type PluginTool = {
  /** The function definition the model sees, in the OpenAI tools format. */
  definition: { name: string; description: string; parameters: Record<string, unknown> };
  run: (args: Record<string, unknown>, signal: AbortSignal) => Promise<ToolResult>;
};

// Plugins with server tools. WhatsApp has none: Jev only drafts a block the browser opens.
const PLUGIN_TOOLS: Partial<Record<SpeechPlugin, PluginTool[]>> = { github: githubTools };

/** The tools of the plugins the visitor left on, in the format Groq expects. */
export function toolDefinitions(plugins: readonly SpeechPlugin[]) {
  return plugins.flatMap(plugin => PLUGIN_TOOLS[plugin] ?? []).map(tool => ({ type: "function" as const, function: tool.definition }));
}

/** The plugin and tool behind a function name, if that plugin is on. */
export function findTool(plugins: readonly SpeechPlugin[], name: string) {
  for (const plugin of plugins) {
    const tool = PLUGIN_TOOLS[plugin]?.find(candidate => candidate.definition.name === name);
    if (tool) return { plugin, tool };
  }
  return null;
}
