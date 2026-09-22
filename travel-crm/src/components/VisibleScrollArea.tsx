import React, { useCallback, useEffect, useRef, useState } from 'react';

type Props = {
    children: React.ReactNode;
    className?: string;
};

type AxisState = {
    needed: boolean;
    thumbSize: number;
    thumbOffset: number;
};

const MIN_THUMB = 28;

/**
 * Scroll container with always-visible custom scrollbars.
 * Native overlay bars are hidden on iOS/Safari; this paints a track + thumb instead.
 */
const VisibleScrollArea: React.FC<Props> = ({ children, className = '' }) => {
    const rootRef = useRef<HTMLDivElement>(null);
    const viewportRef = useRef<HTMLDivElement>(null);
    const dragRef = useRef<{
        axis: 'x' | 'y';
        startPointer: number;
        startScroll: number;
    } | null>(null);

    const [vertical, setVertical] = useState<AxisState>({
        needed: false,
        thumbSize: 0,
        thumbOffset: 0,
    });
    const [horizontal, setHorizontal] = useState<AxisState>({
        needed: false,
        thumbSize: 0,
        thumbOffset: 0,
    });

    const updateMetrics = useCallback(() => {
        const el = viewportRef.current;
        if (!el) return;

        const {
            scrollTop,
            scrollLeft,
            scrollHeight,
            scrollWidth,
            clientHeight,
            clientWidth,
        } = el;

        const vNeeded = scrollHeight > clientHeight + 1;
        const hNeeded = scrollWidth > clientWidth + 1;

        const vThumb = vNeeded
            ? Math.max(MIN_THUMB, (clientHeight / scrollHeight) * clientHeight)
            : 0;
        const vMax = Math.max(scrollHeight - clientHeight, 1);
        const vOffset = vNeeded
            ? (scrollTop / vMax) * Math.max(clientHeight - vThumb, 0)
            : 0;

        const hThumb = hNeeded
            ? Math.max(MIN_THUMB, (clientWidth / scrollWidth) * clientWidth)
            : 0;
        const hMax = Math.max(scrollWidth - clientWidth, 1);
        const hOffset = hNeeded
            ? (scrollLeft / hMax) * Math.max(clientWidth - hThumb, 0)
            : 0;

        setVertical({ needed: vNeeded, thumbSize: vThumb, thumbOffset: vOffset });
        setHorizontal({ needed: hNeeded, thumbSize: hThumb, thumbOffset: hOffset });
    }, []);

    useEffect(() => {
        const el = viewportRef.current;
        const root = rootRef.current;
        if (!el) return;

        updateMetrics();

        const ro = new ResizeObserver(() => updateMetrics());
        ro.observe(el);
        if (root) ro.observe(root);
        if (el.firstElementChild) ro.observe(el.firstElementChild);

        el.addEventListener('scroll', updateMetrics, { passive: true });
        window.addEventListener('resize', updateMetrics);

        // Re-measure after layout / fonts / images settle
        const raf = requestAnimationFrame(updateMetrics);
        const t = window.setTimeout(updateMetrics, 120);

        return () => {
            ro.disconnect();
            el.removeEventListener('scroll', updateMetrics);
            window.removeEventListener('resize', updateMetrics);
            cancelAnimationFrame(raf);
            window.clearTimeout(t);
        };
    }, [updateMetrics, children]);

    useEffect(() => {
        const onMove = (event: PointerEvent) => {
            const drag = dragRef.current;
            const el = viewportRef.current;
            if (!drag || !el) return;

            if (drag.axis === 'y') {
                const maxScroll = el.scrollHeight - el.clientHeight;
                const track = el.clientHeight - vertical.thumbSize;
                if (track <= 0 || maxScroll <= 0) return;
                const delta = event.clientY - drag.startPointer;
                el.scrollTop = drag.startScroll + (delta / track) * maxScroll;
            } else {
                const maxScroll = el.scrollWidth - el.clientWidth;
                const track = el.clientWidth - horizontal.thumbSize;
                if (track <= 0 || maxScroll <= 0) return;
                const delta = event.clientX - drag.startPointer;
                el.scrollLeft = drag.startScroll + (delta / track) * maxScroll;
            }
        };

        const onUp = () => {
            dragRef.current = null;
        };

        window.addEventListener('pointermove', onMove);
        window.addEventListener('pointerup', onUp);
        window.addEventListener('pointercancel', onUp);
        return () => {
            window.removeEventListener('pointermove', onMove);
            window.removeEventListener('pointerup', onUp);
            window.removeEventListener('pointercancel', onUp);
        };
    }, [vertical.thumbSize, horizontal.thumbSize]);

    const startDrag = (axis: 'x' | 'y') => (event: React.PointerEvent) => {
        const el = viewportRef.current;
        if (!el) return;
        event.preventDefault();
        event.stopPropagation();
        dragRef.current = {
            axis,
            startPointer: axis === 'y' ? event.clientY : event.clientX,
            startScroll: axis === 'y' ? el.scrollTop : el.scrollLeft,
        };
    };

    const jumpTrack = (axis: 'x' | 'y') => (event: React.PointerEvent<HTMLDivElement>) => {
        const el = viewportRef.current;
        if (!el || event.target !== event.currentTarget) return;

        const rect = event.currentTarget.getBoundingClientRect();
        if (axis === 'y') {
            const ratio = (event.clientY - rect.top) / rect.height;
            el.scrollTop = ratio * (el.scrollHeight - el.clientHeight);
        } else {
            const ratio = (event.clientX - rect.left) / rect.width;
            el.scrollLeft = ratio * (el.scrollWidth - el.clientWidth);
        }
    };

    const padRight = vertical.needed ? 12 : 0;
    const padBottom = horizontal.needed ? 12 : 0;

    return (
        <div
            ref={rootRef}
            className={`relative min-h-0 min-w-0 flex-1 ${className}`}
        >
            <div
                ref={viewportRef}
                className="visible-scroll-viewport absolute inset-0 overflow-auto overscroll-contain"
                style={{
                    WebkitOverflowScrolling: 'touch',
                    paddingRight: padRight,
                    paddingBottom: padBottom,
                }}
            >
                {children}
            </div>

            {vertical.needed && (
                <div
                    className="absolute top-1.5 right-1 z-30 w-2.5 rounded-full bg-slate-200/95 border border-slate-300/60 shadow-sm"
                    style={{ bottom: horizontal.needed ? 14 : 6 }}
                    onPointerDown={jumpTrack('y')}
                    aria-hidden
                >
                    <div
                        className="absolute left-0.5 right-0.5 rounded-full bg-slate-500 touch-none cursor-grab active:cursor-grabbing"
                        style={{
                            height: vertical.thumbSize,
                            transform: `translateY(${vertical.thumbOffset}px)`,
                        }}
                        onPointerDown={startDrag('y')}
                    />
                </div>
            )}

            {horizontal.needed && (
                <div
                    className="absolute left-1.5 bottom-1 z-30 h-2.5 rounded-full bg-slate-200/95 border border-slate-300/60 shadow-sm"
                    style={{ right: vertical.needed ? 14 : 6 }}
                    onPointerDown={jumpTrack('x')}
                    aria-hidden
                >
                    <div
                        className="absolute top-0.5 bottom-0.5 rounded-full bg-slate-500 touch-none cursor-grab active:cursor-grabbing"
                        style={{
                            width: horizontal.thumbSize,
                            transform: `translateX(${horizontal.thumbOffset}px)`,
                        }}
                        onPointerDown={startDrag('x')}
                    />
                </div>
            )}
        </div>
    );
};

export default VisibleScrollArea;
