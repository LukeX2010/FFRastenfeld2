const entities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
export const escapeHtml = value => value.replace(/[&<>"']/g, char => entities[char]);

const postDate = new Intl.DateTimeFormat("de-AT", {
  day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});
const incidentDate = new Intl.DateTimeFormat("de-AT", {
  weekday: "long", day: "numeric", month: "long", year: "numeric", timeZone: "UTC",
});

function readFragment(source, name) {
  const start = `@* startup:${name}:start *@`;
  const end = `@* startup:${name}:end *@`;
  const content = source.split(start)[1]?.split(end);
  if (content?.length !== 2) throw new Error(`Missing Razor startup fragment: ${name}`);
  return content[0].trim();
}

function renderDropdown(label, id, items) {
  return `<li class="has-dropdown">
    <button type="button" aria-expanded="false" aria-controls="${id}">${label} <span class="caret" aria-hidden="true">▾</span></button>
    <ul class="dropdown" id="${id}">${items.map(([href, text]) => `<li><a href="${href}">${text}</a></li>`).join("")}</ul>
  </li>`;
}

function renderHeader(path, images, interactive = false) {
  const hamburger = interactive
    ? '<button type="button" class="hamburger" aria-label="Menü" aria-controls="site-navigation" aria-expanded="false"><span></span><span></span><span></span></button>'
    : `<a class="hamburger" href="${escapeHtml(path)}#site-footer" aria-label="Navigation im Seitenfuß"><span></span><span></span><span></span></a>`;
  const menus = interactive
    ? renderDropdown("News", "site-navigation-news", [
        ["/einsaetze", "Einsätze"], ["/news", "FF-News"], ["/ausbildung", "Ausbildung"],
      ]) + renderDropdown("Feuerwehr", "site-navigation-feuerwehr", [
        ["/chronik", "Chronik"], ["/mannschaft", "Mannschaft"], ["/feuerwehrhaus", "Feuerwehrhaus"], ["/fahrzeuge", "Fahrzeuge"],
      ])
    : `<li><a href="/news">News <span class="caret" aria-hidden="true">▾</span></a></li>
       <li><a href="/mannschaft">Feuerwehr <span class="caret" aria-hidden="true">▾</span></a></li>`;
  return `<header${interactive ? ' id="site-header" data-static-navigation' : ""}>
    <nav class="navbar" aria-label="Hauptnavigation">
        <div class="container nav-inner">
            <a href="/" class="nav-brand">
                <div class="brand-logo">
                    ${renderImage("/img/logo_rastenfeld.jpg", "", images,
                        { cssClass: "brand-logo-img", eager: true })}
                </div>
                <div class="brand-name">
                    <strong>FF Rastenfeld</strong>
                    <small>Freiwillige Feuerwehr · NÖ</small>
                </div>
            </a>
            ${hamburger}
            <ul class="nav-menu"${interactive ? ' id="site-navigation"' : ""}>
                <li><a href="/"${path === "/" ? ' class="active" aria-current="page"' : ""}>Startseite</a></li>
                ${menus}
                <li><a href="/galerie">Galerie</a></li>
                <li><a href="/kontakt">Kontakt</a></li>
                <li><a href="/spenden">Spenden</a></li>
            </ul>
        </div>
    </nav>
</header>
<div class="header-spacer"></div>`;
}

export function resolvePostImage(entry, imageBase) {
  const rawPath = typeof entry === "string" ? entry : entry?.Pfad ?? entry?.Path ?? entry?.pfad;
  const path = rawPath?.replaceAll("\\", "/").trim();
  if (!path) return "";
  if (/^https?:\/\//i.test(path) || path.startsWith("/") || /^img\//i.test(path)) return path;
  return `${imageBase}/${path}`;
}

export function postImage(post, imageBase) {
  const defaultName = post.Emoji === "keinbild" ? "keinbild.jpeg" : `${post.Slug}.jpeg`;
  return resolvePostImage(post.Bilder?.[0], imageBase) || `${imageBase}/${defaultName}`;
}

export function postImageAlt(post, image) {
  if (/\/keinbild\.jpeg$/i.test(image)) return "Kein Beitragsfoto verfügbar";
  const first = post.Bilder?.[0];
  const description = first?.Beschreibung ?? first?.Description ?? first?.beschreibung;
  return description?.trim() || `Foto zum Bericht „${post.Titel}“`;
}

function renderImage(src, alt, images, { cssClass = "hero-bg-img", eager = false, priority } = {}) {
  const image = images[src.startsWith("/") ? src : `/${src}`];
  const dimensions = image ? ` width="${image.Width}" height="${image.Height}"` : "";
  return `<img src="${escapeHtml(src)}"${dimensions} alt="${escapeHtml(alt)}" class="${cssClass}"
         loading="${eager ? "eager" : "lazy"}" decoding="async"${priority ? ` fetchpriority="${priority}"` : ""}/>`;
}

function renderCard({ path, post }, imageBase, images, priority) {
  const href = escapeHtml(path);
  const title = postLinkTitle(post);
  const date = new Date(`${(post.Datum ?? "").slice(0, 10)}T00:00:00Z`);
  const image = postImage(post, imageBase);
  const meta = post.EinsatzTyp ? `<div class="post-einsatz-meta">
                <span>⚡ ${escapeHtml(post.EinsatzTyp)}</span>
                ${post.EinsatzOrt ? `<span>📍 ${escapeHtml(post.EinsatzOrt)}</span>` : ""}
                ${Number.isInteger(post.EinsatzKraefte) ? `<span>👥 ${post.EinsatzKraefte} Kräfte</span>` : ""}
            </div>` : "";

  return `<article class="post-card">
            <div class="post-card-img">
                ${renderImage(image, postImageAlt(post, image), images, { priority })}
            </div>
            <div class="post-card-body">
                <time class="post-date">${Number.isNaN(date.valueOf()) ? "" : postDate.format(date)}</time>
                <h3><a href="${href}" class="post-card-link">${title}</a></h3>
                ${meta}
                <p>${escapeHtml(post.Kurztext ?? "")}</p>
                <span class="read-more">Weiterlesen →</span>
            </div>
        </article>`;
}

function postLinkTitle(post) {
  return escapeHtml(post.LinkTitel?.trim() || post.Titel);
}

function pageIntro(title, subtitle, parent) {
  const heading = escapeHtml(title);
  return `<div class="page-hero">
    <div class="container">
        <div class="breadcrumb">
            <a href="/">Start</a>
            ${parent ? `<span>›</span><a href="${parent.path}">${parent.label}</a>` : ""}
            <span>›</span><span>${heading}</span>
        </div>
        <h1>${heading}</h1>
        ${subtitle ? `<p>${escapeHtml(subtitle)}</p>` : ""}
    </div>
</div>`;
}

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
  const stamp = last?.post.Datum ?? "";
  const [year, month, day] = stamp.slice(0, 10).split("-");
  const time = stamp.slice(11, 16);
  const categoryLinks = [
    ["Einsatzarchiv", "/einsaetze", incidents.length],
    ["Feuerwehrmeldungen", "/news", posts.filter(({ post }) => post.Kategorie === "FF-News").length],
    ["Übungen & Kurse", "/ausbildung", posts.filter(({ post }) => post.Kategorie === "Ausbildung").length],
  ];
  return `<aside class="sidebar">
    <div class="sidebar-widget sidebar-widget--red">
        <h2>⚡ Letzter Einsatz</h2>
        ${last ? `<p class="sidebar-einsatz-typ">${escapeHtml(last.post.EinsatzTyp ?? "")}</p>
        <p class="sidebar-einsatz-title">${escapeHtml(last.post.Titel)}</p>
        <time${stamp ? ` datetime="${escapeHtml(stamp)}"` : ""}><a href="${escapeHtml(last.path)}">${day ? escapeHtml(`Einsatzbericht vom ${day}.${month}.${year}`) : "Jüngster Einsatzbericht"}</a>${time ? ` · ${escapeHtml(time)} Uhr` : ""}</time>` : ""}
    </div>
    <div class="sidebar-widget">
        <h2>Kategorien</h2>
        <ul class="sidebar-cats">
            ${categoryLinks.map(([label, href, count]) => `<li><a href="${href}">${escapeHtml(label)} <span>${count}</span></a></li>`).join("\n")}
        </ul>
    </div>
    <div class="sidebar-widget">
        <h2>Links</h2>
        <ul class="sidebar-links">
            <li><a href="https://www.noelfv.at" target="_blank" rel="noopener noreferrer">NÖ Landesfeuerwehrverband</a></li>
            <li><a href="https://www.bfk-krems.at" target="_blank" rel="noopener noreferrer">BFK Krems-Land</a></li>
            <li><a href="https://www.noelfv.at/wastl" target="_blank" rel="noopener noreferrer">WASTL Einsatzmonitor</a></li>
            <li><a href="https://www.noelfv.at/lfws" target="_blank" rel="noopener noreferrer">NÖ Landesfeuerwehrschule</a></li>
            <li><a href="https://www.rastenfeld.at" target="_blank" rel="noopener noreferrer">Marktgemeinde Rastenfeld</a></li>
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

const sections = {
  "/einsaetze": { label: "Einsätze", breadcrumb: "Einsatzübersicht", feedHeading: "Einsatzberichte", title: "Einsatzchronik FF Rastenfeld", subtitle: "Aktuelle Einsätze der FF Rastenfeld im Bezirk Krems-Land, NÖ", badge: "einsa-tze", back: "Zurück zur Einsatzübersicht" },
  "/news": { label: "FF-News", breadcrumb: "Aktuelle Meldungen", feedHeading: "Beiträge aus den FF-News", title: "FF-News & Aktuelle Berichte", subtitle: "Neuigkeiten, Veranstaltungen und Berichte der Freiwilligen Feuerwehr Rastenfeld", badge: "ff-news", back: "Zurück zu FF-News" },
  "/ausbildung": { label: "Ausbildung", breadcrumb: "Übungsberichte", feedHeading: "Berichte zu Übungen und Lehrgängen", title: "Ausbildung & Übungen", subtitle: "Kurse, Lehrgänge und Übungen der FF Rastenfeld – bestens ausgebildet für jeden Einsatz", badge: "ausbildung", back: "Zurück zu Ausbildung" },
};

function renderArticle(path, post, parentPath, imageBase, images, posts) {
  const section = sections[parentPath];
  const image = postImage(post, imageBase);
  const date = new Date(`${(post.Datum ?? "").slice(0, 10)}T00:00:00Z`);
  const info = parentPath === "/einsaetze" ? [
    ["Einsatztyp", post.EinsatzTyp ?? ""],
    ["Einsatzort", `📍 ${post.EinsatzOrt ?? ""}`],
    ["Alarmzeit", `🕐 ${post.EinsatzZeit ?? ""}`],
    ["Einsatzkräfte", `👥 ${post.EinsatzKraefte ?? ""} Personen`],
  ] : [];
  const dateLabel = Number.isNaN(date.valueOf()) ? "" : (info.length ? incidentDate : postDate).format(date);
  const incidentTime = post.Datum?.slice(11, 16);
  const first = post.Bilder?.[0];
  const caption = first?.Beschreibung ?? first?.Description ?? first?.beschreibung;
  const hasGallery = Boolean(typeof first === "string" ? first.trim() : first?.Pfad ?? first?.Path ?? first?.pfad);
  const sectionPosts = posts.filter(entry => entry.post.Kategorie === post.Kategorie);
  const index = sectionPosts.findIndex(entry => entry.path === path);
  const neighbours = [
    [sectionPosts[index - 1], "Neuerer Bericht"],
    [sectionPosts[index + 1], "Älterer Bericht"],
  ].filter(([entry]) => entry);
  return `<div id="html-fallback">
    ${renderHeader(path, images)}
    <main>
        ${pageIntro(post.Titel, "", { path: parentPath, label: section.breadcrumb })}
        <div class="site-body container"><div class="content-with-sidebar"><div class="main-feed">
            <article class="post-detail">
                <div class="detail-meta">
                    <span class="post-card-kat post-card-kat--${section.badge}">${section.label}</span>
                    <time>${dateLabel}${info.length && incidentTime ? ` – ${escapeHtml(incidentTime)} Uhr` : ""}</time>
                </div>
                ${info.length ? `<div class="einsatz-infobox">${info.map(([label, value]) =>
                  `<div class="eib-row"><span class="eib-label">${label}</span><span>${escapeHtml(value)}</span></div>`).join("")}</div>` : ""}
                <div class="detail-img">${renderImage(image, postImageAlt(post, image), images, { eager: true })}</div>
                <div class="detail-body"><p class="post-copy">${escapeHtml(post.Volltext ?? post.Kurztext ?? "")}</p></div>
                ${hasGallery ? `<div class="photo-gallery">
                    <div class="photo-gallery-inline"><div class="photo-stage"><div class="photo-plane">
                        ${renderImage(image, "", images)}
                    </div></div></div>
                    ${caption ? `<p class="photo-gallery-caption">${escapeHtml(caption)}</p>` : ""}
                </div>` : ""}
                <a href="${parentPath}" class="back-link">← ${section.back}</a>
                ${neighbours.length ? `<nav class="post-neighbours" aria-label="Weitere Berichte">
                    ${neighbours.map(([entry, label]) => `<div class="post-neighbour"><small>${label}</small>
                        <a href="${escapeHtml(entry.path)}" class="card-link"><strong>${postLinkTitle(entry.post)}</strong></a>
                    </div>`).join("")}
                </nav>` : ""}
            </article>
        </div></div></div>
    </main>
</div>\n`;
}

export function renderStartup(path, homePage, donationPage, posts, imageBase, images, staticHome) {
  const home = path === "/";
  const section = sections[path];
  const donation = path === "/spenden";
  if (!home && !section && !donation) {
    const article = posts.find(post => post.path === path);
    return article ? renderArticle(path, article.post, path.slice(0, path.lastIndexOf("/")), imageBase, images, posts) : "";
  }
  const incidents = posts.filter(({ post }) => post.Kategorie === "Einsätze");
  if (donation) {
    const article = readFragment(donationPage, "donation")
      .replace(/\s+data-external-embed(?=\s)/, "")
      .replace(" data-load-external ", " disabled ");
    return `<div id="html-fallback">
    ${renderHeader(path, images)}
    <main>
        ${pageIntro("Spenden & Unterstützen", "Jeder Beitrag zählt für die Sicherheit in Rastenfeld!")}
        <div class="site-body container"><div class="content-with-sidebar">
            <div class="main-feed">${article}</div>
            ${renderSidebar(posts, incidents)}
        </div></div>
    </main>
</div>\n`;
  }
  const cards = (home ? posts.slice(0, 3) : posts.filter(({ post }) => post.Kategorie === section.label))
    .map(entry => renderCard(entry, imageBase, images, home ? "low" : undefined)).join("\n");
  const intro = home ? readFragment(homePage, "home-intro").replace(
    /<ResponsiveImage\s+Src="img\/cover\.jpg"[^>]*\/>/,
    () => renderImage("/img/cover.jpg", "Einsatzfahrzeug der FF Rastenfeld", images, { eager: true, priority: "high" }),
  ) : pageIntro(section.title, section.subtitle);
  return `<div id="html-fallback">
    ${renderHeader(path, images, staticHome)}
    <main>
        ${intro}
        <div class="site-body container">
            <div class="content-with-sidebar">
                <section class="main-feed" aria-label="${home ? "Aktuelle Beiträge" : section.label}">
                    ${home ? '<h2 class="feed-title">Aktuelle Beiträge</h2>' : `<h2 class="visually-hidden">${section.feedHeading}</h2>`}
                    ${path === "/einsaetze" ? incidentControls(incidents) : ""}
                    ${cards || (path === "/einsaetze" ? '<p class="empty-msg">Keine Einsätze in dieser Kategorie.</p>' : "")}
                    ${home ? `${readFragment(homePage, "home-pagination")}\n${staticHome ? readFragment(homePage, "home-media") : mediaPlaceholders}` : ""}
                </section>
                ${renderSidebar(posts, incidents)}
            </div>
        </div>
    </main>
</div>
`;
}
