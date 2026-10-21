import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, Heart, LockKeyhole, MapPin, MessageCircleHeart, Sparkles, Ticket, Users, Video } from 'lucide-react';

const pages = [
  ['/', 'Home'],
  ['/how-it-works', 'How it works'],
  ['/long-distance', 'Long-distance dates'],
  ['/pricing', 'Pricing'],
] as const;

export function MarketingNav() {
  const [location] = useLocation();
  return <header className="marketing-nav"><Link href="/" className="brand-mark"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" /><span>Tuesday<small>a shared space for two</small></span></Link>
    <nav aria-label="Main navigation" className="marketing-links">{pages.map(([href, label]) => <Link key={href} href={href} aria-current={location === href ? 'page' : undefined} className={location === href ? 'is-current' : ''}>{label}</Link>)}</nav>
    <div className="marketing-actions"><Link href="/sign-in" className="nav-signin">Sign in</Link><Link href="/sign-up" className="pill-button">Start your space <ArrowRight size={15} /></Link></div>
  </header>;
}

export function MarketingFooter() {
  return <footer className="marketing-footer"><Link href="/" className="brand-mark"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" /><span>Tuesday<small>one shared space, just two</small></span></Link><p>Made for the stories that happen between the big plans.</p><div>{pages.slice(1).map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}</div><small>Tuesday · Beta features are free</small></footer>;
}

export function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body: string }) {
  return <section className="marketing-intro"><p className="eyebrow">{eyebrow}</p><h1 className="font-display">{title}</h1><p>{body}</p></section>;
}

export function HowItWorks() {
  return <main className="marketing-page"><PageIntro eyebrow="A small space, made together" title={<>Two people.<br/><em>One shared place.</em></>} body="Tuesday is a private space for exactly two. One of you creates it, the other joins, and the little plans and moments become yours to keep."/>
    <section className="steps-layout"><div className="step-stack">
      {[['01', 'One of you makes the space', 'Add the basics and create your couple’s shared home. No group to manage, no audience to perform for.'], ['02', 'Invite your person', 'Share the invite code with your partner. When they join, the space belongs to the two of you.'], ['03', 'Make it yours, together', 'Propose dates, save the moments worth keeping, and build a record that sounds like you.']].map(([n, title, copy]) => <article className="story-step" key={n}><span>{n}</span><div><h2 className="font-display">{title}</h2><p>{copy}</p></div></article>)}
    </div><aside className="invite-card"><LockKeyhole size={20}/><p className="eyebrow">Just the two of you</p><div className="invite-code">A7K—M2Q</div><p>Illustrative invite code. Your real code is created inside your space and shared with your partner.</p><div className="invite-rule"><Users size={17}/> One shared space. Two people.</div></aside></section>
    <section className="feature-band"><p className="eyebrow">The good stuff, in one place</p><div className="feature-columns"><article><Heart/><h3 className="font-display">Keep the small things</h3><p>Either of you can save a memory in your shared space with a title, note, date, category, and one optional photo. Search and favorite the ones you want close.</p></article><article><Ticket/><h3 className="font-display">Make a plan</h3><p>Either of you can propose an online or in-person date. Talk it over, choose a time, and keep the plan in your shared space.</p></article><article><Sparkles/><h3 className="font-display">Find a starting point</h3><p>Preference-informed suggestions offer a few feasible ideas. Turn one into a proposal when it feels right.</p></article></div></section>
     <ProductGallery compact/>
     <MarketingCTA/>
  </main>;
}

export function LongDistance() {
  return <main className="marketing-page"><PageIntro eyebrow="Close, even between time zones" title={<>A little closer,<br/><em>from wherever.</em></>} body="Being apart changes the logistics, not the point. Keep a shared place for online date plans, thoughtful rituals, and the moments you make from a distance."/>
    <section className="distance-feature"><div className="distance-copy"><p className="eyebrow">A plan can travel</p><h2 className="font-display">The app helps you plan. The call is yours.</h2><p>Suggest an online date and add the details that work for you: what to do, when to meet, and a call link if you already have one. Tuesday doesn’t host video calls.</p><Link href="/sign-up" className="text-link">Make your shared space <ArrowRight size={16}/></Link></div><div className="distance-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="distance-center"><MessageCircleHeart size={36}/><span>same moment<br/>different places</span></div><div className="place-dot dot-a"><span>you</span></div><div className="place-dot dot-b"><span>them</span></div><small className="illustrative">An illustrative scene</small></div></section>
    <section className="distance-ideas"><p className="eyebrow">An idea is a good beginning</p><h2 className="font-display">Small rituals, not perfect productions.</h2><div className="idea-list"><article><span>01</span><div><h3>Cook something in parallel</h3><p>Pick a recipe, set a time, and eat together over a call.</p></div><Video/></article><article><span>02</span><div><h3>Trade a playlist and press play</h3><p>Make a shared soundtrack for a quiet evening in.</p></div><Video/></article><article><span>03</span><div><h3>Take the same little walk</h3><p>Choose a route near each of you and compare the details afterward.</p></div><MapPin/></article></div><p className="fine-print">These are illustrative prompts, not services provided by the app. Date ideas are not venue-verified or bookings.</p></section>
    <MarketingCTA/>
  </main>;
}

export function Pricing() {
  return <main className="marketing-page pricing-page"><PageIntro eyebrow="Beta, without the meter running" title={<>Everything is free.<br/><em>For now, and for both.</em></>} body="Every feature is free during the Tuesday beta. Paid plans and checkout are paused, so there’s nothing to compare or subscribe to right now."/>
    <section className="beta-card"><div className="beta-copy"><span className="beta-stamp">CURRENT BETA</span><h2 className="font-display">One shared space.<br/>All features included.</h2><p>Use the space together without a paid plan. No checkout needed.</p><Link href="/sign-up" className="pill-button">Start your space <ArrowRight size={15}/></Link></div><div className="included-list">{['Shared space for exactly two', 'Date proposals, online or in person', 'Preference-informed date suggestions', 'Written memories, photo albums, search & favorites', 'Daily check-ins and yearly recap'].map((x) => <p key={x}><Check size={17}/>{x}</p>)}</div></section>
    <section className="pricing-note"><div><p className="eyebrow">No price table to decode</p><h2 className="font-display">We’re keeping it simple while beta is open.</h2></div><p>Date suggestions have an operating-cost safeguard, not a paid-plan allowance. We’re not publishing future prices or opening checkout yet. Existing subscriptions are managed separately inside the app; this public page doesn’t change any existing plan or billing behavior.</p></section>
    <MarketingCTA/>
  </main>;
}

export function MarketingCTA() {
  return <section className="marketing-cta"><div><p className="eyebrow">Whenever you’re ready</p><h2 className="font-display">Start with the next small thing.</h2></div><Link href="/sign-up" className="pill-button">Create your shared space <ArrowRight size={16}/></Link></section>;
}

const productScreens = [
  { src: 'dates-mobile.jpg', label: 'Date night', detail: 'Proposals, online ideas, and the plans waiting for an answer.', kind: 'tall' },
  { src: 'memories-mobile.jpg', label: 'Our pages', detail: 'A searchable timeline, with room for the photo and the detail you’d forget.', kind: 'tall' },
  { src: 'recap-mobile.jpg', label: 'The recap', detail: 'A year in review, built from the memories and dates in your space.', kind: 'tall' },
  { src: 'memories-desktop.jpg', label: 'Our pages', detail: 'A searchable timeline, with room for the photo and the detail you’d forget.', kind: 'wide' },
] as const;

export function ProductGallery({ compact = false }: { compact?: boolean }) {
  const base = import.meta.env.BASE_URL;
  return <section className={`product-gallery${compact ? ' product-gallery-compact' : ''}`} aria-labelledby="product-gallery-title">
    <div className="product-gallery-heading">
      <div><p className="eyebrow">Inside Couple Dates</p><h2 id="product-gallery-title" className="font-display">A real look at your shared space.</h2></div>
      <p>These are actual app screens with illustrative demo details. Your space is private to the two people in it.</p>
    </div>
    <div className="product-screen-grid">
      {productScreens.map((screen) => <figure className={`product-screen product-screen-${screen.kind}`} key={screen.src}>
        <div className="product-screen-image"><img src={`${base}product-shots/${screen.src}`} alt={`${screen.label} screen in Couple Dates`} loading="lazy" /></div>
        <figcaption><span className="font-display">{screen.label}</span><span>{screen.detail}</span></figcaption>
      </figure>)}
    </div>
    <p className="product-demo-note">Names, dates, totals, and saved moments shown are illustrative demo data—not a real couple’s account.</p>
  </section>;
}
