import { useState, useMemo, useRef } from 'react'
import { parseFacilitatorReport } from '../../lib/parseCsv.js'
import Tip from '../Tip.jsx'

const DEMO_CSV = `Nama Peserta\tEmail Peserta\tNomor HP Peserta\tURL Profil Google Skills\tStatus Google Skills URL Profil\tURL Profil Google Developer\tStatus URL Profil Google Developer\tStatus Redeem Kode Akses\tMilestone yang diraih\tBonus Milestone yang diraih\tStatus Verifikasi AI Agent\tLencana Digital GEAR yang diraih\tJumlah Lencana Keahlian yang diselesaikan\tNama Lencana Keahlian yang diselesaikan\tJumlah Arcade Game yang diselesaikan\tNama Arcade Game yang diselesaikan
Dimas Adjie Wijaya\tadjiedimas170@gmail.com\t6285166854209\thttps://www.skills.google/public_profiles/f588d6d0-e3e7-431f-8a35-8e834a524e8b\tAll Good\thttps://developers.google.com/profile/u/100815074843485258698\tAll Good\tYes\tNone\tNo\tNot yet submitted\tGemini Enterprise Agent Ready\t3\tBadge1\t0\t
Muhammad Mufadhol Afif\tmufadhol@gmail.com\t628123456789\thttps://www.skills.google/public_profiles/24480a54-82f8-48d5-8357-59a150aa8465\tAll Good\thttps://developers.google.com/profile/u/111054617812326045492\tAll Good\tYes\tMilestone 1\tNo\tSubmitted\tGemini Enterprise Agent Ready\t9\tBadge1\t6\tGame1
Zainudin\tzainudin@gmail.com\t628987654321\thttps://www.cloudskillsboost.google/public_profiles/11111111-2222-3333-4444-555555555555\tAll Good\thttps://me.developers.google.com/u/101548904163688193984\tAll Good\tYes\tUltimate Milestone\tYes\tVerified\tGemini Enterprise Agent Ready\t93\tBadge1\t12\tGame1
Rafi Sofyan Triyanto\trafi@gmail.com\t628123123123\thttps://www.skills.google/public_profiles/22222222-3333-4444-5555-666666666666\tAll Good\thttps://developers.google.com/profile/u/222\tAll Good\tYes\tUltimate Milestone\tYes\tVerified\tGemini Enterprise Agent Ready\t92\tBadge1\t12\tGame1
Samuel Linggom\tsamuel@gmail.com\t62877777777\thttps://www.skills.google/public_profiles/c1c6841f-bf59-4df3-a489-e5e21e2ce0f8\tAll Good\thttps://me.developers.google.com/u/109477710490602107492\tAll Good\tYes\tMilestone 2\tNo\tSubmitted\tGemini Enterprise Agent Ready\t30\tBadge1\t8\tGame1
Peserta Belum Mulai\tbelum@gmail.com\t62899999999\thttps://wrong-url.com\tWrong Google Skills URL\thttps://developers.google.com/profile/u/999\tAll Good\tNo\tNone\tNo\tNot yet submitted\t\t0\t\t0\t`

export default function Fasil() {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'paste'
  const [pasteText, setPasteText] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [milestoneFilter, setMilestoneFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [skillsMinFilter, setSkillsMinFilter] = useState('ALL') // 'ALL' | '5+' | '14+' | '28+' | '42+' | '56+'
  const [sortBy, setSortBy] = useState('points') // 'points' | 'skills' | 'games' | 'name'
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [copiedLink, setCopiedLink] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(null)
  const [selectedShareUser, setSelectedShareUser] = useState(null)
  const fileInputRef = useRef(null)

  const handleProcessText = (text) => {
    setError(null)
    const res = parseFacilitatorReport(text)
    if (res.error) {
      setError(res.error)
      setData(null)
    } else {
      setData(res)
    }
  }

  const handleFileUpload = (e) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      handleProcessText(event.target?.result || '')
    }
    reader.readAsText(file)
  }

  const handleDrop = (e) => {
    e.preventDefault()
    const file = e.dataTransfer.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = (event) => {
      handleProcessText(event.target?.result || '')
    }
    reader.readAsText(file)
  }

  const loadDemo = () => {
    handleProcessText(DEMO_CSV)
  }

  const handleReset = () => {
    setData(null)
    setError(null)
    setPasteText('')
    setSearch('')
    setSyncProgress(null)
    setSelectedShareUser(null)
  }

  // Filter & sort
  const filteredParticipants = useMemo(() => {
    if (!data?.participants) return []
    let list = [...data.participants]

    if (search.trim()) {
      const q = search.trim().toLowerCase()
      list = list.filter((p) => p.name.toLowerCase().includes(q))
    }

    if (milestoneFilter !== 'ALL') {
      list = list.filter((p) => p.milestoneKey === milestoneFilter)
    }

    if (statusFilter === 'VALID') {
      list = list.filter((p) => p.isValidUrl)
    } else if (statusFilter === 'INVALID') {
      list = list.filter((p) => !p.isValidUrl)
    }

    if (skillsMinFilter === '5+') {
      list = list.filter((p) => p.skills >= 5)
    } else if (skillsMinFilter === '14+') {
      list = list.filter((p) => p.skills >= 14)
    } else if (skillsMinFilter === '28+') {
      list = list.filter((p) => p.skills >= 28)
    } else if (skillsMinFilter === '42+') {
      list = list.filter((p) => p.skills >= 42)
    } else if (skillsMinFilter === '56+') {
      list = list.filter((p) => p.skills >= 56)
    }

    list.sort((a, b) => {
      if (sortBy === 'skills') return b.skills - a.skills || b.points - a.points
      if (sortBy === 'games') return b.games - a.games || b.points - a.points
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return b.points - a.points || b.skills - a.skills || a.name.localeCompare(b.name)
    })

    return list
  }, [data, search, milestoneFilter, statusFilter, skillsMinFilter, sortBy])

  // Generator Pesan Rekap WhatsApp
  const generateWaBroadcast = () => {
    if (!data?.summary) return ''
    const s = data.summary
    const dateStr = new Date().toLocaleDateString('id-ID', {
      day: 'numeric',
      month: 'long',
      year: 'numeric',
    })

    const top5 = data.participants.slice(0, 5)
    const topList = top5
      .map((p, idx) => `${idx + 1}. *${p.name}* — ${p.points} Poin (${p.games} Game, ${p.skills} Skill)`)
      .join('\n')

    return `📢 *REKAP PROGRES HARIAN GOOGLE CLOUD ARCADE FASILITATOR*
📅 _Update per ${dateStr}_

👥 *Ringkasan Peserta:*
• Total Peserta: *${s.totalParticipants} orang*
• Profil Valid: *${s.validUrlsCount} orang* ✅
• Minimal 5 Skill Badges: *${s.atLeast5SkillsCount} orang* ⭐
• Perlu Perbaikan URL: *${s.invalidUrlsCount} orang* ⚠️

🏆 *Pencapaian Milestone:*
• 👑 Ultimate Milestone: *${s.milestonesCount.ultimate} orang*
• 🥇 Milestone 3: *${s.milestonesCount.m3} orang*
• 🥈 Milestone 2: *${s.milestonesCount.m2} orang*
• 🥉 Milestone 1: *${s.milestonesCount.m1} orang*
• ⏳ Belum Milestone: *${s.milestonesCount.none} orang*

⭐ *Top 5 Peserta Teratas:*
${topList}

━━━━━━━━━━━━━━━━━━━━
💡 _Yuk terus selesaikan lab & game badge-nya! Pantau progres langsung di tracker:_
🔗 https://arcadehub-id.edgeone.dev/leaderboard`
  }

  const copyWaBroadcast = () => {
    const text = generateWaBroadcast()
    navigator.clipboard?.writeText(text).then(() => {
      setCopiedMsg(true)
      setTimeout(() => setCopiedMsg(false), 2500)
    })
  }

  // Cetak / Unduh PDF
  const handlePrintPdf = () => {
    window.print()
  }

  // Sinkronkan ke Leaderboard Komunitas via /api/join
  const handleSyncLeaderboard = async () => {
    if (!data?.participants) return
    const valids = data.participants.filter((p) => p.isValidUrl && p.profileUrl)
    if (valids.length === 0) return

    setSyncing(true)
    setSyncProgress({ current: 0, total: valids.length, success: 0, failed: 0 })

    let success = 0
    let failed = 0

    for (let i = 0; i < valids.length; i++) {
      const p = valids[i]
      setSyncProgress({ current: i + 1, total: valids.length, success, failed })

      try {
        const res = await fetch('/api/join', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            profileUrl: p.profileUrl,
            name: p.name,
            code: 'GCAF26-ID-FCV-U99',
          }),
        })
        if (res.ok) {
          success++
        } else {
          failed++
        }
      } catch {
        failed++
      }
      await new Promise((r) => setTimeout(r, 200))
    }

    setSyncProgress({ current: valids.length, total: valids.length, success, failed, done: true })
    setSyncing(false)
  }

  // Link progres personal untuk peserta
  const getParticipantShareUrl = (profileUrl) => {
    return `https://arcadehub-id.edgeone.dev/points?profile=${encodeURIComponent(profileUrl)}`
  }

  const getParticipantWaMsg = (p) => {
    const shareUrl = getParticipantShareUrl(p.profileUrl)
    return `Halo *${p.name}*! 👋

Berikut rekap progres Google Cloud Arcade Fasilitator kamu:
🏆 *Milestone*: ${p.milestone}
⭐ *Skill Badges*: ${p.skills} badge
🎮 *Arcade Games*: ${p.games} game
📊 *Total Poin*: ${p.points} poin

Pantau live detail badge & target milestone kamu langsung di tracker:
🔗 ${shareUrl}`
  }

  return (
    <div className="fasil-page">
      {/* Header Halaman (Screen) */}
      <div className="fasil-header no-print">
        <span className="fasil-badge">Fitur Khusus Fasilitator</span>
        <h1 className="fasil-title">Rekap Laporan CSV Fasilitator</h1>
        <p className="fasil-sub">
          Olah spreadsheet laporan harian Google Cloud Arcade secara instan untuk rekap progres peserta, analisis milestone guild, dan leaderboard.
        </p>
      </div>

      {/* Header Khusus Print / PDF (Executive Report Branding) */}
      <div className="print-report-header">
        <div className="prh-top">
          <div className="prh-brand">
            <span className="prh-logo">ARCADE HUB</span>
            <span className="prh-sub">Laporan Progres Harian Peserta Google Cloud Arcade</span>
          </div>
          <div className="prh-date">
            {new Date().toLocaleDateString('id-ID', { day: 'numeric', month: 'long', year: 'numeric' })}
          </div>
        </div>
        <div className="prh-meta-chips">
          <div className="prh-chip">Fasilitator: <b>WILDA ARIFFATUL FAISALNUR</b></div>
          <div className="prh-chip">Kode Guild: <b>GCAF26-ID-FCV-U99</b></div>
          <div className="prh-chip">Program: <b>Arcade Fasilitator 2026</b></div>
        </div>
      </div>

      {/* Jaminan Privasi & Tanpa Scraping */}
      <div className="privacy-banner no-print">
        <div className="pb-icon">🔒</div>
        <div className="pb-content">
          <div className="pb-title">Jaminan Privasi &amp; Keamanan Data</div>
          <p className="pb-text">
            File CSV diproses <b>100% secara lokal di browser perangkat Anda</b>. Sistem secara otomatis <b>membuang dan TIDAK menyimpan/menyalin data sensitif</b> (seperti alamat email dan nomor HP peserta). Kami juga <b>tidak melakukan scraping data pribadi</b>. Hanya data publik (nama &amp; progres badge) yang digunakan untuk visualisasi leaderboard.
          </p>
        </div>
      </div>

      {/* Bagian Input / Upload jika data belum dimuat */}
      {!data && (
        <div className="fasil-upload-card no-print">
          <div className="fasil-tabs">
            <button
              className={`fasil-tab ${activeTab === 'upload' ? 'active' : ''}`}
              onClick={() => setActiveTab('upload')}
            >
              📁 Upload File CSV / TSV
            </button>
            <button
              className={`fasil-tab ${activeTab === 'paste' ? 'active' : ''}`}
              onClick={() => setActiveTab('paste')}
            >
              📋 Tempel Data (Copy-Paste)
            </button>
          </div>

          {activeTab === 'upload' ? (
            <div
              className="dropzone"
              onDragOver={(e) => e.preventDefault()}
              onDrop={handleDrop}
              onClick={() => fileInputRef.current?.click()}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,.tsv,.txt"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
              <div className="dz-icon">📊</div>
              <div className="dz-title">Tarik &amp; Lepaskan File CSV Laporan di Sini</div>
              <div className="dz-sub">atau klik untuk memilih file dari komputer (.csv, .tsv, .txt)</div>
              <button className="dz-btn" type="button">
                Pilih File Spreadsheet
              </button>
            </div>
          ) : (
            <div className="paste-zone">
              <label className="pz-label">
                Salin seluruh tabel dari Google Sheets (termasuk baris judul) lalu tempel di bawah ini:
              </label>
              <textarea
                className="pz-textarea"
                rows={8}
                placeholder="Nama Peserta	Email Peserta	Nomor HP Peserta	URL Profil Google Skills	Status Google Skills URL Profil	URL Profil Google Developer..."
                value={pasteText}
                onChange={(e) => setPasteText(e.target.value)}
              />
              <div className="pz-actions">
                <button
                  className="bigcta"
                  disabled={!pasteText.trim()}
                  onClick={() => handleProcessText(pasteText)}
                >
                  Proses Data Peserta ↗
                </button>
              </div>
            </div>
          )}

          {error && <div className="fasil-error">{error}</div>}

          <div className="demo-hint">
            <span>Belum punya file laporan?</span>
            <button className="demo-btn" onClick={loadDemo}>
              Muat Contoh Data Demo
            </button>
          </div>
        </div>
      )}

      {/* Bagian Dashboard jika data telah berhasil dimuat */}
      {data && (
        <div className="fasil-dashboard">
          {/* Ringkasan KPI Cards */}
          <div className="kpi-grid">
            <div className="kpi-card">
              <div className="kpi-label">Total Peserta</div>
              <div className="kpi-val">{data.summary.totalParticipants}</div>
              <div className="kpi-sub">Terdaftar di laporan</div>
            </div>
            <div className="kpi-card success">
              <div className="kpi-label">URL Profil Valid</div>
              <div className="kpi-val">{data.summary.validUrlsCount}</div>
              <div className="kpi-sub">Google Skills All Good ✅</div>
            </div>
            <div className="kpi-card star">
              <div className="kpi-label">Minimal 5 Skill Badge</div>
              <div className="kpi-val">{data.summary.atLeast5SkillsCount}</div>
              <div className="kpi-sub">Peserta aktif (≥5 badge) ⭐</div>
            </div>
            <div className="kpi-card warning">
              <div className="kpi-label">Perlu Perbaikan URL</div>
              <div className="kpi-val">{data.summary.invalidUrlsCount}</div>
              <div className="kpi-sub">Link profil invalid ⚠️</div>
            </div>
            <div className="kpi-card purple">
              <div className="kpi-label">Rata-rata Poin</div>
              <div className="kpi-val">{data.summary.averagePoints}</div>
              <div className="kpi-sub">Poin per anggota</div>
            </div>
          </div>

          {/* Breakdown Milestone */}
          <div className="ms-breakdown-card">
            <div className="mb-title">Distribusi Milestone Peserta</div>
            <div className="mb-grid">
              <div className="mb-item ult">
                <span className="mb-badge">Ultimate</span>
                <span className="mb-num">{data.summary.milestonesCount.ultimate}</span>
              </div>
              <div className="mb-item m3">
                <span className="mb-badge">Milestone 3</span>
                <span className="mb-num">{data.summary.milestonesCount.m3}</span>
              </div>
              <div className="mb-item m2">
                <span className="mb-badge">Milestone 2</span>
                <span className="mb-num">{data.summary.milestonesCount.m2}</span>
              </div>
              <div className="mb-item m1">
                <span className="mb-badge">Milestone 1</span>
                <span className="mb-num">{data.summary.milestonesCount.m1}</span>
              </div>
              <div className="mb-item none">
                <span className="mb-badge">Belum Milestone</span>
                <span className="mb-num">{data.summary.milestonesCount.none}</span>
              </div>
            </div>
          </div>

          {/* Toolbar Aksi Fasilitator */}
          <div className="fasil-toolbar no-print">
            <button className="wa-broadcast-btn" onClick={copyWaBroadcast}>
              {copiedMsg ? '✅ Pesan WhatsApp Tersalin!' : '📋 Salin Rekap Broadcast WhatsApp'}
            </button>
            <button className="pdf-export-btn" onClick={handlePrintPdf} title="Cetak atau simpan laporan ke PDF">
              📄 Cetak / Simpan PDF
            </button>
            <button
              className="sync-btn"
              disabled={syncing}
              onClick={handleSyncLeaderboard}
              title="Masukkan peserta ber-URL valid ke database Leaderboard Komunitas"
            >
              {syncing ? '🔄 Sedang Sinkronisasi...' : '🔄 Sinkronkan ke Leaderboard Komunitas'}
            </button>
            <button className="reset-btn" onClick={handleReset}>
              🗑️ Ganti File CSV
            </button>
          </div>

          {/* Status Progress Sinkronisasi */}
          {syncProgress && (
            <div className="sync-status-box no-print">
              <div className="ss-title">
                {syncProgress.done ? '✅ Sinkronisasi Selesai!' : '🔄 Sedang Mengirim Data ke Leaderboard...'}
              </div>
              <div className="ss-bar-wrap">
                <div
                  className="ss-bar"
                  style={{
                    width: `${Math.round((syncProgress.current / syncProgress.total) * 100)}%`,
                  }}
                />
              </div>
              <div className="ss-text">
                Progres: {syncProgress.current} dari {syncProgress.total} peserta ({syncProgress.success} berhasil, {syncProgress.failed} gagal)
              </div>
            </div>
          )}

          {/* Filter & Pencarian Tabel */}
          <div className="fasil-filter-card no-print">
            <div className="ff-row">
              <div className="ff-search">
                <input
                  type="text"
                  placeholder="Cari nama peserta..."
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                />
                {search && <button onClick={() => setSearch('')}>✕</button>}
              </div>
              <div className="ff-sort">
                <label>Urutkan:</label>
                <select value={sortBy} onChange={(e) => setSortBy(e.target.value)}>
                  <option value="points">Poin Tertinggi</option>
                  <option value="skills">Skill Badge Terbanyak</option>
                  <option value="games">Arcade Game Terbanyak</option>
                  <option value="name">Nama (A-Z)</option>
                </select>
              </div>
            </div>

            {/* Filter Minimal Skill Badges */}
            <div className="ff-chips">
              <span className="ff-chip-label">Filter Skill Badges:</span>
              {[
                ['ALL', 'Semua'],
                ['5+', '⭐ Minimal 5 Skill Badge'],
                ['14+', 'Minimal 14 Skill (M1)'],
                ['28+', 'Minimal 28 Skill (M2)'],
                ['42+', 'Minimal 42 Skill (M3)'],
                ['56+', 'Minimal 56 Skill (Ultimate)'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`chip-btn ${skillsMinFilter === key ? 'active special' : ''}`}
                  onClick={() => setSkillsMinFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ff-chips">
              <span className="ff-chip-label">Milestone:</span>
              {[
                ['ALL', 'Semua'],
                ['ultimate', 'Ultimate'],
                ['m3', 'Milestone 3'],
                ['m2', 'Milestone 2'],
                ['m1', 'Milestone 1'],
                ['none', 'Belum Ada'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`chip-btn ${milestoneFilter === key ? 'active' : ''}`}
                  onClick={() => setMilestoneFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>

            <div className="ff-chips">
              <span className="ff-chip-label">Status Profil:</span>
              {[
                ['ALL', 'Semua'],
                ['VALID', 'Hanya Valid (All Good)'],
                ['INVALID', 'Hanya Perlu Koreksi URL'],
              ].map(([key, label]) => (
                <button
                  key={key}
                  className={`chip-btn ${statusFilter === key ? 'active' : ''}`}
                  onClick={() => setStatusFilter(key)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>

          {/* Tabel Leaderboard Peserta CSV */}
          <div className="fasil-table-wrap">
            <div className="ft-header-info">
              Menampilkan <b>{filteredParticipants.length}</b> dari {data.participants.length} peserta
              {skillsMinFilter === '5+' && ' (difilter: minimal 5 skill badge)'}
            </div>

            <table className="fasil-table">
              <thead>
                <tr>
                  <th style={{ width: '64px', textAlign: 'center' }}>#</th>
                  <th>Nama Peserta</th>
                  <th>Milestone</th>
                  <th>Game</th>
                  <th>Skill</th>
                  <th>Poin</th>
                  <th>Status URL</th>
                  <th style={{ textAlign: 'center' }} className="no-print">Aksi / Share</th>
                </tr>
              </thead>
              <tbody>
                {filteredParticipants.length === 0 ? (
                  <tr>
                    <td colSpan={8} className="ft-empty">
                      Tidak ada peserta yang cocok dengan filter pencarian.
                    </td>
                  </tr>
                ) : (
                  filteredParticipants.map((p) => (
                    <tr key={p.id} className={!p.isValidUrl ? 'row-invalid' : ''}>
                      {/* Kolom Nomor / Rank - 100% Selalu Tampil Jelas */}
                      <td className="ft-rank" style={{ textAlign: 'center' }}>
                        <span className={`ft-rank-badge ${p.rank <= 3 ? `top-${p.rank}` : ''}`}>
                          {p.rank === 1 ? '🥇 1' : p.rank === 2 ? '🥈 2' : p.rank === 3 ? '🥉 3' : p.rank}
                        </span>
                      </td>
                      <td className="ft-name">
                        <span className="ft-name-text">{p.name}</span>
                        <div style={{ display: 'flex', gap: '4px', flexWrap: 'wrap', marginTop: '2px' }}>
                          {p.skills >= 5 && <span className="skill-5-badge">⭐ 5+ Skill</span>}
                          {p.bonusMilestone && <span className="ai-bonus-badge">AI Agent +10</span>}
                        </div>
                      </td>
                      <td>
                        <span className={`fasil-ms-tag ${p.milestoneKey}`}>{p.milestone}</span>
                      </td>
                      <td className="ft-num">{p.games}</td>
                      <td className="ft-num">
                        <b style={{ color: p.skills >= 5 ? 'var(--gold)' : 'inherit' }}>{p.skills}</b>
                      </td>
                      <td className="ft-points">
                        <b>{p.points}</b>
                      </td>
                      <td>
                        {p.isValidUrl ? (
                          <span className="status-badge ok">All Good</span>
                        ) : (
                          <span className="status-badge warn" title={p.urlStatus}>
                            Perlu Perbaikan URL
                          </span>
                        )}
                      </td>
                      <td style={{ textAlign: 'center' }} className="no-print">
                        <div style={{ display: 'inline-flex', gap: '6px', alignItems: 'center' }}>
                          {p.profileUrl && (
                            <button
                              className="share-row-btn"
                              onClick={() => setSelectedShareUser(p)}
                              title={`Bagikan progres untuk ${p.name}`}
                            >
                              🔗 Share
                            </button>
                          )}
                          {p.profileUrl && (
                            <Tip label="Buka Profil Public Google Skills">
                              <a
                                className="viewlink"
                                href={p.profileUrl}
                                target="_blank"
                                rel="noreferrer"
                              >
                                ↗
                              </a>
                            </Tip>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Modal Dialog Share Progres Peserta */}
      {selectedShareUser && (
        <div className="modal-overlay" onClick={() => setSelectedShareUser(null)}>
          <div className="modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="mc-head">
              <div className="mc-title">Bagikan Progres Peserta</div>
              <button className="mc-close" onClick={() => setSelectedShareUser(null)}>✕</button>
            </div>

            <div className="mc-body">
              {/* Kartu Progres Mini Peserta */}
              <div className="share-preview-card">
                <div className="spc-rank">Peringkat #{selectedShareUser.rank}</div>
                <div className="spc-name">{selectedShareUser.name}</div>
                <div className="spc-milestone">
                  <span className={`fasil-ms-tag ${selectedShareUser.milestoneKey}`}>
                    {selectedShareUser.milestone}
                  </span>
                </div>
                <div className="spc-stats">
                  <div className="spc-stat">
                    <span className="spc-stat-label">Total Poin</span>
                    <span className="spc-stat-val gold">{selectedShareUser.points}</span>
                  </div>
                  <div className="spc-stat">
                    <span className="spc-stat-label">Skill Badges</span>
                    <span className="spc-stat-val">{selectedShareUser.skills}</span>
                  </div>
                  <div className="spc-stat">
                    <span className="spc-stat-label">Arcade Games</span>
                    <span className="spc-stat-val">{selectedShareUser.games}</span>
                  </div>
                </div>
              </div>

              {/* Link Share Progres Peserta */}
              <div className="mc-section">
                <label className="mc-label">🔗 Link Langsung Tracker Peserta:</label>
                <div className="mc-link-box">
                  <input
                    type="text"
                    readOnly
                    value={getParticipantShareUrl(selectedShareUser.profileUrl)}
                    className="mc-link-input"
                  />
                  <button
                    className="mc-copy-btn"
                    onClick={() => {
                      navigator.clipboard.writeText(getParticipantShareUrl(selectedShareUser.profileUrl))
                      setCopiedLink(true)
                      setTimeout(() => setCopiedLink(false), 2000)
                    }}
                  >
                    {copiedLink ? '✅ Tersalin' : 'Salin Link'}
                  </button>
                </div>
                <p className="mc-hint">
                  Ketika peserta membuka link ini, tracker otomatis menghitung dan menampilkan progres live badge miliknya!
                </p>
              </div>

              {/* Pesan Broadcast WhatsApp Personal */}
              <div className="mc-section">
                <label className="mc-label">💬 Pesan WhatsApp Siap Kirim:</label>
                <textarea
                  readOnly
                  rows={6}
                  className="mc-textarea"
                  value={getParticipantWaMsg(selectedShareUser)}
                />
                <div style={{ display: 'flex', gap: '8px', marginTop: '8px' }}>
                  <button
                    className="wa-broadcast-btn"
                    style={{ padding: '8px 14px', fontSize: '12.5px' }}
                    onClick={() => {
                      navigator.clipboard.writeText(getParticipantWaMsg(selectedShareUser))
                      setCopiedMsg(true)
                      setTimeout(() => setCopiedMsg(false), 2000)
                    }}
                  >
                    {copiedMsg ? '✅ Pesan WhatsApp Tersalin!' : '📋 Salin Pesan WhatsApp'}
                  </button>
                  <a
                    className="sync-btn"
                    style={{ padding: '8px 14px', fontSize: '12.5px', textDecoration: 'none' }}
                    href={`https://api.whatsapp.com/send?text=${encodeURIComponent(getParticipantWaMsg(selectedShareUser))}`}
                    target="_blank"
                    rel="noreferrer"
                  >
                    Kirim via WhatsApp ↗
                  </a>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
