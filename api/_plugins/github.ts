import type { PluginTool, ToolResult } from "./registry.js";

// Read-only access to public GitHub data. Vercel ignores `_` folders, so this is never an endpoint itself.
const API = "https://api.github.com";
const REPO = /^[A-Za-z0-9-]{1,39}\/[A-Za-z0-9._-]{1,100}$/;
const LOGIN = /^[A-Za-z0-9-]{1,39}$/;
const QUERY_MAX_CHARS = 100;
const TEXT_MAX_CHARS = 140;
const ITEMS_MAX = 5;
const DAYS_MAX = 30;
// What one result may add to the model's input; longer lists lose their last items.
const RESULT_MAX_CHARS = 1_500;

type Fetched = { ok: true; data: unknown } | { ok: false; error: "not_found" | "rate_limited" | "unavailable" };

const isRecord = (value: unknown): value is Record<string, unknown> =>
  Boolean(value) && typeof value === "object" && !Array.isArray(value);

const text = (value: unknown) => typeof value === "string" ? value.replace(/\s+/gu, " ").trim().slice(0, TEXT_MAX_CHARS) : null;
const count = (value: unknown) => typeof value === "number" && Number.isFinite(value) ? value : null;
const date = (value: unknown) => typeof value === "string" ? value.slice(0, 10) : null;
const pageUrl = (value: unknown) => typeof value === "string" && value.startsWith("https://github.com/") ? value : null;

/** «owner/name», also from a GitHub URL or with a trailing `.git`. */
function repoArgument(value: unknown) {
  if (typeof value !== "string") return null;
  const repo = value.trim().replace(/^https?:\/\/(www\.)?github\.com\//iu, "").replace(/\.git$/iu, "").replace(/\/+$/u, "");
  return REPO.test(repo) ? repo : null;
}

async function get(path: string, signal: AbortSignal): Promise<Fetched> {
  const token = process.env.GITHUB_TOKEN?.trim();
  try {
    const response = await fetch(`${API}${path}`, {
      headers: {
        Accept: "application/vnd.github+json",
        "X-GitHub-Api-Version": "2022-11-28",
        "User-Agent": "jevling",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      signal,
    });
    if (response.status === 404 || response.status === 422) return { ok: false, error: "not_found" };
    if (response.status === 403 || response.status === 429) return { ok: false, error: "rate_limited" };
    if (!response.ok) return { ok: false, error: "unavailable" };
    return { ok: true, data: await response.json() };
  } catch {
    return { ok: false, error: "unavailable" };
  }
}

/** The JSON the model reads, trimmed to fit, and the pages it may link. */
function result(value: Record<string, unknown>): ToolResult {
  const list = Object.values(value).find(Array.isArray);
  let content = JSON.stringify(value);
  while (content.length > RESULT_MAX_CHARS && list && list.length > 1) {
    list.pop();
    content = JSON.stringify(value);
  }
  const urls = [...content.matchAll(/"url":"(https:\/\/github\.com\/[^"]+)"/gu)].map(match => match[1]);
  return { content: content.slice(0, RESULT_MAX_CHARS), urls };
}

const failure = (error: string): ToolResult => ({ content: JSON.stringify({ error }), urls: [] });
const items = (value: unknown) => Array.isArray(value) ? value.filter(isRecord) : [];

const repoSummary = (repo: Record<string, unknown>) => ({
  name: text(repo.full_name), description: text(repo.description), stars: count(repo.stargazers_count),
  language: text(repo.language), url: pageUrl(repo.html_url),
});

/**
 * Latest issues or pull requests of a repository. Two separate tools: with one tool and a `kind`
 * argument, the model asked for issues and concluded there were no pull requests (measured 2026-11-01).
 */
function listTool(kind: "issues" | "pulls"): PluginTool {
  const pulls = kind === "pulls";
  return {
    definition: {
      name: pulls ? "github_pull_requests" : "github_issues",
      description: pulls
        ? "Latest pull requests (PRs) of a public GitHub repository, newest first."
        : "Latest issues of a public GitHub repository, newest first. Pull requests are not included: use github_pull_requests for them.",
      parameters: {
        type: "object",
        properties: { repo: { type: "string", description: "owner/name" }, state: { type: "string", enum: ["open", "closed"] } },
        required: ["repo"],
      },
    },
    async run(args, signal) {
      const repo = repoArgument(args.repo);
      if (!repo) return failure("invalid_repo");
      const state = args.state === "closed" ? "closed" : "open";
      // The issues endpoint also lists pull requests; asking for more leaves room to drop them.
      const fetched = await get(`/repos/${repo}/${kind}?state=${state}&per_page=${pulls ? ITEMS_MAX : 20}`, signal);
      if (!fetched.ok) return failure(fetched.error);
      const list = items(fetched.data).filter(item => pulls || !("pull_request" in item)).slice(0, ITEMS_MAX);
      return result({
        repo, state,
        [kind]: list.map(item => ({
          number: count(item.number), title: text(item.title), author: isRecord(item.user) ? text(item.user.login) : null,
          opened: date(item.created_at), ...(pulls ? { merged: date(item.merged_at) } : { comments: count(item.comments) }), url: pageUrl(item.html_url),
        })),
      });
    },
  };
}

export const githubTools: PluginTool[] = [
  {
    definition: {
      name: "github_repo",
      description: "Facts about one public GitHub repository: description, stars, forks, open issues, language, license, topics and last push.",
      parameters: { type: "object", properties: { repo: { type: "string", description: "owner/name, e.g. facebook/react" } }, required: ["repo"] },
    },
    async run(args, signal) {
      const repo = repoArgument(args.repo);
      if (!repo) return failure("invalid_repo");
      const fetched = await get(`/repos/${repo}`, signal);
      if (!fetched.ok) return failure(fetched.error);
      const data = isRecord(fetched.data) ? fetched.data : {};
      return result({
        ...repoSummary(data), forks: count(data.forks_count), open_issues_and_prs: count(data.open_issues_count),
        license: isRecord(data.license) ? text(data.license.spdx_id) : null, topics: Array.isArray(data.topics) ? data.topics.slice(0, 5) : [],
        archived: data.archived === true, last_push: date(data.pushed_at), created: date(data.created_at),
      });
    },
  },
  {
    definition: {
      name: "github_search_repos",
      description: "Search public GitHub repositories by keywords; returns up to 5 with stars, language and description.",
      parameters: {
        type: "object",
        properties: { query: { type: "string" }, sort: { type: "string", enum: ["best", "stars", "updated"] } },
        required: ["query"],
      },
    },
    async run(args, signal) {
      const query = typeof args.query === "string" ? args.query.trim().slice(0, QUERY_MAX_CHARS) : "";
      if (!query) return failure("invalid_query");
      const sort = args.sort === "stars" || args.sort === "updated" ? `&sort=${args.sort}` : "";
      const fetched = await get(`/search/repositories?q=${encodeURIComponent(query)}&per_page=${ITEMS_MAX}${sort}`, signal);
      if (!fetched.ok) return failure(fetched.error);
      const data = isRecord(fetched.data) ? fetched.data : {};
      return result({ total: count(data.total_count), repos: items(data.items).slice(0, ITEMS_MAX).map(repoSummary) });
    },
  },
  listTool("issues"),
  listTool("pulls"),
  {
    definition: {
      name: "github_commits",
      description: "What changed recently in a public GitHub repository: the latest commits on its default branch, optionally only from the last N days. Use it for questions like what is new or what changed this week.",
      parameters: {
        type: "object",
        properties: { repo: { type: "string", description: "owner/name" }, days: { type: "integer", minimum: 1, maximum: DAYS_MAX } },
        required: ["repo"],
      },
    },
    async run(args, signal) {
      const repo = repoArgument(args.repo);
      if (!repo) return failure("invalid_repo");
      const days = typeof args.days === "number" ? Math.min(DAYS_MAX, Math.max(1, Math.round(args.days))) : null;
      const since = days ? `&since=${new Date(Date.now() - days * 86_400_000).toISOString()}` : "";
      const fetched = await get(`/repos/${repo}/commits?per_page=${ITEMS_MAX}${since}`, signal);
      if (!fetched.ok) return failure(fetched.error);
      return result({
        repo, ...(days ? { days } : {}),
        commits: items(fetched.data).slice(0, ITEMS_MAX).map(item => {
          const commit = isRecord(item.commit) ? item.commit : {};
          const author = isRecord(commit.author) ? commit.author : {};
          return { message: text(typeof commit.message === "string" ? commit.message.split("\n")[0] : null), author: text(author.name), date: date(author.date), url: pageUrl(item.html_url) };
        }),
      });
    },
  },
  {
    definition: {
      name: "github_user",
      description: "Public profile of a GitHub user or organization and its 5 most recently updated repositories.",
      parameters: { type: "object", properties: { login: { type: "string" } }, required: ["login"] },
    },
    async run(args, signal) {
      const login = typeof args.login === "string" ? args.login.trim().replace(/^@/u, "") : "";
      if (!LOGIN.test(login)) return failure("invalid_login");
      const [profile, repos] = await Promise.all([get(`/users/${login}`, signal), get(`/users/${login}/repos?sort=updated&per_page=${ITEMS_MAX}`, signal)]);
      if (!profile.ok) return failure(profile.error);
      const data = isRecord(profile.data) ? profile.data : {};
      return result({
        login: text(data.login), name: text(data.name), bio: text(data.bio), public_repos: count(data.public_repos),
        followers: count(data.followers), since: date(data.created_at), url: pageUrl(data.html_url),
        recent_repos: repos.ok ? items(repos.data).slice(0, ITEMS_MAX).map(repoSummary) : [],
      });
    },
  },
];
