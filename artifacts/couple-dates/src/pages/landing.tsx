import { Link } from 'wouter';
import { motion } from 'framer-motion';
import { ArrowRight, Lock, MapPin, Heart } from 'lucide-react';
import { CategoryChip, TwoRings } from '@/components/bits';
import { MarketingNav, MarketingFooter } from '@/components/marketing';

const base = import.meta.env.BASE_URL;

const SAMPLES = [
  { img: 'sample/noodles.jpg', title: 'The noodle stall that took cash only', date: 'Mar 14', cat: 'Food', note: 'We pooled every coin we had. Worth it. Ordered a second bowl to split.', rot: -3 },
  { img: 'sample/kitchen.jpg', title: 'Sunday crossword, 41 across', date: 'Apr 02', cat: 'Everyday', note: 'Neither of us knew it. We guessed "heron" and it was right.', rot: 2 },
  { img: 'sample/shore.jpg', title: 'Missed the last ferry', date: 'May 19', cat: 'Adventure', note: 'Watched the light go plum instead. Best mistake of spring.', rot: -1 },
];

const WEEK = [true, true, false, true, true, true, false];

export default function Landing() {
  return (
    <div className="min-h-[100dvh] overflow-x-hidden">
      <MarketingNav />

      {/* HERO */}
      <section className="mx-auto grid max-w-5xl gap-10 px-5 pt-8 pb-16 md:grid-cols-[1.1fr_1fr] md:items-center md:pt-16">
        <div>
          <p className="rise eyebrow text-primary">A private space for exactly two</p>
          <h1 className="rise font-display mt-4 text-[3rem] leading-[0.98] font-medium md:text-[4.75rem]" style={{ animationDelay: '80ms' }}>
            Tuesday counts <em className="font-normal text-primary">too.</em>
          </h1>
          <p className="rise mt-5 max-w-md text-lg text-muted-foreground" style={{ animationDelay: '160ms' }}>
            A shared notebook for the two of you. Keep the small moments, plan the next date, check in each day, and look back at your year together.
          </p>
          <div className="rise mt-8 flex flex-wrap items-center gap-3" style={{ animationDelay: '240ms' }}>
            <Link href="/sign-up" data-testid="button-hero-start" className="group inline-flex items-center gap-2 rounded-full bg-primary px-6 py-3.5 font-medium text-primary-foreground transition hover:bg-primary/90 active:scale-[.98]">
              Make your shared space <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
            </Link>
            <a href="#preview" data-testid="link-preview" className="rounded-full px-5 py-3.5 font-medium underline decoration-primary/40 underline-offset-4">See a sample</a>
          </div>
          <p className="mt-6 flex items-center gap-2 text-sm text-muted-foreground"><Lock className="h-4 w-4" /> Only you and the one person you invite can see it.</p>
        </div>

        <div className="relative mx-auto h-[400px] w-full max-w-sm">
          {SAMPLES.map((s, i) => (
            <motion.figure
              key={s.img}
              initial={{ opacity: 0, y: 40, rotate: 0 }}
              animate={{ opacity: 1, y: 0, rotate: s.rot }}
              transition={{ delay: 0.25 + i * 0.15, type: 'spring', stiffness: 120, damping: 16 }}
              whileHover={{ rotate: 0, y: -8, zIndex: 10 }}
              className="polaroid absolute w-[64%]"
              style={{ left: `${[0, 34, 14][i]}%`, top: `${[0, 60, 170][i]}px` }}
            >
              <img src={`${base}${s.img}`} alt={s.title} className="aspect-[4/5] w-full object-cover" />
              <figcaption className="font-display mt-2 text-sm italic text-[hsl(330_32%_15%)]">{s.title}</figcaption>
            </motion.figure>
          ))}
          <span className="absolute -bottom-2 right-0 rounded-full border border-border bg-card px-2.5 py-1 text-[11px] font-medium text-muted-foreground">Example photos</span>
        </div>
      </section>

      {/* PREVIEW: phone */}
      <section id="preview" className="bg-foreground py-20 text-background">
        <div className="mx-auto grid max-w-5xl gap-12 px-5 md:grid-cols-2 md:items-center">
          <div>
            <p className="text-xs font-medium text-accent">Sample space, read-only</p>
            <h2 className="font-display mt-3 text-4xl leading-tight md:text-5xl">This is what a Tuesday looks like when someone writes it down.</h2>
            <p className="mt-4 text-background/70">Everything on this side is invented to show you around. Your space starts empty, and fills only with what the two of you add.</p>
            <ul className="mt-8 space-y-4 text-background/85">
              {['A shared timeline of memories, with photos, search and favorites', 'Planned dates that become rated, completed ones', 'A daily check-in you keep alive together', 'A yearly recap built from what you actually did'].map((t, i) => (
                <li key={t} className="flex gap-3"><span className="font-mono text-sm text-accent">0{i + 1}</span>{t}</li>
              ))}
            </ul>
          </div>

          <div className="mx-auto w-full max-w-[340px] rounded-[40px] border border-background/15 bg-background p-4 text-foreground shadow-2xl">
            <div className="rounded-[32px] bg-card p-4">
              <p className="eyebrow text-primary">Example couple</p>
              <p className="font-display text-2xl">Noor &amp; Teo</p>
              <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                {[['612', 'days'], ['48', 'memories'], ['9', 'day streak']].map(([n, l]) => (
                  <div key={l} className="rounded-2xl bg-secondary/70 py-2"><p className="font-display text-xl">{n}</p><p className="text-[10px] text-muted-foreground">{l}</p></div>
                ))}
              </div>
              <div className="mt-4 flex justify-between">
                {WEEK.map((c, i) => (
                  <div key={i} className="flex flex-col items-center gap-1">
                    <span className={`h-7 w-7 rounded-full ${c ? 'bg-primary' : 'border-2 border-dashed border-foreground/20'}`} />
                    <span className="font-mono text-[9px] text-muted-foreground">{'MTWTFSS'[i]}</span>
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-3 rounded-3xl border border-[hsl(38_60%_75%)] bg-[hsl(41_78%_94%)] p-4">
              <p className="eyebrow">Next date / Sat 7:30 pm</p>
              <p className="font-display mt-1 text-lg">Late film at the Rialto</p>
              <p className="mt-1 flex items-center gap-1 text-xs"><MapPin className="h-3 w-3" /> Rialto Cinema, 3rd row</p>
            </div>
            <div className="mt-3 space-y-2">
              {SAMPLES.slice(0, 2).map((s) => (
                <div key={s.title} className="flex gap-3 rounded-3xl bg-card p-2.5">
                  <img src={`${base}${s.img}`} alt="" className="h-14 w-14 rounded-2xl object-cover" />
                  <div className="min-w-0">
                    <p className="truncate text-sm font-medium">{s.title}</p>
                    <div className="mt-1 flex items-center gap-2"><CategoryChip category={s.cat} /><span className="font-mono text-[10px] text-muted-foreground">{s.date}</span></div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* MEMORY NOTES */}
      <section className="mx-auto max-w-5xl px-5 py-20">
        <p className="eyebrow text-primary">Memories</p>
        <h2 className="font-display mt-2 max-w-xl text-4xl">Not highlights. The bits you'd otherwise forget.</h2>
        <div className="mt-10 grid gap-5 md:grid-cols-[1.3fr_1fr_1fr]">
          {SAMPLES.map((s, i) => (
            <article key={s.title} className={`surface p-5 ${i === 0 ? 'md:row-span-2' : ''}`}>
              <img src={`${base}${s.img}`} alt="" className={`w-full rounded-2xl object-cover ${i === 0 ? 'aspect-[4/5]' : 'aspect-video'}`} />
              <div className="mt-4 flex items-center justify-between"><CategoryChip category={s.cat} /><span className="text-xs text-muted-foreground">{s.date} / example</span></div>
              <h3 className="font-display mt-2 text-xl">{s.title}</h3>
              <p className="mt-1 text-sm text-muted-foreground">{s.note}</p>
            </article>
          ))}
        </div>
      </section>

      {/* RECAP */}
      <section className="mx-auto max-w-5xl px-5 pb-20">
        <div className="relative overflow-hidden rounded-[36px] bg-primary p-8 text-primary-foreground md:p-12">
          <p className="text-xs font-medium opacity-85">Yearly recap / example</p>
          <p className="font-display mt-3 text-5xl leading-none md:text-7xl">83 memories.<br /><em>21 dates.</em></p>
          <p className="mt-4 max-w-md opacity-90">At the end of the year, your recap counts what really happened: busiest months, your favorite kind of date, the longest streak you kept going.</p>
          <div className="mt-8 flex h-24 items-end gap-1.5">
            {[3, 5, 4, 9, 7, 6, 11, 8, 5, 7, 10, 8].map((n, i) => (
              <motion.span key={i} initial={{ scaleY: 0 }} whileInView={{ scaleY: 1 }} viewport={{ once: true }} transition={{ delay: i * 0.05 }} style={{ height: `${n * 8}%`, transformOrigin: 'bottom' }} className="flex-1 rounded-t-md bg-primary-foreground/85" />
            ))}
          </div>
        </div>
      </section>

      {/* HOW */}
      <section className="mx-auto max-w-5xl px-5 pb-24">
        <h2 className="font-display text-4xl">Two steps. Then it's yours.</h2>
        <ol className="mt-8 grid gap-4 md:grid-cols-2">
          <li className="surface p-6"><span className="font-mono text-primary">01</span><p className="font-display mt-2 text-2xl">One of you creates the space.</p><p className="mt-1 text-muted-foreground">Your names, your anniversary. That's it.</p></li>
          <li className="surface p-6"><span className="font-mono text-primary">02</span><p className="font-display mt-2 text-2xl">The other joins with a code.</p><p className="mt-1 text-muted-foreground">Two people, never three. Codes can't open a second space.</p></li>
        </ol>
        <div className="mt-16 flex flex-col items-center text-center">
          <TwoRings size={80} />
          <p className="font-display mt-4 text-4xl">Start keeping score of the good stuff.</p>
          <Link href="/sign-up" data-testid="button-footer-start" className="mt-6 inline-flex items-center gap-2 rounded-full bg-foreground px-6 py-3.5 font-medium text-background transition hover:bg-foreground/90">
            <Heart className="h-4 w-4" /> Create your space
          </Link>
        </div>
      </section>
      <div className="mx-auto max-w-5xl px-5 pb-5 text-xs text-muted-foreground">Sample content on this page is illustrative.</div>
      <MarketingFooter />
    </div>
  );
}
