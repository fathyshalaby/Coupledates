import { motion, useReducedMotion } from 'framer-motion';
import { Link } from 'wouter';
import { ArrowDown, ArrowRight, CalendarHeart, Check, LockKeyhole, Share2, Sparkles } from 'lucide-react';
import { MarketingFooter, MarketingNav } from '@/components/marketing';

const base = import.meta.env.BASE_URL;

const reveal = {
  initial: { opacity: 0, y: 18 },
  whileInView: { opacity: 1, y: 0 },
  viewport: { once: true, margin: '-60px' },
  transition: { duration: 0.55, ease: [0.2, 0.7, 0.2, 1] as const },
};

export default function CouplesJournalPage() {
  const prefersReducedMotion = useReducedMotion();
  const enter = prefersReducedMotion
    ? { initial: false, whileInView: { opacity: 1, y: 0 }, viewport: { once: true }, transition: { duration: 0 } }
    : reveal;
  return (
    <div className="couples-journal-page">
      <MarketingNav />
      <main>
        <section className="journal-hero">
          <div className="journal-hero-copy">
            <p className="eyebrow">A shared space for two</p>
            <h1 className="font-display">A private couples journal for the life you’re making together.</h1>
            <p className="journal-lede">Start with a date idea you both choose. Afterward, keep the photo and the little story in one place you can return to together.</p>
            <div className="journal-hero-actions">
              <Link href="/sign-up" data-testid="link-journal-signup-hero" className="journal-button">
                Start your shared space <ArrowRight size={16} />
              </Link>
              <a href="#how-it-works" className="journal-text-link">See how it works <ArrowDown size={15} /></a>
            </div>
            <p className="journal-beta-line"><LockKeyhole size={15} /> Free during beta <span aria-hidden="true">·</span> Private to the two people in your space</p>
          </div>
          <motion.figure {...enter} className="journal-product-figure">
            <div className="journal-photo-frame">
              <span className="journal-image-label">Inside the shared journal</span>
              <img src={`${base}product-shots/memories-mobile.jpg`} alt="Couple Dates memories page showing a shared timeline with an illustrative date memory" />
            </div>
            <figcaption><span className="font-display">Your pages, together.</span><span>Real product screen · Illustrative demo data</span></figcaption>
          </motion.figure>
          <div className="journal-margin-note" aria-hidden="true">A little record of us</div>
        </section>

        <section className="journal-intro-band" id="how-it-works">
          <motion.div {...enter} className="journal-intro-heading">
            <span className="journal-index">01 / FIRST, THE PLAN</span>
            <h2 className="font-display">A good memory often starts with, “Would you be up for…?”</h2>
          </motion.div>
          <motion.div {...enter} className="journal-intro-body">
            <p>Couple Dates brings date planning and remembering into the same shared space. Either partner can suggest an in-person or online date; the other gets a say before it becomes a plan.</p>
            <p>After the date, add a photo and a note. The plan becomes a memory you can find again—not another moment lost in the camera roll.</p>
            <Link href="/sign-up" className="journal-inline-link" data-testid="link-journal-signup-plan">Make a space for the two of you <ArrowRight size={15} /></Link>
          </motion.div>
        </section>

        <section className="journal-flow" aria-label="From idea to memory">
          <div className="journal-flow-top">
            <p className="eyebrow">From “we should” to “remember that?”</p>
            <p className="journal-flow-aside">No perfect occasion required. Just something you both want to do.</p>
          </div>
          <div className="journal-flow-steps">
            <motion.article {...enter} className="journal-flow-step">
              <div className="journal-step-mark"><Sparkles size={19} /></div>
              <span className="journal-index">01</span>
              <h3 className="font-display">Find an idea</h3>
              <p>Choose something that fits your interests, energy, and the time you have.</p>
            </motion.article>
            <div className="journal-flow-connector" aria-hidden="true" />
            <motion.article {...enter} className="journal-flow-step">
              <div className="journal-step-mark"><CalendarHeart size={19} /></div>
              <span className="journal-index">02</span>
              <h3 className="font-display">Choose it together</h3>
              <p>Suggest a time and place. Your partner can accept, pass, or suggest a change.</p>
            </motion.article>
            <div className="journal-flow-connector" aria-hidden="true" />
            <motion.article {...enter} className="journal-flow-step">
              <div className="journal-step-mark"><LockKeyhole size={19} /></div>
              <span className="journal-index">03</span>
              <h3 className="font-display">Keep what happened</h3>
              <p>Add the photo and the detail you’ll want to remember. It stays in your shared journal.</p>
            </motion.article>
          </div>
        </section>

        <section className="journal-memory-story">
          <motion.div {...enter} className="journal-memory-copy">
            <span className="journal-index">02 / THEN, THE MEMORY</span>
            <h2 className="font-display">A photo keeps the scene.<br /><em>A note brings you back.</em></h2>
            <p>Save the small specifics alongside your photos: what you ordered, what went wrong, the line you’re still quoting. Your shared timeline keeps these moments together, ready to revisit when you feel like looking back.</p>
            <div className="journal-memory-note">
              <span className="journal-note-rule" />
              <p>“Ordered one of everything and shared the last chili crisp.”</p>
              <small>Illustrative example note</small>
            </div>
          </motion.div>
          <motion.div {...enter} className="journal-memory-art" aria-label="Illustration of a shared journal memory">
            <div className="journal-art-paper">
              <p className="journal-art-kicker">A page from the two of you</p>
              <div className="journal-art-photo" role="img" aria-label="Illustrative warm-lit dinner table with a shared bowl of food" />
              <div className="journal-art-caption">
                <span>OCT 16 · FOOD</span>
                <p className="font-display">The dumpling place you found</p>
                <div className="journal-art-scribble">worth the walk across town</div>
              </div>
            </div>
            <span className="journal-art-caption-note">Illustrative memory, not an app screen</span>
          </motion.div>
        </section>

        <section className="journal-privacy">
          <div className="journal-privacy-title">
            <LockKeyhole size={22} />
            <p className="eyebrow">Private means private</p>
            <h2 className="font-display">Not a feed. Not an audience.</h2>
          </div>
          <div className="journal-privacy-copy">
            <p>Your journal is private to the two people in your shared space. There is no public feed, and your memories are not publicly posted.</p>
            <p>If you choose to share socially, it’s opt-in for an individual memory you select. Keep everything private by simply not sharing.</p>
            <div className="journal-privacy-points">
              <span><Check size={15} /> One shared space for two</span>
              <span><Check size={15} /> No public feed</span>
              <span><Check size={15} /> Sharing is your choice, memory by memory</span>
            </div>
          </div>
        </section>

        <section className="journal-recap">
          <motion.div {...enter} className="journal-recap-copy">
            <span className="journal-index">03 / WHEN YOU’RE READY TO LOOK BACK</span>
            <h2 className="font-display">A year can be more than dates on a calendar.</h2>
            <p>An optional yearly recap brings together the dates and memories you’ve added. It’s a way to notice the ordinary rituals and unexpected favorites that made the year yours.</p>
            <p className="journal-recap-caveat">Your recap reflects what you choose to save. It’s there when you want it—not another thing to keep up with.</p>
          </motion.div>
          <motion.div {...enter} className="journal-recap-card">
            <span className="journal-recap-label">A year in review · illustrative</span>
            <p className="font-display">The moments<br /><em>you kept.</em></p>
            <div className="journal-month-marks" aria-hidden="true">
              {[28, 48, 35, 67, 46, 58, 32, 72, 50, 39, 64, 46].map((height, i) => <span key={i} style={{ height: `${height}%` }} />)}
            </div>
            <div className="journal-month-labels" aria-hidden="true"><span>JAN</span><span>APR</span><span>AUG</span><span>DEC</span></div>
            <small>Example treatment · no real couple’s data</small>
          </motion.div>
        </section>

        <section className="journal-cta">
          <div className="journal-cta-ornament" aria-hidden="true">02</div>
          <p className="eyebrow">Free while beta is open</p>
          <h2 className="font-display">Make a little room for your story.</h2>
          <p>Start a shared space, invite your person, and decide together what’s worth keeping.</p>
          <Link href="/sign-up" data-testid="link-journal-signup-bottom" className="journal-button journal-button-light">Start your shared space <ArrowRight size={16} /></Link>
          <span className="journal-cta-footnote"><LockKeyhole size={13} /> Private to the two of you · No public feed</span>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
