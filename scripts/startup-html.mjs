const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = value => value.replace(/[&<>"']/g, char => entities[char]);

const postDate = new Intl.DateTimeFormat("de-AT", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

function homeFragment(source, name) {
  const start = `@* startup:${name}:start *@`;
  const end = `@* startup:${name}:end *@`;
  const content = source.split(start)[1]?.split(end);
  if (content?.length !== 2) throw new Error(`Missing Razor startup fragment: ${name}`);
  return content[0].trim();
}

function renderHeader(home) {
  return `<header>
    <nav class="navbar" aria-label="Hauptnavigation">
        <div class="container nav-inner">
            <a href="/" class="nav-brand">
                <div class="brand-logo">
                    <img src="/img/logo_rastenfeld.jpg" alt="FF Rastenfeld Logo" class="brand-logo-img"/>
                </div>
                <div class="brand-name">
                    <strong>FF Rastenfeld</strong>
                    <small>Freiwillige Feuerwehr · NÖ</small>
                </div>
            </a>
            <a class="hamburger" href="#site-footer" aria-label="Navigation im Seitenfuß">
                <span></span><span></span><span></span>
            </a>
            <ul class="nav-menu">
                <li><a href="/"${home ? ' class="active" aria-current="page"' : ""}>Startseite</a></li>
                <li><a href="/news">News <span class="caret" aria-hidden="true">▾</span></a></li>
                <li><a href="/mannschaft">Feuerwehr <span class="caret" aria-hidden="true">▾</span></a></li>
                <li><a href="/galerie">Galerie</a></li>
                <li><a href="/kontakt">Kontakt</a></li>
                <li><a href="/spenden">Spenden</a></li>
            </ul>
        </div>
    </nav>
</header>
<div class="header-spacer"></div>`;
}

function postImage(post, imageBase) {
  const first = post.Bilder?.[0];
  const rawPath = typeof first === "string" ? first : first?.Pfad ?? first?.Path ?? first?.pfad;
  const defaultName = post.Emoji === "keinbild" ? "keinbild.jpeg" : `${post.Slug}.jpeg`;
  const path = rawPath?.replaceAll("\\", "/").trim() || defaultName;
  if (/^https?:\/\//i.test(path) || path.startsWith("/") || /^img\//i.test(path)) return path;
  return `${imageBase}/${path}`;
}

function renderCard({ path, post }, imageBase) {
  const href = escapeHtml(path);
  const title = escapeHtml(post.Titel);
  const date = new Date(`${post.Datum.slice(0, 10)}T00:00:00Z`);
  const meta = post.EinsatzTyp ? `<div class="post-einsatz-meta">
                <span>⚡ ${escapeHtml(post.EinsatzTyp)}</span>
                ${post.EinsatzOrt ? `<span>📍 ${escapeHtml(post.EinsatzOrt)}</span>` : ""}
                ${Number.isInteger(post.EinsatzKraefte) ? `<span>👥 ${post.EinsatzKraefte} Kräfte</span>` : ""}
            </div>` : "";

  return `<article class="post-card">
            <a href="${href}" class="post-card-img-link">
                <div class="post-card-img">
                    <img src="${escapeHtml(postImage(post, imageBase))}" class="hero-bg-img" alt="${title}"/>
                </div>
            </a>
            <div class="post-card-body">
                <time class="post-date">${Number.isNaN(date.valueOf()) ? "" : postDate.format(date)}</time>
                <h3><a href="${href}">${title}</a></h3>
                ${meta}
                <p>${escapeHtml(post.Kurztext ?? "")}</p>
                <a href="${href}" class="read-more">Weiterlesen →</a>
            </div>
        </article>`;
}

const incidentIntro = `<div class="page-hero">
    <div class="container">
        <div class="breadcrumb">
            <a href="/">Startseite</a>
            <span>›</span><span>Einsatzchronik FF Rastenfeld</span>
        </div>
        <h1>Einsatzchronik FF Rastenfeld</h1>
        <p>Aktuelle Einsätze der FF Rastenfeld im Bezirk Krems-Land, NÖ</p>
    </div>
</div>`;

function incidentControls(incidents) {
  const filters = ["Alle", "Brand", "Technische Hilfe", "Unwetter", "Gefahrgut", "Sonstige"];
  const counts = [
    [incidents.length, "Gesamt"],
    [incidents.filter(({ post }) => post.EinsatzTyp?.startsWith("B")).length, "Brand"],
    [incidents.filter(({ post }) => post.EinsatzTyp?.startsWith("T")).length, "THL"],
    [incidents.reduce((sum, { post }) => sum + (post.EinsatzKraefte ?? 0), 0), "Kräfte gesamt"],
  ];
  return `<div class="feed-filter-bar" aria-label="Einsatzfilter">
        ${filters.map((label, i) => `<button type="button" class="filter-pill${i === 0 ? " active" : ""}" disabled>${label}</button>`).join("\n")}
    </div>
    <div class="einsatz-stats-row">
        ${counts.map(([count, label]) => `<div class="estat"><strong>${count}</strong><span>${label}</span></div>`).join("\n")}
    </div>`;
}

function renderSidebar(posts, incidents) {
  const last = incidents[0];
  const categoryLinks = [
    ["Einsätze", "/einsaetze", incidents.length],
    ["FF-News", "/news", posts.filter(({ post }) => post.Kategorie === "FF-News").length],
    ["Ausbildung", "/ausbildung", posts.filter(({ post }) => post.Kategorie === "Ausbildung").length],
  ];
  return `<aside class="sidebar">
    <div class="sidebar-widget sidebar-widget--red">
        <h3>⚡ Letzter Einsatz</h3>
        ${last ? `<p class="sidebar-einsatz-typ">${escapeHtml(last.post.EinsatzTyp ?? "")}</p>
        <p class="sidebar-einsatz-title"><a href="${escapeHtml(last.path)}">${escapeHtml(last.post.Titel)}</a></p>` : ""}
    </div>
    <div class="sidebar-widget">
        <h3>Kategorien</h3>
        <ul class="sidebar-cats">
            ${categoryLinks.map(([label, href, count]) => `<li><a href="${href}">${label} <span>${count}</span></a></li>`).join("\n")}
        </ul>
    </div>
    <div class="sidebar-widget sidebar-widget--join">
        <p>🧑‍🚒 <strong>Werde Mitglied!</strong></p>
        <p>Du möchtest helfen? Wir freuen uns über jede Verstärkung!</p>
        <a href="/kontakt" class="btn btn-primary" style="width:100%;text-align:center;margin-top:.5rem;">Jetzt mitmachen</a>
    </div>
</aside>`;
}

const mediaPlaceholders = `<div class="embed-row">
    <div class="instagram-embed-wrap external-media-placeholder" aria-hidden="true"><div class="sk sk-line sk-medium"></div></div>
    <div class="instagram-embed-wrap external-media-placeholder" aria-hidden="true"><div class="sk sk-line sk-medium"></div></div>
</div>`;

export function renderStartup(path, homePage, posts, imageBase) {
  if (path !== "/" && path !== "/einsaetze") return "";

  const home = path === "/";
  const incidents = posts.filter(({ post }) => post.Kategorie === "Einsätze");
  const cards = (home ? posts.slice(0, 3) : incidents).map(entry => renderCard(entry, imageBase)).join("\n");
  return `<div id="html-fallback">
    ${renderHeader(home)}
    <main>
        ${home ? homeFragment(homePage, "home-intro") : incidentIntro}
        <div class="site-body container">
            <div class="content-with-sidebar">
                <section class="main-feed" aria-label="${home ? "Aktuelle Beiträge" : "Einsatzberichte"}">
                    ${home ? '<h2 class="feed-title">Aktuelle Beiträge</h2>' : incidentControls(incidents)}
                    ${cards || (home ? "" : '<p class="empty-msg">Keine Einsätze in dieser Kategorie.</p>')}
                    ${home ? `${homeFragment(homePage, "home-pagination")}\n${mediaPlaceholders}` : ""}
                </section>
                ${renderSidebar(posts, incidents)}
            </div>
        </div>
    </main>
</div>
`;
}
