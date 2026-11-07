(function () {
    const base = document.querySelector('base[href]');
    if (base && new URL(base.href).origin !== location.origin) {
        base.href = '/';
    }
    const fallback = document.getElementById('html-fallback');
    if (fallback) {
        const app = document.getElementById('app');
        const observer = new MutationObserver(() => {
            if (!app.querySelector('#page-wrapper')) return;

            const scrollTop = window.scrollY;
            const focused = fallback.contains(document.activeElement) ? document.activeElement : null;
            fallback.remove();
            observer.disconnect();
            if (window.scrollY !== scrollTop) {
                window.scrollTo({ top: scrollTop, behavior: 'instant' });
            }
            if (focused?.href) {
                const replacement = Array.from(app.querySelectorAll('a')).find(link => link.href === focused.href);
                replacement?.focus({ preventScroll: true });
            }
        });
        fallback.dataset.managed = '';
        observer.observe(app, { childList: true, subtree: true });
    }

    const pagePath = url => new URL(url).pathname.replace(/\/+$/, '') || '/';
    let appliedPath = pagePath(location.href);
    let catalog;

    function setTag(tagName, key, name, valueKey, value) {
        let tag = document.head.querySelector(`${tagName}[${key}="${name}"]`);
        if (value == null) {
            tag?.remove();
            return;
        }

        if (!tag) {
            tag = document.createElement(tagName);
            tag.setAttribute(key, name);
            document.head.append(tag);
        }
        tag.setAttribute(valueKey, value);
    }

    window.ffrUpdatePageMetadata = async function (url) {
        if (!document.documentElement.hasAttribute('data-seo-generated')) return;

        const path = pagePath(url);
        if (path === appliedPath) return;

        catalog ??= fetch('/_seo/routes.json').then(response => {
            if (!response.ok) throw new Error('SEO routes unavailable');
            return response.json();
        });
        const data = await catalog.catch(() => null);
        if (!data) {
            catalog = undefined;
            return;
        }
        if (path !== pagePath(location.href)) return;

        const page = data.routes[path] ?? data.notFound;
        const socialTitle = page.canonical ? page.title : null;
        const socialDescription = page.canonical ? page.description : null;

        // Blazor's HeadOutlet still manages the visible page title.
        setTag('link', 'rel', 'canonical', 'href', page.canonical);
        setTag('meta', 'name', 'description', 'content', page.description);
        setTag('meta', 'name', 'robots', 'content', page.canonical ? null : 'noindex');
        setTag('meta', 'property', 'og:title', 'content', socialTitle);
        setTag('meta', 'property', 'og:description', 'content', socialDescription);
        setTag('meta', 'property', 'og:url', 'content', page.canonical);
        setTag('meta', 'property', 'og:type', 'content', page.type);
        setTag('meta', 'property', 'og:image', 'content', page.image);
        setTag('meta', 'property', 'og:image:alt', 'content', page.imageAlt);
        setTag('meta', 'name', 'twitter:title', 'content', socialTitle);
        setTag('meta', 'name', 'twitter:description', 'content', socialDescription);
        setTag('meta', 'name', 'twitter:image', 'content', page.image);
        setTag('meta', 'name', 'twitter:image:alt', 'content', page.imageAlt);

        document.getElementById('site-structured-data')?.remove();
        if (page.structuredData) {
            const script = document.createElement('script');
            script.id = 'site-structured-data';
            script.type = 'application/ld+json';
            script.textContent = JSON.stringify(page.structuredData);
            document.head.append(script);
        }
        appliedPath = path;
    };
})();
