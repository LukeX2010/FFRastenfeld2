// FF Rastenfeld - App JS

(function () {
    const consentKey = 'ffrastenfeld_cookie_consent_v1';
    const umamiWebsiteId = 'c5262e9e-819c-4cef-a39d-b90c93356634';
    const defaultConsent = {
        necessary: true,
        statistics: false,
        externalMedia: false
    };

    function readConsent() {
        try {
            const raw = localStorage.getItem(consentKey);
            if (!raw) return null;
            const parsed = JSON.parse(raw);
            return { ...defaultConsent, ...parsed, necessary: true };
        } catch {
            return null;
        }
    }

    function saveConsent(value) {
        const consent = { ...defaultConsent, ...value, necessary: true, updatedAt: new Date().toISOString() };
        localStorage.setItem(consentKey, JSON.stringify(consent));
        window.dispatchEvent(new CustomEvent('ffr-consent-change', { detail: consent }));
        applyConsent(consent);
    }

    function loadUmami() {
        if (document.querySelector('script[data-ffr-consent-service="umami"]')) return;

        const script = document.createElement('script');
        script.defer = true;
        script.src = 'https://cloud.umami.is/script.js';
        script.dataset.websiteId = umamiWebsiteId;
        script.dataset.ffrConsentService = 'umami';
        document.head.appendChild(script);
    }

    function unloadUmami() {
        document.querySelectorAll('script[data-ffr-consent-service="umami"]').forEach(script => script.remove());
    }

    function applyConsent(consent = readConsent()) {
        if (!consent) return;

        if (consent.statistics) {
            loadUmami();
        } else {
            unloadUmami();
        }

        if (consent.externalMedia) {
            loadAllExternalEmbeds();
        }
    }

    function createButton(text, className, onClick) {
        const button = document.createElement('button');
        button.type = 'button';
        button.className = className;
        button.textContent = text;
        button.addEventListener('click', onClick);
        return button;
    }

    function removeConsentUi() {
        document.getElementById('ffr-consent-banner')?.remove();
        document.getElementById('ffr-consent-modal')?.remove();
    }

    function showBanner() {
        if (readConsent() || document.getElementById('ffr-consent-banner')) return;

        const banner = document.createElement('section');
        banner.id = 'ffr-consent-banner';
        banner.className = 'consent-banner';
        banner.setAttribute('aria-label', 'Cookie-Hinweis');
        banner.innerHTML = `
            <div class="consent-banner__text">
                <strong>Datenschutz-Einstellungen</strong>
                <p>Wir verwenden notwendige Speicherungen fuer den Betrieb. Statistik und externe Medien laden wir erst nach Zustimmung oder aktivem Klick.</p>
            </div>
            <div class="consent-banner__actions"></div>
        `;

        const actions = banner.querySelector('.consent-banner__actions');
        actions.append(
            createButton('Alle akzeptieren', 'btn btn-primary consent-btn', () => {
                saveConsent({ statistics: true, externalMedia: true });
                removeConsentUi();
            }),
            createButton('Nur notwendige', 'btn btn-outline consent-btn', () => {
                saveConsent({ statistics: false, externalMedia: false });
                removeConsentUi();
            }),
            createButton('Einstellungen', 'btn btn-ghost-dark consent-btn', () => showSettings())
        );

        document.body.appendChild(banner);
    }

    function showSettings() {
        document.getElementById('ffr-consent-modal')?.remove();
        const consent = readConsent() || defaultConsent;

        const modal = document.createElement('div');
        modal.id = 'ffr-consent-modal';
        modal.className = 'consent-modal';
        modal.innerHTML = `
            <div class="consent-modal__backdrop" data-consent-close></div>
            <section class="consent-modal__panel" role="dialog" aria-modal="true" aria-labelledby="consent-title">
                <div class="consent-modal__head">
                    <div>
                        <p class="consent-kicker">FF Rastenfeld</p>
                        <h2 id="consent-title">Cookie-Einstellungen</h2>
                    </div>
                    <button type="button" class="consent-modal__close" data-consent-close aria-label="Schliessen">x</button>
                </div>
                <p class="consent-modal__lead">Hier kannst du festlegen, welche Dienste auf dieser Website geladen werden duerfen. Deine Auswahl kannst du jederzeit im Footer aendern.</p>

                <div class="consent-option consent-option--locked">
                    <div>
                        <strong>Notwendig</strong>
                        <p>Technisch notwendige Funktionen und die Speicherung deiner Auswahl.</p>
                    </div>
                    <span>Immer aktiv</span>
                </div>

                <label class="consent-option">
                    <div>
                        <strong>Statistik</strong>
                        <p>Umami-Statistik zur anonymisierten Reichweitenmessung.</p>
                    </div>
                    <input type="checkbox" id="consent-statistics" ${consent.statistics ? 'checked' : ''}>
                </label>

                <label class="consent-option">
                    <div>
                        <strong>Externe Medien</strong>
                        <p>Instagram, Google Maps, YouTube und Florian10 Infoscreen.</p>
                    </div>
                    <input type="checkbox" id="consent-external-media" ${consent.externalMedia ? 'checked' : ''}>
                </label>

                <div class="consent-modal__actions">
                    <button type="button" class="btn btn-outline consent-btn" data-consent-necessary>Nur notwendige</button>
                    <button type="button" class="btn btn-primary consent-btn" data-consent-save>Auswahl speichern</button>
                    <button type="button" class="btn btn-primary consent-btn" data-consent-all>Alle akzeptieren</button>
                </div>
            </section>
        `;

        modal.querySelectorAll('[data-consent-close]').forEach(el => el.addEventListener('click', () => modal.remove()));
        modal.querySelector('[data-consent-necessary]').addEventListener('click', () => {
            saveConsent({ statistics: false, externalMedia: false });
            removeConsentUi();
        });
        modal.querySelector('[data-consent-save]').addEventListener('click', () => {
            saveConsent({
                statistics: modal.querySelector('#consent-statistics').checked,
                externalMedia: modal.querySelector('#consent-external-media').checked
            });
            removeConsentUi();
        });
        modal.querySelector('[data-consent-all]').addEventListener('click', () => {
            saveConsent({ statistics: true, externalMedia: true });
            removeConsentUi();
        });

        document.body.appendChild(modal);
    }

    function loadExternalEmbed(placeholder) {
        if (!placeholder || placeholder.dataset.loaded === 'true') return;

        const type = placeholder.dataset.embedType || 'iframe';
        const src = placeholder.dataset.src;
        if (!src) return;

        let element;
        if (type === 'iframe') {
            element = document.createElement('iframe');
            element.src = src;
            element.title = placeholder.dataset.title || 'Externer Inhalt';
            element.loading = 'lazy';
            element.allowFullscreen = placeholder.dataset.allowFullscreen !== 'false';
            element.referrerPolicy = placeholder.dataset.referrerPolicy || 'no-referrer-when-downgrade';
            element.className = placeholder.dataset.class || 'external-media-frame';
            if (placeholder.dataset.allow) element.allow = placeholder.dataset.allow;
        }

        if (!element) return;
        placeholder.dataset.loaded = 'true';
        placeholder.replaceChildren(element);
        placeholder.classList.add('external-media--loaded');
    }

    function loadAllExternalEmbeds() {
        document.querySelectorAll('[data-external-embed]').forEach(loadExternalEmbed);
    }

    function initExternalEmbeds(root = document) {
        const placeholders = [];
        if (root.matches?.('[data-external-embed]')) placeholders.push(root);
        root.querySelectorAll?.('[data-external-embed]').forEach(placeholder => placeholders.push(placeholder));

        placeholders.forEach(placeholder => {
            if (placeholder.dataset.initialized === 'true') return;
            placeholder.dataset.initialized = 'true';
            placeholder.querySelectorAll('[data-load-external]').forEach(button => {
                button.addEventListener('click', () => loadExternalEmbed(placeholder));
            });
        });

        if (readConsent()?.externalMedia) {
            loadAllExternalEmbeds();
        }
    }

    document.addEventListener('click', (event) => {
        const trigger = event.target.closest('[data-open-cookie-settings]');
        if (!trigger) return;
        event.preventDefault();
        showSettings();
    });

    document.addEventListener('DOMContentLoaded', () => {
        showBanner();
        applyConsent();
        initExternalEmbeds();

        const observer = new MutationObserver(mutations => {
            for (const mutation of mutations) {
                mutation.addedNodes.forEach(node => {
                    if (node.nodeType === Node.ELEMENT_NODE) initExternalEmbeds(node);
                });
            }
        });
        observer.observe(document.body, { childList: true, subtree: true });
    });

    window.ffrConsent = {
        key: consentKey,
        get: readConsent,
        save: saveConsent,
        openSettings: showSettings,
        loadExternalEmbed
    };
})();

// Ladeanimation
window.addEventListener('load', function () {
    setTimeout(function () {
        const l = document.getElementById('app-loader');
        if (l) { l.style.opacity = '0'; l.style.transition = 'opacity .4s'; setTimeout(() => l.remove(), 450); }
    }, 600);
});

// Scroll: Navbar + Scroll-to-Top
window.addEventListener('scroll', function () {
    const h = document.getElementById('site-header');
    const s = document.getElementById('scroll-top');
    if (h) h.classList.toggle('scrolled', scrollY > 80);
    if (s) s.classList.toggle('visible', scrollY > 500);
}, { passive: true });
