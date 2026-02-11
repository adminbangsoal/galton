const SLUG_CONTSTANT = {
  PKPM: 'pkpm',
  PBM: 'pbm',
  PPU: 'ppu',
  'Literasi dalam Bahasa Inggris': 'bahasa-inggris',
  PU: 'pu',
  'Literasi dalam Bahasa Indonesia': 'bahasa-indonesia',
};

const QUESTION_LIMIT_CLASSIC = {
  PKPM: 35,
  PBM: 20,
  PPU: 20,
  'Literasi dalam Bahasa Inggris': 20,
  PU: 10,
  'Literasi dalam Bahasa Indonesia': 30,
};

const SLUG_SUBJECT_MAPPING = {
  pu: 'Penalaran Umum',
  pkpm: 'Pengetahuan Kuantitatif & Penalaran Matematika',
  ppu: 'Pengetahuan dan Pemahaman Umum',
  pbm: 'Pemahaman Bacaan dan Menulis',
  'bahasa-inggris': 'Bahasa Inggris',
  'bahasa-indonesia': 'Bahasa Indonesia',
};

const SUBJECT_SLUG = {
  'Penalaran Umum': 'pu',
  'Pengetahuan Kuantitatif & Penalaran Matematika': 'pkpm',
  'Pengetahuan dan Pemahaman Umum': 'ppu',
  'Pemahaman Bacaan dan Menulis': 'pbm',
  'Bahasa Inggris': 'bahasa-inggris',
  'Bahasa Indonesia': 'bahasa-indonesia',
};

const TIME_LIMIT_MAPPING = {
  PBM: 75,
  PPU: 45,
  PU: 180,
  PKPM: 85,
  'Literasi dalam Bahasa Indonesia': 90,
  'Literasi dalam Bahasa Inggris': 90,
};

export {
  SLUG_CONTSTANT,
  QUESTION_LIMIT_CLASSIC,
  SLUG_SUBJECT_MAPPING,
  SUBJECT_SLUG,
  TIME_LIMIT_MAPPING,
};
