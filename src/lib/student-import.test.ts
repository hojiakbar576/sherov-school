import { describe, expect, it } from 'vitest'
import { createDemoData } from '../data/seed'
import { readSpreadsheet, parseCsv } from './xlsx-read'
import { toXlsx } from './xlsx'
import { importTemplate, parseDate, planImport } from './student-import'

const NOW = new Date('2026-11-05T10:00:00+05:00')
const data = createDemoData(NOW)
const today = '2026-11-05'
const group = data.groups.find((g) => g.status === 'active' && data.groups.filter((x) => x.name === g.name).length === 1)!
const file = (bytes: Uint8Array, name: string) => Object.assign(new Blob([bytes as BlobPart]), { name })

describe('reading spreadsheets', () => {
  it('reads back an .xlsx this app wrote', async () => {
    const rows = [
      ['Student', 'Monthly tuition (UZS)'],
      ['Ali & “Vali” <b>', 450000],
    ]
    const back = await readSpreadsheet(file(toXlsx(rows), 'x.xlsx'))
    expect(back).toEqual([
      ['Student', 'Monthly tuition (UZS)'],
      ['Ali & “Vali” <b>', '450000'],
    ])
  })

  it('reads a compressed .xlsx made by Excel-like software (first tab, blank rows kept)', async () => {
    const bytes = Uint8Array.from(atob(EXCEL_MADE), (c) => c.charCodeAt(0))
    const rows = await readSpreadsheet(file(bytes, 'excel-made.xlsx'))
    expect(rows[0][0]).toBe('Student')
    expect(rows[1].slice(0, 3)).toEqual(['Ali Valiyev', '90 123 45 67', 'English Beginner A'])
    expect(parseDate(rows[1][8])).toBe('2026-10-01')
    expect(rows[2]).toEqual([])
    expect(rows[3][0]).toBe('Olim & “Qo‘shtirnoq”')
  })

  it('reads CSV with commas or semicolons and quotes', () => {
    expect(parseCsv('﻿a,b\r\n"x, y","say ""hi"""\n')).toEqual([
      ['a', 'b'],
      ['x, y', 'say "hi"'],
    ])
    expect(parseCsv('a;b\n1;2')).toEqual([
      ['a', 'b'],
      ['1', '2'],
    ])
  })

  it('understands the usual date styles', () => {
    expect(parseDate('2026-11-05')).toBe('2026-11-05')
    expect(parseDate('05.11.2026')).toBe('2026-11-05')
    expect(parseDate('5/11/2026')).toBe('2026-11-05')
    expect(parseDate('46331')).toBe('2026-11-05')
    expect(parseDate('31.02.2026')).toBeNull()
    expect(parseDate('soon')).toBeNull()
  })
})

describe('planning an import', () => {
  const header = importTemplate(group)[0]
  const row = (over: Partial<Record<string, string>>) => header.map((h) => over[h] ?? '')

  it('the template’s example row is ready to import', () => {
    const plan = planImport(importTemplate(group), data, { today, fallbackBranch: null })
    expect(plan.rows).toHaveLength(1)
    expect(plan.rows[0].problems).toEqual([])
    const input = plan.rows[0].input!
    expect(input.groupId).toBe(group.id)
    expect(input.monthlyTuition).toBe(group.monthlyFee)
    expect(input.guardians![0]).toMatchObject({ relationship: 'mother', phone: '+998 91 234 56 78' })
    expect(input.enrolledOn).toBe(today)
    expect(input.status).toBe('active')
  })

  it('explains what is wrong with a row, with its spreadsheet row number', () => {
    const plan = planImport(
      [header, row({ Student: 'Ali', Group: 'Nope', 'Student phone': '123', Status: 'Left', Enrolled: '2030-01-01' }), [], row({ Student: '' , 'Parent phone': '+998 90 000 00 01' })],
      data,
      { today, fallbackBranch: null },
    )
    const [a, b] = plan.rows
    expect(a.row).toBe(2)
    expect(a.input).toBeUndefined()
    expect(a.problems.join(' ')).toMatch(/Nope/)
    expect(a.problems.join(' ')).toMatch(/123/)
    expect(a.problems.join(' ')).toMatch(/current students/)
    expect(a.problems.join(' ')).toMatch(/future/)
    expect(b.row).toBe(4)
    expect(b.problems.join(' ')).toMatch(/name is missing/)
  })

  it('needs a group or a chosen branch', () => {
    const r = row({ Student: 'Ali Valiyev', 'Student phone': '+998 90 111 22 33', 'Monthly tuition (UZS)': '400000' })
    expect(planImport([header, r], data, { today, fallbackBranch: null }).rows[0].problems.join(' ')).toMatch(/choose a branch/)
    expect(planImport([header, r], data, { today, fallbackBranch: 'br_bashlik' }).rows[0].input?.groupId).toBeNull()
  })

  it('skips students already in the system and repeats in the file', () => {
    const s = data.students.find((x) => x.phone)!
    const fresh = row({ Student: 'New Person', 'Student phone': '+998 90 555 44 33', Group: group.name })
    const plan = planImport([header, row({ Student: s.fullName, 'Student phone': s.phone, Group: group.name }), fresh, fresh], data, { today, fallbackBranch: null })
    expect(plan.rows.map((r) => [Boolean(r.input), Boolean(r.duplicate)])).toEqual([
      [false, true],
      [true, false],
      [false, true],
    ])
  })

  it('a price different from the group’s fee keeps a reason', () => {
    const plan = planImport([header, row({ Student: 'Cheap Price', 'Student phone': '+998 90 222 33 44', Group: group.name, 'Monthly tuition (UZS)': '100 000', 'Price note': 'Sibling' })], data, { today, fallbackBranch: null })
    expect(plan.rows[0].input).toMatchObject({ monthlyTuition: 100000, tuitionAdjustment: { kind: 'special_price', reason: 'Sibling' } })
  })

  it('accepts a file exported from the Students page, ignoring calculated columns', () => {
    const plan = planImport([['Student', 'Group', 'Teacher', 'Parent phone', 'Owed (UZS)'], ['Round Trip', group.name, 'Someone', '+998 93 777 66 55', '0']], data, { today, fallbackBranch: null })
    expect(plan.ignored).toEqual(['Teacher', 'Owed (UZS)'])
    expect(plan.rows[0].input?.groupId).toBe(group.id)
  })

  it('rejects a file without a Student column', () => {
    expect(planImport([['Name?', 'x']], data, { today, fallbackBranch: null }).error).toMatch(/Student/)
  })
})

/** A real .xlsx saved by spreadsheet software (compressed, two tabs, a date cell, a blank row). */
const EXCEL_MADE =
  'UEsDBBQAAAAIAE6dZV1Gx01IlwAAAM0AAAAQAAAAZG9jUHJvcHMvYXBwLnhtbE2PTQvCMBBE/0ro3aS16EFiQdSj6Ml7TDc2kGSXZIX476WCH7cZhvdg9CUjQWYPRdQYUtk2EzNtlCp2gmiKRIJUY3CYo+EiMd8VOuctHNA+IiRWy7ZdK6gMaYRxQV9hM+gdUfDWsMc0nLzNWNCxOFYLQewxkmF/CyCUOBMketYgetnJlVb/4Gy5Qi5z7mX3Hj9dq9+B4QVQSwMEFAAAAAgATp1lXSo1qGLvAAAAKwIAABEAAABkb2NQcm9wcy9jb3JlLnhtbM2SwUoDMRCGX6XkvjtJWguGbS6KpxYEC4q3kEzb4GYTkpHdvr3s2m4RfQCvMz/f/w1MY5OyMeNzjgkzeSyLIbRdUTZt2IkoKYBiTxhMqWPCbgjtIeZgqNQxHyEZ+2GOCJLzNQQk4wwZGIFVmolMN84qm9FQzBe8szM+feZ2gjkL2GLAjgqIWgDTY2M6D20DN8AII8yhfA/QzcRp+id22gC7JIfi51Tf93W/nHKScwFvu+3LdG7lu0Kms8gWQ/GKzgk37Nr8unx43D8xLblcV0JU/G4vVmollbx/H11/+N2EQ3T+4P+x8VVQN/DrL/QXUEsDBBQAAAAIAE6dZV2ZXJwjDwYAAJwnAAATAAAAeGwvdGhlbWUvdGhlbWUxLnhtbO1aXXObOBR9z6/QaGf2bWsw4NhpSCf+anebtJnE250+XmMZ1AiJEXIS//sdge0gwNjtOpt0N34IQdI5956rK12EffruIWbojsiUCu5j+42F350dncKJikhM0EPMeHoCPo6USk5arTSISAzpG5EQ/hCzuZAxqPSNkGFrJuGe8jBmrbZldVoxUI4Rh5j4+PN8TgOCJpoSnx0htOYfMRITrlLdlrUGTN4EmeUiEuf92YjZrb2+y+7TZTpgEt0B8/E95TNxPyEPCiMGqRow6WMr++DWhqNlkJzCCVO7KAt04+xj0hUIMg/bJp0Mpxs+e+z2jodlb9qGNw3w0Wg0GNll60U4BAHhZUFFCnfctfslD0qgDU2DJwPLs9xamqo3znaaXr/f93p1NE6Fxt1O07U67nm7jsat0HgNsemfDwadOhqvQtPZTjM+7nXcWppOgSZilN9uJ9FZW040A3IKJ3PBPjSzdC3L6pay30Tpls2y2yzEueBqx0qM4ZuQY8GVYZ2BohypZULmEBAfDyCeSgqPHmSjCBSGlPqCdHufdgulgaSJ8vEfCXBcGPvrLw/jcXv4Nrs6zluU/2PpBsfqu6vrcX4dOPn1fPy2ycgH4GHJSL83tDV2cOxamZHzwSgz0vdsbxdZWiLz+t2+xrpjz9mFVSVsx+tndo+HuchOxxrpa+986DZynUuYFrkmNCYp+kTu0bWIgTe6QabyB6GTCKgBhUjE5cwwECMVGYhPS2CNgD4xZ+uLpHzWiHi/+GbouYnkQtEmxMcoNhCXQrC+kM3aP2o3itoXPNzhl1wUAdcAd41uDUq5NVokEYkrK8/ERMSQcsWAKwgJJwrpPnFLSBP+K6XG/FzSQIpUzBX6SlEfaHMgJ3Sq6tEfaAwMlo2+TyIwInr5BfUFazQ4JHcmBHgIrNEIYcYsvIeFgrhZFcSsCLkAFTUKuVnKwJi4VEngIWECjWYkTRvBn+XSkPQRGN2RWZdsGZsQqehtI+QChChChuJ2EEGcNOuiPCqCfk9vhWCAroRq9k+Ya1jfC0aB786oL5SoH9yc/qRhVJ+MumchzRJaqX26HlK+Vz1kdCrLKl7r4Yuqh+eSNu8L5Sq4E/AfrX1DWPArwqPX0vda+l5L30sqfTt3pO8seGZxy4+R6yPi46kx3nVonFPGbtSSkYvUrJOpYHQ2pow9tubtGd/mPJtEAyYNWa1a7CmchBKyRiSF+ouq6CaChPjYxiULYWr4smlFiUh9bGGza7tT5XH5ay7KVT7IM19DmXygLsUsH+dY9QMzoWu7JXdb2t+tEhxt+lAynOPnkmHnjAfSYXt76tgyb9+lI28ppZl+OKQcAQ99bHfauTqUBsDITKdpKcnX6fzycjyNYEZWSW7vF1XbOXR2dP95chR09Jzn0nGILC8KcfcVUr8enjrNrV1pnlWamqKhaXltJWEc3fu457U9jAJIfDxnoDAK4mTm41QXWGAh93GgZHmZ1Bah/YNfCv2WiJYCb9UN2xr2LeUuo01kqoaQRjlxNqocXcZrQtX2XD0lTxur1lOrcLr2z6oiv6vJcDKfk0DVZnmhq2Q676nb78VCEXkTze7RlC3kNcx87ObLcUZT5eP2+kb62HNXK9WsLPU7U/l7i5oNLP/mhCURrOpqd/t+k9NVV8TG//Is1Eh+bC7F6Kli5/yLsWvYq19j97yxW+0dhBNnVglEADGRgPTm4GMhVSRCCUlEg7EUXNVJlEIhBkoHADH9Db2ODLkrFc61Pzl/xSyjYaSuaYgkDX2sIknIlVrF+/us2u3ax/psA1sZqeyQ1VjoCCU14ZmSO8ImejPv6GnCKFoXp+q+a+C3JGyp2dxbp+H4f3sWdfc9ix7i8GNIcA95hnObznCFB7Hec6k98MN8e89pa3tP+DCfgIqQ/uPjgMqAEVyRr5/XJ+KaBAptXnwg5ePfuqutfdM49bHdrarStrWJn+UE/JiSNWJqp+hlvh4p5NqWg2011w4h5AlyzatJtZr1vV+m6ba6epEdTuPCW1DdUPllm34Cmn4jgRqSOSyYSlurVvKgJAzWv725SFXr7GjDcHb0N1BLAwQUAAAACABOnWVd7I4vbI4CAAC/BwAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQxLnhtbIWVa0/bMBSG/8qRJ6FNk+oktIXSNBKXcpPYOjrYtG+mOW0sHDvYTgv/fnJKQxF2+XZ8ed7jy+vjdKX0oykQLTyXQpoRKaytjig1swJLZjqqQvlcirnSJbOmo/SCmkojyxuoFDSJoj4tGZckS5u+ic5SVVvBJU40mLosmX45QaFWIxKTTcctXxTWddAsrdgCp2jvqommWUpblZyXKA1XEjTOR+Q4PrruuvnNhHuOK7MVg9vJg1KPrnGVj0jkFoQCZ9YpsJnlSzxFIZwQAfP0qknalA7cjjfq583eJxoemMFTJf7w3BYjckggxzmrhb1Vq0t83U+vXeAZsyxLtVqBdvvM0pkLXG47Ily685laTbKUmyy12dTWOUqbUpul1HXR2Sty8gkCVaEkesDTEHihVV15gLMQMGHaJaKwqJnOOZMeeByCb1Ewdwem4L6k558kDe3uIsTdKGkL8QK25s3Vf737N/3mEbgMnyuztfEQVyFiLLUSAnMPcx1ifiObFajfI1SrVWuapDVNEtA4FhzumeAvuPQZJ4QNIoiTfej2oH/g802IG8uF4KaAE1xwKVHDsc9EIfqGCf7INutlPgsFUWU/HNXaPCHi+2BwCIMY4jiGJIH9fZ+D1rCrXMus24uiKErpctshwXNvqonPIQkB09S5N+F+Mui/170O6f7d4YZu64ZugP4peAl7rKyGsPflMEmi4S/lgrg/NIXlWqqnpj8e+szyUfXNEKGMPxRM61kBwYKyQ3S8Y+x8x9jFjrHL0EInrDbe53kVIqJeJ447SZT0fY/av4b1fdGt8u++thumF1waEDi3IxJ1DnoE9Pq7WDesqhrLPChrVdmEBbIctZvQIzBXym4a7rdq/+zsP1BLAwQUAAAACABOnWVdcC666z0BAAASAgAAGAAAAHhsL3dvcmtzaGVldHMvc2hlZXQyLnhtbE1S0U7DMAz8lSgfsHRIAzSlkcYQggekahPwnLVuGy2Ji+PR8fco3Vbxdj7Zl7tT9Ih0TD0Ai3PwMZWyZx7WSqW6h2DTAgeI5+BbpGA5LZA6lQYC20xHwau7orhXwboojZ64iozGE3sXoSKRTiFY+n0Cj2Mpl/JG7FzXcyaU0YPtYA/8MVSkjFazSuMCxOQwCoK2lJvlejPtTwufDsb0D4uc5IB4zMNbU8oiGwIPNWcFW7P7gS14n4WkSN9XTTk/mQ//45v6y5S9InGwCbbov1zDfSkfpWigtSfPOxxf4ZpnNRt8tmyNJhwF5ZxG1xnkt7mULuZ+9kzSaJeMZuO6iAQigFZstMqkqo1WhLOpi2Ju691S52ISHlouZbF4WElBFweXgXGY2j4gM4YJ9mAboLywkqJF5NuQC5i/gfkDUEsDBBQAAAAIAE6dZV3KM5UXewIAAI8KAAANAAAAeGwvc3R5bGVzLnhtbN1WXWvbMBT9K0bvrZJ4M/GQ9TBDYLCNQvuwVyWWE4E+PFku8X79uJbrJK1uYWNPswmS7vE599M4rA+jlo8nKUN2Ntr2FTmF0H2itD+cpBH9veukPRvdOm9E6O+dP9K+81I0PZCMppvVqqBGKEs4s4PZmdBnBzfYUJH1Ysri8qWpyLr4QLIoV7tGVmQcx/HOmLumIZQzOmtw1jp7KwUGzqwwMnsWuiK10GrvFbBaYZQeo3kDhoPTzmfhJI0EMuWs/xXhdTxBerOOUdb5yXf0MC0QgNJ6CWBDooGzToQgvd0prSfOZHwDZfP+aexkRY5ejOvNR3IhTEvP2d75RvqbPKOJMy3bQDnz6niCNbiOAhiCM5SzRomjs2KK4YUxb3rODlLrR+jtj/ZG+9xetWIFjbDLVmk9b6NMPID+tVrUvpLd/JVs1qlnFz4PITg7nX8OLsgHL1t1ns7ndvF/oz7Pz7/Up3NGV2W7KdpizWD4KvIdpldfJLL9oHRQdj6dVNNI+6Z2PWdB7LW81V+RrJGtGHR4WsCKXPbfZKMGUy5PPUBa81OX/VeYkXWxTH7PmbKNPMumno/+uJ+2mT/uK7KaLyC8RnbTlUYwTsTSCGCYHywCjBNZmJ//KZ8tmk/EsNi2SWSLcrYoJ7JSSD3dmJ80pyzLMp1pWeZ5UWAVretkBDVWt6KAX1oNiw0YmB/w9Ge1xruNT8j7c4D19L0JwTLFJxHLFK81IOm6AaMs093G/AAD6wI2O+A/7QdmKs3Jc+gqFhv2BuNIWWIIzGJ6RosCqU4Bd7o/2FuS52WZRgBLR5DnGAJvI45gEUAMGJLn03fw1feIvnyn6OUvKP8NUEsDBBQAAAAIAE6dZV2XirscwAAAABMCAAALAAAAX3JlbHMvLnJlbHOd0ktqAzEMgOGrDN53lKbQRchk1U12peQCqq15MLYlZJW6tw/JJpnQF9mLn09C2zeKaBPnMk5SmppiLp0bzWQDUPxICUvLQrmm2LMmtNKyDiDoZxwI1qvVM+h1w+22183m8CX0nyL3/eTphf1HomzfhG8mXHNAHcg6VyN8ss7vzHNbU3TNPnRO9+HRwZ2Wn7eDRIYBDcGz0oMoC6lNVC6cwP5VWcp5YgFa3w36+zhUjXKg8DsJRRaip5MIFj+wOwJQSwMEFAAAAAgATp1lXY1UURZKAQAAsQIAAA8AAAB4bC93b3JrYm9vay54bWy1kt1KxEAMhV+lzAM4dVHBpe2Niz8grujifTpNt2FnJiWT3VWfXtpSXBDEG68yORnCOR8pjiy7mnmXvQcfU2k61X5pbXIdBkhn3GN8D75lCaDpjGVrUy8ITeoQNXi7yPMrG4CiqYp517PY04YVnRJHWxWD8EZ4TN/zoc0OlKgmT/pRmvHt0WSBIgX6xKY0uclSx8d7FvrkqOBfnbD3pTmfBm8oSu6H/DqY3ECdRkWhfgElLs1VnpusJUk6/hj3g1M64Abqqdsr35JXlBUo3gnve4rbYY2tCnsSY+Qw1wniUv6CkduWHK7Y7QNGnTgK+sFgTB31yWQRApZmAx5q8CBDJkR9aKZ8CoontGRJTWnkoRkt/p+dtXZ4amXxi5XFSGtG1GBLEZsnCJhsVTjw7lmyoYyRFheX59cma/fe34B36/jI0MzE52upvgBQSwMEFAAAAAgATp1lXY33LFq0AAAAiQIAABoAAAB4bC9fcmVscy93b3JrYm9vay54bWwucmVsc8WSMQ6DMAxFr4JyAAy06lBBpy6sFReIwBBEQqLYVeH2VWGASB26oE7W9/D+k+z8gVpyb0dSvaNoMnqkQihmdwWgWqGRFFuH42R0a72RTLH1HThZD7JDyJLkAn7PELd8z4yq2eEvRNu2fY13Wz8NjvwFDC/rB1KILKJK+g65EDDpbU2wjDSejBZR2RTCl00q4N9CWSCUHShEPGukzWbNQf3pwHpWaHBrX+K6DG9y/jhA8Hm3N1BLAwQUAAAACABOnWVdbqckvB4BAABXBAAAEwAAAFtDb250ZW50X1R5cGVzXS54bWzFlL9OAzEMxl/llLVqUjowoF4XYIUOvEBIfL2oSRzZbrm+PbrrHwlUTlRFYomH2N/P9hdl8bYvwFWXYuZatSLlwRh2LSTLGgvkLsUGKVlhjbQ2xbqNXYOZz2b3xmEWyDKVXkMtF0/Q2G2U6rkTyBww14ogsqoeD4k9q1a2lBiclYDZ7LL/RpkeCZogDjnchsKTLkVlLhL6m58Bx7rXHRAFD9XKkrzYBLUyXTQs+wisxyUu9IhNExx4dNsEWTQXAuu5BZAU9UF0Mk6WFhIczrub+YPMGNCjWxEWNg4JrsedLOmrp4WwAEkYH/FMtKXcPB/0bnvwv2R30XwgbQY/2Azh9h1/9fisf2Uf83/s4x1x89dPvY862ZBPfDP8J8tPUEsBAhQDFAAAAAgATp1lXUbHTUiXAAAAzQAAABAAAAAAAAAAAAAAAIABAAAAAGRvY1Byb3BzL2FwcC54bWxQSwECFAMUAAAACABOnWVdKjWoYu8AAAArAgAAEQAAAAAAAAAAAAAAgAHFAAAAZG9jUHJvcHMvY29yZS54bWxQSwECFAMUAAAACABOnWVdmVycIw8GAACcJwAAEwAAAAAAAAAAAAAAgAHjAQAAeGwvdGhlbWUvdGhlbWUxLnhtbFBLAQIUAxQAAAAIAE6dZV3sji9sjgIAAL8HAAAYAAAAAAAAAAAAAACAgSMIAAB4bC93b3Jrc2hlZXRzL3NoZWV0MS54bWxQSwECFAMUAAAACABOnWVdcC666z0BAAASAgAAGAAAAAAAAAAAAAAAgIHnCgAAeGwvd29ya3NoZWV0cy9zaGVldDIueG1sUEsBAhQDFAAAAAgATp1lXcozlRd7AgAAjwoAAA0AAAAAAAAAAAAAAIABWgwAAHhsL3N0eWxlcy54bWxQSwECFAMUAAAACABOnWVdl4q7HMAAAAATAgAACwAAAAAAAAAAAAAAgAEADwAAX3JlbHMvLnJlbHNQSwECFAMUAAAACABOnWVdjVRRFkoBAACxAgAADwAAAAAAAAAAAAAAgAHpDwAAeGwvd29ya2Jvb2sueG1sUEsBAhQDFAAAAAgATp1lXY33LFq0AAAAiQIAABoAAAAAAAAAAAAAAIABYBEAAHhsL19yZWxzL3dvcmtib29rLnhtbC5yZWxzUEsBAhQDFAAAAAgATp1lXW6nJLweAQAAVwQAABMAAAAAAAAAAAAAAIABTBIAAFtDb250ZW50X1R5cGVzXS54bWxQSwUGAAAAAAoACgCEAgAAmxMAAAAA'
