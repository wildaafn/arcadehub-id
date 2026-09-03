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

test('parseFacilitatorReport membaca 16 kolom resmi laporan fasilitator Google tanpa tertukar dengan Google Developer profile', () => {
  const sampleSheet = `Nama Peserta\tEmail Peserta\tNomor HP Peserta\tURL Profil Google Skills\tStatus Google Skills URL Profil\tURL Profil Google Developer\tStatus URL Profil Google Developer\tStatus Redeem Kode Akses\tMilestone yang diraih\tBonus Milestone yang diraih\tStatus Verifikasi AI Agent\tLencana Digital GEAR yang diraih\tJumlah Lencana Keahlian yang diselesaikan\tNama Lencana Keahlian yang diselesaikan\tJumlah Arcade Game yang diselesaikan\tNama Arcade Game yang diselesaikan
Dimas Adjie Wijaya\tadjie@gmail.com\t6285166854209\thttps://www.skills.google/public_profiles/f588d6d0-e3e7-431f-8a35-8e834a524e8b\tAll Good\thttps://developers.google.com/profile/u/100815074843485258698\tAll Good\tYes\tNone\tNo\tNot yet submitted\tGemini Enterprise Agent Ready\t3\tBadge1\t0\t
Muhammad Mufadhol Afif\tmufadhol@gmail.com\t628123456789\thttps://www.skills.google/public_profiles/24480a54-82f8-48d5-8357-59a150aa8465\tAll Good\thttps://developers.google.com/profile/u/111054617812326045492\tAll Good\tYes\tMilestone 1\tNo\tSubmitted\tGemini Enterprise Agent Ready\t9\tBadge1\t6\tGame1
Zainudin\tzainudin@gmail.com\t628987654321\thttps://www.cloudskillsboost.google/public_profiles/11111111-2222-3333-4444-555555555555\tAll Good\thttps://me.developers.google.com/u/101548904163688193984\tAll Good\tYes\tUltimate Milestone\tYes\tVerified\tGemini Enterprise Agent Ready\t93\tBadge1\t12\tGame1
Peserta Error\terror@gmail.com\t62855555555\thttps://wrong-url.com\tWrong Google Skills URL\thttps://developers.google.com/profile/u/999\tAll Good\tNo\tNone\tNo\tNot yet submitted\t\t0\t\t0\t`

  const result = parseFacilitatorReport(sampleSheet)
  assert.equal(result.error, null)
  assert.equal(result.participants.length, 4)
  assert.equal(result.summary.totalParticipants, 4)
  assert.equal(result.summary.validUrlsCount, 3, 'Harus ada 3 peserta ber-URL Google Skills valid (All Good)')
  assert.equal(result.summary.invalidUrlsCount, 1, 'Harus ada 1 peserta ber-URL invalid')
  assert.equal(result.summary.atLeast5SkillsCount, 2, 'Harus ada 2 peserta yang memiliki >= 5 skill badges (Zainudin 93, Mufadhol 9)')

  // PRIVACY CHECK: Pastikan TIDAK ADA field email atau nomor HP di hasil output
  for (const p of result.participants) {
    assert.equal(p.email, undefined)
    assert.equal(p.phone, undefined)
    assert.equal(p.nomorHp, undefined)
    assert.equal(p.emailPeserta, undefined)
  }

  // Cek bahwa URL yang diambil adalah URL Google Skills (bukan URL Developer)
  const zainudin = result.participants.find((p) => p.name === 'Zainudin')
  assert.ok(zainudin)
  assert.equal(zainudin.profileUrl, 'https://www.cloudskillsboost.google/public_profiles/11111111-2222-3333-4444-555555555555')
  assert.equal(zainudin.isValidUrl, true)
  assert.equal(zainudin.urlStatus, 'All Good')
  assert.equal(zainudin.has5Skills, true)
})

test('parseFacilitatorReport menolak input kosong', () => {
  const res = parseFacilitatorReport('')
  assert.ok(res.error)
  assert.equal(res.participants.length, 0)
})
