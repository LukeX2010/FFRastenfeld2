import { postToDraft } from "./post-map.js";
const root = document.querySelector("#app");
let posts = [],
  drafts = [],
  draft = null,
  settings = null,
  currentUser = null,
  tab = "posts",
  dirty = false,
  busy = false,
  noticeTimer;
const esc = (value) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
const cats = ["FF-News", "Einsätze", "Ausbildung", "Feuerwehrjugend"];
const imageUrl = (image) =>
  image.dataUrl || "/img/" + encodeURI(image.path || "").replace(/#/g, "%23");
const postImage = (post) => {
  const image = post.Bilder?.[0];
  return image
    ? imageUrl({ path: typeof image === "string" ? image : image.Pfad })
    : "";
};
const readable = (date) => new Date(date).toLocaleDateString("de-AT");
function toast(message, error = false) {
  const box = document.querySelector("#notice");
  box.textContent = message;
  box.className = error ? "error" : "";
  box.style.display = "block";
  clearTimeout(noticeTimer);
  noticeTimer = setTimeout(
    () => (box.style.display = "none"),
    error ? 14000 : 6500,
  );
}
async function api(route, data) {
  const res = await fetch("/api/admin" + route, {
    method: data === undefined ? "GET" : "POST",
    headers:
      data === undefined
        ? {}
        : { "Content-Type": "application/json", "X-Editor-Request": "1" },
    body: data === undefined ? undefined : JSON.stringify(data),
  });
  let value;
  try {
    value = await res.json();
  } catch {
    throw new Error(
      "Der Redaktionsdienst ist noch nicht erreichbar. Bitte Hosting-Konfiguration prüfen.",
    );
  }
  if (!res.ok) {
    if (res.status === 401 && !draft) login();
    throw new Error(
      value.message || "Die Anfrage konnte nicht abgeschlossen werden.",
    );
  }
  return value;
}
async function task(fn) {
  if (busy) return;
  busy = true;
  const veil = document.createElement("div");
  veil.className = "busy";
  veil.textContent = "Bitte warten …";
  document.body.append(veil);
  try {
    await fn();
  } catch (e) {
    toast(e.message, true);
  } finally {
    busy = false;
    veil.remove();
  }
}
const on = (selector, event, handler) =>
  root.querySelector(selector)?.addEventListener(event, handler);
function header() {
  return `<header class="topbar"><div class="brand"><img src="/img/logo.jpg" alt=""><div><strong>${esc(currentUser?.displayName || 'FF Rastenfeld')}</strong><small>ANGEMELDET · ${esc(currentUser?.username || 'REDAKTION')}</small></div></div><div class="toplinks"><button id="activity">Aktivitäten</button><a href="/" target="_blank" rel="noopener">Website ansehen ↗</a><button id="logout" class="subtle">Abmelden</button></div></header>${settings?.local ? '<div class="local">Lokaler Test · Änderungen bleiben auf diesem Laptop. Keine Veröffentlichung ins Internet.</div>' : ""}`;
}
function logoutBind() {
  on('#activity','click',()=>{if(leave())task(activityPage);});
  on("#logout", "click", () =>
    task(async () => {
      if (!leave()) return;
      await api("/logout", {});
      draft = null;
      dirty = false;
      currentUser = null;
      login();
    }),
  );
}
function leave() {
  return (
    !dirty || confirm("Es gibt ungespeicherte Änderungen. Wirklich verlassen?")
  );
}
function login() {
  root.innerHTML = `<form class="login"><div class="brand"><img src="/img/logo.jpg" alt=""><div><strong>FF Rastenfeld</strong><small>WEBSITE-REDAKTION</small></div></div><h1>Willkommen zurück.</h1><p class="help">Beiträge erstellen, gemeinsam verbessern und veröffentlichen.</p><label>Benutzername<input name="username" autocomplete="username" required></label><label>Passwort<input name="password" type="password" autocomplete="current-password" required></label><button class="primary" type="submit">Anmelden →</button></form>`;
  on("form", "submit", (e) => {
    e.preventDefault();
    const data = Object.fromEntries(new FormData(e.target));
    task(async () => {
      currentUser = (await api("/login", data)).user;
      await dashboard();
    });
  });
}
async function dashboard() {
  const results = await Promise.allSettled([
    api("/posts"),
    api("/drafts"),
    api("/settings"),
  ]);
  posts = results[0].status === "fulfilled" ? results[0].value : [];
  drafts = results[1].status === "fulfilled" ? results[1].value : [];
  settings = results[2].status === "fulfilled" ? results[2].value : settings;
  currentUser = settings?.user || currentUser;
  draft = null;
  dirty = false;
  overview();
  const errors = results.filter((x) => x.status === "rejected");
  if (errors.length)
    toast(errors.map((x) => x.reason.message).join("\n"), true);
}
function overview() {
  root.innerHTML =
    header() +
    `<main><div class="heading"><div class="eyebrow">Deine Website. Deine Geschichten.</div><h1>Redaktionsübersicht</h1><p>Alles an einem Ort – vom ersten Stichwort bis zum fertigen Bericht.</p><div class="actions"><button id="new" class="primary">＋ Neuer Beitrag</button><button id="settings">Einstellungen</button></div></div><div class="stats"><div class="stat"><strong>${posts.length}</strong><span>Veröffentlichte Beiträge</span></div><div class="stat"><strong>${drafts.length}</strong><span>Gespeicherte Entwürfe</span></div><div class="stat"><strong>${settings?.aiConfigured ? "Bereit" : "Offen"}</strong><span>KI-Unterstützung</span></div></div><div class="toolbar"><div class="tabs"><button id="postsTab" class="${tab === "posts" ? "selected" : ""}">Veröffentlicht</button><button id="draftsTab" class="${tab === "drafts" ? "selected" : ""}">Entwürfe</button></div><input class="search" id="search" type="search" placeholder="Beiträge durchsuchen …" aria-label="Beiträge durchsuchen"></div><div id="list" class="list"></div></main>`;
  logoutBind();
  on("#new", "click", () => {
    draft = {
      id: crypto.randomUUID(),
      titel: "",
      kategorie: settings?.preferences?.defaultCategory || "FF-News",
      datum: new Date().toLocaleDateString("sv-SE"),
      ort: "",
      einsatzTyp: "",
      einsatzZeit: "",
      einsatzKraefte: null,
      kurztext: "",
      volltext: "",
      notizen: "",
      kiAnweisung: "",
      bilder: [],
    };
    dirty = false;
    editor();
  });
  on("#settings", "click", preferences);
  on("#postsTab", "click", () => {
    tab = "posts";
    overview();
  });
  on("#draftsTab", "click", () => {
    tab = "drafts";
    overview();
  });
  on("#search", "input", list);
  list();
}
function list() {
  const query = root.querySelector("#search").value.toLowerCase();
  const rows = (
    tab === "posts"
      ? [...posts].sort((a, b) => b.Datum.localeCompare(a.Datum))
      : drafts
  ).filter((p) => (p.Titel || p.titel || "").toLowerCase().includes(query));
  root.querySelector("#list").innerHTML = rows.length
    ? rows
        .map(
          (p, i) =>
            `<button class="row" data-row="${i}">${tab === "posts" && postImage(p) ? `<img src="${esc(postImage(p))}" alt="">` : '<span class="placeholder">▤</span>'}<span class="rowtext"><strong>${esc(p.Titel || p.titel || "Unbenannter Entwurf")}</strong><small>${esc(p.Kategorie || p.kategorie)} · ${readable(p.Datum || p.updatedAt)}</small></span><span class="badge ${tab === "posts" ? "live" : ""}">${tab === "posts" ? "Veröffentlicht" : "Entwurf"}</span><span>→</span></button>`,
        )
        .join("")
    : '<div class="empty">Hier gibt es noch keine passenden Beiträge.</div>';
  root.querySelectorAll("[data-row]").forEach((el) =>
    el.addEventListener("click", () =>
      task(async () => {
        const item = rows[Number(el.dataset.row)];
        if (tab === "drafts") draft = await api("/drafts/" + item.id);
        else {
          draft = await postToDraft(item);
        }
        dirty = false;
        editor();
      }),
    ),
  );
}
function field(key, label, type = "text") {
  return `<label>${label}<input data-field="${key}" type="${type}" value="${esc(draft[key])}"${type === "number" ? ' min="0" max="10000"' : ""}></label>`;
}
function editor() {
  root.innerHTML =
    header() +
    `<main><button id="back" class="subtle back">← Zur Übersicht</button><div class="heading"><div><div class="eyebrow">${draft.postId ? "Beitrag bearbeiten" : "Neuer Beitrag"}</div><h1>Deine Geschichte gestalten</h1><p>Fotos auswählen, Gedanken sammeln, Text verfeinern.</p></div><span class="badge">${esc(draft.status || "Ungespeichert")}</span></div><div class="editor"><div><section class="panel"><h2><span class="sectionnum">1</span>Bilder auswählen</h2><p class="help">Das Titelbild erscheint zuerst. „Nur KI-Info“ bleibt privat und wird nicht veröffentlicht.</p><label class="upload">＋ Bilder hinzufügen<input id="files" type="file" accept="image/jpeg,image/png,image/webp" multiple></label><div id="photos" class="photos"></div></section><section class="panel"><h2><span class="sectionnum">2</span>Was ist passiert?</h2><div class="grid"><div class="wide">${field("titel", "Titel")}</div><label>Kategorie<select data-field="kategorie">${cats.map((c) => `<option ${c === draft.kategorie ? "selected" : ""}>${c}</option>`).join("")}</select></label>${field("datum", "Datum", "date")}<div class="wide">${field("ort", "Ort")}</div>${field("einsatzTyp", "Einsatzart (optional)")}${field("einsatzZeit", "Alarmzeit (optional)", "time")}${field("einsatzKraefte", "Einsatzkräfte (optional)", "number")}</div><label>Notizen und Informationen<textarea data-field="notizen" rows="5" placeholder="Was, wo, wann? Beteiligte, Fakten, wichtige Hinweise …">${esc(draft.notizen)}</textarea></label></section><section class="panel ai"><h2><span class="sectionnum">3</span>Mit KI formulieren</h2><p class="help">Aus deinen Angaben und Bildern wird ein Vorschlag. Beim Überarbeiten berücksichtigt die KI auch den aktuellen Text. Fakten und Bildfreigaben bitte selbst prüfen.</p><label>Dein Auftrag an die KI<textarea data-field="kiAnweisung" rows="2" placeholder="Zum Beispiel: kürzer, sachlicher, keine Namen nennen …">${esc(draft.kiAnweisung)}</textarea></label><button id="generate">✧ Text vorschlagen / überarbeiten</button><button id="undoAi" class="subtle" ${draft.previousText ? "" : "disabled"}>Vorherigen Text zurückholen</button></section><section class="panel"><h2><span class="sectionnum">4</span>Text fertigstellen</h2><label>Kurztext<textarea data-field="kurztext" rows="3">${esc(draft.kurztext)}</textarea></label><label>Vollständiger Beitrag<textarea data-field="volltext" rows="12">${esc(draft.volltext)}</textarea></label></section></div><aside class="aside"><section class="panel"><h2>Bereit für die Website?</h2><p class="help">Speichere deinen Zwischenstand oder prüfe die Vorschau vor der Veröffentlichung.</p><div class="actions"><button id="preview">Vorschau ansehen</button><button id="save">Entwurf speichern</button><button id="publish" class="primary">${draft.postId ? "Änderungen veröffentlichen" : "Veröffentlichen"}</button></div><p id="savehint" class="savehint">${draft.updatedAt ? "Zuletzt gespeichert: " + new Date(draft.updatedAt).toLocaleString("de-AT") : "Noch nicht gespeichert."}</p><p class="help">Nach dem Veröffentlichen benötigt die Website einen kurzen Moment zur Aktualisierung.</p></section></aside></div></main>`;
  logoutBind();
  photos();
  on("#back", "click", () => {
    if (leave()) task(dashboard);
  });
  root.querySelectorAll("[data-field]").forEach((el) =>
    el.addEventListener("input", () => {
      draft[el.dataset.field] =
        el.type === "number"
          ? el.value === ""
            ? null
            : Number(el.value)
          : el.value;
      markDirty();
    }),
  );
  on("#files", "change", (e) => task(() => addImages(e.target.files)));
  on("#save", "click", () =>
    task(async () => {
      draft = await api("/drafts", draft);
      dirty = false;
      editor();
      toast(settings?.local ? "Entwurf lokal gespeichert." : "Entwurf gespeichert – auf allen Geräten verfügbar.");
    }),
  );
  on("#generate", "click", () =>
    task(async () => {
      const previousText = {
        titel: draft.titel,
        kurztext: draft.kurztext,
        volltext: draft.volltext,
      };
      draft = { ...(await api("/ai", draft)), previousText };
      dirty = true;
      editor();
      toast("KI-Vorschlag übernommen. Du kannst alles bearbeiten.");
    }),
  );
  on("#undoAi", "click", () => {
    if (draft.previousText) {
      Object.assign(draft, draft.previousText);
      delete draft.previousText;
      dirty = true;
      editor();
    }
  });
  on("#preview", "click", preview);
  on("#publish", "click", () =>
    task(async () => {
      if (
        !confirm(
          "Diesen Beitrag und die freigegebenen Bilder jetzt öffentlich auf der Website veröffentlichen?",
        )
      )
        return;
      draft = await api("/drafts", draft);
      dirty = false;
      const result = await api("/publish", draft);
      draft = result.draft;
      dirty = false;
      editor();
      toast(result.warning || result.message, !!result.warning);
    }),
  );
}
function markDirty() {
  dirty = true;
  const hint = root.querySelector("#savehint");
  if (hint) hint.textContent = "Ungespeicherte Änderungen";
}
function photos() {
  const panel = root.querySelector("#photos");
  if (!panel) return;
  panel.innerHTML = draft.bilder
    .map(
      (image, i) =>
        `<article class="photo ${image.isInformationOnly ? "info" : ""}"><img src="${esc(imageUrl(image))}" alt="${esc(image.caption || image.name)}"><div class="photobody"><label><input data-title="${i}" type="radio" name="title" ${image.isTitleImage ? "checked" : ""} ${image.isInformationOnly ? "disabled" : ""}>Als Titelbild verwenden</label><label><input data-info="${i}" type="checkbox" ${image.isInformationOnly ? "checked" : ""}>Nur KI-Info – nicht veröffentlichen</label><input data-caption="${i}" type="text" placeholder="Bildbeschreibung" aria-label="Bildbeschreibung ${i + 1}" value="${esc(image.caption)}"><div class="order"><button data-move="${i},-1" ${i === 0 ? "disabled" : ""} aria-label="Bild nach vorne">←</button><button data-move="${i},1" ${i === draft.bilder.length - 1 ? "disabled" : ""} aria-label="Bild nach hinten">→</button><button class="danger" data-remove="${i}">Entfernen</button></div></div></article>`,
    )
    .join("");
  panel.querySelectorAll("[data-title]").forEach(
    (el) =>
      (el.onchange = () => {
        draft.bilder.forEach(
          (b, i) => (b.isTitleImage = i === Number(el.dataset.title)),
        );
        markDirty();
        photos();
      }),
  );
  panel.querySelectorAll("[data-info]").forEach(
    (el) =>
      (el.onchange = () => {
        draft.bilder[el.dataset.info].isInformationOnly = el.checked;
        normalizeTitle();
        markDirty();
        photos();
      }),
  );
  panel.querySelectorAll("[data-caption]").forEach(
    (el) =>
      (el.oninput = () => {
        draft.bilder[el.dataset.caption].caption = el.value;
        markDirty();
      }),
  );
  panel.querySelectorAll("[data-move]").forEach(
    (el) =>
      (el.onclick = () => {
        const [i, dir] = el.dataset.move.split(",").map(Number);
        [draft.bilder[i], draft.bilder[i + dir]] = [
          draft.bilder[i + dir],
          draft.bilder[i],
        ];
        markDirty();
        photos();
      }),
  );
  panel.querySelectorAll("[data-remove]").forEach(
    (el) =>
      (el.onclick = () => {
        draft.bilder.splice(Number(el.dataset.remove), 1);
        normalizeTitle();
        markDirty();
        photos();
      }),
  );
}
function normalizeTitle() {
  draft.bilder
    .filter((b) => b.isInformationOnly)
    .forEach((b) => (b.isTitleImage = false));
  if (!draft.bilder.some((b) => b.isTitleImage)) {
    const first = draft.bilder.find((b) => !b.isInformationOnly);
    if (first) first.isTitleImage = true;
  }
}
async function addImages(files) {
  if (draft.bilder.length + files.length > 12)
    throw new Error("Maximal 12 Bilder pro Beitrag.");
  const added = [];
  for (const file of files) {
    if (!["image/jpeg", "image/png", "image/webp"].includes(file.type))
      throw new Error(
        "Bitte JPEG, PNG oder WebP auswählen. HEIC vorher als JPEG exportieren.",
      );
    if (file.size > 20000000)
      throw new Error("Ein Originalbild ist größer als 20 MB.");
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, 1200 / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.round(bitmap.width * scale);
    canvas.height = Math.round(bitmap.height * scale);
    const ctx = canvas.getContext("2d");
    ctx.fillStyle = "white";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    bitmap.close();
    const dataUrl = canvas.toDataURL("image/jpeg", 0.72);
    added.push({
      id: crypto.randomUUID(),
      name: file.name,
      dataUrl,
      caption: "",
      isTitleImage: false,
      isInformationOnly: false,
    });
  }
  if (
    [...draft.bilder, ...added].reduce(
      (n, b) => n + (b.dataUrl?.length || 0) * 0.75,
      0,
    ) > 2500000
  )
    throw new Error(
      "Die Bilder sind zusammen zu groß. Bitte weniger Bilder auswählen.",
    );
  draft.bilder.push(...added);
  normalizeTitle();
  markDirty();
  photos();
}
function preview() {
  const images = draft.bilder
    .filter((b) => !b.isInformationOnly)
    .sort((a, b) => Number(b.isTitleImage) - Number(a.isTitleImage));
  root.innerHTML =
    header() +
    `<main class="preview"><button id="edit" class="back">← Weiter bearbeiten</button><section class="panel"><p class="eyebrow">Vorschau · ${esc(draft.kategorie)} · ${readable(draft.datum)}</p><h1>${esc(draft.titel || "Noch kein Titel")}</h1>${images[0] ? `<img src="${esc(imageUrl(images[0]))}" alt="${esc(images[0].caption)}">` : ""}<p><strong>${esc(draft.kurztext)}</strong></p><div class="body">${esc(draft.volltext)}</div><div class="gallery">${images
      .slice(1)
      .map(
        (b) =>
          `<figure><img src="${esc(imageUrl(b))}" alt="${esc(b.caption)}"><figcaption>${esc(b.caption)}</figcaption></figure>`,
      )
      .join("")}</div></section></main>`;
  logoutBind();
  on("#edit", "click", editor);
}
function preferences() {
  root.innerHTML =
    header() +
    `<main class="preview"><button id="back" class="back">← Zur Übersicht</button><h1>Einstellungen</h1><section class="panel"><h2>Redaktionsstil</h2><form id="preferences"><label>Standard-Kategorie<select name="defaultCategory">${cats.map((c) => `<option ${c === settings?.preferences?.defaultCategory ? "selected" : ""}>${c}</option>`).join("")}</select></label><label>Stil und Hinweise für die KI<textarea name="style" rows="5" maxlength="2000">${esc(settings?.preferences?.style || "Sachlicher Bericht der FF Rastenfeld. Keine Fakten erfinden.")}</textarea></label><button class="primary">Einstellungen speichern</button></form></section><section class="panel"><h2>Verbindungen</h2>${[
      ["KI", settings?.aiConfigured],
      ["GitHub", settings?.githubConfigured],
      ["Private Entwürfe", settings?.draftsConfigured],
    ]
      .map(
        ([title, ok]) =>
          `<div class="statusline"><span>${title}</span><strong class="${ok ? "ok" : "warn"}">${ok ? "Konfiguriert" : "Noch einzurichten"}</strong></div>`,
      )
      .join(
        "",
      )}<p class="help">Modell: ${esc(settings?.model || "–")}. Zugangsschlüssel liegen ausschließlich im geschützten Serverbereich.</p></section></main>`;
  logoutBind();
  on("#back", "click", overview);
  on("#preferences", "submit", (e) => {
    e.preventDefault();
    const values = Object.fromEntries(new FormData(e.target));
    task(async () => {
      await api("/settings", values);
      settings.preferences = values;
      toast("Einstellungen gespeichert.");
    });
  });
}
const activityLabels = {'login':'Angemeldet','logout':'Abgemeldet','draft.created':'Entwurf erstellt','draft.updated':'Entwurf gespeichert','ai.generated':'KI-Text erstellt / überarbeitet','settings.updated':'Einstellungen geändert','publish.started':'Veröffentlichung gestartet','post.published':'Auf GitHub veröffentlicht','publish.retried':'Veröffentlichung erneut bestätigt','action.failed':'Aktion fehlgeschlagen'};
async function activityPage() {
  const events = await api('/activity');
  draft=null; dirty=false;
  root.innerHTML=header()+`<main><button id="back" class="back">← Zur Übersicht</button><p class="eyebrow">Privates Redaktionsprotokoll</p><h1>Aktivitäten</h1><p class="help">Die letzten 1.000 Aktionen seit Einführung des Protokolls. Zeitpunkt in Österreich. Keine Passwörter, internen Notizen oder KI-Prompts. „Veröffentlicht“ bestätigt den GitHub-Commit, nicht den späteren Website-Build.</p><div class="toolbar"><input id="activitySearch" class="search" type="search" placeholder="Benutzer, Aktion oder Beitrag …" aria-label="Aktivitäten durchsuchen"><button id="refreshActivity">Aktualisieren</button></div><div id="activityList" class="list"></div></main>`;
  logoutBind(); on('#back','click',()=>task(dashboard)); on('#refreshActivity','click',()=>task(activityPage));
  const render=()=>{
    const query=root.querySelector('#activitySearch').value.toLocaleLowerCase('de');
    const filtered=events.filter(e=>[e.username,e.displayName,e.title,activityLabels[e.action]||e.action].join(' ').toLocaleLowerCase('de').includes(query));
    root.querySelector('#activityList').innerHTML=filtered.length ? filtered.map(e=>`<article class="panel activity-entry"><div class="activity-meta"><strong>${esc(e.displayName || e.username)}</strong><span>${esc(e.username)}</span><time datetime="${esc(e.at)}">${esc(new Date(e.at).toLocaleString('de-AT',{timeZone:'Europe/Vienna'}))}</time></div><h2>${esc(activityLabels[e.action]||e.action)}</h2>${e.title?`<p>${esc(e.title)}</p>`:''}${e.route?`<p class="help">${esc(e.route)} · Fehler ${esc(e.status)}</p>`:''}${e.commit?`<small>Git-Commit: ${esc(e.commit.slice(0,12))}</small>`:''}</article>`).join('') : '<p class="empty">Keine passenden Aktivitäten.</p>';
  }; on('#activitySearch','input',render); render();
}
window.addEventListener("beforeunload", (e) => {
  if (dirty) {
    e.preventDefault();
    e.returnValue = "";
  }
});
task(async () => {
  try {
    const session = await api("/session");
    currentUser = session.user;
    if (session.authenticated) await dashboard();
    else login();
  } catch (e) {
    login();
    throw e;
  }
});
