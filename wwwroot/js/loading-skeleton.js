// Runs before WebAssembly starts. Keep the view mapping aligned with LoadingSkeleton.razor.
(() => {
    const path = window.location.pathname.replace(/^\/+|\/+$/g, '').toLowerCase();
    const section = path.split('/')[0];
    const feeds = ['einsaetze', 'news', 'ausbildung'];
    const views = new Map([['', 'home'], ['fahrzeuge', 'vehicles'], ['galerie', 'gallery'],
        ['mannschaft', 'team'], ['feuerwehrhaus', 'detail'], ['kontakt', 'contact'], ['admin', 'admin']]);
    let view = views.get(section) || 'article';
    if (feeds.includes(section)) view = 'feed';
    if (path.includes('/') && [...feeds, 'fahrzeuge'].includes(section)) view = 'detail';

    const block = (classes) => `<span class="sk ${classes}"></span>`;
    const line = (classes = '') => block(`sk-line ${classes}`);
    const actions = () => `<div class="sk-actions">${block('sk-button')}${block('sk-button')}</div>`;
    const copy = () => `<div class="sk-copy">${line('sk-short')}${block('sk-subtitle')}${line()}${line('sk-medium')}${line('sk-link')}</div>`;
    const repeat = (count, markup) => markup.repeat(count);
    const paragraph = `<div class="sk-paragraph">${line()}${line()}${line('sk-medium')}</div>`;
    let main;
    switch (view) {
        case 'home':
        case 'feed':
        case 'vehicles':
            main = (view === 'home' ? line('sk-heading') : '') + repeat(3,
                `<div class="sk-card sk-feed-card">${block('sk-card-image')}${copy()}</div>`);
            break;
        case 'gallery':
            main = actions() + `<div class="sk-gallery">${repeat(9, block('sk-gallery-image'))}</div>`;
            break;
        case 'team':
            main = block('sk-subtitle sk-medium') + block('sk-team-photo') + actions() +
                `<div class="sk-team-grid">${repeat(4, `<div class="sk-card">${block('sk-portrait')}${copy()}</div>`)}</div>`;
            break;
        case 'admin':
            main = `<div class="sk-card sk-admin">${block('sk-admin-logo')}${block('sk-subtitle')}${line('sk-medium')}${repeat(2, line('sk-short') + block('sk-input'))}${block('sk-input')}</div>`;
            break;
        default:
            main = `<div class="sk-card sk-article">${view === 'detail' ? block('sk-article-image') : ''}${block('sk-subtitle sk-medium')}${repeat(3, paragraph)}${view === 'contact' ? block('sk-article-image') : ''}</div>`;
    }

    const header = `<div class="sk-boot-header"><div class="sk-boot-top"></div><div class="container sk-boot-nav"><div class="sk-boot-brand">${block('')}<span class="sk-boot-name">FF Rastenfeld</span></div><div class="sk-boot-links">${repeat(5, block(''))}</div>${block('sk-boot-menu')}</div></div>`;
    const hero = `<div class="sk-hero"><div class="container sk-hero-inner">${line('sk-short')}${block('sk-title')}${view === 'home' ? block('sk-title sk-medium') : ''}${line('sk-medium')}${view === 'home' ? actions() : ''}</div></div>`;
    const sidebar = `<div class="sk-sidebar">${repeat(3, `<div class="sk-card sk-widget">${block('sk-subtitle sk-medium')}${line()}${line('sk-medium')}${line('sk-short')}</div>`)}</div>`;
    const skeleton = document.querySelector('#app > .loading-skeleton');
    skeleton.dataset.view = view;
    // All markup is fixed presentation content; no URL or remote data is interpolated.
    skeleton.querySelector('[aria-hidden]').innerHTML = (view === 'admin' ? '' : header + hero) +
        `<div class="container sk-body"><div class="sk-layout"><div class="sk-main">${main}</div>${['team', 'admin'].includes(view) ? '' : sidebar}</div></div>`;
})();
