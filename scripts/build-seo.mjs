import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";

const publish = process.argv[2] ?? ".publish/wwwroot";
const origin = "https://ffrastenfeld.at";
const organization = "Freiwillige Feuerwehr Rastenfeld";
const homeDescription = "Offizielle Website der Freiwilligen Feuerwehr Rastenfeld im Bezirk Krems-Land. Aktuelle Einsätze, News, Fahrzeuge, Mannschaft und Kontakt.";

const pages = {
  "/": [`${organization} – Niederösterreich`, homeDescription],
  "/einsaetze": [`Einsätze – ${organization}, Niederösterreich`, "Aktuelle Einsatzberichte der Freiwilligen Feuerwehr Rastenfeld aus dem Bezirk Krems-Land."],
  "/news": [`FF-News & Berichte – ${organization}, NÖ`, "Neuigkeiten, Veranstaltungen und Berichte der Freiwilligen Feuerwehr Rastenfeld."],
  "/ausbildung": [`Ausbildung & Übungen – ${organization}, Bezirk Krems`, "Berichte über Übungen und Ausbildung bei der Freiwilligen Feuerwehr Rastenfeld."],
  "/mannschaft": [`Unsere Mannschaft – ${organization}`, "Lerne die Mannschaft und das Kommando der Freiwilligen Feuerwehr Rastenfeld kennen."],
  "/chronik": ["Chronik seit 1871 – Geschichte der Freiwilligen Feuerwehr Rastenfeld, NÖ", "Die Geschichte der Freiwilligen Feuerwehr Rastenfeld von ihrer Gründung 1871 bis heute."],
  "/feuerwehrhaus": ["Feuerwehrhaus Rastenfeld – Standort & Ausstattung, 3532 Rastenfeld NÖ", "Das Feuerwehrhaus der Freiwilligen Feuerwehr Rastenfeld. Informationen zum Standort und zur Ausstattung."],
  "/fahrzeuge": [`Fahrzeuge & Ausrüstung – ${organization}, NÖ`, "TLF 4000, MTF, Abschleppachse und TSA 750 der Freiwilligen Feuerwehr Rastenfeld im Überblick."],
  "/fahrzeuge/1": [`Tanklöschfahrzeug – ${organization}, NÖ`, "Das Tanklöschfahrzeug TLF 4000 der Freiwilligen Feuerwehr Rastenfeld."],
  "/fahrzeuge/2": [`Mannschaftstransportfahrzeug – ${organization}, NÖ`, "Das Mannschaftstransportfahrzeug MTF der Freiwilligen Feuerwehr Rastenfeld."],
  "/fahrzeuge/3": [`Abschleppachse – ${organization}, NÖ`, "Die Abschleppachse der Freiwilligen Feuerwehr Rastenfeld für technische Hilfeleistungen."],
  "/fahrzeuge/4": [`TS-Anhänger – ${organization}, NÖ`, "Der Tragkraftspritzenanhänger TSA 750 der Freiwilligen Feuerwehr Rastenfeld."],
  "/galerie": [`Galerie – Einsatz- & Übungsbilder ${organization}`, "Fotos von Einsätzen, Übungen und Veranstaltungen der Freiwilligen Feuerwehr Rastenfeld."],
  "/kontakt": [`Kontakt – ${organization}, 3532 Rastenfeld, NÖ`, "Adresse, Telefonnummer und E-Mail der Freiwilligen Feuerwehr Rastenfeld. Das Feuerwehrhaus befindet sich in Rastenfeld 178."],
  "/spenden": [`Spenden & Unterstützen – ${organization}, NÖ`, "Informationen zu Spenden für die Freiwillige Feuerwehr Rastenfeld und zur Verwendung der Spenden."],
  "/impressum": [`Impressum - ${organization}, NÖ`, "Impressum und Angaben zur Herausgeberin der Website der Freiwilligen Feuerwehr Rastenfeld."],
  "/datenschutz": [`Datenschutzerklärung - ${organization}, NÖ`, "Datenschutzerklärung der Website der Freiwilligen Feuerwehr Rastenfeld."],
};

const postSections = new Map([
  ["Einsätze", ["einsaetze", "FF Rastenfeld, Niederösterreich"]],
  ["FF-News", ["news", `${organization}, NÖ`]],
  ["Ausbildung", ["ausbildung", `${organization}, NÖ`]],
]);

const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${origin}/#website`,
      url: `${origin}/`,
      name: organization,
      alternateName: "FF Rastenfeld",
      inLanguage: "de-AT",
      publisher: { "@id": `${origin}/#feuerwehr` },
    },
    {
      "@type": "FireStation",
      "@id": `${origin}/#feuerwehr`,
      name: organization,
      alternateName: "FF Rastenfeld",
      url: `${origin}/`,
      logo: `${origin}/img/logo.jpg`,
      image: `${origin}/img/cover.jpg`,
      telephone: "+43 677 64048597",
      email: "rastenfeld@feuerwehr.gv.at",
      foundingDate: "1871-04-12",
      description: "Seit 1871 für die Gemeinde Rastenfeld im Bezirk Krems-Land in Niederösterreich im Einsatz.",
      areaServed: { "@type": "Place", name: "Rastenfeld, Bezirk Krems-Land, Niederösterreich" },
      address: {
        "@type": "PostalAddress",
        streetAddress: "Rastenfeld 178",
        addressLocality: "Rastenfeld",
        postalCode: "3532",
        addressCountry: "AT",
        addressRegion: "Niederösterreich",
      },
      sameAs: [
        "https://www.instagram.com/ff_rastenfeld",
        "https://www.facebook.com/profile.php?id=100066674045868",
      ],
    },
  ],
};

const htmlEntities = { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" };
const escapeHtml = value => value.replace(/[&<>"']/g, char => htmlEntities[char]);

const [shell, postsJson, redirectRules] = await Promise.all([
  readFile(new URL("../wwwroot/index.html", import.meta.url), "utf8"),
  readFile(join(publish, "data/posts.json"), "utf8"),
  readFile(new URL("../wwwroot/_redirects", import.meta.url), "utf8"),
]);
const marker = /<!-- page-metadata:start -->[\s\S]*?<!-- page-metadata:end -->/;
if (!marker.test(shell)) throw new Error("SEO markers missing in index.html.");

const routes = Object.fromEntries(Object.entries(pages).map(([path, [title, description]]) =>
  [path, { title, description, canonical: origin + path, type: "website" }]));
routes["/"].structuredData = structuredData;

const publishedPosts = [];
for (const post of JSON.parse(postsJson.replace(/^\uFEFF/, ""))) {
  const section = postSections.get(post.Kategorie);
  if (!section) continue;

  const [folder, titleSuffix] = section;
  const slug = post.Slug;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    throw new Error(`Invalid published post slug: ${slug}`);
  }
  const path = `/${folder}/${slug}`;
  if (Object.hasOwn(routes, path)) throw new Error(`Duplicate SEO route: ${path}`);

  const summary = (post.Kurztext ?? "").replace(/\s+/g, " ").trim();
  const description = summary.length > 160 ? `${summary.slice(0, 157).replace(/\s+\S*$/, "")}…` : summary;
  routes[path] = {
    title: `${post.Titel} – ${titleSuffix}`,
    description: description || `„${post.Titel}“ – ein Bericht der Freiwilligen Feuerwehr Rastenfeld.`,
    canonical: origin + path,
    type: "article",
  };
  publishedPosts.push({ path, post, summary });
}

publishedPosts.sort((a, b) => Date.parse(b.post.Datum) - Date.parse(a.post.Datum));

function renderFallback(path) {
  if (path !== "/" && path !== "/einsaetze") return "";

  const home = path === "/";
  const posts = home
    ? publishedPosts.slice(0, 3)
    : publishedPosts.filter(entry => entry.post.Kategorie === "Einsätze");
  const heading = home ? "Freiwillige Feuerwehr Rastenfeld" : "Einsatzchronik FF Rastenfeld";
  const intro = home
    ? "Seit 1871 für unsere Gemeinde im Einsatz. Bezirk Krems-Land, Niederösterreich."
    : "Aktuelle Einsätze der FF Rastenfeld im Bezirk Krems-Land, Niederösterreich.";
  const links = home
    ? '<a href="/einsaetze" class="btn btn-primary">Aktuelle Einsätze</a> <a href="/mannschaft" class="btn btn-ghost">Über uns</a>'
    : '<a href="/" class="btn btn-ghost">Zur Startseite</a>';
  const cards = posts.map(({ path, post, summary }) => `<article class="post-card">
            <div class="post-card-body">
                <h3><a href="${escapeHtml(path)}">${escapeHtml(post.Titel)}</a></h3>
                <p>${escapeHtml(summary)}</p>
            </div>
        </article>`).join("\n        ");

  return `<main id="html-fallback">
    <section class="page-hero">
        <div class="container">
            <h1>${heading}</h1>
            <p>${intro}</p>
            <nav aria-label="Schnelleinstieg">${links}</nav>
        </div>
    </section>
    <section class="site-body container">
        <h2>${home ? "Aktuelle Beiträge" : "Einsatzberichte"}</h2>
        ${cards}
    </section>
</main>
`;
}

function render({ title, description, canonical, type, structuredData }, path) {
  const tags = [
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}"/>`,
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}"/>` : '<meta name="robots" content="noindex"/>',
    ...(canonical ? [
      `<meta property="og:title" content="${escapeHtml(title)}"/>`,
      `<meta property="og:description" content="${escapeHtml(description)}"/>`,
      `<meta property="og:url" content="${escapeHtml(canonical)}"/>`,
      `<meta property="og:type" content="${type}"/>`,
      `<meta name="twitter:title" content="${escapeHtml(title)}"/>`,
      `<meta name="twitter:description" content="${escapeHtml(description)}"/>`,
    ] : []),
  ];
  if (structuredData) {
    const json = JSON.stringify(structuredData).replaceAll("<", "\\u003c");
    tags.push(`<script id="site-structured-data" type="application/ld+json">${json}</script>`);
  }

  return shell.replace('<html lang="de">', '<html lang="de" data-seo-generated>')
    .replace(marker, () => tags.join("\n    "))
    .replace('<div id="app">', () => renderFallback(path) + '<div id="app">');
}

const notFound = {
  title: "404 - Seite nicht gefunden | FF Rastenfeld",
  description: "Diese Seite wurde nicht gefunden.",
};
const rewrites = [];
for (const [path, metadata] of Object.entries(routes)) {
  const target = path === "/" ? "/index.html" : `/_seo/pages${path}.html`;
  if (path !== "/") rewrites.push(`${path} ${target} 200`);
  const destination = join(publish, target);
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, render(metadata, path));
}

// Keep the local SPA fallback in the source. On Netlify, only known URLs get 200.
const redirects = redirectRules.replace(/^\/\*\s+\/index\.html\s+200\s*$/m, "").trimEnd();
const sitemapUrls = Object.values(routes).map(({ canonical }) => `  <url><loc>${escapeHtml(canonical)}</loc></url>`);
await Promise.all([
  writeFile(join(publish, "_redirects"), [redirects, ...rewrites, ""].join("\n")),
  writeFile(join(publish, "_seo/routes.json"), JSON.stringify({ routes, notFound })),
  writeFile(join(publish, "404.html"), render(notFound)),
  writeFile(join(publish, "sitemap.xml"), [
    '<?xml version="1.0" encoding="UTF-8"?>',
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">',
    ...sitemapUrls, "</urlset>", "",
  ].join("\n")),
]);

console.log(`Generated metadata and sitemap for ${Object.keys(routes).length} public URLs.`);
