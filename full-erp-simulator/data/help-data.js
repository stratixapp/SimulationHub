/* =============================================================================
   DOT ERP
   FILE:  data/help-data.js
   ROLE:  Static FAQ knowledge base for Module 9 (Help Center).

   Unlike users.js or dashboard-data.js, this isn't randomly generated —
   it's reference content, so it's just a plain array. helpfulYes/helpfulNo
   are seed counts (as if other trainees had already voted); the current
   user's own vote is layered on top in localStorage by help.js, the same
   "seed + override" pattern used for the user directory.
   ========================================================================== */

const ERP_HELP_FAQS = [
  // --- Getting Started ---------------------------------------------------
  {
    id: "FAQ-01", category: "getting-started",
    question: "What is Dot ERP?",
    answer: "A single system for sales, purchasing, inventory, finance, HR and projects, so every department reads and writes the same records instead of keeping separate spreadsheets. Everything runs in this browser: there's no cloud account, and your company's data stays on this device unless you back it up yourself.",
    helpfulYes: 41, helpfulNo: 2
  },
  {
    id: "FAQ-02", category: "getting-started",
    question: "How do I sign in?",
    answer: "Use the username and password an administrator created for you. If you don't have an account yet, ask your administrator to add you in User & Role Management — they'll give you a temporary password, and you'll be asked to set your own the first time you sign in.",
    helpfulYes: 37, helpfulNo: 1
  },
  {
    id: "FAQ-03", category: "getting-started",
    question: "What does \"Soon\" next to a sidebar item mean?",
    answer: "That module hasn't been built yet. Clicking it shows a toast explaining that, instead of doing nothing — it's a placeholder for the roadmap, not a broken link.",
    helpfulYes: 29, helpfulNo: 0
  },
  {
    id: "FAQ-04", category: "getting-started",
    question: "Where should I start if I'm new here?",
    answer: "Sign in, look at the Dashboard for an overview, then open the Help Guide (the button in the bottom-right corner of most pages) on each module — it explains the real-world business process behind what you're looking at, not just the UI.",
    helpfulYes: 33, helpfulNo: 1
  },

  // --- Account & Security --------------------------------------------------
  {
    id: "FAQ-05", category: "account-security",
    question: "How do I change my password?",
    answer: "Go to My Profile → Security → Change Password. You'll need your current password, and the new one can't be the same as the old one. It takes effect immediately — sign out and back in to confirm.",
    helpfulYes: 26, helpfulNo: 0
  },
  {
    id: "FAQ-06", category: "account-security",
    question: "What does \"session timeout\" actually do?",
    answer: "In Settings → Security Preferences, you can choose how many minutes of inactivity (no mouse, keyboard, scroll, or tap) sign you out automatically. It's a real timer, not cosmetic — set it short and step away to see it fire.",
    helpfulYes: 22, helpfulNo: 1
  },
  {
    id: "FAQ-07", category: "account-security",
    question: "Can I use my own photo as my avatar?",
    answer: "Yes — on My Profile, use \"Change photo.\" It's stored locally in your browser as part of your account (under 300 KB), never uploaded anywhere. Use \"Remove photo\" to go back to your initials.",
    helpfulYes: 19, helpfulNo: 0
  },
  {
    id: "FAQ-08", category: "account-security",
    question: "Why did I get signed out automatically?",
    answer: "Most likely your session timeout preference expired after a period of inactivity — Login shows a \"Session timed out\" toast when this happens. You can increase or disable the timeout in Settings.",
    helpfulYes: 18, helpfulNo: 2
  },

  // --- Data & Privacy --------------------------------------------------
  {
    id: "FAQ-09", category: "data-privacy",
    question: "Is any of my data sent to a server?",
    answer: "No. There's no cloud account behind this app — every company record (masters, transactions, your profile, login history, preferences, notifications, tickets) lives entirely in this browser's local storage. Closing the browser doesn't erase it; a different browser or device won't see it unless you restore a backup there.",
    helpfulYes: 31, helpfulNo: 0
  },
  {
    id: "FAQ-10", category: "data-privacy",
    question: "How do I export my data?",
    answer: "Settings → Data & Privacy → \"Export My Data (JSON)\" downloads your profile, preferences, login history and activity as a single file. For the full company database — every module's records — use Company Setup → Backup & Restore.",
    helpfulYes: 15, helpfulNo: 0
  },
  {
    id: "FAQ-11", category: "data-privacy",
    question: "How do I wipe everything and start fresh?",
    answer: "Settings → Data & Privacy → \"Factory Reset.\" This permanently deletes every company record, every user account and this browser's local data, and signs everyone out. It's administrator-only and deliberately behind a strong confirmation, since it can't be undone — back up first if there's any chance you'll want the data again.",
    helpfulYes: 20, helpfulNo: 0
  },
  {
    id: "FAQ-12", category: "data-privacy",
    question: "Why does clearing the Activity Log also clear my Login History?",
    answer: "The Activity Log page presents three underlying logs (Login, Profile, and general System events) merged into one timeline. Its \"Clear Log\" is explicit that it resets all three — it says so in the confirmation before you commit.",
    helpfulYes: 12, helpfulNo: 1
  },

  // --- Modules Guide --------------------------------------------------
  {
    id: "FAQ-13", category: "modules-guide",
    question: "Where can I see my recent sign-ins?",
    answer: "My Profile → Login History shows every attempt tied to your account, or Module 1's own Login page has a full audit log covering every account.",
    helpfulYes: 14, helpfulNo: 0
  },
  {
    id: "FAQ-14", category: "modules-guide",
    question: "Where do I control which notifications I get?",
    answer: "Settings → Notification Preferences has a toggle for each alert category. Turn one off and check the topbar bell — it disappears immediately.",
    helpfulYes: 13, helpfulNo: 0
  },
  {
    id: "FAQ-15", category: "modules-guide",
    question: "Where can I see who did what across the system?",
    answer: "The Activity Log — it's a read-only, append-only timeline by design, so it can be trusted the way a real audit trail should be.",
    helpfulYes: 16, helpfulNo: 0
  },
  {
    id: "FAQ-16", category: "modules-guide",
    question: "How do I change how the app looks?",
    answer: "Either the sun/moon icon in the topbar (cycles Light → Dark → System instantly) or the full Theme Switcher page for a side-by-side comparison first.",
    helpfulYes: 11, helpfulNo: 0
  },

  // --- Troubleshooting --------------------------------------------------
  {
    id: "FAQ-17", category: "troubleshooting",
    question: "My export/download didn't start — what do I do?",
    answer: "Check whether your browser blocked a pop-up or download silently (look for a blocked-icon in the address bar) and allow it for this page, then try the export again.",
    helpfulYes: 9, helpfulNo: 1
  },
  {
    id: "FAQ-18", category: "troubleshooting",
    question: "My theme won't switch to Dark — what's wrong?",
    answer: "If your preference is set to \"System\" it follows your OS setting rather than a manual choice — switch to \"Dark\" directly on the Theme Switcher page or via the topbar toggle to force it.",
    helpfulYes: 8, helpfulNo: 0
  },
  {
    id: "FAQ-19", category: "troubleshooting",
    question: "I tried to create a notification and it was rejected — why?",
    answer: "The Notifications module blocks a new notification if an existing, non-dismissed one already has the exact same title — a duplicate check, working as intended. Change the title slightly and try again.",
    helpfulYes: 7, helpfulNo: 0
  },
  {
    id: "FAQ-20", category: "troubleshooting",
    question: "The print dialog didn't open when I clicked Print — why?",
    answer: "Print opens a new browser window/tab, so a pop-up blocker can silently stop it. Allow pop-ups for this page and click Print again.",
    helpfulYes: 6, helpfulNo: 0
  }
];

const ERP_HELP_QUICK_LINKS = [
  { title: "Login", desc: "Sign in, demo roles, account lockout.", href: "../index.html" },
  { title: "Dashboard", desc: "Daily KPIs, charts and recent activity.", href: "dashboard.html" },
  { title: "My Profile", desc: "Personal info, photo, password, login history.", href: "profile.html" },
  { title: "Settings", desc: "Display, notification and security preferences.", href: "settings.html" },
  { title: "Notifications", desc: "The full notification center.", href: "notifications.html" },
  { title: "Activity Log", desc: "A unified, read-only audit trail.", href: "activity-log.html" },
  { title: "Theme Switcher", desc: "Light, Dark or System appearance.", href: "theme.html" }
];
