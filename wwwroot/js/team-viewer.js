import { clampTransform, pinchTransform, swipeDirection } from './photo-gestures.js';
export { clampTransform, pinchTransform } from './photo-gestures.js';

export function markerSize(scale, compact) {
    const zoom = Math.min(5, Math.max(1, scale));
    return compact ? 5 + (zoom - 1) * 2.5 : 8 + (zoom - 1) * 1.5;
}

export function mount(root, dotnet) {
    const stage = root.querySelector('[data-stage]');
    const canvas = root.querySelector('[data-canvas]');
    const info = root.querySelector('[data-info]');
    const hoverLabel = root.querySelector('[data-hover-label]');
    const abort = new AbortController();
    const on = (target, event, handler, options = {}) => target.addEventListener(event, handler, { ...options, signal: abort.signal });
    const reduced = matchMedia('(prefers-reduced-motion: reduce)');
    let scale = 1, x = 0, y = 0, baseW = 0, baseH = 0, frame = 0, full = false, savedOverflow = '', opener;
    let gesture, moved = false, suppressClickUntil = 0, lastTap = 0, lastTapPoint, swipeY;
    let photoSwipe;
    const pointers = new Map();
    let labelMarker, lastPointerType = 'mouse', settleTimer;
    const hoverDevice = matchMedia('(min-width: 701px) and (hover: hover) and (pointer: fine)');
    const mobile = () => matchMedia('(max-width: 700px), (max-height: 500px) and (max-width: 1000px)').matches;
    const dismiss = () => dotnet.invokeMethodAsync('DismissInfo').catch(() => {});
    const motion = () => reduced.matches ? 'instant' : 'smooth';

    function hideLabel() {
        labelMarker = null;
        hoverLabel.classList.remove('is-visible');
        hoverLabel.setAttribute('aria-hidden', 'true');
    }
    function positionLabel() {
        if (!labelMarker?.isConnected) { hideLabel(); return; }
        const bounds = stage.getBoundingClientRect();
        const dot = labelMarker.querySelector('.team-hotspot-dot').getBoundingClientRect();
        const left = Math.max(8, Math.min(stage.clientWidth - hoverLabel.offsetWidth - 8, dot.left + dot.width / 2 - bounds.left - hoverLabel.offsetWidth / 2));
        const top = Math.min(stage.clientHeight - hoverLabel.offsetHeight - 8, dot.bottom - bounds.top + 6);
        hoverLabel.style.left = `${Math.round(left)}px`;
        hoverLabel.style.top = `${Math.round(Math.max(8, top))}px`;
    }
    function showLabel(marker) {
        if (!marker || !hoverDevice.matches || lastPointerType === 'touch') { hideLabel(); return; }
        const changed = labelMarker !== marker;
        labelMarker = marker;
        hoverLabel.textContent = marker.dataset.name;
        positionLabel();
        if (changed) hoverLabel.classList.remove('is-visible');
        hoverLabel.classList.add('is-visible');
        hoverLabel.setAttribute('aria-hidden', 'false');
    }
    on(canvas, 'pointerover', e => {
        if (e.pointerType === 'mouse') showLabel(e.target.closest('.team-hotspot'));
    });
    on(canvas, 'pointerout', e => {
        if (labelMarker && !labelMarker.contains(e.relatedTarget)) hideLabel();
    });
    on(canvas, 'focusin', e => showLabel(e.target.closest('.team-hotspot')));
    on(canvas, 'focusout', hideLabel);
    on(hoverDevice, 'change', hideLabel);
    on(root, 'pointerdown', e => {
        lastPointerType = e.pointerType;
        if (e.pointerType !== 'mouse') hideLabel();
    });
    on(root, 'keydown', e => { if (e.key === 'Tab') lastPointerType = 'keyboard'; });

    function settle(animate = true) {
        clearTimeout(settleTimer);
        canvas.classList.toggle('is-settling', animate && !reduced.matches);
        canvas.style.willChange = 'transform';
        settleTimer = setTimeout(() => {
            canvas.classList.remove('is-settling');
            // Release the temporary compositor layer so the resting image is rasterized sharply.
            canvas.style.willChange = 'auto';
        }, 220);
    }

    function paint() {
        frame = 0;
        ({ scale, x, y } = clampTransform(scale, x, y, stage.clientWidth, stage.clientHeight, baseW, baseH));
        canvas.style.transform = `translate(-50%, -50%) translate(${x}px, ${y}px) scale(${scale})`;
        canvas.style.setProperty('--inverse-zoom', 1 / scale);
        canvas.style.setProperty('--marker-size', `${markerSize(scale, matchMedia('(max-width: 700px)').matches)}px`);
        root.querySelector('[data-zoom-label]').textContent = `${Math.round(scale * 100)} %`;
        stage.classList.toggle('is-zoomed', scale > 1.01);
        if (labelMarker) positionLabel();
    }
    function render() { if (!frame) frame = requestAnimationFrame(paint); }
    function layout() {
        const image = canvas.querySelector('[data-photo]');
        const cropHeight = Number(image.getAttribute('height')) - (full ? 0 : Number(stage.dataset.trimTop || 0) + Number(stage.dataset.trimBottom || 0));
        const ratio = Number(image.getAttribute('width')) / cropHeight;
        baseW = Math.min(stage.clientWidth, stage.clientHeight * ratio);
        baseH = baseW / ratio;
        canvas.style.width = `${baseW}px`;
        canvas.style.height = `${baseH}px`;
        render();
    }
    function reset() { settle(); scale = 1; x = y = 0; render(); }
    function zoom(next, clientX, clientY, animate = true) {
        settle(animate);
        const bounds = stage.getBoundingClientRect();
        const px = (clientX ?? bounds.left + bounds.width / 2) - bounds.left - bounds.width / 2;
        const py = (clientY ?? bounds.top + bounds.height / 2) - bounds.top - bounds.height / 2;
        next = Math.max(1, Math.min(5, next));
        const factor = next / scale;
        x = px - (px - x) * factor;
        y = py - (py - y) * factor;
        scale = next;
        render();
    }
    function enterFullscreen() {
        if (full) return;
        opener = document.activeElement;
        savedOverflow = document.body.style.overflow;
        root.close();
        root.classList.add('is-fullscreen');
        root.setAttribute('role', 'dialog');
        root.setAttribute('aria-modal', 'true');
        root.showModal();
        full = true;
        document.body.style.overflow = 'hidden';
        layout();
        root.querySelector('[data-exit]').focus({ preventScroll: true });
    }
    function exitFullscreen(restoreFocus = true) {
        if (!full) return;
        full = false;
        root.close();
        root.classList.remove('is-fullscreen');
        root.setAttribute('role', 'region');
        root.removeAttribute('aria-modal');
        root.setAttribute('open', '');
        document.body.style.overflow = savedOverflow;
        reset();
        layout();
        if (restoreFocus && opener?.isConnected) opener.focus({ preventScroll: true });
    }
    on(root.querySelector('[data-fullscreen]'), 'click', enterFullscreen);
    on(root.querySelector('[data-exit]'), 'click', () => exitFullscreen());
    on(root, 'cancel', e => { e.preventDefault(); exitFullscreen(); });
    on(root.querySelector('[data-zoom-in]'), 'click', () => zoom(scale * 1.4));
    on(root.querySelector('[data-zoom-out]'), 'click', () => zoom(scale / 1.4));
    on(root.querySelector('[data-reset]'), 'click', reset);
    on(stage, 'dblclick', e => { if (e.target.closest('button')) return; e.preventDefault(); zoom(scale > 1.1 ? 1 : 2.5, e.clientX, e.clientY); });
    on(stage, 'wheel', e => {
        // Normal page scrolling stays untouched; wheel zoom is confined to the modal.
        if (!full || e.target.closest('[data-info]')) return;
        e.preventDefault();
        zoom(scale * Math.exp(-e.deltaY * .002), e.clientX, e.clientY, false);
    }, { passive: false });
    on(stage, 'keydown', e => {
        if (e.target.closest('button')) return;
        if (['+', '=', '-', '0', 'ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) e.preventDefault();
        if (e.key === '+' || e.key === '=') zoom(scale * 1.3);
        if (e.key === '-') zoom(scale / 1.3);
        if (e.key === '0') reset();
        if (e.key === 'ArrowLeft') x += 45;
        if (e.key === 'ArrowRight') x -= 45;
        if (e.key === 'ArrowUp') y += 45;
        if (e.key === 'ArrowDown') y -= 45;
        render();
    });
    function snapshotGesture() {
        const pts = [...pointers.values()];
        if (pts.length > 1) {
            const cx = (pts[0].x + pts[1].x) / 2, cy = (pts[0].y + pts[1].y) / 2;
            const r = stage.getBoundingClientRect();
            gesture = { count: 2, distance: Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y), cx: cx - r.left - r.width / 2, cy: cy - r.top - r.height / 2, x, y, scale };
        } else if (pts.length) gesture = { count: 1, cx: pts[0].x, cy: pts[0].y, x, y, scale };
        else gesture = null;
    }
    on(stage, 'pointerdown', e => {
        if (e.target.closest('.team-zoom-controls') || e.button !== 0) return;
        clearTimeout(settleTimer);
        canvas.classList.remove('is-settling');
        canvas.style.willChange = 'transform';
        hideLabel();
        if (e.pointerType === 'mouse' && scale > 1) e.preventDefault();
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (pointers.size === 1) photoSwipe = { x: e.clientX, y: e.clientY, time: performance.now(), multi: false, scale };
        else if (photoSwipe) photoSwipe.multi = true;
        moved = pointers.size > 1;
        snapshotGesture();
        // Inline touch preserves document scroll. Open the modal for owned gestures.
        if ((full || e.pointerType === 'mouse') && !e.target.closest('button')) stage.setPointerCapture(e.pointerId);
    });
    on(stage, 'pointermove', e => {
        if (!pointers.has(e.pointerId) || (!full && e.pointerType !== 'mouse')) return;
        pointers.set(e.pointerId, { x: e.clientX, y: e.clientY });
        if (!gesture) return;
        const pts = [...pointers.values()];
        if (pts.length >= 2 && gesture.count === 2) {
            const r = stage.getBoundingClientRect();
            const cx = (pts[0].x + pts[1].x) / 2 - r.left - r.width / 2;
            const cy = (pts[0].y + pts[1].y) / 2 - r.top - r.height / 2;
            ({ scale, x, y } = pinchTransform(gesture, cx, cy, Math.hypot(pts[0].x - pts[1].x, pts[0].y - pts[1].y)));
            moved = true;
        } else if (gesture.count === 1 && scale > 1) {
            const dx = e.clientX - gesture.cx, dy = e.clientY - gesture.cy;
            if (Math.hypot(dx, dy) > 5) { moved = true; if (!stage.hasPointerCapture(e.pointerId)) stage.setPointerCapture(e.pointerId); }
            x = gesture.x + dx; y = gesture.y + dy;
        }
        render();
    });
    function endPointer(e) {
        if (!pointers.has(e.pointerId)) return;
        const direction = photoSwipe && e.type === 'pointerup' && e.pointerType === 'touch' ? swipeDirection(e.clientX - photoSwipe.x, e.clientY - photoSwipe.y,
            performance.now() - photoSwipe.time, Math.max(scale, photoSwipe.scale), photoSwipe.multi, stage.clientWidth) : 0;
        if (direction) {
            dotnet.invokeMethodAsync('StepPhoto', direction).catch(() => {});
            suppressClickUntil = performance.now() + 400;
            photoSwipe = null;
        }
        const hadGesture = moved || pointers.size > 1 || !!direction;
        pointers.delete(e.pointerId);
        if (stage.hasPointerCapture(e.pointerId)) stage.releasePointerCapture(e.pointerId);
        if (hadGesture) { suppressClickUntil = performance.now() + 350; lastTap = 0; }
        else if (e.type === 'pointerup' && e.pointerType === 'touch' && !e.target.closest('button')) {
            const now = performance.now();
            if (now - lastTap < 320 && lastTapPoint && Math.hypot(lastTapPoint.x - e.clientX, lastTapPoint.y - e.clientY) < 35) {
                zoom(scale > 1.1 ? 1 : 2.5, e.clientX, e.clientY); lastTap = 0; suppressClickUntil = performance.now() + 350;
            } else { lastTap = now; lastTapPoint = { x: e.clientX, y: e.clientY }; }
        }
        snapshotGesture();
        if (!pointers.size) canvas.style.willChange = 'auto';
    }
    on(stage, 'pointerup', endPointer);
    on(stage, 'pointercancel', endPointer);
    on(stage, 'lostpointercapture', e => {
        pointers.delete(e.pointerId);
        snapshotGesture();
        if (!pointers.size) canvas.style.willChange = 'auto';
    });
    on(stage, 'dragstart', e => e.preventDefault());
    on(stage, 'click', e => {
        if (performance.now() < suppressClickUntil) { e.preventDefault(); e.stopImmediatePropagation(); suppressClickUntil = 0; return; }
        if (!e.target.closest('button')) dismiss();
    }, { capture: true });
    on(document, 'pointerdown', e => {
        if (info.classList.contains('has-selection') && !root.contains(e.target) && !e.target.closest('.team-member-card')) dismiss();
    });
    on(document, 'keydown', e => { if (e.key === 'Escape' && !full) dismiss(); });
    on(info, 'pointerdown', e => { swipeY = e.target.closest('[data-sheet-grip]') ? e.clientY : undefined; });
    on(info, 'pointerup', e => { if (swipeY !== undefined && e.clientY - swipeY > 45) dismiss(); swipeY = undefined; });
    on(canvas, 'error', e => { if (e.target.matches('[data-photo]')) root.querySelector('[data-image-error]').hidden = false; }, { capture: true });
    const resize = new ResizeObserver(layout);
    resize.observe(stage);
    layout();

    return {
        restoreMarkerFocus() {
            if (info.contains(document.activeElement)) canvas.querySelector('.is-selected')?.focus({ preventScroll: true });
        },
        photoChanged() {
            hideLabel();
            photoSwipe = null;
            pointers.clear(); gesture = null; lastTap = 0; suppressClickUntil = Math.max(suppressClickUntil, performance.now() + 100);
            root.querySelector('[data-image-error]').hidden = false;
            const image = canvas.querySelector('[data-photo]');
            root.querySelector('[data-image-error]').hidden = !(image.complete && !image.naturalWidth);
            reset(); layout();
        },
        async focusMember(id) {
            if (mobile() && !full) enterFullscreen();
            layout();
            const marker = canvas.querySelector(`[data-member="${CSS.escape(id)}"]`);
            if (!marker) return;
            scale = mobile() ? 2.5 : 1.5;
            x = (.5 - parseFloat(marker.style.left) / 100) * baseW * scale;
            const markerY = full ? Number(marker.dataset.photoY) : parseFloat(marker.style.getPropertyValue('--inline-y')) / 100;
            y = (.5 - markerY) * baseH * scale;
            paint();
            if (!full) root.scrollIntoView({ behavior: motion(), block: 'start' });
            marker.focus({ preventScroll: true });
        },
        async goToProfile(id) {
            exitFullscreen(false);
            // Await the Blazor render which can reveal a previously filtered member.
            for (let i = 0; i < 8; i++) {
                const card = document.getElementById(`mitglied-${id}`);
                if (card) { card.focus({ preventScroll: true }); card.scrollIntoView({ behavior: motion(), block: 'center' }); return; }
                await new Promise(resolve => requestAnimationFrame(resolve));
            }
        },
        dispose() {
            if (full) { full = false; root.close(); document.body.style.overflow = savedOverflow; }
            resize.disconnect(); abort.abort(); cancelAnimationFrame(frame);
            clearTimeout(settleTimer);
            pointers.clear();
        }
    };
}
