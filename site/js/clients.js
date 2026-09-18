/* Beeviro portfolio — client data.
 *
 * EDITORIAL RULE, applied to every record below:
 *   `outcome.kind === 'result'` means the figure is published in the
 *   client-approved portfolio document. `outcome.kind === 'goal'` means the
 *   strategy set that target and we are NOT claiming it was hit. Never
 *   promote a goal to a result without a source.
 *
 * REDACTION RULE: nothing here contains competitor names or teardowns,
 * internal media budgets, unpublished projections, phone numbers or personal
 * handles. Those live in the strategy decks and stay there.
 */

window.BV_STAGES = [
  { key: 'contact',  label: 'First contact', hint: 'How the brand arrived, and the state it arrived in.' },
  { key: 'diagnose', label: 'Diagnosis',     hint: 'Market, competitors and audience, read before anything is made.' },
  { key: 'position', label: 'Positioning',   hint: 'The single claim the brand would own.' },
  { key: 'build',    label: 'Build',         hint: 'What was actually produced.' },
  { key: 'launch',   label: 'Launch',        hint: 'Where it went live and how it was run.' },
  { key: 'outcome',  label: 'Outcome',       hint: 'What came back.' },
];

/* DISPLAY ORDER, by slug.
 *
 * The work grid shows six cards before "Show more work", so the first six here
 * are the whole of what a visitor sees without scrolling — which is why the
 * client specifies them and not the other nineteen. Revenue Lab 360 leads on
 * their instruction: a prospect who opens it by chance sees the work that went
 * into it.
 *
 * The array below stays grouped however is convenient for editing; this decides
 * what renders. A slug missing from this list is not an error — it sorts after
 * everything listed, keeping its relative position, so adding a client without
 * touching this list still works. */
window.BV_ORDER = [
  'revenuelab360', 'cognistar', 'master-craft', 'tamahwour', 'speakup', 'kinetic-health',
  'izar', 'freestyle', 'qr-tably', 'kirin', 'volt-ems', 'dr-eman', 'rojana',
  'black-star', 'daily-box', 'edara-plus', 'eqbal', 'moaafa', 'renda-perfumes',
  'rinos-kitchen', 'electro-master', 'moamen-medhat', 'hadeel-maqlad',
  'dar-al-hadith', 'sheikh-hosney',
];

window.BV_CLIENTS = [
  {
    slug: 'izar', name: 'Izar', accent: '#2dd4a8', year: '2025',
    industry: 'Menswear / E-commerce', country: 'Egypt', site: 'izarwear.com',
    services: ['Media Buying', 'Content Strategy', 'Creative Production', 'Performance Analysis'],
    tagline: 'Sell the fabric, not the discount.',
    summary: 'Izar makes high-quality gabardine trousers for men. The category competes on price by default. We built the case for competing on cloth, colour-fastness, fit and finish instead — then put real money behind the creative that proved it.',
    journey: {
      contact: 'A single-product menswear brand with a working web store, a decent ad account and almost no visual identity — one platform, one product, and a market where everyone discounts.',
      diagnose: 'We mapped the target buyer into three age bands (25–34, 35–44, 45–54) with distinct triggers, then audited the competitive set. The finding that shaped everything: almost nobody in the category actually shows the fabric. Few show stitching. Few publish a fit guide. Quality was being claimed, never demonstrated.',
      position: 'Compete on proof, not price. Four claims the brand would own and evidence on camera: heavy gabardine that lasts, premium tailoring detail, guaranteed colour-fastness, and a fit that works on every body.',
      build: 'A visual content system built to demonstrate rather than assert — close-ups on stitching and detail, a stretch test, a colour-fastness-after-wash video, real models across different body types for a genuine fit guide, and comparison content against generic market product. Plus packaging: an insert card carrying a discount code for the next order and a link back for feedback.',
      launch: 'Paid social weighted to the best-performing creative, with campaign structure and KPIs reviewed monthly. Spend was consolidated into the winning campaign rather than spread evenly, and creative was cut to 10–15 second ads on a fixed beat: Look → Fit → Details → Lifestyle.',
      outcome: 'Over a three-month window the account returned more than 809 purchases and approximately EGP 1.15M in revenue, with the best campaigns running at a return on ad spend between 9 and 13.2.',
    },
    outcome: { kind: 'result', headline: '809+ purchases · ~EGP 1.15M · ROAS 9–13.2' },
    metrics: [
      { v: '809+', l: 'Purchases', note: 'Website purchases attributed over the three-month reporting window.' },
      { v: '~EGP 1.15M', l: 'Revenue', note: 'Conversion value across the same three months.' },
      { v: '9–13.2', l: 'ROAS', note: 'Range across the top-performing campaigns; the single best returned 13.2.' },
      { v: '~830K', l: 'Reach', note: 'People reached across the three-month period.' },
    ],
    film: { src: 'assets/hero/reels/izar.webm', note: "Cloth, stitching and fit shown rather than claimed — the argument the whole case rests on." },
    work: 9,
  },

  {
    slug: 'speakup', name: 'SpeakUp English Training', accent: '#4c8dff', year: '2025',
    industry: 'Education', country: 'Egypt',
    services: ['Media Buying', 'Web & Funnel', 'Content Marketing', 'Strategy & SWOT'],
    tagline: 'An EGP 8,000 test that paid for itself seven times over.',
    summary: 'An online English academy for kids, adults and teachers. Strong offer, weak presence. We built the whole path — not just the ads — from attracting the right person to converting them into a paying student.',
    journey: {
      contact: 'A real product with genuine differentiators — daily speaking practice, accredited certificates, a money-back guarantee, job support for teachers — and a social presence that was barely active, with inconsistent branding and few comments or likes.',
      diagnose: 'We broke the audience into three commercial segments and sized them: parents of 6–14s (~65%), adults 18–45 (~30–35%), and English teachers (~5–10%), each with its own persona, pain points and search behaviour. A competitive review showed the brand was behind on posting rhythm, design consistency and engagement, despite a stronger underlying offer.',
      position: 'Lead with the guarantees nobody else would make. The refund promise and the accredited certificate went from buried detail to the front of the message.',
      build: 'A conversion-focused website and sales funnel, a full design system for social, and a content plan structured in three tiers — engagement content to grow the audience, client-generation content to warm it, and sales content to close.',
      launch: 'Media buying weighted by segment priority — parents first, then adults, then teachers — running against a documented funnel: Awareness → Interest → Decision → Action → Loyalty, supported by a customer lifecycle plan covering follow-up, retention and referral.',
      outcome: 'More than EGP 60,000 in revenue generated from an EGP 8,000 advertising budget.',
    },
    outcome: { kind: 'result', headline: 'EGP 8,000 in → EGP 60,000+ out' },
    metrics: [
      { v: 'EGP 60,000+', l: 'Revenue', note: 'Published figure for revenue generated by the campaign.' },
      { v: 'EGP 8,000', l: 'Ad budget', note: 'The advertising spend that produced it.' },
      { v: '7.5×', l: 'Return', note: 'Revenue divided by advertising budget, from the two published figures.' },
      { v: '3', l: 'Audience segments', note: 'Parents, adult learners and teachers — each with its own funnel and creative.' },
    ],
    work: 8,
  },

  {
    slug: 'freestyle', name: 'Freestyle', accent: '#ff5c3c', year: '2025',
    industry: 'Fashion / Streetwear', country: 'Egypt',
    services: ['Organic Content', 'TikTok Strategy', 'Creative Production', 'Media Buying'],
    tagline: 'One video did more than the whole ad account.',
    summary: 'A local cotton T-shirt brand with a sports edge. We went after organic reach on TikTok rather than buying attention — then converted the attention into a complete sell-out.',
    journey: {
      contact: 'A small streetwear label with a drop to sell, a modest budget, and no meaningful organic traction.',
      diagnose: 'We read what actually travels on Egyptian TikTok in this category, and it was not product photography. It was football identity — club rivalry, matchday feeling, the argument in the comments.',
      position: 'Stop advertising T-shirts. Start posting football culture that happens to be wearing them.',
      build: 'A high-volume reel and design output built for shareability rather than polish — club-coded creative, rivalry hooks, and lifestyle shots using real customers rather than models.',
      launch: '31 videos over the campaign window, supported by a modest Meta campaign running to messaging conversations rather than link clicks — the cheaper action for a brand selling by DM.',
      outcome: '232,036 TikTok views across the run, with a single video reaching 192,349 of them, and the drop sold out completely.',
    },
    outcome: { kind: 'result', headline: '232K views · one video at 192K · drop sold out' },
    metrics: [
      { v: '232,036', l: 'TikTok views', note: 'Total views across 31 videos in the reporting period.' },
      { v: '192,349', l: 'Best single video', note: 'One club-rivalry video carried the majority of the reach on its own.' },
      { v: '8,392', l: 'Likes', note: 'Plus 978 comments and 367 shares across the run.' },
      { v: 'Sold out', l: 'The drop', note: 'The entire product drop cleared — the reach converted into real demand.' },
    ],
    campaign: {
      title: 'Meta Ads · Aug–Sep 2025',
      note: 'Read off the campaign report. Spend figures and the client’s order line are withheld.',
      rows: [
        ['Impressions', '22,837'], ['Reach', '20,202'],
        ['Link clicks', '139'], ['Messaging conversations', '53'],
        ['CTR (link)', '0.61%'], ['Frequency', '1.13'],
      ],
      split: 'Instagram carried the reach (18,289) against Facebook’s 1,584 — so budget followed it.',
    },
    // A real deliverable, not a still of one. media() resolves this to the full
    // 420px file; the hero comb takes the 288px copy through thumb().
    film: { src: 'assets/hero/reels/freestyle.webm', note: "A club-rivalry cut from the TikTok run — the format that carried 232K views." },
    work: 8,
  },

  {
    slug: 'cognistar', name: 'CogniStar', accent: '#8b5cf6', year: '2026',
    industry: 'Education', country: 'Saudi Arabia · UAE · Qatar · Egypt',
    services: ['Go-to-Market Strategy', 'Creative Production', 'Reels', 'Funnel Design'],
    tagline: 'One subject, done properly.',
    summary: 'An IGCSE English growth partner for British Curriculum students across the Gulf. We built a go-to-market strategy that positioned narrowness as the advantage.',
    journey: {
      contact: 'A tutoring platform with 24 active students, real academic results, and a market full of generalist tutors claiming everything.',
      diagnose: 'We identified four differentiators the brand actually had and competitors mostly did not: exclusive IGCSE English specialisation, small-group learning, continuous parent visibility, and measurable academic progress.',
      position: 'The specialist, not the tutor. Measurable academic outcomes as the centre of the marketing message rather than a footnote.',
      build: 'A complete customer journey — Awareness, Interest, Comparison, Experience, Conversion, Loyalty — plus a design system and a reel library built around parent testimonials and student success stories.',
      launch: 'Multi-channel: Meta Ads, Google Search and a structured referral programme, with social proof doing the heavy lifting at the comparison stage.',
      outcome: 'The strategy was built to take CogniStar from 24 to 100 active students within 90 days and generate 300–400 qualified leads from target parents.',
    },
    outcome: { kind: 'goal', headline: 'Built to scale 24 → 100 active students in 90 days' },
    metrics: [
      { v: '24 → 100', l: 'Student target', note: 'The growth target the go-to-market strategy was designed around, over 90 days.' },
      { v: '300–400', l: 'Qualified leads', note: 'Target volume of qualified parent leads over the same window.' },
      { v: '4', l: 'Markets', note: 'Saudi Arabia, the UAE, Qatar and Egypt.' },
      { v: '6', l: 'Journey stages', note: 'Awareness, Interest, Comparison, Experience, Conversion, Loyalty — each with its own content.' },
    ],
    testimonial: true,
    film: { src: 'assets/hero/reels/cognistar.webm', note: "From the reel library built around tutors and student progress — the specialist, on camera." },
    work: 8,
  },

  {
    slug: 'kinetic-health', name: 'Kinetic Health', accent: '#36d6e7', year: '2026',
    industry: 'Healthcare', country: 'Egypt',
    services: ['Positioning', 'Lead Generation', 'Landing Pages', 'Content Strategy', 'Event Coverage'],
    tagline: 'We Speak Science.',
    summary: 'A New Cairo clinic specialising in evidence-based post-operative and orthopedic rehabilitation. The job was to stop it being compared to general physiotherapy.',
    journey: {
      contact: 'A genuinely specialist clinic being shopped against general physio centres, which meant competing on price for patients who were not its best fit.',
      diagnose: 'The core problem was not awareness, it was category. Without program-specific entry points, the clinic attracted enquiries outside its ideal segment and burned capacity qualifying them.',
      position: '“We Speak Science” — an evidence-led clinic for complex and post-surgical cases, deliberately not a general physiotherapy provider.',
      build: 'Dedicated landing pages per programme — knee, shoulder, spine — each with qualifying questions on the lead form (surgery type, surgery date, insurance, area) so unsuitable leads filtered themselves out early. Supported by doctor-led video, patient stories, team credentials and surgeon collaborations.',
      launch: 'Separate lead campaigns per rehabilitation programme rather than one clinic campaign, with a tracking system for qualifying leads and converting them into assessments and treatment programmes.',
      outcome: 'The system targets 40–50% of leads qualified and 60–70% of qualified leads booked, lifting capacity utilisation from about 25 patients a day toward 43–57.',
    },
    outcome: { kind: 'goal', headline: 'Built to lift utilisation from ~25/day to 43–57/day' },
    metrics: [
      { v: '3', l: 'Programme funnels', note: 'Knee, shoulder and spine — each with its own landing page, creative and lead form.' },
      { v: '40–50%', l: 'Lead qualification target', note: 'Share of leads expected to meet the persona and clinical criteria.' },
      { v: '60–70%', l: 'Booking target', note: 'Share of qualified leads expected to book an assessment.' },
      { v: '25 → 43–57', l: 'Daily capacity target', note: 'Patients per day, from current utilisation toward 60–80% of capacity.' },
    ],
    // A real deliverable, not a still of one. media() resolves this to the full
    // 420px file; the hero comb takes the 288px copy through thumb().
    film: { src: 'assets/hero/reels/kinetic-health.webm', note: "Doctor-led video: the evidence-first tone the whole position rests on." },
    work: 8,
  },

  {
    slug: 'qr-tably', name: 'QR Tably', accent: '#3ddc84', year: '2025',
    industry: 'SaaS / Hospitality', country: 'Egypt',
    services: ['Full Marketing Strategy', 'Funnel Design', 'Creative Production', 'UGC', 'Reels'],
    tagline: 'A marketing foundation built from zero.',
    summary: 'A digital platform that gives restaurants, cafés and hotels digital menus, ordering, reservations and delivery. We built the entire marketing function from the ground up.',
    journey: {
      contact: 'A product ready to sell into a category that did not yet know it needed one, with no marketing foundation underneath it.',
      diagnose: 'Market analysis and buyer personas across cafés, restaurants and the wider hospitality sector — the operator who wants fewer mistakes, the owner who wants lower cost, the venue that wants to look modern.',
      position: 'Not a QR code — a more professional digital dining experience, sold on ease of use and cost-effectiveness.',
      build: 'A full marketing funnel covering Awareness, Interest, Decision, Action and Loyalty, with a multi-channel content strategy, a design system, reels, and UGC shot for TikTok.',
      launch: 'Meta, TikTok, Google and YouTube, each mapped to a specific funnel stage rather than posting the same asset everywhere.',
      outcome: 'A scalable marketing foundation designed to launch QR Tably and position it competitively in Egypt’s growing digital dining market.',
    },
    outcome: { kind: 'goal', headline: 'A launch-ready foundation for Egypt’s digital dining market' },
    metrics: [
      { v: '4', l: 'Channels', note: 'Meta, TikTok, Google and YouTube, each assigned to a funnel stage.' },
      { v: '5', l: 'Funnel stages', note: 'Awareness → Interest → Decision → Action → Loyalty.' },
      { v: '6', l: 'UGC videos', note: 'Creator-style videos produced and published on TikTok.' },
      { v: '3', l: 'Buyer personas', note: 'Cafés, restaurants and the hospitality sector, each sized and messaged separately.' },
    ],
    film: { src: 'assets/hero/reels/qr-tably.webm', note: "The product demonstrated rather than described — a digital menu only makes sense in motion." },
    work: 8,
  },

  {
    slug: 'tamahwour', name: 'Tamahwour', accent: '#6f7cff', year: '2025',
    industry: 'Brand Identity', country: 'Egypt',
    services: ['Brand Identity', 'Logo System', 'Typography', 'Brand Guidelines'],
    tagline: 'Your honest partner for success.',
    summary: 'A complete visual identity built from the core concept outward — logo system, colour, pattern, iconography and a bilingual typographic system, documented so it holds together everywhere.',
    journey: {
      contact: 'A brand with a promise and a name, and nothing visual to carry either.',
      diagnose: 'The identity had to work in Arabic and English with equal authority — which rules out designing in one and retrofitting the other.',
      position: 'Balance, focus, growth and continuous progress — expressed literally in the mark.',
      build: 'Primary and secondary logos plus a brand icon combining the Arabic “ت” with the English “T” around a circular pivot. A colour system built on Deep Indigo, Midnight Depth and Abyss Blue with Solar Ember as the accent. Patterns, iconography and background treatments. A full Arabic and English typography system.',
      launch: 'Delivered as a documented brand system with usage guidelines, so the identity survives contact with people who did not design it.',
      outcome: 'A complete visual identity reflecting Tamahwour as professional, trustworthy, modern and authentic — built around its promise, “Your honest partner for success.”',
    },
    outcome: { kind: 'result', headline: 'A full bilingual identity system, documented end to end' },
    metrics: [
      { v: '3', l: 'Marks', note: 'Primary logo, secondary logo and brand icon.' },
      { v: '4', l: 'Core colours', note: 'Deep Indigo, Midnight Depth and Abyss Blue, with Solar Ember as accent.' },
      { v: '2', l: 'Scripts', note: 'A typography system covering both Arabic and English.' },
      { v: '80', l: 'Files delivered', note: 'Source artwork, webfonts, presentation and guideline documents.' },
    ],
    testimonial: true,
    work: 12,
  },

  {
    slug: 'revenuelab360', name: 'Revenue Lab 360', accent: '#f5540c', year: '2026',
    industry: 'MarTech / SaaS', country: 'Egypt · UK',
    services: ['Brand Identity', 'Creative Production', 'Reels', 'Event Coverage'],
    tagline: 'Our own product, marketed like a client.',
    summary: 'Revenue Lab 360 is both a Beeviro product and a Beeviro client — an all-in-one revenue platform. We built its brand identity, its creative library and the content around its training programme.',
    journey: {
      contact: 'An internal platform that needed to stand on its own in the market, with the same rigour we would apply to an outside client.',
      diagnose: 'A software brand cannot be sold on aesthetics alone — the creative has to demonstrate the product doing something.',
      position: 'A complete revenue system rather than another tool, with a full logo suite covering every surface it would appear on.',
      build: 'A brand identity kit — full lockups, icon and wordmark variants in black, white, orange, yellow and gradient — plus a library of final designs and two reel series. Live coverage of the Steps training sessions and Career Quest.',
      launch: 'Creative deployed across product launch, retargeting and lifetime-offer campaigns, with demo video as the anchor asset.',
      outcome: 'A full brand system and creative library, with 60 branding files and 32 finished designs delivered.',
    },
    outcome: { kind: 'result', headline: 'Full brand system · 60 branding files · 32 designs' },
    metrics: [
      { v: '60', l: 'Branding files', note: 'Logo suite across lockups, icons and wordmarks in five colourways, plus source artwork.' },
      { v: '32', l: 'Final designs', note: 'Finished campaign and social creative delivered.' },
      { v: '17', l: 'Reels', note: 'Two reel series produced for the platform.' },
      { v: '2', l: 'Events covered', note: 'The Steps training sessions and Career Quest, shot and edited.' },
    ],
    work: 8,
  },

  {
    slug: 'kirin', name: 'Kirin Top Up', accent: '#ffb13c', year: '2025',
    industry: 'Gaming', country: 'Egypt · Saudi Arabia',
    services: ['Brand Identity', 'Strategy', 'Content Strategy', 'Social Design'],
    tagline: 'From a service to a gaming brand.',
    summary: 'A Mobile Legends currency top-up service that lived entirely inside social DMs. We gave it a brand and a funnel.',
    journey: {
      contact: 'A working service with real customers and no brand — entirely dependent on its social presence, with nothing to fall back on if reach dropped.',
      diagnose: 'Market and competitor analysis, then audience segmentation into four groups with genuinely different motives: hardcore gamers, casual gamers, gift buyers, and esports and content creators.',
      position: 'A gaming brand that belongs to the community, speaking in a bold, friendly mix of Arabic and English rather than corporate service language.',
      build: 'A logo and design system, plus a content strategy split three ways: interactive content to attract followers, engagement content to build a community, and sales content to convert it.',
      launch: 'Facebook, Instagram and TikTok, running against a defined funnel from discovery to purchase.',
      outcome: 'The strategy was built to turn a social-media-dependent service into a gaming brand with a scalable digital presence across Egypt and Saudi Arabia.',
    },
    outcome: { kind: 'goal', headline: 'Built to turn a DM service into a scalable gaming brand' },
    metrics: [
      { v: '4', l: 'Audience segments', note: 'Hardcore gamers, casual gamers, gift buyers, and esports and content creators.' },
      { v: '3', l: 'Platforms', note: 'Facebook, Instagram and TikTok.' },
      { v: '2', l: 'Markets', note: 'Egypt and Saudi Arabia.' },
      { v: '3', l: 'Content tiers', note: 'Interactive, engagement and sales content, each with a distinct job.' },
    ],
    work: 7, logo: 'kirin.png',
  },

  {
    slug: 'volt-ems', name: 'Volt EMS', accent: '#ffea00', year: '2025',
    industry: 'Fitness', country: 'Egypt',
    services: ['Strategy & SWOT', 'Content Production', 'Influencer Partnerships', 'BTS'],
    tagline: 'EMS, gym and nutrition in one measurable offer.',
    summary: 'An EMS training studio in New Cairo combining electro-stimulation training, personalised workouts and nutrition. We built the strategy that made that combination the point.',
    journey: {
      contact: 'A fitness business with a genuinely differentiated service in a category where everyone advertises the same transformation photos.',
      diagnose: 'Market, competitor and audience analysis focused on health-conscious individuals, busy professionals and students, and residents of New Cairo — people short on time rather than short on motivation.',
      position: 'The efficient, modern option: EMS plus gym training plus nutrition, with InBody measurement making progress objective.',
      build: 'A content and creative programme — reels, behind-the-scenes shoots and targeted advertising creative — plus influencer partnerships.',
      launch: 'Facebook, Instagram and TikTok, with digital marketing, targeted advertising and creator collaboration running together.',
      outcome: 'The strategy targeted a stronger digital presence, increased reach and customer acquisition, and a scalable foundation for expansion.',
    },
    outcome: { kind: 'goal', headline: 'A growth system built on a measurable differentiator' },
    metrics: [
      { v: '3', l: 'Service pillars', note: 'EMS training, gym training and nutrition, sold as one offer.' },
      { v: '4', l: 'Audience segments', note: 'Health-conscious individuals, busy professionals, students and New Cairo residents.' },
      { v: '17', l: 'Video assets', note: 'Reels and behind-the-scenes material produced.' },
      { v: 'InBody', l: 'Proof mechanism', note: 'Body-composition measurement used to make client progress objective.' },
    ],
    // Video-only deliverables — the gallery is poster frames off the finished reels.
    // Now the reel itself plays above them, which is what workNote was apologising for.
    film: { src: 'assets/hero/reels/volt-ems.webm', note: "The finished reel the gallery below could only show frames of." },
    work: 5, workNote: 'Frames from the finished reels — Volt’s deliverables were video, not static design.',
  },

  {
    slug: 'dr-eman', name: 'Dr. Eman Khamis', accent: '#b39ddb', year: '2025',
    industry: 'Healthcare / Personal Brand', country: 'Egypt',
    services: ['Brand Identity', 'Strategy & SWOT', 'Business Card', 'Digital Strategy'],
    tagline: 'A personal brand built on trust, handled carefully.',
    summary: 'Positioning a psychologist as a trusted provider of online consultations for Arab and expatriate audiences — in a category where tone is the whole product.',
    journey: {
      contact: 'A practising psychologist with clinical credibility and no digital presence to carry it.',
      diagnose: 'Audience segmentation into adolescents and young adults, families and couples, and individuals seeking specialised therapeutic services — each needing a different level of directness.',
      position: 'Professional, transparent and culturally appropriate. In this category the wrong tone does more damage than no marketing at all.',
      build: 'A logo and identity, a business card, and a multi-platform content approach built around her actual differentiators: flexible online and in-clinic consultations, follow-up support, and specialised therapeutic services.',
      launch: 'A multi-platform digital strategy aimed at visibility, engagement and online bookings, with improvements to the booking experience itself.',
      outcome: 'The strategy targeted a strong, trusted personal brand, wider reach among the target audience, and booking growth through a more professional digital presence.',
    },
    outcome: { kind: 'goal', headline: 'A trusted personal brand, built tone-first' },
    metrics: [
      { v: '3', l: 'Audience segments', note: 'Adolescents and young adults, families and couples, and individuals seeking specialised care.' },
      { v: '2', l: 'Consultation modes', note: 'Online and in-clinic, positioned as flexibility rather than compromise.' },
      { v: '3', l: 'Logo variants', note: 'Black, white and primary lockups delivered.' },
      { v: '2', l: 'Audiences by geography', note: 'Arab and expatriate audiences, addressed in the same system.' },
    ],
    work: 0, logo: 'dr-eman.png',
  },

  {
    slug: 'rojana', name: 'Rojana Kids Store', accent: '#ff5ca8', year: '2025',
    industry: 'Kids Fashion / Retail', country: 'Egypt',
    services: ['Brand Identity', 'Strategy', 'Social Design', 'Reels', 'BTS'],
    tagline: 'Turn digital growth into footfall.',
    summary: 'A children’s clothing brand with a physical store. The strategy’s job was to make online engagement show up at the door.',
    journey: {
      contact: 'A children’s clothing retailer active on Facebook, with sales happening in a physical store that the digital activity was not feeding.',
      diagnose: 'Audience analysis put mothers as the primary segment, followed by young women buying children’s gifts — two different purchase motives needing two different messages.',
      position: 'A store worth the trip, not just a page worth following.',
      build: 'A logo suite in six variants, a cover system, social designs, reels and raw behind-the-scenes material.',
      launch: 'Expansion beyond Facebook into Instagram and TikTok, with influencer partnerships, loyalty programmes, promotions and events tying the digital activity back to the shop.',
      outcome: 'The plan targeted increased brand awareness, more customers walking into the physical store, and digital growth converted into tangible business results.',
    },
    outcome: { kind: 'goal', headline: 'Built to convert online engagement into store visits' },
    metrics: [
      { v: '2', l: 'Buyer segments', note: 'Mothers as the primary segment, then young women buying gifts.' },
      { v: '3', l: 'Platforms', note: 'Expanded from Facebook alone into Instagram and TikTok.' },
      { v: '6', l: 'Logo variants', note: 'Black, white, original palette and reversed lockups.' },
      { v: '6', l: 'Reels', note: 'Produced alongside raw behind-the-scenes footage.' },
    ],
    work: 6, logo: 'rojana.png',
  },

  {
    slug: 'black-star', name: 'Black Star', accent: '#c8a24a', year: '2025',
    industry: 'Lighting / Manufacturing', country: 'Saudi Arabia',
    services: ['Marketing Strategy', 'Social Design', 'Reels'],
    tagline: 'Make the product the argument.',
    summary: 'A Saudi manufacturer of decorative lighting and electrical fittings for homes and commercial spaces, sold on how the work looks when it is finished.',
    journey: {
      contact: 'A manufacturer with a strong physical product and a digital presence that did not do it justice.',
      diagnose: 'In decorative lighting the purchase is visual and emotional. The competitive gap was presentation quality, not product quality.',
      position: 'Showcase the work, not the catalogue — lighting as atmosphere rather than as a component.',
      build: 'A marketing strategy plus a design and reel programme built to present products and completed installations attractively.',
      launch: 'Social channels, with content aimed at increasing engagement and reaching a wider customer base in a competitive market.',
      outcome: 'The work targeted a stronger social presence, greater reach among the target audience, and new opportunities to connect with potential clients.',
    },
    outcome: { kind: 'goal', headline: 'Presentation rebuilt to match the product' },
    metrics: [
      { v: '16', l: 'Designs', note: 'Social designs delivered.' },
      { v: '8', l: 'Reels', note: 'Video assets produced for social.' },
      { v: 'KSA', l: 'Market', note: 'Homes and commercial spaces across Saudi Arabia.' },
      { v: '2', l: 'Segments', note: 'Residential and commercial buyers.' },
    ],
    film: { src: 'assets/hero/reels/black-star.webm', note: "A finished installation shown as atmosphere rather than as a catalogue product." },
    work: 8,
  },

  {
    slug: 'daily-box', name: 'Daily Box', accent: '#ff9f1c', year: '2025',
    industry: 'Consumer Products', country: 'Egypt',
    services: ['Positioning', 'Social Design', 'Photoshoot', 'Reels'],
    tagline: 'Not a lunchbox. A solved morning.',
    summary: 'A brand selling practical, stylish solutions for organising children’s meals. The work was mostly a positioning problem.',
    journey: {
      contact: 'A good product being sold on its specifications — compartments, materials, seal quality.',
      diagnose: 'Parents do not buy compartments. They buy time in the morning, and the confidence that what goes in the box gets eaten.',
      position: 'More than a lunchbox — a practical solution that saves parents time, makes balanced meals easier, and builds better eating habits.',
      build: 'A design system translating features into parent-facing benefits, a product photoshoot, and a bazaar activation with its own reel and design set.',
      launch: 'Social content structured around everyday parent problems rather than product specification, supported by live bazaar coverage.',
      outcome: 'A stronger marketing foundation built by connecting the product to the daily needs of parents rather than to its own spec sheet.',
    },
    outcome: { kind: 'goal', headline: 'Repositioned from spec sheet to parent problem' },
    metrics: [
      { v: '13', l: 'Designs', note: 'Social designs translating product features into parent benefits.' },
      { v: '20', l: 'Photoshoot frames', note: 'A dedicated product and lifestyle shoot.' },
      { v: '22', l: 'Bazaar videos', note: 'Live activation coverage.' },
      { v: '4', l: 'Benefit pillars', note: 'Smart compartments, leak-proof design, food freshness and BPA-free materials.' },
    ],
    // A real deliverable, not a still of one. media() resolves this to the full
    // 420px file; the hero comb takes the 288px copy through thumb().
    film: { src: 'assets/hero/reels/daily-box.webm', note: "From the bazaar activation, shot live." },
    work: 11,
  },

  {
    slug: 'edara-plus', name: 'Edara Plus', accent: '#5eead4', year: '2025',
    industry: 'Finance / Investment', country: 'Egypt',
    services: ['Marketing Strategy', 'Social Design', 'Sales Funnel'],
    tagline: 'A startup’s first marketing foundation.',
    summary: 'A micro-investment company in Beni Suef, entering a competitive market from zero.',
    journey: {
      contact: 'A startup with a product, a city, and no marketing presence at all.',
      diagnose: 'In micro-investment the barrier is not interest, it is trust. The audience’s first question is whether their money is safe.',
      position: 'Answer the fear directly. Build awareness on credibility rather than on returns.',
      build: 'A comprehensive marketing strategy, a social design system, and a structured sales funnel designed to attract, build trust with, and qualify potential investors.',
      launch: 'Social content aimed at the target audience, with the funnel handling follow-up via WhatsApp and phone.',
      outcome: 'A scalable marketing foundation intended to help Edara Plus enter the market, establish its presence, and build a pipeline of potential customers from the earliest stage.',
    },
    outcome: { kind: 'goal', headline: 'A market-entry foundation built from zero' },
    metrics: [
      { v: '8', l: 'Designs', note: 'Launch design set for social.' },
      { v: '1', l: 'Sales funnel', note: 'Structured to attract, build trust and qualify.' },
      { v: 'Beni Suef', l: 'Base', note: 'A local micro-investment company entering a competitive national market.' },
      { v: '0 → 1', l: 'Starting point', note: 'The brand had no marketing presence before this engagement.' },
    ],
    work: 7,
  },

  {
    slug: 'master-craft', name: 'MasterCraft Egypt', accent: '#4fc3f7', year: '2026',
    industry: 'Luxury / Marine', country: 'Egypt',
    services: ['Social Media Strategy', 'Content Strategy', 'Creative Production', 'Reels'],
    tagline: 'A digital presence worth the price tag.',
    summary: 'The official dealer of MasterCraft luxury performance boats in Egypt, targeting the A+ segment.',
    journey: {
      contact: 'A luxury dealership whose digital presence did not match the price of what it sells.',
      diagnose: 'The A+ buyer is not one persona. Business owners, families seeking premium experiences, athletes and performance-focused influencers each want a different thing from the same boat.',
      position: 'Luxury, performance and full customisation — a presence that signals the tier before anyone asks the price.',
      build: 'A structured monthly content strategy covering product showcases, customisation options, lifestyle, performance and luxury, with creative tailored to each persona.',
      launch: 'Social content sequenced to move the audience gradually from awareness toward lead generation, consultations and test-drive bookings.',
      outcome: 'The strategy aimed to establish a premium digital presence, introduce the brand and its customisation capability to the Egyptian market, and turn digital interest into qualified sales opportunities.',
    },
    outcome: { kind: 'goal', headline: 'Premium positioning built for a low-volume, high-value sale' },
    metrics: [
      { v: '4', l: 'Personas', note: 'Business owners, families, athletes and performance influencers.' },
      { v: '5', l: 'Content pillars', note: 'Product, customisation, lifestyle, performance and luxury.' },
      { v: '41', l: 'Designs', note: 'Creative assets delivered.' },
      { v: '11', l: 'Videos', note: 'Reels and video content produced.' },
    ],
    film: { src: 'assets/hero/reels/master-craft.webm', note: "Performance on the water — the one thing a photograph of a boat cannot carry." },
    work: 8,
  },

  {
    slug: 'eqbal', name: 'Eqbal', accent: '#7bc950', year: '2025',
    industry: 'F&B / Natural Products', country: 'Egypt',
    services: ['AI-Assisted Creative', 'Rebrand', 'Social Design', 'Reels'],
    tagline: 'AI in the pipeline, craft in the output.',
    summary: 'A manufacturer of natural food, beverage and personal care products. We rebuilt its visual presence using AI tooling inside a human creative process.',
    journey: {
      contact: 'A manufacturer with a genuinely good natural product range and social creative that made it look generic.',
      diagnose: 'Natural products sell on the ingredient. If the ingredient is not visible and appealing, the premium disappears.',
      position: 'Make the raw material the hero — turmeric, charcoal, coffee, shea — each product given its own visual treatment.',
      build: 'AI image generation combined with our creative direction to produce a wide range of designs and videos, refreshing the brand across social.',
      launch: 'Social channels, with the new creative system rolled out across the product range.',
      outcome: 'The transformation targeted increased brand awareness, a stronger digital presence, and growth in demand and sales through more distinctive content.',
    },
    outcome: { kind: 'goal', headline: 'A visual rebrand built with AI-assisted production' },
    metrics: [
      { v: '18', l: 'Designs', note: 'Product-led creative across the range.' },
      { v: '5', l: 'Videos', note: 'Reels produced for social.' },
      { v: '2', l: 'Categories', note: 'Natural F&B alongside cosmetics and personal care.' },
      { v: 'AI + direction', l: 'Method', note: 'Generative tooling used inside a directed creative process, not instead of one.' },
    ],
    // A real deliverable, not a still of one. media() resolves this to the full
    // 420px file; the hero comb takes the 288px copy through thumb().
    film: { src: 'assets/hero/reels/eqbal.webm', note: "Product-led motion from the AI-assisted rebuild." },
    work: 8,
  },

  {
    slug: 'moaafa', name: 'Moafa App', accent: '#22c1c3', year: '2025',
    industry: 'HealthTech', country: 'Egypt',
    services: ['Launch Campaign', 'Character Design', 'App Mockups', 'Social Design'],
    tagline: 'A startup’s first campaign.',
    summary: 'A medical services startup launching its first social campaign and building a digital presence from nothing.',
    journey: {
      contact: 'A pre-launch app with a range of medical services and no market presence.',
      diagnose: 'Medical apps face an explanation problem before they face a marketing one — the audience has to understand what it does before they can want it.',
      position: 'Friendly and legible. A character system to make a clinical product approachable.',
      build: 'A set of creative concepts and visual directions tailored to the app and its audience: a character design system, app store mockups, social designs and promotional videos explaining the services clearly.',
      launch: 'A first social campaign focused on brand awareness and service introduction.',
      outcome: 'The campaign was built to establish brand awareness, introduce the services to the market, and create a social presence from the startup’s earliest stage.',
    },
    outcome: { kind: 'goal', headline: 'A launch identity for a pre-market health app' },
    metrics: [
      { v: '14', l: 'Character designs', note: 'A mascot and character system to make a clinical product approachable.' },
      { v: '8', l: 'App mockups', note: 'Store-ready presentation screens plus icon and banner.' },
      { v: '12', l: 'Social designs', note: 'Service-explainer creative for launch.' },
      { v: '0 → launch', l: 'Starting point', note: 'The app had no digital presence before the campaign.' },
    ],
    work: 16,
  },

  {
    slug: 'renda-perfumes', name: 'Renda Perfumes', accent: '#d4af6a', year: '2025',
    industry: 'Beauty / E-commerce', country: 'Egypt',
    services: ['E-commerce Website', 'Social Design', 'Celebrity UGC', 'Reels'],
    tagline: 'A shop, a feed and a familiar face.',
    summary: 'A local perfume brand given a proper storefront, a stronger feed, and credibility borrowed from someone the audience already trusts.',
    journey: {
      contact: 'A perfume brand selling through social with no structured place to send people.',
      diagnose: 'Fragrance cannot be demonstrated online. It has to be transferred — through people, association and presentation.',
      position: 'A brand with a real shopfront and real faces behind it.',
      build: 'A complete e-commerce website presenting the full range in a structured, visual way, plus a stronger social design system.',
      launch: 'UGC content produced in collaboration with a celebrity partner, giving the products an authentic, relatable presentation and running alongside the new site and feed.',
      outcome: 'Website, social growth and celebrity-driven UGC combined to build a stronger digital presence and more opportunities to reach new customers.',
    },
    outcome: { kind: 'goal', headline: 'Storefront, feed and social proof, built together' },
    metrics: [
      { v: '1', l: 'E-commerce site', note: 'Designed and developed to present the full product range.' },
      { v: '14', l: 'Designs', note: 'Product and campaign creative for social.' },
      { v: '3', l: 'Celebrity UGC videos', note: 'Published as social reels with a celebrity partner.' },
      { v: '3', l: 'Channels', note: 'Website, social feed and UGC working as one system.' },
    ],
    work: 8,
  },

  {
    slug: 'rinos-kitchen', name: 'Rino’s Kitchen', accent: '#ff7043', year: '2025',
    industry: 'F&B / Cloud Kitchen', country: 'Egypt',
    services: ['Marketing Strategy', 'Social Design', 'Reels'],
    tagline: 'A kitchen with no shopfront needs a louder feed.',
    summary: 'A cloud kitchen operating on an order-and-delivery model, where the feed is the only storefront the customer ever sees.',
    journey: {
      contact: 'A delivery-only kitchen whose entire customer-facing presence was social.',
      diagnose: 'With no premises to walk past, brand visibility is the whole acquisition channel — and food has to look worth ordering in a scroll.',
      position: 'Appetite first. Creative built to make the food the argument.',
      build: 'A comprehensive marketing strategy plus creative designs and video content showcasing the food in an appealing, attention-grabbing way.',
      launch: 'Social channels, with content aimed at brand visibility, reaching the right audience and increasing engagement.',
      outcome: 'The approach targeted a stronger social presence and a firmer marketing foundation for growth and reaching more customers.',
    },
    outcome: { kind: 'goal', headline: 'A storefront built entirely out of content' },
    metrics: [
      { v: '13', l: 'Designs', note: 'Menu and campaign creative for social.' },
      { v: '3', l: 'Reels', note: 'Food-led video content.' },
      { v: 'Delivery-only', l: 'Model', note: 'A cloud kitchen with no physical shopfront.' },
      { v: '1', l: 'Storefront', note: 'The social feed is the only storefront customers see.' },
    ],
    // A real deliverable, not a still of one. media() resolves this to the full
    // 420px file; the hero comb takes the 288px copy through thumb().
    film: { src: 'assets/hero/reels/rinos-kitchen.webm', note: "Food-first video — the only storefront a delivery-only kitchen has." },
    work: 8,
  },

  {
    slug: 'electro-master', name: 'Electro Master', accent: '#ffd23f', year: '2025',
    industry: 'Electrical / Home Services', country: 'Egypt',
    services: ['Content Strategy', 'Social Design', 'Before & After Video'],
    tagline: 'Before and after does the selling.',
    summary: 'Residential electrical furnishing and installation, sold on the visible difference between the two states.',
    journey: {
      contact: 'A skilled installation business whose work was invisible once it was finished.',
      diagnose: 'Installation quality is hard to describe and easy to show. The obvious format was being left on the table.',
      position: 'Let the transformation speak — the gap between before and after is the entire pitch.',
      build: 'Creative content, social designs, and before-and-after videos making the quality and impact of the work legible to people with no technical knowledge.',
      launch: 'Social channels, with the before-and-after format as the anchor.',
      outcome: 'The content contributed to social growth and increased engagement, and helped Electro Master reach and acquire new clients through a stronger digital presence.',
    },
    outcome: { kind: 'goal', headline: 'Invisible craft made visible' },
    metrics: [
      { v: '7', l: 'Designs', note: 'Social creative for the installation business.' },
      { v: '3', l: 'Videos', note: 'Before-and-after edits produced.' },
      { v: 'B&A', l: 'Anchor format', note: 'Before-and-after as the primary creative device.' },
      { v: 'Residential', l: 'Segment', note: 'Home electrical furnishing and installation.' },
    ],
    film: { src: 'assets/hero/reels/electro-master.webm', note: "The before-and-after format the whole content plan is anchored on." },
    work: 6,
  },

  {
    slug: 'moamen-medhat', name: 'Moamen Medhat', accent: '#9db8d8', year: '2025',
    industry: 'Legal', country: 'Egypt',
    services: ['Personal Brand', 'Social Design', 'Educational Video', 'Daily Stories'],
    tagline: 'Make the law legible.',
    summary: 'A lawyer specialising in company incorporation, given a digital presence built on explaining rather than advertising.',
    journey: {
      contact: 'A specialist lawyer with expertise and no digital footprint.',
      diagnose: 'Legal services are bought on trust, and trust in this category is built by being useful in public before anyone pays you.',
      position: 'The lawyer who explains it clearly — authority demonstrated through teaching.',
      build: 'A professional digital identity, engaging designs, and educational videos simplifying legal topics for a non-specialist audience.',
      launch: 'A daily Stories strategy to maintain consistent contact with the audience, build engagement, and establish credibility around the personal brand.',
      outcome: 'The approach gave the practice a strong social launch and a digital foundation designed to attract clients seeking company incorporation and legal establishment services.',
    },
    outcome: { kind: 'goal', headline: 'Authority built by teaching in public' },
    metrics: [
      { v: 'Daily', l: 'Stories cadence', note: 'A daily Stories strategy to hold consistent audience contact.' },
      { v: '4', l: 'Designs', note: 'Identity and social creative delivered.' },
      { v: 'Explainer', l: 'Content format', note: 'Educational video simplifying legal topics.' },
      { v: 'Incorporation', l: 'Specialism', note: 'Legal establishment of companies and corporations.' },
    ],
    work: 4,
  },

  {
    slug: 'hadeel-maqlad', name: 'Hadeel Maqlad', accent: '#e0a3b8', year: '2024',
    industry: 'Fashion Design', country: 'Egypt',
    services: ['Signature Logo', 'Social Design', 'Lookbooks', 'Reels'],
    tagline: 'A designer’s name as the mark.',
    summary: 'A fashion designer given a signature identity and a set of lookbooks to carry the collections.',
    journey: {
      contact: 'A designer with collections to present and no consistent visual identity around them.',
      diagnose: 'In designer fashion the name is the brand. The mark had to read as a signature, not a logo.',
      position: 'The signature as identity — personal, hand-drawn, applied consistently.',
      build: 'A signature logo in multiple weights, a large social design set, and per-collection lookbooks delivered as documents.',
      launch: 'Social channels, with reels carrying the collections in motion.',
      outcome: 'A complete identity and content set: signature marks, 23 designs, per-collection lookbooks and 8 reels.',
    },
    outcome: { kind: 'result', headline: 'Signature identity · 23 designs · 8 reels' },
    metrics: [
      { v: '4', l: 'Signature marks', note: 'Signature logo variants delivered.' },
      { v: '23', l: 'Designs', note: 'Social and campaign creative.' },
      { v: '8', l: 'Reels', note: 'Collection films produced.' },
      { v: 'Per-collection', l: 'Lookbooks', note: 'Delivered as documents alongside the social set.' },
    ],
    film: { src: 'assets/hero/reels/hadeel-maqlad.webm', note: "One of the eight collection reels — the pieces in motion rather than laid flat." },
    work: 7, logo: 'hadeel-maqlad.png',
  },

  {
    slug: 'dar-al-hadith', name: 'Dar El Hadith', accent: '#66bb6a', year: '2025',
    industry: 'Education', country: 'Egypt',
    services: ['Promotional Video', 'Content Production'],
    tagline: 'Explaining Al-Azhar to the world.',
    summary: 'An academy providing educational courses for international students of Al-Azhar in Egypt.',
    journey: {
      contact: 'An academy with a specific, valuable offer and an audience scattered across other countries.',
      diagnose: 'The audience is international and researching from a distance — video carries this better than static posts.',
      position: 'Clear, credible, welcoming — services explained rather than advertised.',
      build: 'Promotional video content designed to communicate the academy’s services clearly and show the value of its programmes.',
      launch: 'Social channels, targeting international students interested in studying at Al-Azhar.',
      outcome: 'The video content helped the academy present its services more professionally, strengthen its social presence, and reach a wider audience of potential students.',
    },
    outcome: { kind: 'goal', headline: 'Services made legible to an international audience' },
    metrics: [
      { v: '4', l: 'Videos', note: 'Promotional films produced for the academy.' },
      { v: 'International', l: 'Audience', note: 'Overseas students of Al-Azhar.' },
      { v: 'Video-led', l: 'Format', note: 'Chosen over static content for a distant, researching audience.' },
      { v: 'Al-Azhar', l: 'Context', note: 'Courses for international students at Al-Azhar in Egypt.' },
    ],
    /* work: 0 — the whole engagement was four films, so this dossier had nothing
       to show at all until now. It also has no gallery to borrow a poster from,
       which is why this is the one record that carries its own. */
    film: {
      src: 'assets/hero/reels/dar-al-hadith.webm',
      poster: 'assets/hero/reels/poster/dar-al-hadith.webp',
      note: "One of the four promotional films — which is the entire engagement.",
    },
    work: 0,
  },

  {
    slug: 'sheikh-hosney', name: 'Sheikh Hosney', accent: '#a1887f', year: '2025',
    industry: 'Brand Identity', country: 'Egypt',
    services: ['Logo Design'],
    tagline: 'A mark, delivered properly.',
    summary: 'A focused identity engagement: a logo, delivered in full with source artwork and print-ready files.',
    journey: {
      contact: 'A brand needing a mark, with no wider marketing engagement attached.',
      diagnose: 'A small scope done properly is worth more than a large one done loosely.',
      position: 'One mark, built to work everywhere it would be used.',
      build: 'A logo delivered in multiple formats — raster, transparent and print-ready PDF — with source files.',
      launch: 'Handed over as a complete asset set for the client to deploy.',
      outcome: 'A complete logo package delivered in five files covering screen and print use.',
    },
    outcome: { kind: 'result', headline: 'Complete logo package, screen and print' },
    metrics: [
      { v: '5', l: 'Files delivered', note: 'Raster, transparent and print-ready formats plus source.' },
      { v: '1', l: 'Scope', note: 'A focused identity engagement, no wider retainer.' },
      { v: 'Print + screen', l: 'Coverage', note: 'Formats supplied for both output paths.' },
      { v: 'Source', l: 'Included', note: 'Editable artwork handed over with the finals.' },
    ],
    work: 0, logo: 'sheikh-hosney.png',
  },
];
