import type { ReactNode } from 'react';
import { Link, useLocation } from 'wouter';
import { ArrowRight, Check, Heart, LockKeyhole, MapPin, MessageCircleHeart, Sparkles, Ticket, Users, Video } from 'lucide-react';

const pages = [
  ['/', 'Home'],
  ['/how-it-works', 'How it works'],
  ['/couples-journal', 'Couples journal'],
  ['/long-distance', 'Long-distance dates'],
  ['/pricing', 'Pricing'],
] as const;

export function MarketingNav() {
  const [location] = useLocation();
  return <header className="marketing-nav"><Link href="/" className="brand-mark"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" /><span>Couple Dates<small>a shared space for two</small></span></Link>
    <nav aria-label="Main navigation" className="marketing-links">{pages.map(([href, label]) => <Link key={href} href={href} aria-current={location === href ? 'page' : undefined} className={location === href ? 'is-current' : ''}>{label}</Link>)}</nav>
    <div className="marketing-actions"><Link href="/sign-in" className="nav-signin">Sign in</Link><Link href="/sign-up" className="pill-button">Start your space <ArrowRight size={15} /></Link></div>
  </header>;
}

export function MarketingFooter() {
  return <footer className="marketing-footer"><Link href="/" className="brand-mark"><img src={`${import.meta.env.BASE_URL}logo.svg`} alt="" /><span>Couple Dates<small>a shared space for two</small></span></Link><p>For the girlfriend who wants more dates worth posting.</p><div>{pages.slice(1).map(([href, label]) => <Link key={href} href={href}>{label}</Link>)}<Link href="/at-home-date-ideas">At-home date ideas</Link></div><small>Couple Dates · Free during beta</small></footer>;
}

export function PageIntro({ eyebrow, title, body }: { eyebrow: string; title: ReactNode; body: string }) {
  return <section className="marketing-intro"><p className="eyebrow">{eyebrow}</p><h1 className="font-display">{title}</h1><p>{body}</p></section>;
}

export function HowItWorks() {
  return <main className="marketing-page"><PageIntro eyebrow="For the girlfriend who wants more dates worth posting" title={<>From “we should”<br/>to <em>“remember that?”</em></>} body="Couple Dates turns her next idea into a date both partners choose. Keep the photos and little details in your shared space; share selected memories only when you decide."/>
    <section className="steps-layout"><div className="step-stack">
      {[['01', 'Make one space for two', 'One of you starts it; the other joins by invite. No group to manage and no audience to perform for.'], ['02', 'Suggest it, then decide together', 'Either partner can propose an online or in-person date. The other can accept, pass, or suggest a time that works.'], ['03', 'Keep the part you would forget', 'Afterward, save a photo and a note in your shared timeline. Your space stays private; share a memory only when you choose. Later, your recap brings the year back into view.']].map(([n, title, copy]) => <article className="story-step" key={n}><span>{n}</span><div><h2 className="font-display">{title}</h2><p>{copy}</p></div></article>)}
    </div><aside className="invite-card"><LockKeyhole size={20}/><p className="eyebrow">Just the two of you</p><div className="invite-code">A7K—M2Q</div><p>Illustrative invite code. Your real code is created inside your space and shared with your partner.</p><div className="invite-rule"><Users size={17}/> One shared space. Two people.</div></aside></section>
     <section className="feature-band"><p className="eyebrow">A shared story, without the pressure</p><div className="feature-columns"><article><Heart/><h3 className="font-display">Save the small stuff</h3><p>Add a photo, a note, and the detail you know you will bring up later. Keep it between you, or make a share card for a memory you choose.</p></article><article><Ticket/><h3 className="font-display">Make a plan together</h3><p>Suggest an online or in-person date. Your partner gets a say before it becomes a plan.</p></article><article><Sparkles/><h3 className="font-display">Start with an idea</h3><p>Ask the date assistant for suggestions shaped by your interests and practical details. It offers a starting point; you both decide what happens next.</p></article></div></section>
     <ProductGallery compact/>
     <MarketingCTA/>
  </main>;
}

export function LongDistance() {
  return <main className="marketing-page"><PageIntro eyebrow="When busy schedules and time zones don’t line up" title={<>The same time together,<br/><em>from two places.</em></>} body="For couples in different places—or weeks that never seem to line up—a call doesn’t need to be a production. Choose a low-key online date, agree on a time, and add the call link you already use. Couple Dates keeps the plan and the memory; you choose where the conversation happens."/>
    <section className="distance-feature"><div className="distance-copy"><p className="eyebrow">A plan can travel</p><h2 className="font-display">The app helps you plan. The call is yours.</h2><p>Suggest an online date and add the details that work for you: what to do, when to meet, and a call link if you already have one. Couple Dates doesn’t host video calls.</p><Link href="/sign-up" className="text-link">Make your shared space <ArrowRight size={16}/></Link></div><div className="distance-art"><div className="orbit orbit-one"/><div className="orbit orbit-two"/><div className="distance-center"><MessageCircleHeart size={36}/><span>same moment<br/>different places</span></div><div className="place-dot dot-a"><span>you</span></div><div className="place-dot dot-b"><span>them</span></div><small className="illustrative">An illustrative scene</small></div></section>
    <section className="distance-ideas"><p className="eyebrow">An idea is a good beginning</p><h2 className="font-display">Small rituals, not perfect productions.</h2><div className="idea-list"><article><span>01</span><div><h3>Cook something in parallel</h3><p>Pick a recipe, set a time, and eat together over a call.</p></div><Video/></article><article><span>02</span><div><h3>Trade a playlist and press play</h3><p>Make a shared soundtrack for a quiet evening in.</p></div><Video/></article><article><span>03</span><div><h3>Take the same little walk</h3><p>Choose a route near each of you and compare the details afterward.</p></div><MapPin/></article></div><p className="fine-print">These are illustrative prompts, not services provided by the app. Date ideas are not venue-verified or bookings.</p></section>
    <MarketingCTA/>
  </main>;
}

export function Pricing() {
  return <main className="marketing-page pricing-page"><PageIntro eyebrow="Open beta · free for both partners" title={<>Use the whole space.<br/><em>No checkout in beta.</em></>} body="Invite your partner and try the full flow together. Every Couple Dates feature is free while beta is open; paid plans and checkout are paused."/>
    <section className="beta-card"><div className="beta-copy"><span className="beta-stamp">CURRENT BETA</span><h2 className="font-display">One shared space.<br/>Everything included.</h2><p>Plan dates, save memories, and look back at your year together. No paid plan or checkout needed during beta.</p><Link href="/sign-up" className="pill-button">Start your shared space <ArrowRight size={15}/></Link></div><div className="included-list">{['A private space for exactly two', 'Date proposals, online or in person', 'Date assistant suggestions shaped by your preferences', 'Memories, photos, search & favorites', 'Daily check-ins and yearly recap'].map((x) => <p key={x}><Check size={17}/>{x}</p>)}</div></section>
    <section className="pricing-note"><div><p className="eyebrow">Clear about beta</p><h2 className="font-display">Try the whole story before there’s a price.</h2></div><p>The date assistant has an operating-cost safeguard to keep beta reliable; it is not a paid-plan allowance. We are not setting future prices here. If your space already has a subscription, its billing controls remain separate and unchanged.</p></section>
    <MarketingCTA/>
  </main>;
}

export function MarketingCTA() {
  return <section className="marketing-cta"><div><p className="eyebrow">No special occasion needed</p><h2 className="font-display">Start with the next small thing.</h2></div><Link href="/sign-up" className="pill-button">Start your shared space <ArrowRight size={16}/></Link></section>;
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
     <div><p className="eyebrow">Inside Couple Dates</p><h2 id="product-gallery-title" className="font-display">Plan the date. Keep the memory. Share it on your terms.</h2></div>
      <p>These are real app screens with illustrative details. Your space is private to the two people in it; share only the memory you choose.</p>
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
