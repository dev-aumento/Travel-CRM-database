import React, { useEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight } from 'lucide-react';

interface PlanCardSliderProps {
    children: React.ReactNode;
    className?: string;
}

const TABLET_QUERY = '(min-width: 768px)';

/** One plan per slide on phones, two plans per slide on tablets. */
const PlanCardSlider = ({ children, className = '' }: PlanCardSliderProps) => {
    const scrollerRef = useRef<HTMLDivElement>(null);
    const [page, setPage] = useState(0);
    const [perView, setPerView] = useState(() =>
        typeof window !== 'undefined' && window.matchMedia(TABLET_QUERY).matches ? 2 : 1
    );
    const count = React.Children.count(children);
    const pageCount = Math.max(1, count - perView + 1);

    useEffect(() => {
        const media = window.matchMedia(TABLET_QUERY);
        const update = () => setPerView(media.matches ? 2 : 1);
        update();
        media.addEventListener('change', update);
        return () => media.removeEventListener('change', update);
    }, []);

    useEffect(() => {
        setPage((current) => Math.min(current, pageCount - 1));
    }, [pageCount]);

    const syncPage = () => {
        const el = scrollerRef.current;
        if (!el) return;
        const cards = [...el.children] as HTMLElement[];
        let nearest = 0;
        let best = Infinity;
        cards.forEach((card, i) => {
            const dist = Math.abs(card.offsetLeft - el.scrollLeft);
            if (dist < best) {
                best = dist;
                nearest = i;
            }
        });
        setPage(Math.min(nearest, Math.max(0, count - perView)));
    };

    const scrollToPage = (next: number) => {
        const el = scrollerRef.current;
        const clamped = Math.max(0, Math.min(pageCount - 1, next));
        const card = el?.children[clamped] as HTMLElement | undefined;
        if (!el || !card) return;
        const max = Math.max(0, el.scrollWidth - el.clientWidth);
        el.scrollTo({ left: Math.min(card.offsetLeft, max), behavior: 'smooth' });
        setPage(clamped);
    };

    if (count === 0) return null;

    return (
        <div className={`min-w-0 ${className}`}>
            <div className="xl:hidden">
                <div
                    ref={scrollerRef}
                    onScroll={syncPage}
                    className="flex gap-0 md:gap-4 overflow-x-auto snap-x snap-mandatory overscroll-x-contain pb-2 visible-scroll-viewport"
                >
                    {React.Children.map(children, (child) => (
                        <div className="snap-start shrink-0 min-w-0 w-full max-w-full md:w-[calc(50%-0.5rem)] md:max-w-[calc(50%-0.5rem)]">
                            {child}
                        </div>
                    ))}
                </div>
                <div className="mt-5 flex items-center justify-center gap-4">
                    <button
                        type="button"
                        aria-label="Previous plan"
                        disabled={page === 0}
                        onClick={() => scrollToPage(page - 1)}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 disabled:opacity-30"
                    >
                        <ChevronLeft size={18} />
                    </button>
                    <div className="flex items-center gap-2">
                        {Array.from({ length: pageCount }, (_, i) => (
                            <button
                                key={i}
                                type="button"
                                aria-label={`Show slide ${i + 1}`}
                                onClick={() => scrollToPage(i)}
                                className={`h-2 rounded-full transition-all ${i === page ? 'w-6 bg-crm-600' : 'w-2 bg-slate-300'}`}
                            />
                        ))}
                    </div>
                    <button
                        type="button"
                        aria-label="Next plan"
                        disabled={page >= pageCount - 1}
                        onClick={() => scrollToPage(page + 1)}
                        className="w-10 h-10 rounded-full bg-white border border-slate-200 shadow-sm flex items-center justify-center text-slate-700 disabled:opacity-30"
                    >
                        <ChevronRight size={18} />
                    </button>
                </div>
            </div>
            <div className="hidden xl:grid xl:grid-cols-3 gap-8">{children}</div>
        </div>
    );
};

export default PlanCardSlider;
