import { test } from 'node:test'
import assert from 'node:assert/strict'
import { parseFacilitatorReport, parseDelimitedText } from './parseCsv.js'

test('parseDelimitedText membedakan koma dan tab dengan benar', () => {
  const csv = 'Nama,Umur\n"Budi, S.Kom",25\n"Ani",22'
  const parsedCsv = parseDelimitedText(csv)
  assert.equal(parsedCsv.length, 3)
  assert.equal(parsedCsv[1][0], 'Budi, S.Kom')
  assert.equal(parsedCsv[1][1], '25')

  const tsv = 'Nama\tNilai\nBudi\t100\nAni\t95'
  const parsedTsv = parseDelimitedText(tsv)
  assert.equal(parsedTsv.length, 3)
  assert.equal(parsedTsv[1][0], 'Budi')
  assert.equal(parsedTsv[1][1], '100')
})

test('parseFacilitatorReport membaca header resmi laporan fasilitator Google', () => {
  const sampleSheet = `Nama Peserta\tEmail Peserta\tNomor HP Peserta\tURL Profil Google Skills\tStatus Google Skills URL Profil\tMilestone yang diraih\tBonus Milestone yang diraih\tJumlah Lencana Keahlian yang diselesaikan\tJumlah Arcade Game yang diselesaikan
Andi Pratama\tandi@example.com\t08123456789\thttps://www.skills.google/public_profiles/24480a54-82f8-48d5-8357-59a150aa8465\tAll Good\tMilestone 1\tNo\t14\t6
Budi Santoso\tbudi@gmail.com\t08987654321\thttps://www.cloudskillsboost.google/public_profiles/11111111-2222-3333-4444-555555555555\tAll Good\tUltimate Milestone\tYes\t56\t12
Cici Indah\tcici@yahoo.com\t08555555555\thttps://invalid-url.com\tWrong Google Skills URL\tNone\tNo\t2\t1`

  const result = parseFacilitatorReport(sampleSheet)
  assert.equal(result.error, null)
  assert.equal(result.participants.length, 3)
  assert.equal(result.summary.totalParticipants, 3)
  assert.equal(result.summary.validUrlsCount, 2)
  assert.equal(result.summary.invalidUrlsCount, 1)

  // PRIVACY CHECK: Pastikan TIDAK ADA field email atau nomor HP di hasil output
  for (const p of result.participants) {
    assert.equal(p.email, undefined, 'Email peserta tidak boleh diekspos')
    assert.equal(p.phone, undefined, 'Nomor HP tidak boleh diekspos')
    assert.equal(p.nomorHp, undefined, 'Nomor HP tidak boleh diekspos')
    assert.equal(p.emailPeserta, undefined, 'Email peserta tidak boleh diekspos')
  }

  // Cek kalkulasi poin & ranking
  // Budi: Ultimate (56 skills, 12 games, Bonus Yes) -> games(12) + skills/2(28) = 40 base + 40 (Ult bonus) + 10 (AI bonus) = 90
  const top = result.participants[0]
  assert.equal(top.name, 'Budi Santoso')
  assert.equal(top.milestoneKey, 'ultimate')
  assert.equal(top.points, 90)

  // Andi: M1 (14 skills, 6 games, Bonus No) -> games(6) + skills/2(7) = 13 base + 7 (M1 bonus) = 20
  const second = result.participants[1]
  assert.equal(second.name, 'Andi Pratama')
  assert.equal(second.milestoneKey, 'm1')
  assert.equal(second.points, 20)
})

test('parseFacilitatorReport menolak input kosong', () => {
  const res = parseFacilitatorReport('')
  assert.ok(res.error)
  assert.equal(res.participants.length, 0)
})
