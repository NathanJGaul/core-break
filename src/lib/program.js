// The training program: five movements, versions of each by difficulty level,
// 4-week blocks, and three rotating session templates.

export const PATTERNS = {
  antiExtension: { name: 'Resist arching', hint: 'Hollow body, dead bug' },
  antiLateral: { name: 'Resist side-bending', hint: 'Side plank' },
  flexion: { name: 'Curl the spine', hint: 'Bicycle, reverse crunch' }
};

// level: 'easy' (block 1), 'standard', 'tempo', 'leverage'
export const EXERCISES = {
  hollow: {
    name: 'Hollow body hold',
    pattern: 'antiExtension',
    versions: {
      easy: {
        label: 'Tucked hollow hold',
        cues: [
          'Lie on your back, knees bent and pulled in over your hips.',
          'Press your lower back flat into the mat. This matters more than anything else.',
          'Lift your shoulder blades slightly and reach your hands toward your shins.'
        ]
      },
      standard: {
        label: 'Hollow body hold',
        cues: [
          'Lower back pressed flat the whole time.',
          'Legs straight and a few inches off the floor, arms reaching toward your feet.',
          'If your back lifts, raise your legs higher until it stays down.'
        ]
      },
      tempo: {
        label: 'Hollow hold with slow leg lowers',
        cues: [
          'Start with legs up high, lower back flat.',
          'Take 3 seconds to lower your legs, pause 1 second at the lowest point you can keep your back down.',
          'Raise them and repeat.'
        ]
      },
      leverage: {
        label: 'Hollow hold, arms overhead',
        cues: [
          'Arms straight overhead, biceps by your ears.',
          'Legs straight and low, lower back glued to the mat.',
          'Squeeze your glutes and breathe behind your braced stomach.'
        ]
      }
    }
  },
  deadbug: {
    name: 'Dead bug',
    pattern: 'antiExtension',
    versions: {
      easy: {
        label: 'Dead bug heel taps',
        cues: [
          'Arms pointing at the ceiling, knees bent at 90° over your hips.',
          'Keep the knee bent and slowly lower one heel to tap the floor, then return.',
          'Alternate sides. Lower back stays flat.'
        ]
      },
      standard: {
        label: 'Dead bug',
        cues: [
          'Extend your opposite arm and leg toward the floor at the same time.',
          'Stop just above the floor, then return and switch sides.',
          'Exhale as you extend. Your lower back never lifts.'
        ]
      },
      tempo: {
        label: 'Slow dead bug',
        cues: [
          'Take 3 seconds to extend opposite arm and leg.',
          'Pause 1 second just above the floor.',
          'Return and switch. Slow is the point.'
        ]
      },
      leverage: {
        label: 'Straight-leg dead bug',
        cues: [
          'Both legs straight up toward the ceiling, arms up too.',
          'Lower one straight leg and the opposite arm toward the floor.',
          'Keep your lower back flat. Bend the knee slightly if it arches.'
        ]
      }
    }
  },
  sideplank: {
    name: 'Side plank with reach-through',
    pattern: 'antiLateral',
    sided: true,
    versions: {
      easy: {
        label: 'Knee side plank with reach-through',
        cues: [
          'Elbow under your shoulder, knees bent and stacked, hips lifted.',
          'Reach your top arm to the ceiling, then thread it under your body.',
          'Keep your hips high. Hold still in the plank if reaching breaks form.'
        ]
      },
      standard: {
        label: 'Side plank with reach-through',
        cues: [
          'Elbow under your shoulder, feet stacked or staggered, body in a straight line.',
          'Reach the top arm up, then thread it under your torso.',
          'Hips stay lifted. Rotate from your ribs, not your hips.'
        ]
      },
      tempo: {
        label: 'Slow side plank reach-through',
        cues: [
          'Take 3 seconds to thread your arm under your body.',
          'Pause 1 second at the deepest point.',
          'Return to the top under control.'
        ]
      },
      leverage: {
        label: 'Side plank reach-through, top leg raised',
        cues: [
          'From a full side plank, lift your top leg and hold it.',
          'Thread your top arm under and back up.',
          'If hips drop, lower the leg and keep going.'
        ]
      }
    }
  },
  bicycle: {
    name: 'Bicycle crunch',
    pattern: 'flexion',
    versions: {
      easy: {
        label: 'Slow bicycle, legs high',
        cues: [
          'Hands lightly behind your head, shoulder blades off the floor.',
          'Keep the extended leg high, closer to vertical. It is easier.',
          'Turn your ribs toward the opposite knee. Do not pull on your neck.'
        ]
      },
      standard: {
        label: 'Bicycle crunch',
        cues: [
          'Shoulder blades off the floor, extended leg at about 45°.',
          'Rotate your rib cage toward the bent knee, not just your elbow.',
          'Steady pace, no flailing.'
        ]
      },
      tempo: {
        label: 'Slow bicycle with pause',
        cues: [
          'Take 2–3 seconds to rotate to each side.',
          'Pause 1 second at full rotation.',
          'Lower back stays down.'
        ]
      },
      leverage: {
        label: 'Low bicycle with hold',
        cues: [
          'Extended leg hovers just off the floor.',
          'Hold each rotation for 1 second.',
          'If your back arches, raise the leg.'
        ]
      }
    }
  },
  reverse: {
    name: 'Reverse crunch',
    pattern: 'flexion',
    versions: {
      easy: {
        label: 'Small reverse crunch',
        cues: [
          'Knees bent at 90°, arms by your sides pressing into the floor.',
          'Curl your hips just off the mat by pulling your knees toward your chest.',
          'Lower slowly. A small range done well counts.'
        ]
      },
      standard: {
        label: 'Reverse crunch',
        cues: [
          'Knees toward your chest, curl your tailbone up off the mat.',
          'Lower vertebra by vertebra.',
          'Do not swing. Your abs lift you, not momentum.'
        ]
      },
      tempo: {
        label: 'Slow reverse crunch',
        cues: [
          'Curl up in 1 second, pause 1 second at the top.',
          'Take 3 seconds to lower.',
          'Feet stay off the floor between reps.'
        ]
      },
      leverage: {
        label: 'Long-lever reverse crunch',
        cues: [
          'Legs much straighter, knees only slightly bent.',
          'Curl your hips up and roll down slowly.',
          'Lower the legs to a hover between reps without arching.'
        ]
      }
    }
  }
};

// Each session: five 1-minute intervals. Side planks always come in L/R pairs.
export const TEMPLATES = [
  {
    id: 'A',
    intervals: [
      { ex: 'hollow' },
      { ex: 'sideplank', side: 'left' },
      { ex: 'reverse' },
      { ex: 'sideplank', side: 'right' },
      { ex: 'hollow' }
    ]
  },
  {
    id: 'B',
    intervals: [
      { ex: 'deadbug' },
      { ex: 'bicycle' },
      { ex: 'sideplank', side: 'left' },
      { ex: 'sideplank', side: 'right' },
      { ex: 'deadbug' }
    ]
  },
  {
    id: 'C',
    intervals: [
      { ex: 'reverse' },
      { ex: 'deadbug' },
      { ex: 'hollow' },
      { ex: 'bicycle' },
      { ex: 'reverse' }
    ]
  }
];

const FIXED_BLOCKS = [
  { name: 'Foundation', work: 20, rest: 40, level: 'easy', focus: 'Easier versions of every move. Learn to keep your lower back flat.' },
  { name: 'Standard', work: 30, rest: 30, level: 'standard', focus: 'Full versions of every move.' },
  { name: 'Volume', work: 40, rest: 20, level: 'standard', focus: 'Same moves, more time under tension.' },
  { name: 'Tempo', work: 40, rest: 20, level: 'tempo', focus: 'Slow 3-second lowering and a pause at the hardest point.' },
  { name: 'Leverage', work: 45, rest: 15, level: 'leverage', focus: 'Longer levers: arms overhead, straighter legs, raised top leg.' }
];

export const BLOCK_DAYS = 28;

/** Block definition for a 0-based block number. Past block 5 it alternates tempo and leverage. */
export function getBlock(index) {
  if (index < FIXED_BLOCKS.length) return { index, ...FIXED_BLOCKS[index] };
  const n = index - FIXED_BLOCKS.length;
  const tempo = n % 2 === 0;
  return {
    index,
    name: tempo ? 'Advanced tempo' : 'Advanced leverage',
    work: tempo ? 45 : 50,
    rest: tempo ? 15 : 10,
    level: tempo ? 'tempo' : 'leverage',
    focus: tempo
      ? 'Slow tempo with longer work sets. Add a 2-second pause where 1 second felt easy.'
      : 'Long-lever versions, longest work sets yet.'
  };
}

export function buildIntervals(templateIndex, blockIndex) {
  const block = getBlock(blockIndex);
  return TEMPLATES[templateIndex].intervals.map((it) => {
    const ex = EXERCISES[it.ex];
    const v = ex.versions[block.level];
    return {
      ex: it.ex,
      side: it.side ?? null,
      name: ex.name,
      label: v.label,
      cues: v.cues,
      pattern: ex.pattern,
      work: block.work,
      rest: block.rest
    };
  });
}

export const SESSION_GET_READY = 10; // seconds before the first interval
