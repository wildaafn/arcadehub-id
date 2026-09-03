import { calc, MS } from './points.js'
import { normalizeProfileUrl } from './fetchProfile.js'

/**
 * Deteksi delimiter teks (koma, titik koma, atau tab).
 * Tab sering terjadi saat pengguna melakukan copy-paste langsung dari Google Sheets / Excel.
 */
function detectDelimiter(text) {
  const firstLine = text.split(/\r?\n/)[0] || ''
  const tabs = (firstLine.match(/\t/g) || []).length
  const semicolons = (firstLine.match(/;/g) || []).length
  const commas = (firstLine.match(/,/g) || []).length

  if (tabs >= commas && tabs >= semicolons && tabs > 0) return '\t'
  if (semicolons > commas && semicolons > 0) return ';'
  return ','
}

/**
 * Parser CSV/TSV sederhana dengan dukungan teks berkutip ganda ("...") dan newline di dalam kutip.
 */
export function parseDelimitedText(text, delimiter) {
  const delim = delimiter || detectDelimiter(text)
  const rows = []
  let currentRow = []
  let currentField = ''
  let inQuotes = false

  for (let i = 0; i < text.length; i++) {
    const char = text[i]
    const nextChar = text[i + 1]

    if (inQuotes) {
      if (char === '"' && nextChar === '"') {
        currentField += '"'
        i++
      } else if (char === '"') {
        inQuotes = false
      } else {
        currentField += char
      }
    } else {
      if (char === '"') {
        inQuotes = true
      } else if (char === delim) {
        currentRow.push(currentField.trim())
        currentField = ''
      } else if (char === '\r') {
        // abaikan carriage return
      } else if (char === '\n') {
        currentRow.push(currentField.trim())
        if (currentRow.some((field) => field.length > 0)) {
          rows.push(currentRow)
        }
        currentRow = []
        currentField = ''
      } else {
        currentField += char
      }
    }
  }

  if (currentField.length > 0 || currentRow.length > 0) {
    currentRow.push(currentField.trim())
    if (currentRow.some((field) => field.length > 0)) {
      rows.push(currentRow)
    }
  }

  return rows
}

function normalizeHeader(h) {
  return String(h || '')
    .toLowerCase()
    .replace(/[^a-z0-9]/g, '')
}

/**
 * Parser Laporan Fasilitator Google Cloud Arcade.
 *
 * JAMINAN PRIVASI (PRIVACY-FIRST):
 * Kolom data sensitif peserta (seperti Email, Nomor HP, Telepon) SECARA OTOMATIS DIABAIKAN & DIBUANG
 * dari memori dan tidak pernah dikembalikan dalam objek hasil parse.
 */
export function parseFacilitatorReport(rawText) {
  if (!rawText || typeof rawText !== 'string' || !rawText.trim()) {
    return { participants: [], summary: null, error: 'File atau data teks kosong.' }
  }

  const rows = parseDelimitedText(rawText)
  if (rows.length < 2) {
    return { participants: [], summary: null, error: 'Format data tidak valid (minimal harus ada baris judul dan 1 baris data).' }
  }

  const headers = rows[0]
  const colIndex = {}

  headers.forEach((h, idx) => {
    const norm = normalizeHeader(h)

    // Status URL Profil dicek sebelum URL Profil
    if (norm.includes('status') && (norm.includes('googleskills') || norm.includes('profil') || norm.includes('url'))) {
      colIndex.urlStatus = idx
    }
    // URL Profil Google Skills
    else if (
      (norm.includes('url') && (norm.includes('skills') || norm.includes('profil') || norm.includes('public'))) ||
      norm.includes('googleskillsprofileurl') ||
      norm.includes('publicprofileurl')
    ) {
      colIndex.profileUrl = idx
    }
    // Nama Peserta
    else if (norm.includes('namapeserta') || norm === 'nama' || norm === 'name' || norm === 'studentname') {
      colIndex.name = idx
    }
    // Bonus Milestone dicek sebelum Milestone reguler
    else if (norm.includes('bonus') || norm.includes('bonusmilestone')) {
      colIndex.bonusMilestone = idx
    }
    // Milestone reguler (tanpa kata bonus)
    else if ((norm.includes('milestone') || norm.includes('milestoneyangdiraih')) && !norm.includes('bonus')) {
      colIndex.milestone = idx
    }
    // Jumlah Lencana Keahlian (Skill Badges)
    else if (
      norm.includes('jumlahlencanakeahlian') ||
      norm.includes('skillbadgescompleted') ||
      (norm.includes('jumlahlencana') && norm.includes('keahlian')) ||
      (norm.includes('jumlah') && norm.includes('skill'))
    ) {
      colIndex.skills = idx
    }
    // Jumlah Arcade Game
    else if (
      norm.includes('jumlaharcadegame') ||
      norm.includes('arcadegamescompleted') ||
      (norm.includes('jumlah') && norm.includes('game'))
    ) {
      colIndex.games = idx
    }
    // Status Redeem
    else if (norm.includes('statusredeem') || norm.includes('redeem')) {
      colIndex.redeemStatus = idx
    }
    // Status AI Agent
    else if (norm.includes('verifikasiaiagent') || norm.includes('aiagent')) {
      colIndex.aiAgentStatus = idx
    }
  })

  if (colIndex.name === undefined && colIndex.profileUrl === undefined) {
    return {
      participants: [],
      summary: null,
      error: 'Kolom "Nama Peserta" atau "URL Profil Google Skills" tidak ditemukan pada baris judul.',
    }
  }

  const participants = []
  const milestonesCount = { ultimate: 0, m3: 0, m2: 0, m1: 0, none: 0 }
  let validUrlsCount = 0
  let invalidUrlsCount = 0
  let totalSkills = 0
  let totalGames = 0

  for (let r = 1; r < rows.length; r++) {
    const row = rows[r]
    if (!row || row.length === 0 || row.every((c) => !c)) continue

    const name = colIndex.name !== undefined ? row[colIndex.name] || 'Peserta' : 'Peserta'
    const rawUrl = colIndex.profileUrl !== undefined ? row[colIndex.profileUrl] || '' : ''
    const canonicalUrl = normalizeProfileUrl(rawUrl)
    const urlStatus = colIndex.urlStatus !== undefined ? row[colIndex.urlStatus] || '' : ''
    const rawMilestone = colIndex.milestone !== undefined ? row[colIndex.milestone] || 'None' : 'None'
    const rawBonus = colIndex.bonusMilestone !== undefined ? row[colIndex.bonusMilestone] || 'No' : 'No'
    const rawSkills = colIndex.skills !== undefined ? parseInt(row[colIndex.skills], 10) || 0 : 0
    const rawGames = colIndex.games !== undefined ? parseInt(row[colIndex.games], 10) || 0 : 0
    const redeemStatus = colIndex.redeemStatus !== undefined ? row[colIndex.redeemStatus] || '' : ''
    const aiAgentStatus = colIndex.aiAgentStatus !== undefined ? row[colIndex.aiAgentStatus] || '' : ''

    const hasBonus = /yes|ya|true|1/i.test(rawBonus)
    const isValidUrl = Boolean(canonicalUrl) && !/wrong|invalid|error/i.test(urlStatus)

    if (isValidUrl) {
      validUrlsCount++
    } else {
      invalidUrlsCount++
    }

    const mLower = rawMilestone.toLowerCase()
    let milestoneKey = 'none'
    if (mLower.includes('ultimate')) {
      milestoneKey = 'ultimate'
      milestonesCount.ultimate++
    } else if (mLower.includes('3')) {
      milestoneKey = 'm3'
      milestonesCount.m3++
    } else if (mLower.includes('2')) {
      milestoneKey = 'm2'
      milestonesCount.m2++
    } else if (mLower.includes('1')) {
      milestoneKey = 'm1'
      milestonesCount.m1++
    } else {
      milestonesCount.none++
    }

    totalSkills += rawSkills
    totalGames += rawGames

    const calculated = calc(rawGames, rawSkills, hasBonus)

    participants.push({
      id: r,
      name: name.trim().slice(0, 80),
      profileUrl: canonicalUrl || rawUrl,
      rawProfileUrl: rawUrl,
      isValidUrl,
      urlStatus: urlStatus || (isValidUrl ? 'All Good' : 'Perlu dicek'),
      milestone: rawMilestone,
      milestoneKey,
      bonusMilestone: hasBonus,
      skills: rawSkills,
      games: rawGames,
      points: calculated.total,
      basePoints: calculated.base,
      milestoneBonus: calculated.mbonus,
      redeemStatus,
      aiAgentStatus,
    })
  }

  // Sort default: Poin tertinggi, lalu nama
  participants.sort((a, b) => {
    if (b.points !== a.points) return b.points - a.points
    return a.name.localeCompare(b.name)
  })

  // Tambahkan rank
  participants.forEach((p, idx) => {
    p.rank = idx + 1
  })

  return {
    participants,
    summary: {
      totalParticipants: participants.length,
      validUrlsCount,
      invalidUrlsCount,
      milestonesCount,
      totalSkills,
      totalGames,
      averagePoints: participants.length > 0 ? (participants.reduce((acc, p) => acc + p.points, 0) / participants.length).toFixed(1) : 0,
    },
    error: null,
  }
}
