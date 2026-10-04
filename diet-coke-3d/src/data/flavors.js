// Flavor lineup. `label` is the ink colour printed on the can, `theme` drives
// the page colours while the flavors section is on screen.
export const FLAVORS = [
  {
    id: 'classic',
    index: '01',
    name: 'Classic',
    tagline: 'The silver original.',
    description:
      'Crisp, clean and impossibly light. The can that started it all in 1982, still the sharpest thing in the fridge.',
    notes: ['Crisp', 'Clean', 'Iconic'],
    label: '#E4002B',
    theme: { bg: '#161618', fg: '#F4F4F2', accent: '#E4002B', bubble: '#ffffff' },
  },
  {
    id: 'cherry',
    index: '02',
    name: 'Cherry',
    tagline: 'Dark, juicy, a little mischievous.',
    description:
      'A ripe cherry twist that rolls in sweet and finishes tart, still without a single gram of sugar.',
    notes: ['Juicy', 'Tart', 'Bold'],
    label: '#B0123F',
    theme: { bg: '#4A0A20', fg: '#FFE8EF', accent: '#FF3B6B', bubble: '#ffd6e2' },
  },
  {
    id: 'lime',
    index: '03',
    name: 'Lime',
    tagline: 'Zest, meet fizz.',
    description:
      'A squeeze of bright citrus that cuts straight through the bubbles. Sharp, cold and wide awake.',
    notes: ['Zesty', 'Bright', 'Sharp'],
    label: '#3E9B2F',
    theme: { bg: '#CDE66B', fg: '#12210A', accent: '#2F7D22', bubble: '#ffffff' },
  },
  {
    id: 'mango',
    index: '04',
    name: 'Mango',
    tagline: 'Sunshine in a can.',
    description:
      'Golden, tropical and smooth, with just enough tang to keep you coming back for one more sip.',
    notes: ['Tropical', 'Smooth', 'Sunny'],
    label: '#F57C00',
    theme: { bg: '#FFB443', fg: '#2B1500', accent: '#C24E00', bubble: '#fff4e0' },
  },
];

// Page themes, keyed by each section's data-theme attribute.
export const THEMES = {
  ink: { bg: '#0B0B0C', fg: '#F4F4F2', accent: '#E4002B', bubble: '#ffffff' },
  paper: { bg: '#ECEDEF', fg: '#0B0B0C', accent: '#E4002B', bubble: '#8a929a' },
  red: { bg: '#E4002B', fg: '#FFFFFF', accent: '#0B0B0C', bubble: '#ffffff' },
  ice: { bg: '#DCE6EC', fg: '#0E1A22', accent: '#E4002B', bubble: '#9fb2c1' },
};
