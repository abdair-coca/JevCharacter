import { afterEach, describe, expect, it, vi } from "vitest";

import { githubTools } from "../api/_plugins/github";
import { findTool, toolDefinitions } from "../api/_plugins/registry";

const tool = (name: string) => {
  const found = githubTools.find(candidate => candidate.definition.name === name);
  if (!found) throw new Error(`missing ${name}`);
  return found;
};
const run = (name: string, args: Record<string, unknown>) => tool(name).run(args, new AbortController().signal);

/** GitHub answers each path with the given JSON; returns the requested URLs and headers. */
function github(routes: Record<string, unknown>, status = 200) {
  const calls: { url: string; headers: Record<string, string> }[] = [];
  vi.stubGlobal("fetch", vi.fn((url: RequestInfo | URL, init?: RequestInit) => {
    calls.push({ url: String(url), headers: init?.headers as Record<string, string> });
    const path = String(url).replace("https://api.github.com", "").split("?")[0];
    return Promise.resolve(new Response(JSON.stringify(routes[path] ?? {}), { status }));
  }));
  return calls;
}

afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe("GitHub plugin", () => {
  it("is offered only when its plugin is on", () => {
    expect(toolDefinitions([])).toEqual([]);
    expect(toolDefinitions(["whatsapp"])).toEqual([]);
    expect(toolDefinitions(["github"]).map(definition => definition.function.name)).toEqual(["github_repo", "github_search_repos", "github_issues", "github_pull_requests", "github_commits", "github_user"]);
    expect(findTool(["whatsapp"], "github_repo")).toBeNull();
    expect(findTool(["github"], "github_repo")?.plugin).toBe("github");
  });

  it("reads a repository from owner/name or its URL, anonymously without a token", async () => {
    const calls = github({ "/repos/facebook/react": {
      full_name: "facebook/react", description: "UI library", stargazers_count: 230000, forks_count: 47000, open_issues_count: 900,
      language: "JavaScript", license: { spdx_id: "MIT" }, topics: ["react", "ui"], pushed_at: "2026-10-31T10:00:00Z", html_url: "https://github.com/facebook/react",
    } });
    const result = await run("github_repo", { repo: "https://github.com/facebook/react.git" });
    expect(calls[0].url).toBe("https://api.github.com/repos/facebook/react");
    expect(calls[0].headers.Authorization).toBeUndefined();
    expect(calls[0].headers["User-Agent"]).toBe("jevling");
    expect(JSON.parse(result.content)).toMatchObject({ name: "facebook/react", stars: 230000, forks: 47000, license: "MIT", last_push: "2026-10-31" });
    expect(result.urls).toEqual(["https://github.com/facebook/react"]);
  });

  it("sends the server's token when there is one", async () => {
    vi.stubEnv("GITHUB_TOKEN", "github_pat_test");
    const calls = github({ "/repos/a/b": {} });
    await run("github_repo", { repo: "a/b" });
    expect(calls[0].headers.Authorization).toBe("Bearer github_pat_test");
  });

  it.each([["github_repo", { repo: "../../etc" }, "invalid_repo"], ["github_user", { login: "no spaces" }, "invalid_login"], ["github_search_repos", { query: " " }, "invalid_query"]])(
    "%s rejects a malformed argument without calling GitHub", async (name, args, error) => {
      const calls = github({});
      expect(JSON.parse((await run(name, args)).content)).toEqual({ error });
      expect(calls).toEqual([]);
    },
  );

  it.each([[404, "not_found"], [403, "rate_limited"], [500, "unavailable"]])("turns GitHub %i into %s for the model", async (status, error) => {
    github({}, status);
    expect(JSON.parse((await run("github_repo", { repo: "a/b" })).content)).toEqual({ error });
  });

  it("lists issues without the pull requests GitHub mixes in", async () => {
    const calls = github({ "/repos/a/b/issues": [
      { number: 2, title: "Bug", user: { login: "ana" }, created_at: "2026-10-30T00:00:00Z", comments: 3, html_url: "https://github.com/a/b/issues/2" },
      { number: 3, title: "A PR", pull_request: {}, html_url: "https://github.com/a/b/pull/3" },
    ] });
    const result = JSON.parse((await run("github_issues", { repo: "a/b" })).content);
    expect(calls[0].url).toContain("/repos/a/b/issues?state=open");
    expect(result.issues).toEqual([{ number: 2, title: "Bug", author: "ana", opened: "2026-10-30", comments: 3, url: "https://github.com/a/b/issues/2" }]);
  });

  it("lists pull requests from their own endpoint, with when they merged", async () => {
    const calls = github({ "/repos/a/b/pulls": [{ number: 7, title: "Fix", user: { login: "ana" }, created_at: "2026-10-30T00:00:00Z", merged_at: null, html_url: "https://github.com/a/b/pull/7" }] });
    const result = JSON.parse((await run("github_pull_requests", { repo: "a/b", state: "open" })).content);
    expect(calls[0].url).toContain("/repos/a/b/pulls?state=open");
    expect(result.pulls).toEqual([{ number: 7, title: "Fix", author: "ana", opened: "2026-10-30", merged: null, url: "https://github.com/a/b/pull/7" }]);
  });

  it("asks for commits since the requested days, capped at 30", async () => {
    const calls = github({ "/repos/a/b/commits": [{ commit: { message: "Fix it\n\nLong body", author: { name: "Ana", date: "2026-10-31T00:00:00Z" } }, html_url: "https://github.com/a/b/commit/abc" }] });
    const result = JSON.parse((await run("github_commits", { repo: "a/b", days: 90 })).content);
    const since = new URL(calls[0].url).searchParams.get("since");
    expect(Date.now() - Date.parse(String(since))).toBeCloseTo(30 * 86_400_000, -5);
    expect(result.commits).toEqual([{ message: "Fix it", author: "Ana", date: "2026-10-31", url: "https://github.com/a/b/commit/abc" }]);
  });

  it("reads a profile with its recent repositories", async () => {
    github({
      "/users/octocat": { login: "octocat", name: "The Octocat", public_repos: 8, followers: 9000, html_url: "https://github.com/octocat" },
      "/users/octocat/repos": [{ full_name: "octocat/hello", stargazers_count: 2, html_url: "https://github.com/octocat/hello" }],
    });
    const result = await run("github_user", { login: "@octocat" });
    expect(JSON.parse(result.content)).toMatchObject({ login: "octocat", public_repos: 8, recent_repos: [{ name: "octocat/hello", stars: 2 }] });
    expect(result.urls).toEqual(["https://github.com/octocat", "https://github.com/octocat/hello"]);
  });

  it("keeps a result under 1500 characters by dropping the last items, and never links outside GitHub", async () => {
    github({ "/search/repositories": { total_count: 99, items: Array.from({ length: 5 }, (_, index) => ({
      // Each field is cut at 140 characters; long names and descriptions still overflow five items.
      full_name: `owner/${"r".repeat(120)}-${index}`, description: "x".repeat(400), stargazers_count: index,
      html_url: index === 0 ? "https://evil.example/x" : `https://github.com/owner/${"r".repeat(120)}-${index}`,
    })) } });
    const result = await run("github_search_repos", { query: "jev" });
    expect(result.content.length).toBeLessThanOrEqual(1500);
    const parsed = JSON.parse(result.content);
    expect(parsed.repos.length).toBeLessThan(5);
    expect(parsed.repos[0].url).toBeNull();
    expect(result.urls.every(url => url.startsWith("https://github.com/"))).toBe(true);
  });
});
