import { clampTransform, pinchTransform, swipeDirection } from './photo-gestures.js';

export function mount(root, dotnet) {
    const dialog = root.querySelector('[data-photo-modal]');
    const abort = new AbortController();
    const on = (target, event, handler, opts = {}) => target.addEventListener(event, handler, { ...opts, signal: abort.signal });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let opened = false, opener, savedOverflow = '', disposed = false, changing = false;
    const states = [...root.querySelectorAll('[data-photo-stage]')].map(stage => ({
        stage, plane: stage.querySelector('[data-photo-plane]'), scale: 1, x: 0, y: 0,
        w: 0, h: 0, frame: 0, pointers: new Map(), gesture: null, pinch: null,
        suppressUntil: 0, lastTap: null, offset: 0, timer: 0, tapTimer: 0, loadAbort: null
    }));
    const active = () => states.find(s => s.stage.dataset.photoStage === (opened ? 'modal' : 'inline'));
    const count = () => Number(root.dataset.photoCount) || 0;

    async function step(direction) {
        if (disposed || changing || count() <= 1) return;
        changing = true;
        try { await dotnet.invokeMethodAsync('Step', direction); }
        finally { changing = false; }
    }
    function paint(s) {
        s.frame = 0;
        ({ scale: s.scale, x: s.x, y: s.y } = clampTransform(s.scale, s.x, s.y, s.stage.clientWidth, s.stage.clientHeight, s.w, s.h));
        s.plane.style.transform = `translate(-50%, -50%) translate(${s.x + s.offset}px, ${s.y}px) scale(${s.scale})`;
        s.stage.classList.toggle('is-zoomed', s.scale > 1.01);
        const scope = s.stage.dataset.photoStage === 'modal' ? dialog : s.stage;
        scope.querySelector('[data-photo-zoom]').textContent = `${Math.round(s.scale * 100)} %`;
    }
    function render(s) { if (!s.frame) s.frame = requestAnimationFrame(() => paint(s)); }
    function settle(s, smooth = true) {
        clearTimeout(s.timer);
        s.plane.classList.toggle('is-settling', smooth && !reduced.matches);
        s.plane.style.willChange = 'transform';
        s.timer = setTimeout(() => { s.plane.classList.remove('is-settling'); s.plane.style.willChange = 'auto'; }, 210);
    }
    function layout(s) {
        if (!s.stage.clientWidth || !s.stage.clientHeight) return;
        const img = s.plane.querySelector('img');
        const ratio = img.naturalWidth && img.naturalHeight ? img.naturalWidth / img.naturalHeight : 1.5;
        s.w = Math.min(s.stage.clientWidth, s.stage.clientHeight * ratio);
        s.h = s.w / ratio;
        s.plane.style.width = `${s.w}px`; s.plane.style.height = `${s.h}px`;
        render(s);
    }
    function reset(s, smooth = true) { settle(s, smooth); s.scale = 1; s.x = s.y = s.offset = 0; render(s); }
    function zoom(s, value, clientX, clientY, smooth = true) {
        settle(s, smooth);
        const r = s.stage.getBoundingClientRect();
        const px = (clientX ?? r.left + r.width / 2) - r.left - r.width / 2;
        const py = (clientY ?? r.top + r.height / 2) - r.top - r.height / 2;
        value = Math.max(1, Math.min(5, value));
        const factor = value / s.scale;
        s.x = px - (px - s.x) * factor; s.y = py - (py - s.y) * factor;
        s.scale = value; render(s);
    }
    function open() {
        if (disposed || opened) return;
        opener = document.activeElement;
        savedOverflow = document.body.style.overflow;
        opened = true; dialog.showModal();
        document.body.style.overflow = 'hidden';
        const s = active(); reset(s, false); layout(s);
        dialog.querySelector('[data-photo-action="close"]').focus({ preventScroll: true });
    }
    function close(restoreFocus = true) {
        if (!opened) return;
        opened = false; dialog.close();
        document.body.style.overflow = savedOverflow;
        states.forEach(s => { s.pointers.clear(); s.gesture = s.pinch = null; });
        if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
    }
    function pinchSnapshot(s) {
        const points = [...s.pointers.values()];
        if (points.length > 1) {
            const r = s.stage.getBoundingClientRect();
            s.pinch = { scale: s.scale, x: s.x, y: s.y,
                cx: (points[0].x + points[1].x) / 2 - r.left - r.width / 2,
                cy: (points[0].y + points[1].y) / 2 - r.top - r.height / 2,
                distance: Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y) };
        } else {
            s.pinch = null;
            if (points.length && s.gesture) Object.assign(s.gesture, { panX: points[0].x, panY: points[0].y, x: s.x, y: s.y });
        }
    }
    for (const s of states) {
        on(s.stage, 'dragstart', e => e.preventDefault());
        on(s.stage, 'pointerdown', e => {
            if (e.target.closest('.photo-toolbar') || e.button !== 0) return;
            clearTimeout(s.timer); clearTimeout(s.tapTimer); s.plane.classList.remove('is-settling'); s.plane.style.willChange = 'transform';
            if (e.pointerType === 'mouse') { e.preventDefault(); s.stage.focus({ preventScroll: true }); }
            if (!s.pointers.size) s.gesture = { sx: e.clientX, sy: e.clientY, panX: e.clientX, panY: e.clientY, x: s.x, y: s.y,
                time: performance.now(), multi: false, moved: false, scale: s.scale };
            s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            if (s.pointers.size > 1) { s.gesture.multi = true; s.gesture.moved = true; s.lastTap = null; }
            pinchSnapshot(s);
            s.stage.setPointerCapture(e.pointerId);
        });
        on(s.stage, 'pointermove', e => {
            if (!s.pointers.has(e.pointerId) || !s.gesture) return;
            s.pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
            const points = [...s.pointers.values()], g = s.gesture;
            if (points.length > 1 && s.pinch) {
                const r = s.stage.getBoundingClientRect();
                Object.assign(s, pinchTransform(s.pinch, (points[0].x + points[1].x) / 2 - r.left - r.width / 2,
                    (points[0].y + points[1].y) / 2 - r.top - r.height / 2,
                    Math.hypot(points[0].x - points[1].x, points[0].y - points[1].y)));
            } else if (s.scale > 1.01) {
                const dx = e.clientX - g.panX, dy = e.clientY - g.panY;
                if (Math.hypot(dx, dy) > 5) g.moved = true;
                s.x = g.x + dx; s.y = g.y + dy;
            } else if (!g.multi) {
                const dx = e.clientX - g.sx, dy = e.clientY - g.sy;
                if (Math.hypot(dx, dy) > 6) g.moved = true;
                if (Math.abs(dx) > Math.abs(dy) * 1.3) s.offset = Math.max(-80, Math.min(80, dx * .22));
            }
            render(s);
        });
        function end(e) {
            if (!s.pointers.has(e.pointerId)) return;
            const g = s.gesture;
            s.pointers.delete(e.pointerId);
            if (s.stage.hasPointerCapture(e.pointerId)) s.stage.releasePointerCapture(e.pointerId);
            if (!g) return;
            if (s.pointers.size) { pinchSnapshot(s); return; }
            s.offset = 0;
            const swipe = e.type === 'pointerup' ? swipeDirection(e.clientX - g.sx, e.clientY - g.sy, performance.now() - g.time,
                Math.max(g.scale, s.scale), g.multi, s.stage.clientWidth) : 0;
            if (swipe) step(swipe);
            if (g.moved || swipe || g.multi || e.type !== 'pointerup') { s.suppressUntil = performance.now() + 400; s.lastTap = null; }
            else if (e.pointerType === 'touch') {
                const now = performance.now();
                if (s.lastTap && now - s.lastTap.time < 320 && Math.hypot(e.clientX - s.lastTap.x, e.clientY - s.lastTap.y) < 35) {
                    zoom(s, s.scale > 1.05 ? 1 : 2.5, e.clientX, e.clientY); s.lastTap = null;
                } else {
                    s.lastTap = { time: now, x: e.clientX, y: e.clientY };
                    if (!opened) s.tapTimer = setTimeout(() => { if (!disposed && !opened) open(); }, 320);
                }
                s.suppressUntil = now + 400;
            }
            settle(s, !swipe); render(s); s.gesture = s.pinch = null;
        }
        on(s.stage, 'pointerup', end); on(s.stage, 'pointercancel', end);
        on(s.stage, 'lostpointercapture', e => {
            s.pointers.delete(e.pointerId);
            if (!s.pointers.size) { s.gesture = s.pinch = null; s.offset = 0; s.plane.style.willChange = 'auto'; render(s); }
        });
        on(s.stage, 'click', e => {
            if (e.target.closest('.photo-toolbar')) return;
            if (performance.now() < s.suppressUntil) { e.preventDefault(); e.stopImmediatePropagation(); return; }
            if (!opened) open();
        }, { capture: true });
        on(s.stage, 'dblclick', e => { if (!e.target.closest('.photo-toolbar')) { e.preventDefault(); zoom(s, s.scale > 1.05 ? 1 : 2.5, e.clientX, e.clientY); } });
        on(s.stage, 'wheel', e => {
            if (!opened && !e.ctrlKey) return;
            e.preventDefault(); zoom(s, s.scale * Math.exp(-e.deltaY * .002), e.clientX, e.clientY, false);
        }, { passive: false });
        const observer = new ResizeObserver(() => layout(s)); observer.observe(s.stage); s.observer = observer;
    }
    on(root, 'click', e => {
        const action = e.target.closest('[data-photo-action]')?.dataset.photoAction;
        if (!action) return;
        const s = active();
        if (action === 'open') open();
        if (action === 'close') close();
        if (action === 'previous') step(-1);
        if (action === 'next') step(1);
        if (action === 'zoom-in') zoom(s, s.scale * 1.4);
        if (action === 'zoom-out') zoom(s, s.scale / 1.4);
        if (action === 'reset') reset(s);
    });
    on(root, 'keydown', e => {
        if (!['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','+','=','-','0','Home'].includes(e.key)) return;
        e.preventDefault(); const s = active();
        if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && s.scale <= 1.05) step(e.key === 'ArrowLeft' ? -1 : 1);
        else if (e.key === 'ArrowLeft') { s.x += 50; render(s); }
        else if (e.key === 'ArrowRight') { s.x -= 50; render(s); }
        if (e.key === 'ArrowUp') { s.y += 50; render(s); }
        if (e.key === 'ArrowDown') { s.y -= 50; render(s); }
        if (e.key === '+' || e.key === '=') zoom(s, s.scale * 1.3);
        if (e.key === '-') zoom(s, s.scale / 1.3);
        if (e.key === '0' || e.key === 'Home') reset(s);
    });
    on(dialog, 'cancel', e => { e.preventDefault(); close(); });
    function refresh() {
        for (const s of states) {
            s.loadAbort?.abort(); s.loadAbort = new AbortController();
            clearTimeout(s.tapTimer);
            s.pointers.clear(); s.gesture = s.pinch = null; s.lastTap = null;
            const image = s.plane.querySelector('img'), error = s.stage.querySelector('[data-photo-error]');
            error.hidden = !(image.complete && !image.naturalWidth);
            image.addEventListener('load', () => { error.hidden = true; layout(s); }, { signal: s.loadAbort.signal });
            image.addEventListener('error', () => { error.hidden = false; }, { signal: s.loadAbort.signal });
            reset(s, false); layout(s);
        }
    }
    refresh();
    return { open, refresh, dispose() {
        disposed = true; close(false); abort.abort();
        states.forEach(s => { s.observer.disconnect(); s.loadAbort?.abort(); cancelAnimationFrame(s.frame); clearTimeout(s.timer); clearTimeout(s.tapTimer); });
    } };
}
