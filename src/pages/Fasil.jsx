import { useState, useMemo, useRef } from 'react'
import { parseFacilitatorReport } from '../../lib/parseCsv.js'
import { MS } from '../points.js'
import Tip from '../Tip.jsx'
import Medal from '../Medal.jsx'
import { IconGamepad, IconTrophy, IconTarget, IconAward, IconAlert, IconCrown } from '../icons.jsx'

const DEMO_CSV = `Nama Peserta\tEmail Peserta\tNomor HP Peserta\tURL Profil Google Skills\tStatus Google Skills URL Profil\tMilestone yang diraih\tBonus Milestone yang diraih\tJumlah Lencana Keahlian yang diselesaikan\tJumlah Arcade Game yang diselesaikan
Muhammad Mufadhol Afif\tmufadhol@example.com\t08123456789\thttps://www.skills.google/public_profiles/24480a54-82f8-48d5-8357-59a150aa8465\tAll Good\tMilestone 1\tNo\t9\t6
Ahmad Rizki Pratama\tahmad.rizki@example.com\t08219876543\thttps://www.cloudskillsboost.google/public_profiles/11111111-2222-3333-4444-555555555555\tAll Good\tUltimate Milestone\tYes\t56\t12
Siti Nurhaliza\tsiti.nur@example.com\t08571234567\thttps://www.skills.google/public_profiles/33333333-4444-5555-6666-777777777777\tAll Good\tMilestone 3\tYes\t44\t10
Budi Santoso\tbudi.s@example.com\t08198765432\thttps://www.skills.google/public_profiles/44444444-5555-6666-7777-888888888888\tAll Good\tMilestone 2\tNo\t30\t8
Dewi Anggraini\tdewi.a@example.com\t08381234567\thttps://www.cloudskillsboost.google/public_profiles/55555555-6666-7777-8888-999999999999\tAll Good\tMilestone 1\tNo\t16\t6
Fajar Nugraha\tfajar.n@example.com\t08139876543\thttps://invalid-link-profil.com\tWrong Google Skills URL\tNone\tNo\t4\t2`

export default function Fasil() {
  const [activeTab, setActiveTab] = useState('upload') // 'upload' | 'paste'
  const [pasteText, setPasteText] = useState('')
  const [data, setData] = useState(null)
  const [error, setError] = useState(null)
  const [search, setSearch] = useState('')
  const [milestoneFilter, setMilestoneFilter] = useState('ALL')
  const [statusFilter, setStatusFilter] = useState('ALL')
  const [sortBy, setSortBy] = useState('points') // 'points' | 'skills' | 'games' | 'name'
  const [copiedMsg, setCopiedMsg] = useState(false)
  const [syncing, setSyncing] = useState(false)
  const [syncProgress, setSyncProgress] = useState(null)
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

    list.sort((a, b) => {
      if (sortBy === 'skills') return b.skills - a.skills || b.points - a.points
      if (sortBy === 'games') return b.games - a.games || b.points - a.points
      if (sortBy === 'name') return a.name.localeCompare(b.name)
      return b.points - a.points || b.skills - a.skills || a.name.localeCompare(b.name)
    })

    return list
  }, [data, search, milestoneFilter, statusFilter, sortBy])

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
      // Beri jeda kecil agar tidak memicu rate limit berlebihan
      await new Promise((r) => setTimeout(r, 200))
    }

    setSyncProgress({ current: valids.length, total: valids.length, success, failed, done: true })
    setSyncing(false)
  }

  return (
    <div className="fasil-page">
      {/* Header Halaman */}
      <div className="fasil-header">
        <span className="fasil-badge">Fitur Khusus Fasilitator</span>
        <h1 className="fasil-title">Rekap Laporan CSV Fasilitator</h1>
        <p className="fasil-sub">
          Olah spreadsheet laporan harian Google Cloud Arcade secara instan untuk rekap progres peserta, analisis milestone guild, dan leaderboard.
        </p>
      </div>

      {/* Jaminan Privasi & Tanpa Scraping */}
      <div className="privacy-banner">
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
        <div className="fasil-upload-card">
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
                placeholder="Nama Peserta	Email Peserta	Nomor HP Peserta	URL Profil Google Skills	Status..."
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
              <div className="kpi-sub">Status All Good ✅</div>
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
          <div className="fasil-toolbar">
            <button className="wa-broadcast-btn" onClick={copyWaBroadcast}>
              {copiedMsg ? '✅ Pesan WhatsApp Tersalin!' : '📋 Salin Rekap Broadcast WhatsApp'}
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
            <div className="sync-status-box">
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
          <div className="fasil-filter-card">
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
            </div>

            <table className="fasil-table">
              <thead>
                <tr>
                  <th style={{ width: '48px' }}>#</th>
                  <th>Nama Peserta</th>
                  <th>Milestone</th>
                  <th>Game</th>
                  <th>Skill</th>
                  <th>Poin</th>
                  <th>Status URL</th>
                  <th style={{ textAlign: 'center' }}>Profil</th>
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
                  filteredParticipants.map((p, idx) => (
                    <tr key={p.id} className={!p.isValidUrl ? 'row-invalid' : ''}>
                      <td className="ft-rank">
                        {p.rank <= 3 ? <Medal i={p.rank - 1} className="pod-medal" /> : p.rank}
                      </td>
                      <td className="ft-name">
                        <span className="ft-name-text">{p.name}</span>
                        {p.bonusMilestone && <span className="ai-bonus-badge">AI Agent +10</span>}
                      </td>
                      <td>
                        <span className={`fasil-ms-tag ${p.milestoneKey}`}>{p.milestone}</span>
                      </td>
                      <td className="ft-num">{p.games}</td>
                      <td className="ft-num">{p.skills}</td>
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
                      <td style={{ textAlign: 'center' }}>
                        {p.profileUrl && (
                          <Tip label="Buka Profil Public Google">
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
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  )
}
