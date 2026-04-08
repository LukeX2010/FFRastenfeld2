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

function initCounters() {
    document.querySelectorAll('.hq-item').forEach(el => {
        const start = parseInt(el.dataset.start) || 0;
        const stop = parseInt(el.dataset.stop);
        const duration = parseInt(el.dataset.duration) || 1000;
        const suffix = el.dataset.ed || "";
        const strong = el.querySelector('strong');

        let startTime = null;
        function step(timestamp) {
            if (!startTime) startTime = timestamp;
            const progress = Math.min((timestamp - startTime) / duration, 2);
            strong.textContent = Math.floor(progress * (stop - start) + start) + suffix;
            if (progress < 1) requestAnimationFrame(step);
        }
        requestAnimationFrame(step);
    });
}