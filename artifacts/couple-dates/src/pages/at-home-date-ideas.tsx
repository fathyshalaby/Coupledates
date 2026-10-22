import { useState } from 'react';
import { Link } from 'wouter';
import { ArrowRight, Clock3, Heart, Search, Video } from 'lucide-react';
import { MarketingFooter, MarketingNav } from '@/components/marketing';

const base = import.meta.env.BASE_URL;

type DateIdea = {
  title: string;
  description: string;
  time: number;
  cost: number;
  costLabel: string;
  online: boolean;
  tags: string[];
};

const dateIdeas: DateIdea[] = [
  {
    title: 'Dessert and one good question',
    description: 'Bring out something sweet you already have and trade an answer to: “What made you feel most like yourself this week?”',
    time: 15,
    cost: 0,
    costLabel: 'Free',
    online: true,
    tags: ['Easy start', 'Conversation'],
  },
  {
    title: 'A living-room picnic',
    description: 'Make a little space on the floor, share a snack from the kitchen, and put your phones out of reach for a while.',
    time: 30,
    cost: 0,
    costLabel: 'Free',
    online: false,
    tags: ['Low effort', 'No prep'],
  },
  {
    title: 'Trade three songs',
    description: 'Pick three songs for each other. Listen at the same time, then tell the story behind one choice.',
    time: 30,
    cost: 0,
    costLabel: 'Free',
    online: true,
    tags: ['Music', 'Long-distance friendly'],
  },
  {
    title: 'Make your usual dinner feel new',
    description: 'Choose a familiar meal, set the table a little differently, and cook together without trying to perfect it.',
    time: 45,
    cost: 8,
    costLabel: 'Under $10',
    online: false,
    tags: ['Dinner', 'A little prep'],
  },
  {
    title: 'Sketch each other in five minutes',
    description: 'Grab any paper and pen. Draw each other without erasing; the fun is in showing the results, not getting it right.',
    time: 30,
    cost: 0,
    costLabel: 'Free',
    online: true,
    tags: ['Creative', 'Silly'],
  },
  {
    title: 'Taste-test a few treats',
    description: 'Pick up a few inexpensive snacks neither of you has tried. Taste them together and pick a favorite.',
    time: 45,
    cost: 15,
    costLabel: '$10–25',
    online: false,
    tags: ['Food', 'Try something new'],
  },
  {
    title: 'Watch one short thing together',
    description: 'Choose one episode or short film, bring your own snack, and save the conversation for before or after.',
    time: 60,
    cost: 0,
    costLabel: 'Free',
    online: true,
    tags: ['Quiet night', 'Long-distance friendly'],
  },
  {
    title: 'Set up an at-home tasting night',
    description: 'Choose a few cheeses, chocolates, teas, or other favorites. Take turns picking the next bite and rating it.',
    time: 60,
    cost: 32,
    costLabel: '$25+',
    online: false,
    tags: ['Special treat', 'Food'],
  },
];

function costTier(cost: number) {
  if (cost === 0) return 'free';
  if (cost < 10) return 'under10';
  if (cost < 25) return 'under25';
  return 'any';
}

export default function AtHomeDateIdeasPage() {
  const [search, setSearch] = useState('');
  const [time, setTime] = useState('any');
  const [budget, setBudget] = useState('any');
  const [format, setFormat] = useState('any');

  const filteredIdeas = dateIdeas.filter((idea) => {
    const query = search.trim().toLowerCase();
    const matchesSearch = !query || `${idea.title} ${idea.description} ${idea.tags.join(' ')}`.toLowerCase().includes(query);
    const matchesTime = time === 'any' || idea.time <= Number(time);
    const matchesBudget = budget === 'any'
      || (budget === 'under25' ? idea.cost < 25 : costTier(idea.cost) === budget);
    const matchesFormat = format === 'any' || (format === 'online' ? idea.online : !idea.online);
    return matchesSearch && matchesTime && matchesBudget && matchesFormat;
  });

  const resetFilters = () => {
    setSearch('');
    setTime('any');
    setBudget('any');
    setFormat('any');
  };

  return (
    <div className="marketing-shell">
      <MarketingNav />
      <main className="at-home-page">
        <section className="at-home-hero" aria-labelledby="at-home-title">
          <div className="at-home-hero-copy">
            <p className="eyebrow">Good dates can stay in</p>
            <h1 id="at-home-title" className="font-display">Romantic at-home date ideas for <em>real life.</em></h1>
            <p className="at-home-lede">No reservations, elaborate setup, or big budget needed. Find a cozy idea that fits your time, budget, and energy—including options for couples in different places.</p>
            <div className="at-home-hero-actions">
              <a href="#idea-finder" className="journal-button">Find your idea <ArrowRight size={16} /></a>
              <span><Heart size={15} /> Free ideas, any kind of night</span>
            </div>
          </div>
          <figure className="at-home-product-figure">
            <div className="at-home-product-image">
              <img
                src={`${base}product-shots/dates-mobile.jpg`}
                alt="Real Couple Dates screen for suggesting and planning a date together; details shown are illustrative."
                width="780"
                height="1688"
              />
            </div>
            <figcaption><span className="font-display">From idea to shared plan</span><span>Real product screen · Illustrative demo data</span></figcaption>
          </figure>
        </section>

        <section className="at-home-finder" id="idea-finder" aria-labelledby="finder-title">
          <div className="at-home-section-heading">
            <p className="eyebrow">Start with what works tonight</p>
            <h2 id="finder-title" className="font-display">Find an idea that fits.</h2>
            <p>Search the ideas or narrow them by time, budget, and whether you’re together in person.</p>
          </div>
          <div className="at-home-filters">
            <label className="at-home-search">
              <span>Search ideas</span>
              <span className="at-home-input-wrap"><Search size={17} aria-hidden="true" /><input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Try “music” or “food”" /></span>
            </label>
            <label>Time available
              <select value={time} onChange={(event) => setTime(event.target.value)}>
                <option value="any">Any amount of time</option>
                <option value="30">30 minutes or less</option>
                <option value="45">45 minutes or less</option>
                <option value="60">About an hour</option>
              </select>
            </label>
            <label>Budget
              <select value={budget} onChange={(event) => setBudget(event.target.value)}>
                <option value="any">Any budget</option>
                <option value="free">Free</option>
                <option value="under10">Under $10</option>
                <option value="under25">Under $25</option>
              </select>
            </label>
            <label>Date format
              <select value={format} onChange={(event) => setFormat(event.target.value)}>
                <option value="any">In person or online</option>
                <option value="together">Together at home</option>
                <option value="online">Works over a call</option>
              </select>
            </label>
          </div>
          <p className="at-home-result-count" role="status" aria-live="polite">{filteredIdeas.length} {filteredIdeas.length === 1 ? 'idea' : 'ideas'} to try</p>
          {filteredIdeas.length > 0 ? (
            <div className="at-home-idea-grid">
              {filteredIdeas.map((idea) => (
                <article className="at-home-idea-card" key={idea.title}>
                  <div className="at-home-idea-meta"><span><Clock3 size={14} /> {idea.time} min</span><span>{idea.costLabel}</span></div>
                  <h3 className="font-display">{idea.title}</h3>
                  <p>{idea.description}</p>
                  <div className="at-home-idea-tags">{idea.online && <span><Video size={13} /> Online option</span>}{idea.tags.filter((tag) => tag !== 'Long-distance friendly').slice(0, 1).map((tag) => <span key={tag}>{tag}</span>)}</div>
                </article>
              ))}
            </div>
          ) : (
            <div className="at-home-empty">
              <p>No ideas match those filters yet. Try a broader search or clear a filter.</p>
              <button type="button" onClick={resetFilters}>Clear filters</button>
            </div>
          )}
        </section>

        <section className="at-home-plan-section" aria-labelledby="at-home-plan-title">
          <div>
            <p className="eyebrow">Make it a shared plan</p>
            <h2 id="at-home-plan-title" className="font-display">One idea. Two people choosing.</h2>
          </div>
          <div className="at-home-plan-copy">
            <p>Either partner can suggest an at-home date in Couple Dates, add a time and details, and let the other person accept or suggest a change. Long-distance? Add the call link you already use. Couple Dates helps you plan—it doesn’t book venues or host video calls.</p>
            <Link href="/how-it-works" className="journal-inline-link">See how planning works <ArrowRight size={15} /></Link>
          </div>
        </section>

        <section className="at-home-cta" aria-labelledby="at-home-cta-title">
          <div>
            <p className="eyebrow">Open beta · free for both partners</p>
            <h2 id="at-home-cta-title" className="font-display">Save a little room for each other.</h2>
            <p>Start a private shared space, invite your partner, and plan your next night in together.</p>
          </div>
          <Link href="/sign-up" className="journal-button">Join the free beta <ArrowRight size={16} /></Link>
        </section>
      </main>
      <MarketingFooter />
    </div>
  );
}
