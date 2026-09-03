# PRD: Arcade Hub — Supabase, GitHub, dan Tencent EdgeOne Makers

## 1. Ringkasan

Migrasikan Arcade Hub dari arsitektur Vercel + Neon menjadi:

1. GitHub milik Wilda sebagai sumber kode utama.
2. Tencent EdgeOne Makers sebagai hosting frontend dan serverless API.
3. Supabase sebagai database PostgreSQL.
4. Deployment otomatis setiap ada push ke branch produksi GitHub.

Situs harus mempertahankan semua fitur yang saat ini tersedia: kalkulator poin dari profil publik Google Cloud Skills Boost, leaderboard, guild, feedback, keluar dari leaderboard, refresh profil, katalog, hadiah, info, dan halaman statis lainnya.

## 2. Kondisi proyek saat ini

- Sumber awal: `https://github.com/ravi-arnan/arcadehub-id`.
- Stack: React 18, Vite 6, React Router, Vercel Serverless Functions, Neon PostgreSQL.
- Branch sumber: `main`.
- Build command: `npm run build`.
- Output frontend: `dist`.
- Unit test: `npm test` (134 test pada versi awal).
- API saat ini berada di `api/` dan memakai format Vercel `handler(req, res)`.
- Database saat ini diakses melalui `@neondatabase/serverless` pada `lib/db.js`.
- Konfigurasi Vercel berada di `vercel.json`.
- Cron saat ini memanggil `/api/refresh-all` setiap hari pukul 22.00 UTC.

Personalisasi yang sudah diterapkan:

- Fasilitator: `WILDA ARIFFATUL FAISALNUR`.
- Kode referral: `GCAF26-ID-FCV-U99`.
- Link daftar: `https://bit.ly/GoogleSkills26`.
- Grup WhatsApp: `https://chat.whatsapp.com/Cbbe9EzpMfSBDwBcwe0a70?mode=gi_t`.
- Signature pengumuman: `W`.

File personalisasi:

- `src/config.js`
- `src/pages/Info.jsx`
- `src/components/Footer.jsx`

## 3. Sasaran produk

- Pengguna dapat memasukkan profil publik Google Cloud Skills Boost dan melihat perhitungan poin.
- Hasil perhitungan dapat tersimpan dan muncul pada leaderboard Supabase.
- Pengguna dapat keluar dari leaderboard memakai token kepemilikan yang sudah ada.
- Guild, feedback, refresh manual, dan refresh massal tetap bekerja.
- Halaman dapat dibuka langsung melalui URL seperti `/points`, `/catalog`, dan `/leaderboard` tanpa 404.
- Push ke branch produksi GitHub otomatis memicu build dan deployment EdgeOne.
- Tidak ada secret Supabase, admin, cron, atau Resend yang masuk Git.

## 4. Bukan sasaran

- Mengubah sistem perhitungan poin, katalog badge, milestone, atau aturan leaderboard.
- Menghapus atribusi, lisensi MIT, atau kredit pembuat repo asal.
- Menambahkan AI/Codex sebagai contributor.
- Menjalankan migrasi yang menghapus data tanpa konfirmasi.
- Mengubah desain secara besar-besaran.

## 5. Arsitektur target

```text
Pengguna
   |
   v
Tencent EdgeOne Makers
   |-- frontend React/Vite (dist)
   |-- /api/* melalui Cloud Functions Node.js
   |
   v
Supabase REST/API
   |
   v
Supabase PostgreSQL

GitHub main --push--> EdgeOne automatic deployment
GitHub Actions/Scheduler --daily--> /api/refresh-all
```

Gunakan Supabase melalui API HTTPS dengan `@supabase/supabase-js` atau implementasi REST yang setara. Jangan mengandalkan koneksi TCP PostgreSQL apabila runtime EdgeOne tidak menjaminnya. `SUPABASE_SERVICE_ROLE_KEY` hanya boleh digunakan di serverless function dan tidak boleh memakai prefix `VITE_`.

## 6. Kebutuhan database Supabase

Buat migration SQL yang idempotent, misalnya di `supabase/migrations/`, untuk tabel berikut:

### `members`

- `id text primary key`
- `guild text not null default 'UMUM'`
- `name text not null`
- `profile_url text not null unique`
- `games integer not null default 0`
- `skills integer not null default 0`
- `facil_games integer not null default 0`
- `facil_skills integer not null default 0`
- `base integer not null default 0`
- `mbonus integer not null default 0`
- `total integer not null default 0`
- `tier_idx integer not null default -1`
- `last_earned date`
- `avatar text`
- `remove_token text`
- `last_synced timestamptz not null default now()`

### `point_history`

- `member_id text not null references members(id) on delete cascade`
- `day date not null`
- `total integer not null default 0`
- `games integer not null default 0`
- `skills integer not null default 0`
- Primary key gabungan `(member_id, day)`.

### `rate_limits`

- `k text primary key`
- `cnt integer not null default 0`
- `ts timestamptz not null default now()`

### `feedback`

- `id text primary key`
- `message text not null`
- `name text`
- `page text`
- `created_at timestamptz not null default now()`

Aktifkan RLS pada seluruh tabel. Jangan buat policy publik untuk data sensitif. Semua operasi aplikasi harus melalui Cloud Functions dengan service-role key. Pastikan `remove_token`, isi feedback, dan tabel rate limit tidak dapat dibaca langsung oleh browser.

## 7. Kebutuhan API

Pertahankan kontrak endpoint frontend agar perubahan UI minimal:

- `POST /api/join`
- `POST /api/leave`
- `POST /api/remove`
- `GET /api/leaderboard`
- `POST /api/refresh`
- `GET/POST /api/refresh-all` sesuai kebutuhan cron/admin
- `GET/POST /api/feedback`

Konversikan handler Vercel ke format Cloud Functions yang resmi dan terbaru untuk Tencent EdgeOne Makers. Handler harus menerima `context`, membaca `context.request`/environment variables, dan mengembalikan objek `Response` apabila itu format yang diwajibkan platform.

Persyaratan perilaku:

- Status HTTP dan bentuk JSON tetap kompatibel dengan frontend.
- Validasi URL profil dan perlindungan SSRF pada `lib/fetchProfile.js` tetap dipertahankan.
- Redirect profil hanya boleh menuju host Google yang sudah diizinkan.
- Rate limit tetap tersimpan secara atomik. Jika perlu, buat Supabase RPC PostgreSQL untuk operasi increment rate limit agar tidak terkena race condition.
- Upsert `members` berdasarkan `profile_url` harus tetap bekerja.
- `remove_token` hanya dikembalikan saat pendaftaran pertama.
- Pengurutan leaderboard tetap: total menurun, `last_earned` menaik dengan null terakhir, skills menurun, nama menaik.
- Header cache leaderboard tetap masuk akal pada EdgeOne.
- Endpoint admin tetap dilindungi `ADMIN_KEY`.
- Refresh massal tetap dilindungi `CRON_SECRET`/`ADMIN_KEY`.
- Resend tetap opsional dan tidak boleh menggagalkan penyimpanan feedback.

## 8. Environment variables

Dokumentasikan pada `.env.example`, tanpa nilai asli:

```env
SUPABASE_URL=
SUPABASE_SERVICE_ROLE_KEY=
ADMIN_KEY=
CRON_SECRET=
RESEND_API_KEY=
FEEDBACK_EMAIL=
FEEDBACK_FROM=
GUILD_CODE=GCAF26-ID-FCV-U99
```

Jika cron memakai GitHub Actions, simpan secret berikut pada GitHub Actions Secrets:

```text
APP_BASE_URL
CRON_SECRET
```

Jangan pernah mencetak service-role key ke log, memasukkannya ke screenshot, commit, frontend bundle, atau variabel `VITE_*`.

## 9. Konfigurasi EdgeOne Makers

Buat konfigurasi resmi EdgeOne, misalnya `edgeone.json`, berdasarkan dokumentasi platform terbaru.

Kebutuhan minimum:

- Node.js 20 atau versi LTS yang didukung.
- Build command `npm run build`.
- Static output `dist`.
- Routing `/api/*` harus menuju Cloud Functions sebelum SPA fallback.
- SPA fallback `/* -> /index.html`.
- Pertahankan security headers dari `vercel.json` sejauh didukung.
- Cache jangka panjang untuk `/assets/*`, `/img/*`, dan font `.woff2`.
- Jangan menghapus `vercel.json` sebelum deployment EdgeOne terbukti bekerja; file tersebut boleh dipertahankan sebagai referensi/fallback.

## 10. GitHub dan deployment otomatis

- Buat atau gunakan repository milik akun GitHub Wilda.
- Disarankan nama repo: `arcadehub-id` apabila tersedia.
- Jadikan repo milik Wilda sebagai remote `origin`.
- Pertahankan repo Ravi sebagai remote `upstream` untuk mengambil pembaruan sumber pada masa depan.
- Production branch: `main`.
- Hubungkan repo dan branch `main` ke EdgeOne Makers melalui dashboard.
- Aktifkan automatic deployment saat push.
- Pastikan preview deployment untuk branch/PR tidak memakai secret production bila platform memungkinkan pemisahan environment.

Jangan push sebelum pengguna memberi konfirmasi terakhir, sesuai `AGENTS.md`. Jangan force-push dan jangan rewrite history.

## 11. Cron harian

Apabila EdgeOne tidak menyediakan scheduler yang cocok, buat GitHub Actions workflow terjadwal:

- Jadwal: `0 22 * * *` (22.00 UTC / 05.00 WIB hari berikutnya).
- Mendukung `workflow_dispatch` untuk pengujian manual.
- Memanggil `${APP_BASE_URL}/api/refresh-all`.
- Mengirim `Authorization: Bearer ${CRON_SECRET}`.
- Gagal bila respons HTTP bukan 2xx.
- Jangan menyimpan URL rahasia atau secret langsung dalam YAML.

## 12. Pengujian dan quality gate

Sebelum commit:

1. Jalankan `npm test`; seluruh test harus lulus.
2. Jalankan `npm run build`; build harus sukses.
3. Tambahkan test untuk adapter request/response EdgeOne dan database Supabase.
4. Uji endpoint dengan environment development/test, bukan database production.
5. Jalankan `git diff --check`.
6. Tinjau `git diff` dan pastikan hanya file relevan berubah.
7. Pastikan tidak ada secret dengan pencarian sebelum commit.
8. Gunakan Conventional Commit berbahasa Indonesia.

Commit yang disarankan:

```text
feat(deploy): migrasi Supabase dan EdgeOne Makers
```

Jangan menambahkan footer `Co-Authored-By` atau `Generated with ...`.

## 13. Acceptance criteria

Pekerjaan dianggap selesai jika:

- Personalisasi Wilda tetap tampil dan semua tautan benar.
- Database Supabase dan seluruh tabel berhasil dibuat.
- RLS aktif dan tabel tidak dapat diakses memakai anon key tanpa policy.
- Kalkulator berhasil membaca profil publik dan menyimpan skor.
- Leaderboard/guild menampilkan data Supabase.
- Keluar leaderboard menghapus member dan riwayat melalui cascade.
- Feedback tersimpan.
- Refresh manual dan massal bekerja.
- Deep link frontend tidak menghasilkan 404.
- Push percobaan ke branch yang disetujui memicu deployment EdgeOne otomatis.
- Deployment selesai tanpa secret di log atau frontend bundle.
- Test dan build lulus.
- Repo asli tetap tercatat sebagai `upstream` dan atribusi MIT tidak dihapus.

## 14. Urutan pelaksanaan GPT Cloud

1. Baca `AGENTS.md` sepenuhnya.
2. Periksa branch, remotes, status Git, serta perubahan yang sudah ada.
3. Jangan menimpa personalisasi Wilda.
4. Buat project Supabase di region terdekat pengguna Indonesia, setelah meminta konfirmasi nama project dan region.
5. Terapkan migration SQL menggunakan SQL Editor atau CLI resmi.
6. Refactor lapisan database dan API secara lokal.
7. Tambahkan konfigurasi EdgeOne serta cron fallback.
8. Jalankan test/build dan perbaiki seluruh kegagalan.
9. Buat repository GitHub Wilda atau pilih repo yang ditentukan pengguna.
10. Buat commit lokal.
11. Tampilkan ringkasan diff dan minta konfirmasi sebelum push.
12. Setelah disetujui, push ke GitHub.
13. Hubungkan GitHub ke EdgeOne Makers, isi environment variables melalui dashboard, dan deploy.
14. Jalankan smoke test production untuk semua acceptance criteria.

## 15. Laporan akhir yang diwajibkan

Laporan akhir harus menyebutkan:

- URL repository GitHub.
- URL deployment EdgeOne.
- Supabase project yang digunakan tanpa mengekspos secret.
- Daftar file utama yang berubah.
- Hasil test dan build.
- Hasil smoke test endpoint.
- Secret/environment variable yang masih perlu diisi pengguna.
- Risiko atau pekerjaan lanjutan yang belum selesai.
