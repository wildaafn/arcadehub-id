// Pengumuman admin, muncul sekali per pengunjung saat buka web.
// Cara pakai: ganti `id` tiap bikin pengumuman baru (itu yang bikin modal muncul
// lagi buat semua orang). Set `id: null` kalau lagi tidak ada pengumuman.
// `links` opsional: URL ditulis lengkap di sini (bukan ambil dari CONFIG) karena
// tiap pengumuman bisa menunjuk dokumen yang berbeda.
export const ANNOUNCEMENT = {
  id: '2026-09-15-progres-diperpanjang-29-september',
  date: '15 September 2026',
  title: '📢 Pendaftaran Fasilitator Ditutup — Progres Dihitung Hingga 29 September 2026!',
  body: [
    'Pendaftaran program Google Cloud Arcade Fasilitator 2026 telah resmi ditutup per 14 September 2026.',
    'Kabar baik: Progres player maupun fasilitator masih akan terhitung hingga 29 September 2026 pukul 23.59 WIB.',
    'Bagi peserta yang sudah terdaftar, maksimalkan sisa waktu ini untuk menyelesaikan lab, mengumpulkan badge, dan mengunci tier serta milestone hadiahmu!',
  ],
  links: [
    { label: 'Cek poin saya', href: '/points' },
    { label: 'Lihat katalog badge', href: '/catalog' },
    { label: 'Leaderboard', href: '/leaderboard' },
  ],
  signature: 'W',
}

// Konfigurasi guild fasilitator, ubah di sini kalau ganti kode/link.
export const CONFIG = {
  facilitatorName: 'WILDA ARIFFATUL FAISALNUR',
  referralCode: 'GCAF26-ID-FCV-U99',
  registerUrl: 'https://bit.ly/GoogleSkills26',
  whatsappUrl: 'https://chat.whatsapp.com/Cbbe9EzpMfSBDwBcwe0a70?mode=gi_t',
  regOpen: '13 Juli 2026, 09.00 WIB',
  regClose: '14 September 2026, 23.59 WIB (Ditutup)',
  progressClose: '29 September 2026, 23.59 WIB',
  isRegClosed: true,
  arcadeUrl: 'https://go.cloudskillsboost.google/arcade',
  // Weekly challenge peserta (Dicoding). Short link sengaja dipakai apa adanya:
  // tujuannya bisa berganti tanpa perlu ubah kode.
  wcPlayerUrl: 'https://dicoding.id/Arcade26-WCPlayer',
  wcLeaderboardUrl: 'https://dicoding.id/Arcade26-PlayerLeaderboard',
  catalogUrl: 'https://www.cloudskillsboost.google/catalog',
  profileHelp: 'https://www.cloudskillsboost.google/my_account/profile',
  spamEmail: 'googlecloudedu-noreply@google.com',
  // Bonus Milestone 2026 (+10 poin, bikin AI Agent pertama). Diumumkan 31 Jul 2026.
  bonusForumUrl: 'https://discuss.google.dev/t/arcade-facilitator-2026-bonus-milestone/386412',
  bonusDocUrl: 'https://docs.google.com/document/d/1RjwwiKY0fGyMm9wt5t4exXaA7pM3IU45FBOOPtmgUdo/preview',
  bonusFormUrl: 'https://docs.google.com/forms/d/e/1FAIpQLSdq6-5RPthTa4D_o7xfgM0We_pnFWmj80ByiZfEl9ov1yZ3iw/viewform',
  bonusVerifierEmail: 'arcade-agent-verifier@google.com',
  // Open source
  repoUrl: 'https://github.com/ravi-arnan/arcadehub-id',
  issuesUrl: 'https://github.com/ravi-arnan/arcadehub-id/issues',
  goodFirstIssuesUrl: 'https://github.com/ravi-arnan/arcadehub-id/issues?q=is%3Aissue+is%3Aopen+label%3A%22good+first+issue%22',
  contributingUrl: 'https://github.com/ravi-arnan/arcadehub-id/blob/main/CONTRIBUTING.md',
  addYourselfUrl: 'https://github.com/ravi-arnan/arcadehub-id/edit/main/src/contributors.js',
}
