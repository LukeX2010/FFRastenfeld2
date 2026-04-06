// FF Rastenfeld – App JS

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
