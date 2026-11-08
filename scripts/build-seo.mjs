import { createHash } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { escapeHtml, postImage, postImageAlt, renderStartup, resolvePostImage } from "./startup-html.mjs";
import { readImageDimensions, localImagePath } from "./build-images.mjs";

const publish = process.argv[2] ?? ".publish/wwwroot";
const origin = "https://ffrastenfeld.at";
const organization = "Freiwillige Feuerwehr Rastenfeld";
const homeDescription = "Offizielle Website der Freiwilligen Feuerwehr Rastenfeld im Bezirk Krems-Land. Aktuelle Einsätze, News, Fahrzeuge, Mannschaft und Kontakt.";

const pages = {
  "/": [`${organization} – Niederösterreich`, homeDescription],
  "/einsaetze": [`Einsätze – ${organization}, Niederösterreich`, "Aktuelle Einsatzberichte der Freiwilligen Feuerwehr Rastenfeld aus dem Bezirk Krems-Land."],
  "/news": [`FF-News & Berichte – ${organization}, NÖ`, "Neuigkeiten, Veranstaltungen und Berichte der Freiwilligen Feuerwehr Rastenfeld."],
  "/ausbildung": ["Ausbildung & Übungen | FF Rastenfeld", "Berichte über Übungen und Ausbildung bei der Freiwilligen Feuerwehr Rastenfeld."],
  "/mannschaft": [`Unsere Mannschaft – ${organization}`, "Lerne die Mannschaft und das Kommando der Freiwilligen Feuerwehr Rastenfeld kennen."],
  "/chronik": ["Chronik seit 1871 | FF Rastenfeld", "Die Geschichte der Freiwilligen Feuerwehr Rastenfeld von ihrer Gründung 1871 bis heute."],
  "/feuerwehrhaus": ["Feuerwehrhaus Rastenfeld – Standort & Ausstattung, 3532 Rastenfeld NÖ", "Das Feuerwehrhaus der Freiwilligen Feuerwehr Rastenfeld. Informationen zum Standort und zur Ausstattung."],
  "/fahrzeuge": [`Fahrzeuge & Ausrüstung – ${organization}, NÖ`, "TLF 4000, MTF, Abschleppachse und TSA 750 der Freiwilligen Feuerwehr Rastenfeld im Überblick."],
  "/fahrzeuge/1": [`Tanklöschfahrzeug – ${organization}, NÖ`, "Das Tanklöschfahrzeug TLF 4000 der FF Rastenfeld fasst 4.000 Liter Wasser. Technische Daten und Ausrüstung des Fahrzeugs im Überblick."],
  "/fahrzeuge/2": [`Mannschaftstransportfahrzeug – ${organization}, NÖ`, "Das Mannschaftstransportfahrzeug MTF der Freiwilligen Feuerwehr Rastenfeld."],
  "/fahrzeuge/3": [`Abschleppachse – ${organization}, NÖ`, "Die Abschleppachse der Freiwilligen Feuerwehr Rastenfeld für technische Hilfeleistungen."],
  "/fahrzeuge/4": [`TS-Anhänger – ${organization}, NÖ`, "Der Tragkraftspritzenanhänger TSA 750 der Freiwilligen Feuerwehr Rastenfeld."],
  "/galerie": ["Galerie mit Einsatz- und Übungsfotos | FF Rastenfeld", "Fotos von Einsätzen, Übungen und Veranstaltungen der Freiwilligen Feuerwehr Rastenfeld."],
  "/kontakt": [`Kontakt – ${organization}, 3532 Rastenfeld, NÖ`, "Adresse, Telefonnummer und E-Mail der Freiwilligen Feuerwehr Rastenfeld. Das Feuerwehrhaus befindet sich in Rastenfeld 178."],
  "/spenden": [`Spenden & Unterstützen – ${organization}, NÖ`, "Informationen zu Spenden für die Freiwillige Feuerwehr Rastenfeld und zur Verwendung der Spenden."],
  "/impressum": [`Impressum - ${organization}, NÖ`, "Impressum und Angaben zur Herausgeberin der Website der Freiwilligen Feuerwehr Rastenfeld."],
  "/datenschutz": [`Datenschutzerklärung - ${organization}, NÖ`, "Datenschutzerklärung der Website der Freiwilligen Feuerwehr Rastenfeld."],
};

const postSections = new Map([["Einsätze", "einsaetze"], ["FF-News", "news"], ["Ausbildung", "ausbildung"]]);

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

const [shell, postsJson, redirectRules, homePage, donationPage, settingsJson] = await Promise.all([
  readFile(new URL("../wwwroot/index.html", import.meta.url), "utf8"),
  readFile(join(publish, "data/posts.json"), "utf8"),
  readFile(new URL("../wwwroot/_redirects", import.meta.url), "utf8"),
  readFile(new URL("../Pages/Index.razor", import.meta.url), "utf8"),
  readFile(new URL("../Pages/Spenden.razor", import.meta.url), "utf8"),
  readFile(join(publish, "appsettings.json"), "utf8"),
]);
const settings = JSON.parse(settingsJson.replace(/^\uFEFF/, ""));
settings.WebsiteData ??= {};
const imageBase = settings.WebsiteData.ImageBaseUrl?.trim().replace(/\/+$/, "") || "img";
const postsUrl = settings.WebsiteData.PostsUrl?.trim() || "data/posts.json";
const staticHome = postsUrl === "data/posts.json" || postsUrl === "/data/posts.json";
const marker = /<!-- page-metadata:start -->[\s\S]*?<!-- page-metadata:end -->/;
if (!marker.test(shell)) throw new Error("SEO markers missing in index.html.");

await mkdir(join(publish, "assets/site"), { recursive: true });
async function saveAsset(name, content) {
  const hash = createHash("sha256").update(content).digest("hex").slice(0, 16);
  const file = name.replace(/(\.[^.]+)$/, `.${hash}$1`);
  await writeFile(join(publish, "assets/site", file), content);
  return `/assets/site/${file}`;
}

const styles = [...shell.matchAll(/<link rel="stylesheet" href="\/(css\/[^"]+)"\/>/g)];
const css = await Promise.all(styles.map(([, file]) => readFile(join(publish, file), "utf8")));
const stylesheet = await saveAsset("site.css", css.join("\n").replaceAll("url(../fonts/", "url(/fonts/"));
const scripts = [...shell.matchAll(/<script src="\/(js\/[^"]+)" defer><\/script>/g)];
const scriptUrls = await Promise.all(scripts.map(async ([, file]) =>
  saveAsset(file.split("/").at(-1), await readFile(join(publish, file)))));
const optimizedShell = scripts.reduce((html, [tag, file], index) =>
  html.replace(tag, tag.replace(`/${file}`, scriptUrls[index])), styles.reduce((html, [tag], index) =>
  html.replace(tag, index === 0 ? `<link rel="stylesheet" href="${stylesheet}"/>` : ""), shell));

const defaultImage = { image: `${origin}/img/cover.jpg`, imageAlt: "Einsatzfahrzeug der FF Rastenfeld" };
const routes = Object.fromEntries(Object.entries(pages).map(([path, [title, description]]) =>
  [path, { title, description, canonical: origin + path, type: "website", ...defaultImage }]));
routes["/"].structuredData = structuredData;

const publishedPosts = [];
for (const post of JSON.parse(postsJson.replace(/^\uFEFF/, ""))) {
  const folder = postSections.get(post.Kategorie);
  if (!folder) continue;
  const slug = post.Slug;
  if (typeof slug !== "string" || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/i.test(slug)) {
    throw new Error(`Invalid published post slug: ${slug}`);
  }
  const path = `/${folder}/${slug}`;
  if (Object.hasOwn(routes, path)) throw new Error(`Duplicate SEO route: ${path}`);

  const summary = (post.Kurztext ?? "").replace(/\s+/g, " ").trim();
  const description = summary.length > 160 ? `${summary.slice(0, 157).replace(/\s+\S*$/, "")}…` : summary;
  routes[path] = {
    title: post.Titel.length <= 47 ? `${post.Titel} | FF Rastenfeld` : post.Titel,
    description: description || `„${post.Titel}“ – ein Bericht der Freiwilligen Feuerwehr Rastenfeld.`,
    canonical: origin + path,
    type: "article",
    ...defaultImage,
  };
  publishedPosts.push({ path, post });
}

publishedPosts.sort((a, b) => Date.parse(b.post.Datum) - Date.parse(a.post.Datum));

const images = await readImageDimensions(publish, [
  "/img/cover.jpg", "/img/logo_rastenfeld.jpg", "/img/scaniaP340.jpeg", "/img/MTF.jpeg", "/img/FFhaus.png",
  ...publishedPosts.map(({ post }) => postImage(post, imageBase)),
  ...publishedPosts.flatMap(({ post }) => (post.Bilder ?? []).map(entry => resolvePostImage(entry, imageBase))),
]);
delete settings.WebsiteData.OptimizedImages;
settings.WebsiteData.ImageDimensions = images;
for (const { path, post } of publishedPosts) {
  const image = localImagePath(postImage(post, imageBase));
  const imageAlt = postImageAlt(post, image);
  if (images[image] && !image.endsWith("/keinbild.jpeg")) Object.assign(routes[path], { image: origin + image, imageAlt });
}

function render({ title, description, canonical, type, structuredData, image, imageAlt }, path) {
  const tags = [
    ...(path === "/" ? ['<link rel="preload" as="image" href="/img/cover.jpg" fetchpriority="high"/>'] : []),
    `<title>${escapeHtml(title)}</title>`,
    `<meta name="description" content="${escapeHtml(description)}"/>`,
    canonical ? `<link rel="canonical" href="${escapeHtml(canonical)}"/>` : '<meta name="robots" content="noindex"/>',
    ...(canonical ? [
      `<meta property="og:title" content="${escapeHtml(title)}"/>`,
      `<meta property="og:description" content="${escapeHtml(description)}"/>`,
      `<meta property="og:url" content="${escapeHtml(canonical)}"/>`,
      `<meta property="og:type" content="${type}"/>`,
      `<meta property="og:image" content="${escapeHtml(image)}"/>`,
      `<meta property="og:image:alt" content="${escapeHtml(imageAlt)}"/>`,
      `<meta name="twitter:title" content="${escapeHtml(title)}"/>`,
      `<meta name="twitter:description" content="${escapeHtml(description)}"/>`,
      `<meta name="twitter:image" content="${escapeHtml(image)}"/>`,
      `<meta name="twitter:image:alt" content="${escapeHtml(imageAlt)}"/>`,
    ] : []),
  ];
  if (structuredData) {
    const json = JSON.stringify(structuredData).replaceAll("<", "\\u003c");
    tags.push(`<script id="site-structured-data" type="application/ld+json">${json}</script>`);
  }

  const isStaticHome = path === "/" && staticHome;
  const startup = renderStartup(path, homePage, donationPage, publishedPosts, imageBase, images, isStaticHome);
  const pageShell = startup ? optimizedShell.replace(/<script src="\/assets\/site\/loading-skeleton\.[^"]+" defer><\/script>\s*/, "") : optimizedShell;
  return pageShell.replace('<html lang="de">', '<html lang="de" data-seo-generated>')
    .replace('<base href="/"/>', process.env.CONTEXT === "production" && !isStaticHome ? `<base href="${origin}/"/>` : '<base href="/"/>')
    .replace(marker, () => tags.join("\n    "))
    .replace(/<!-- client-app:start -->([\s\S]*?)<!-- client-app:end -->/, (_, clientApp) =>
      startup + (isStaticHome ? '<button id="scroll-top" type="button" title="Nach oben" aria-label="Zum Seitenanfang">↑</button>' : clientApp));
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
  writeFile(join(publish, "appsettings.json"), JSON.stringify(settings)),
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
