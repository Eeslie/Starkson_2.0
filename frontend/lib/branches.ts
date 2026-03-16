// Must match backend constants/branches.js. Used for branch selection in admin create user and ticket create.
// 'ALL' = All Branches (user has access to every branch); not used for ticket numbers.
export const ALL_BRANCHES_ACRONYM = 'ALL'
export const BRANCHES = [
  { acronym: 'ALL', name: 'All Branches' },
  { acronym: 'A1P', name: 'A1+ - Multifood Packaging, Inc.' },
  { acronym: 'D01', name: 'D01 – DISNEY 1' },
  { acronym: 'D02', name: 'D02 – DISNEY 2' },
  { acronym: 'D03', name: 'D03 – DISNEY 3' },
  { acronym: 'D04', name: 'D04 – DISNEY 4' },
  { acronym: 'D05', name: 'D05 – DISNEY 5' },
  { acronym: 'D06', name: 'D06 – DISNEY 6' },
  { acronym: 'D07', name: 'D07 – DISNEY 7' },
  { acronym: 'D08', name: 'D08 – DISNEY 8' },
  { acronym: 'D09', name: 'D09 – DISNEY 9' },
  { acronym: 'DGN', name: 'DGN – DONGGUAN' },
  { acronym: 'EUA', name: 'EUA – EURASIA' },
  { acronym: 'HMF', name: 'HMF – Happy Alliance Mono Film, Inc.' },
  { acronym: 'HBO', name: 'HBO – HASBRO' },
  { acronym: 'MOR', name: 'MOR – ONE MARANAO MAIN' },
  { acronym: 'OMO', name: 'OMO – ONE MARANAO' },
  { acronym: 'MTL', name: 'MTL – MATTEL' },
  { acronym: 'PLA', name: 'PLA – PERLANDIA' },
  { acronym: 'SHI', name: 'SHI – SHANGHAI' },
  { acronym: 'SPI', name: 'SPI – Starkson Packaging INC.' },
  { acronym: 'SII', name: 'SII – STARKSON INDUSTRIES INC.' },
  { acronym: 'SM1', name: 'SM1 – STARKSON INDUSTRIES INC.' },
  { acronym: 'WNR', name: 'WNR – WARNER' },
  { acronym: 'STO', name: 'STO – SITIO' },
] as const

// Real branches only (exclude ALL) – for ticket/incident number generation and branch dropdown when creating a ticket.
export const REAL_BRANCHES = BRANCHES.filter((b) => b.acronym !== 'ALL')

export type BranchAcronym = typeof BRANCHES[number]['acronym']
