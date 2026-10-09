// Millimetre sizes from 0. Document/Manny_Fung_floorplan.pdf (MF-01 / MF-02).
// World positions are Three.js Y-up, converted from the exhibition model.

export const planDimensions = [
  ["4240", "North report wall"],
  ["4042", "South inner width"],
  ["4188", "South boundary"],
  ["4501", "West craft wall"],
  ["3926", "West lower run"],
  ["4960", "East run"],
  ["9330", "Internal north–south"],
  ["3600", "Lens to image wall"],
];

export const setupSections = [
  {
    title: "S1 + S2  Student work shelves",
    lines: [
      "S1: 2262 L × 480 D",
      "S2: 1619 L × 480 D",
      "Shelf tops: 438 / 873 AFF",
      "15 artwork volumes at supplied sizes",
    ],
  },
  {
    title: "Block supports",
    lines: [
      "16 blocks, each 400 × 250 × 200",
      "Twin openings on the vertical side faces",
      "Dashed outlines = supports below the shelf",
    ],
  },
  {
    title: "C  Car",
    lines: ["Deck: X 500 × Y 1000", "Single inclined pull rod", "Wood boxes"],
  },
  {
    title: "R  Takeaway report wall",
    lines: [
      "4 timber rails: 2060 L × 70 H × 35 D",
      "28 A5 sets in 7 columns × 4 rows",
      "A5 sheet: 148 × 210",
    ],
  },
  {
    title: "P / V  Projector / image",
    lines: [
      "Epson EB-992F; throw: 3600",
      "Image: 2400 W × 1350 H",
      "Lens / image top: 2395 AFF",
      "Image bottom: 1045 AFF",
    ],
  },
];

export const students = [
  ["01", "Andy 鄭", "S1 / Upper", "180 × 180 × 140"],
  ["02", "Ady Yu Steven Wong", "S1 / Upper", "180 × 170 × 170"],
  ["03", "Angie Lo", "S1 / Lower", "170 × 160 × 110"],
  ["04", "曹英堯", "S1 / Lower", "170 × 160 × 110"],
  ["07", "Unknown", "S1 / Upper", "180 × 200 × 190"],
  ["11", "伍英傑", "S1 / Lower", "190 × 190 × 70"],
  ["15", "Familia Sang 岑吳珍玲", "S1 / Upper", "170 × 170 × 380"],
  ["16", "岑順欽", "S1 / Lower", "170 × 170 × 120"],
  ["17", "小強", "S1 / Upper", "170 × 180 × 330"],
  ["18", "Billy FC Wong", "S2 / Upper", "170 × 180 × 90"],
  ["22", "Jenny", "S2 / Upper", "170 × 180 × 80"],
  ["23", "淑", "S2 / Upper", "170 × 190 × 75"],
  ["24", "軒", "S2 / Lower", "190 × 190 × 80"],
  ["26", "楊紹祖", "S2 / Lower", "190 × 200 × 80"],
  ["29", "Teresa Ho", "S2 / Lower", "160 × 200 × 100"],
];

// [text, x, y, z, scale]
export const worldLabels = [
  ["4240", 14.97, 2.55, -10.85, 1],
  ["4188 boundary", 15.27, 1.85, -2.05, 0.85],
  ["4042", 15.27, 1.35, -2.05, 0.85],
  ["4501", 13.2, 2.15, -8.86, 1],
  ["3926", 13.2, 1.55, -3.7, 1],
  ["4960", 17.55, 1.9, -5.4, 1],
  ["9330 internal N–S", 17.55, 2.45, -6.5, 0.8],
  ["3600 lens to wall", 15.34, 1.35, -4.18, 0.75],
  ["S1  2262 × 480", 14.15, 1.55, -8.7, 0.7],
  ["438 / 873 AFF", 14.15, 0.85, -8.7, 0.62],
  ["S2  1619 × 480", 16.1, 1.25, -6.75, 0.7],
  ["400 × 250 × 200", 14.35, 0.48, -9.31, 0.55],
  ["Deck 500 × 1000", 15.99, 0.62, -2.86, 0.6],
  ["Rails 2060 × 70 × 35", 14.97, 2.35, -10.55, 0.62],
  ["A5 148 × 210", 14.97, 2.05, -10.55, 0.55],
  ["2400 × 1350", 17.22, 2.55, -3.85, 0.7],
  ["2395 / 1045 AFF", 17.22, 2.2, -3.85, 0.58],
  ["01  180×180×140", 14.69, 1.12, -9.05, 0.42],
  ["02  180×170×170", 14.79, 1.16, -8.72, 0.42],
  ["03  170×160×110", 14.84, 0.66, -8.59, 0.42],
  ["04  170×160×110", 15.12, 0.66, -7.68, 0.42],
  ["07  180×200×190", 15.11, 1.18, -7.7, 0.42],
  ["11  190×190×70", 14.69, 0.62, -9.05, 0.42],
  ["15  170×170×380", 14.9, 1.32, -8.38, 0.42],
  ["16  170×170×120", 14.98, 0.68, -8.13, 0.42],
  ["17  170×180×330", 15.0, 1.28, -8.05, 0.42],
  ["18  170×180×90", 15.74, 1.08, -6.92, 0.42],
  ["22  170×180×80", 16.09, 1.06, -6.75, 0.42],
  ["23  170×190×75", 16.45, 1.06, -6.58, 0.42],
  ["24  190×190×80", 15.75, 0.64, -6.92, 0.42],
  ["26  190×200×80", 16.09, 0.64, -6.75, 0.42],
  ["29  160×200×100", 16.44, 0.66, -6.58, 0.42],
];
