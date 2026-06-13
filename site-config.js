/**
 * ╔══════════════════════════════════════════════════════════════════╗
 * ║                    LUCID  —  SITE CONFIG                        ║
 * ║                                                                  ║
 * ║  Edit anything below. No coding knowledge needed.               ║
 * ║  After saving, refresh the page to see your changes.            ║
 * ║                                                                  ║
 * ║  IMAGES: put new image files in the "images/" folder, then      ║
 * ║  update the path below (e.g. "images/my-new-icon.png").         ║
 * ║                                                                  ║
 * ║  LINKS: paste the full URL, including https://                  ║
 * ╚══════════════════════════════════════════════════════════════════╝
 */

var SITE_CONFIG = {

  /* ──────────────────────────────────────────────
     PAGE META
     Controls the browser tab title and theme colour
  ────────────────────────────────────────────── */
  meta: {
    title:      "Lucid: Dream Journal & Lucid Dreaming",
    themeColor: "#0d0b1e",                   // browser chrome colour on mobile
  },

  /* ──────────────────────────────────────────────
     IMAGES
     Paths are relative to index.html
  ────────────────────────────────────────────── */
  images: {
    appIcon:          "images/icon.png",     // nav logo + hero icon + footer icon
    screenshotHome:   "images/homepage.png",
    screenshotJournal:"images/journal.png",
    screenshotAnalytics:"images/analytics.png",
    screenshotReality:"images/reality_checks.png",
    screenshotWidget: "images/widget.png",
  },

  /* ──────────────────────────────────────────────
     LINKS
  ────────────────────────────────────────────── */
  links: {
    downloadApk:    "https://github.com/oneironautdev/Lucid/releases/latest",
    github:         "https://github.com/oneironautdev/Lucid",
    buyMeCoffee:    "https://buymeacoffee.com/oneironautdev",
    contactEmail:   "mailto:lucidapp.contact@gmail.com",
  },

  /* ──────────────────────────────────────────────
     NAVBAR
  ────────────────────────────────────────────── */
  nav: {
    appName: "Lucid",                        // text next to the logo icon

    links: [
      { label: "About",      anchor: "#about"       },
      { label: "The App",    anchor: "#screenshots" },
      { label: "Roadmap",    anchor: "#next"        },
      { label: "FAQ",        anchor: "#faq"         },
      { label: "Download",   anchor: "#download"    },
    ],

    ctaSupport:  "Support",                  // right-side support button label
    ctaDownload: "Download APK",             // right-side download button label
  },

  /* ──────────────────────────────────────────────
     HERO SECTION
  ────────────────────────────────────────────── */
  hero: {
    badge: "Free · Open Source · Android",  // small pill above the app name

    appName: "Lucid",                        // big app name under the icon

    // Headline — use \n for a new line, wrap an <accent> word with [brackets]
    // Example: "Remember dreams.\nSpot patterns.\n[Go lucid.]"
    tagline: "Remember dreams.\nSpot patterns.\n[Go lucid.]",

    subtext: "A free, private dream journal and lucid dreaming companion for Android. No account. No subscription. Just you and your dreams.",

    ctaPrimary: "Download APK",
    ctaSupport: "Buy me a coffee",
    ctaSecondary: "See the app ↓",

    trustItems: [
      "No account needed",
      "Local only · 100% private",
      "Open source",
    ],
  },

  /* ──────────────────────────────────────────────
     ABOUT SECTION
  ────────────────────────────────────────────── */
  about: {
    sectionLabel: "Why it exists",
    heading: "Built for one person. Adapted for others.",
    body: "I got into lucid dreaming a while ago, and I never really used any apps and didn't even check if one already existed. I wanted to make a simple app for myself to log my dreams and help me get better at lucid dreaming. I eventually thought that I could share it with other people from the community in case it could be useful for them too. I ended up trying to make the app easier to use for people other than myself, and released it publicly for anyone to use. It is still built and maintained by one person, but I hope it helps.",
    chips: [
      "Free forever",
      "Open source",
      "Local only",
      "Android",
      "No account",
    ],
  },

  /* ──────────────────────────────────────────────
     APP SHOWCASE (the scrolling phone section)
  ────────────────────────────────────────────── */
  showcase: {
    sectionLabel: "The app",
    heading: "What it actually looks like.",
    subtext: "Dark by default. Everything is tuned to work when you've just woken up and are trying to hold onto a dream before it slips away.",

    // Each panel corresponds to one phone screenshot (in order)
    panels: [
      {
        tag:   "Home",
        title: "Your streak, front and centre.",
        body:  "The home screen shows your logging streak, the last couple of dreams you logged, and one insight pulled from your data. The streak description changes the longer it runs — past a certain point it gets weirdly specific about how many nights that actually is.",
      },
      {
        tag:   "Journal",
        title: "Log it before it fades.",
        body:  "Dreams go fast. The log screen is built to get out of your way — title, description, vividness, mood, tags, done. You can search by title, description, or tag, and filter between all dreams and lucid ones specifically.",
      },
      {
        tag:   "Analytics",
        title: "See what's actually working.",
        body:  "Charts and stats built from your own logs. Recall over time, vividness trends, WBTB nights vs normal ones, a 49-day consistency grid. The data is yours so the patterns actually mean something to you, not just generic averages.",
      },
      {
        tag:   "Reality Checks",
        title: "Build the habit that gets you there.",
        body:  "Eight techniques with step-by-step instructions and a presence rating after each one — because tapping through without actually doing the check doesn't really count. Your daily total and streak are tracked separately from your dream streak.",
      },
      {
        tag:   "WBTB Widget",
        title: "Wake at the right time without opening your phone.",
        body:  "The widget lives on your home screen. Arm it before bed, it wakes you after the hours you set, you stay up for a bit, then go back to sleep. That's when the good dreams happen. The alarm logs automatically so you can see in analytics whether WBTB is actually doing anything for you.",
      },
    ],
  },

  /* ──────────────────────────────────────────────
     ROADMAP SECTION
  ────────────────────────────────────────────── */
  roadmap: {
    sectionLabel: "What's next",
    heading: "Potential features.",
    subtext: "A dev note, not a promise.",

    cards: [
      {
        num:   "01",
        title: "Dream counter stepper",
        body:  "Planning to make it easier to log multiple dreams from the same night. Instead of a single log button, there would be a stepper option to increase the number of dreams for that night to avoid friction.",
      },
      {
        num:   "02",
        title: "WBTB preset modes",
        body:  "Currently, the widget is rather customizable but that also means you would have to set up more things, I am considering adding some presets you can choose from and use. You would be able to tweak them if you like.",
      },
      {
        num:   "03",
        title: "Exporting specific dreams",
        body:  "An option to export or copy a single dream as text, to make it easier to share your specific dreams with friends or to keep individual dreams yourself.",
      },
      {
        num:   "04",
        title: "Biometric app lock",
        body:  "The app lock is currently just a PIN, but I am considering adding a way to unlock it through biometrics, mainly fingerprint. This would make it very seamless to open the app while still keeping it protected.",
      },
    ],

    // ── Further out ────────────────────────────────────────
    // Same format as the roadmap cards above. Add, remove, or reorder freely.
    maybeNeverLabel:   "Further out",
    maybeNeverHeading: "Further back in the queue.",
    maybeNeverSubtext: "Things that the app could use but might take some time or not happen at all.",

    maybeNeverCards: [
      {
        title: "AI dream interpretation",
        body:  "I am exploring the idea of adding an option to add an external API key and have a feature that summarizes your dream logs for you. It would need to be a minority feature so that people that don't have it, don't feel like they are missing out on something essential.",
      },
      {
        title: "An iOS version",
        body:  "It would be great to have the app on iOS too, but as of now, this is a one-person project and implementing it on iOS would require a Mac and a paid developer account. This is a relatively higher barrier compared to getting it on the Play Store, so it would depend on the level of interest and support from the community.",
      },
      {
        title: "Audio recording",
        body:  "The ability to be able to just talk and have the app transcribe it into a dream entry, this would be a great way to reduce friction even further and make it easier to log dreams as soon as you wake up.",
      },
      {
        title: "Visualized dream calendar",
        body:  "A feature where users could see their dreams laid out on a calendar view, and to click on each day to see that day's details and dream logs. This would make it a much easier way to navigate through your dream history without having to scroll or search through a long list of entries.",
      },
    ],
  },

  /* ──────────────────────────────────────────────
     FAQ SECTION
     Add, remove, or reorder questions freely.
  ────────────────────────────────────────────── */
  faq: {
    sectionLabel: "Questions",
    heading: "FAQ",

    items: [
      {
        q: "What is a lucid dream?",
        a: "A lucid dream is when you become aware that you are dreaming while it is happening. You stay asleep but you are conscious. Some people can take control of what happens. It sounds rare, but it is genuinely a skill you can build with practice.",
      },
      {
        q: "What is a reality check?",
        a: "A reality check is a habit you practice while awake to question whether you are dreaming. Over time that habit carries into your sleep, and when you do a check inside a dream, you can become aware that you are dreaming.",
      },
      {
        q: "What is WBTB?",
        a: "Wake Back To Bed. You set an alarm to wake yourself after four to six hours of sleep, stay awake briefly, then go back to sleep. This puts you straight into the REM-heavy later sleep cycles, which dramatically increases your odds of having a lucid dream.",
      },
      {
        q: "Is Lucid actually free?",
        a: "Yes, completely. No ads, no subscription, no locked features. If the app helps you and you want to support development there is a Buy Me a Coffee link, but it will always be free regardless.",
      },
      {
        q: "Is my data private?",
        a: "Your dreams, journal entries, settings, and PIN are stored locally on your phone, there are no accounts and no automatic sync. Lucid can send a small amount of anonymous usage data (like whether you logged a dream today) to help me understand how the app is used and improve it, this never includes dream content or anything that could identify you. It's on by default and you can turn it off anytime in Settings → Privacy, or during the intro.",
      },
      {
        q: "Why do my notifications stop after a week?",
        a: "Lucid schedules seven days of notifications at a time. They refresh when you open Settings and tap Save. If they stop arriving, just open the app and save your settings again.",
      },
      {
        q: "How does the streak work?",
        a: "Your streak counts how many days in a row you have logged something, whether that is a full dream or just a no-memory entry. Missing a day resets the count to zero, but all your logs and insights stay exactly where they are.",
      },
      {
        q: "Why is the app Android only?",
        a: "Lucid is built and maintained by one person. iOS development requires a Mac and an annual Apple Developer account. If there is enough interest and support over time, iOS could happen eventually.",
      },
      {
        q: "Can I lock the app with a PIN?",
        a: "Yes. Go to Settings and turn on App Lock. You set a 4 to 6 digit PIN and the app will ask for it every time you open it. To remove it, just toggle it off in the same place.",
      },
      {
        q: "Can I back up my data?",
        a: "Yes. Go to Settings, then Data, and tap Export. It saves all your dreams and reality checks as a JSON file you can share anywhere. To restore it on a new phone, tap Import and pick the file.",
      },
      {
        q: "Does it work without internet?",
        a: "Yes, the app works fully offline. When connected, it makes a couple of optional network calls, a version check on startup, and anonymous usage stats if that's enabled (Settings → Privacy), but nothing else needs the internet and the app works fine without it.",
      },
      {
        q: "What does the WBTB widget track?",
        a: "Every time the alarm fires, it logs the time you armed it, when the alarm was set for, and when it actually went off. That history shows up in your analytics so you can see how often you used WBTB and whether it affected your recall.",
      },
    ],
  },

  /* ──────────────────────────────────────────────
     FOOTER
  ────────────────────────────────────────────── */
  footer: {
    appName:   "Lucid",
    copyright: "Built by one person. Free forever.",

    links: [
      { label: "Download",        key: "downloadApk",  icon: "download" },
      { label: "GitHub",          key: "github",       icon: "github"   },
      { label: "Contact",         key: "contactEmail", icon: "email"    },
      { label: "Buy me a coffee", key: "buyMeCoffee",  icon: "coffee"   },
    ],
  },

};
/* ── end of config — do not edit below this line ── */
