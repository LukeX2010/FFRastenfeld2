export class ApiError extends Error {
  constructor(status, message) { super(message); this.status = status; }
}
export class GitStore {
  constructor(env, fetcher = fetch) { this.env = env; this.fetch = fetcher; }
  repo(privateRepo = false) {
    const repo = this.env[privateRepo ? 'DRAFTS_REPO' : 'GITHUB_REPO'];
    if (!/^[\w.-]+\/[\w.-]+$/.test(repo || '') || !this.env.GITHUB_TOKEN)
      throw new ApiError(503, 'GitHub-Verbindung fehlt. Bitte die Server-Einstellungen vervollständigen.');
    return repo;
  }
  async api(repo, path, method = 'GET', body) {
    const response = await this.fetch(`https://api.github.com/repos/${repo}${path ? '/' + path : ''}`, {
      method, headers: { Authorization: `Bearer ${this.env.GITHUB_TOKEN}`, 'User-Agent': 'FFRastenfeld-Redaktion', Accept: 'application/vnd.github+json', 'Content-Type': 'application/json', 'X-GitHub-Api-Version': '2022-11-28' },
      body: body === undefined ? undefined : JSON.stringify(body), signal: AbortSignal.timeout(18000)
    });
    if (!response.ok) throw new ApiError(response.status === 409 || response.status === 422 ? 409 : 502,
      response.status === 409 || response.status === 422 ? 'Zwischenzeitlich wurde etwas geändert. Bitte neu laden und deine Änderung erneut prüfen.' : `GitHub ist nicht erreichbar oder der Zugang fehlt (HTTP ${response.status}).`);
    return response.status === 204 ? null : response.json();
  }
  async snapshot(privateRepo = false) {
    const repo = this.repo(privateRepo);
    const meta = await this.api(repo, '');
    if (privateRepo && !meta.private) throw new ApiError(503, 'Das Entwürfe-Repository muss privat sein. Speichern wurde zum Schutz deiner Notizen gestoppt.');
    const branch = (privateRepo ? this.env.DRAFTS_BRANCH : this.env.GITHUB_BRANCH) || meta.default_branch;
    const ref = await this.api(repo, `git/ref/heads/${branch}`);
    const commit = await this.api(repo, `git/commits/${ref.object.sha}`);
    return { repo, branch, head: ref.object.sha, tree: commit.tree.sha };
  }
  async read(snapshot, path, optional = false) {
    // Resolve from this exact commit, so concurrent updates cannot mix versions.
    const response = await this.fetch(`https://api.github.com/repos/${snapshot.repo}/contents/${path}?ref=${snapshot.head}`, {
      headers: { Authorization: `Bearer ${this.env.GITHUB_TOKEN}`, 'User-Agent': 'FFRastenfeld-Redaktion', Accept: 'application/vnd.github.raw+json' }, signal: AbortSignal.timeout(18000)
    });
    if (optional && response.status === 404) return null;
    if (!response.ok) throw new ApiError(502, `GitHub-Datei konnte nicht gelesen werden (HTTP ${response.status}).`);
    return response.json();
  }
  async commit(snapshot, files, message) {
    const tree = [];
    for (let i=0; i<files.length; i+=6) {
      await Promise.all(files.slice(i,i+6).map(async file => {
      const blob = await this.api(snapshot.repo, 'git/blobs', 'POST', { content: file.content, encoding: file.encoding || 'utf-8' });
      tree.push({ path: file.path, mode: '100644', type: 'blob', sha: blob.sha });
      }));
    }
    const nextTree = await this.api(snapshot.repo, 'git/trees', 'POST', { base_tree: snapshot.tree, tree });
    const commit = await this.api(snapshot.repo, 'git/commits', 'POST', { message, tree: nextTree.sha, parents: [snapshot.head] });
    // Never force: a concurrent commit makes this fail instead of overwriting it.
    await this.api(snapshot.repo, `git/refs/heads/${snapshot.branch}`, 'PATCH', { sha: commit.sha, force: false });
    return commit.sha;
  }
}
