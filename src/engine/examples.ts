import { PlanSchema, type Actor, type Block, type CalcStep, type Plan, type Verify } from './plan'

/** Worked example plans. They are the prompt's few-shot examples AND the test fixtures. */

const num = (n: number) => ({ num: n, ref: null })
export const calc = (id: string, op: CalcStep['op'], a: number, b: number): CalcStep => ({ id, op, a: num(a), b: num(b) })

export const block = (b: Partial<Block> & Pick<Block, 'type' | 'caption'>): Block => ({
  think: null, group: null, groups: [], count: null, sprite: null, color: null,
  actors: [], arrows: [], expr: null, x_min: null, x_max: null, marks: [], measure: null,
  ...b,
})

export const actor = (a: Partial<Actor> & Pick<Actor, 'id' | 'sprite' | 'x' | 'y'>): Actor => ({
  motion: 'none', flip: false, label: '', say: '', ...a,
})

export const verify = (v: Partial<Verify>): Verify => ({
  kind: 'none', calc: [], example_calc: [], faithful: true, expr: null, variable: null,
  options: [], correct: null, why_wrong: [], reference: null, rubric: null, hints: [],
  ...v,
})

const plan = (p: Partial<Plan> & Pick<Plan, 'asked' | 'category' | 'mode' | 'verify' | 'chunks'>): Plan =>
  PlanSchema.parse({ status: 'complete', message: '', missing: [], clarify: [], about_technology: false, ...p })

/** An unusable question: no plan, just a message. */
export const refusal = (status: Plan['status'], message: string, missing: string[] = [], clarify: string[] = []): Plan =>
  PlanSchema.parse({
    status, message, missing, clarify, about_technology: false, category: 'none', asked: '', mode: 'none', verify: verify({}), chunks: [],
  })

// ---- word problem, the question's own objects --------------------------------------------------
export const applesPlan = plan({
  category: 'word_problem',
  asked: 'How many apples do you have in total?',
  mode: 'objects',
  verify: verify({ kind: 'calc', calc: [calc('total', 'add', 3, 4)], hints: ['Count every apple, the red ones and the green ones.'] }),
  chunks: [{
    title: 'Put the apples together',
    blocks: [
      block({ type: 'spawn', caption: 'You have **3 apples**.', group: 'mine', count: 3, sprite: 'apple', color: 'red' }),
      block({ type: 'spawn', caption: 'You get **4 more apples**.', group: 'extra', count: 4, sprite: 'apple', color: 'green' }),
      block({ type: 'merge', caption: 'Now you **put them together**.', group: 'all', groups: ['mine', 'extra'] }),
      block({ type: 'ask', caption: '**How many apples do you have now?**', group: 'all', measure: 'group_total' }),
    ],
  }],
})

// ---- a bare thing, not a question: explain what it is ------------------------------------------
export const squaresPlan = plan({
  category: 'math',
  asked: 'What does 7 squares look like, and how can you be sure how many there are?',
  mode: 'objects',
  verify: verify({ kind: 'evaluate', expr: '7', hints: ['Touch each square once as you count.', 'Count them again in a different order. Do you get the same number?'] }),
  chunks: [{
    title: 'Look at the squares',
    blocks: [
      block({ type: 'spawn', caption: 'This is **7 squares**. The number 7 tells you how many there are.', group: 'sq', count: 7, sprite: 'square', color: 'blue', think: 'How can you count them without missing one or counting one twice?' }),
      block({ type: 'ask', caption: '**How many squares are there?**', group: 'sq', measure: 'group_total' }),
    ],
  }],
})

// ---- pure math, invented example with the real numbers -----------------------------------------
export const dividePlan = plan({
  category: 'math',
  asked: 'How many are in each group when 12 is split into 3 equal groups?',
  mode: 'example',
  verify: verify({ kind: 'calc', calc: [calc('each', 'div', 12, 3)], hints: ['Look at one plate. How many cookies are on it?'] }),
  chunks: [{
    title: 'Share the cookies',
    blocks: [
      block({ type: 'spawn', caption: 'Imagine you have **12 cookies**.', group: 'cookies', count: 12, sprite: 'cookie', color: 'orange' }),
      block({ type: 'split', caption: 'You share them equally onto **3 plates**.', group: 'cookies', count: 3 }),
      block({ type: 'ask', caption: 'So 12 ÷ 3 means splitting into 3 equal groups. **How many cookies are on each plate?**', group: 'cookies', measure: 'per_basket' }),
    ],
  }],
})

// ---- numbers too big to draw: scaled analogy ----------------------------------------------------
export const percentPlan = plan({
  category: 'math',
  asked: 'What is 15% of 200?',
  mode: 'example',
  verify: verify({
    kind: 'calc', faithful: false,
    calc: [calc('part', 'percent', 15, 200)],
    example_calc: [calc('part', 'percent', 15, 20)],
    hints: ['A percent means "out of 100". Find the share of 100 first.'],
  }),
  chunks: [
    {
      title: 'Picture the whole',
      blocks: [block({ type: 'spawn', caption: 'Picture a box of cookies. This is an analogy: we use **20** cookies instead of 200 so we can see them all.', group: 'box', count: 20, sprite: 'cookie', color: 'orange' })],
    },
    {
      title: 'Take the share',
      blocks: [
        block({ type: 'highlight', caption: '15% means **15 out of every 100**. Here is the same share of our box.', group: 'box', count: 3 }),
        block({ type: 'ask', caption: '**How many cookies glow?** Then use the same idea on 200.', group: 'box', measure: 'highlighted' }),
      ],
    },
  ],
})

// ---- money: one object stands for a unit, so the picture reads small but the learner answers in baht ----
export const changePlan = plan({
  category: 'word_problem',
  asked: 'How much change do you get back?',
  mode: 'objects',
  verify: verify({
    kind: 'calc', faithful: false,
    calc: [
      calc('cost', 'mul', 4, 25),
      { id: 'change', op: 'sub', a: { num: 200, ref: null }, b: { num: null, ref: 'cost' } },
    ],
    // the same calculation in units of 25 baht: you pay 8 units, the notebooks cost 4 units
    example_calc: [calc('left', 'sub', 8, 4)],
    hints: ['Each notebook costs one coin. How many coins are left?', 'Each coin is worth 25 baht.'],
  }),
  chunks: [{
    title: 'Pay and get change',
    blocks: [
      block({ type: 'spawn', caption: 'You pay with a **200 baht** note. Think of it as **8 coins**. Each coin is **25 baht**.', group: 'money', count: 8, sprite: 'coin', color: 'yellow' }),
      block({ type: 'spawn', caption: 'You buy **4 notebooks**. Each notebook costs **1 coin**.', group: 'books', count: 4, sprite: 'book', color: 'red' }),
      block({ type: 'take_away', caption: 'You pay for the notebooks with **4 coins**.', group: 'money', count: 4 }),
      block({ type: 'ask', caption: '**How much change do you get?** Look at the coins left. Each one is 25 baht.', group: 'money', measure: 'group_total' }),
    ],
  }],
})

// ---- fewer objects than sharers: cut into slices -----------------------------------------------
export const fractionPlan = plan({
  category: 'math',
  asked: 'If 5 cakes are shared equally between 6 people, how much cake does each person get?',
  mode: 'example',
  verify: verify({ kind: 'calc', calc: [calc('each', 'div', 5, 6)], hints: ['One plate has some slices. How many slices make one whole cake?'] }),
  chunks: [{
    title: 'Try to share',
    blocks: [
      block({ type: 'spawn', caption: 'Imagine **5 cakes**.', group: 'cakes', count: 5, sprite: 'cake', color: 'pink' }),
      block({ type: 'cut', caption: 'There is not enough for a whole cake each. Cut every cake into **6 equal slices**.', group: 'cakes', count: 6, think: 'Why do we cut into 6 slices?' }),
      block({ type: 'split', caption: 'Now share the slices equally onto **6 plates**.', group: 'cakes', count: 6 }),
      block({ type: 'ask', caption: 'So 5 ÷ 6 means sharing 5 between 6. **What part of a cake does each plate get?**', group: 'cakes', measure: 'per_basket_fraction' }),
    ],
  }],
})

export const halvesPlan = plan({
  category: 'math',
  asked: 'If 7 cookies are shared between 2 friends, how much does each friend get?',
  mode: 'example',
  verify: verify({ kind: 'calc', calc: [calc('each', 'div', 7, 2)] }),
  chunks: [{
    title: 'Share the cookies',
    blocks: [
      block({ type: 'spawn', caption: 'You have **7 cookies**.', group: 'c', count: 7, sprite: 'cookie', color: 'orange' }),
      block({ type: 'cut', caption: '7 will not share evenly. Cut each cookie into **2 halves**.', group: 'c', count: 2 }),
      block({ type: 'split', caption: 'Share the halves onto **2 plates**.', group: 'c', count: 2 }),
      block({ type: 'ask', caption: '**How many cookies does each plate get?**', group: 'c', measure: 'per_basket_fraction' }),
    ],
  }],
})

export const oneBasketPlan = plan({
  category: 'math',
  asked: 'If 11 are shared into 1 group, how many are in it?',
  mode: 'example',
  verify: verify({ kind: 'calc', calc: [calc('each', 'div', 11, 1)] }),
  chunks: [{
    title: 'Share',
    blocks: [
      block({ type: 'spawn', caption: 'Imagine **11 cookies**.', group: 'c', count: 11, sprite: 'cookie', color: 'orange' }),
      block({ type: 'split', caption: 'Put them all on **1 plate**.', group: 'c', count: 1 }),
      block({ type: 'ask', caption: '**How many cookies are on the plate?**', group: 'c', measure: 'per_basket' }),
    ],
  }],
})

// ---- algebra: balance scale, checked by the math engine ----------------------------------------
export const algebraPlan = plan({
  category: 'math',
  asked: 'Which number is hiding in the box, so the equation is true?',
  mode: 'example',
  verify: verify({
    kind: 'solve', expr: 'x + 3 = 10', variable: 'x',
    hints: ['Whatever you do to one side, do to the other side.', 'Take the 3 away from both sides.'],
  }),
  chunks: [{
    title: 'Keep the scale level',
    blocks: [
      block({ type: 'balance', caption: 'A box hides a number. The box and **3 blocks** balance **10 blocks**.', expr: 'x + 3 = 10', think: 'What can you do to find the box, and keep the scale level?' }),
      block({ type: 'ask', caption: '**How many blocks are in the box?**', measure: 'balance_value' }),
    ],
  }],
})

// ---- advanced math: graph + scenes, checked by the math engine ---------------------------------
export const derivativePlan = plan({
  category: 'advanced_math',
  asked: 'How steep is the curve x³ at every point? Find the formula for its slope.',
  mode: 'concept',
  verify: verify({
    kind: 'derivative', expr: 'x^3', variable: 'x',
    hints: ['Use the power rule: bring the power down in front.', 'Then make the power one smaller.'],
  }),
  chunks: [
    {
      title: 'What is a derivative?',
      blocks: [
        block({ type: 'graph', caption: 'This is the curve **y = x³**.', expr: 'x^3', x_min: -2, x_max: 2, think: 'Where does the curve look steepest? Where does it look flat?' }),
        block({
          type: 'scene', caption: 'The **derivative** tells you how steep the road is at each point.',
          actors: [
            actor({ id: 'flat', sprite: 'car', x: 22, y: 70, motion: 'walk_in', label: 'gentle slope' }),
            actor({ id: 'steep', sprite: 'car', x: 72, y: 30, motion: 'pop_in', label: 'steep slope' }),
          ],
          arrows: [{ from: 'flat', to: 'steep', label: 'steeper' }],
        }),
      ],
    },
    {
      title: 'The power rule',
      blocks: [
        block({
          type: 'scene', caption: 'A rule helps: the **power rule**. For example, x² becomes 2x.',
          actors: [
            actor({ id: 'before', sprite: 'box', x: 20, y: 55, motion: 'pop_in', label: 'x^2' }),
            actor({ id: 'after', sprite: 'box', x: 80, y: 55, motion: 'pop_in', label: '2x', say: 'power comes down' }),
          ],
          arrows: [{ from: 'before', to: 'after', label: 'power rule' }],
        }),
        block({ type: 'ask', caption: '**Use the power rule on x³. What is the derivative?**' }),
      ],
    },
  ],
})

// ---- general "what is X": one everyday comparison, three tiny cards, one easy check ---------------
export const conceptPlan = plan({
  category: 'general',
  about_technology: true,
  asked: 'What is artificial intelligence?',
  mode: 'concept',
  verify: verify({
    kind: 'choice',
    options: [
      'A calculator that adds numbers using fixed steps',
      'A program that learns to spot junk email by looking at thousands of examples',
      'A light that turns on when you press a switch',
    ],
    correct: 1,
    why_wrong: [
      'A calculator follows fixed steps that a person wrote. It does not learn.',
      '',
      'A switch always does the same one thing. It never learns.',
    ],
    hints: ['Which one gets better by looking at many examples?'],
  }),
  chunks: [{
    title: 'An everyday example',
    blocks: [
      block({
        type: 'scene', caption: 'Think of a **child learning what a dog is**.',
        actors: [
          actor({ id: 'child', sprite: 'child', x: 25, y: 60, motion: 'walk_in', label: 'child' }),
          actor({ id: 'dog1', sprite: 'dog', x: 70, y: 66, motion: 'pop_in', flip: true, label: 'dog' }),
        ],
      }),
      block({
        type: 'scene', caption: 'Nobody gives the child rules. The child just sees **many dogs**.',
        actors: [
          actor({ id: 'child', sprite: 'child', x: 12, y: 60, label: 'child' }),
          actor({ id: 'dog1', sprite: 'dog', x: 45, y: 32, motion: 'pop_in', flip: true }),
          actor({ id: 'dog2', sprite: 'dog', x: 75, y: 32, motion: 'pop_in' }),
          actor({ id: 'dog3', sprite: 'dog', x: 45, y: 78, motion: 'pop_in' }),
          actor({ id: 'dog4', sprite: 'dog', x: 75, y: 78, motion: 'pop_in', flip: true }),
        ],
      }),
    ],
  }, {
    title: 'The real thing',
    blocks: [
      block({
        type: 'scene', caption: '**AI** is a computer that learns the same way: from many examples.',
        actors: [
          actor({ id: 'dog1', sprite: 'dog', x: 15, y: 22, flip: true }),
          actor({ id: 'dog2', sprite: 'dog', x: 15, y: 52, flip: true }),
          actor({ id: 'dog3', sprite: 'dog', x: 15, y: 82, flip: true }),
          actor({ id: 'pc', sprite: 'computer', x: 72, y: 52, motion: 'glow', label: 'AI', say: 'Dog!' }),
        ],
        arrows: [{ from: 'dog1', to: 'pc', label: 'shows' }, { from: 'dog2', to: 'pc', label: 'shows' }, { from: 'dog3', to: 'pc', label: 'shows' }],
      }),
      block({ type: 'ask', caption: '**Which one is closest to AI?**' }),
    ],
  }],
})

// ---- "what is X": everyday example first, then the real thing, then the answer -----------------------
export const cpuPlan = plan({
  category: 'general',
  about_technology: true,
  asked: 'What is a CPU?',
  mode: 'concept',
  verify: verify({
    kind: 'choice',
    options: [
      'Working out the total of a list of numbers in a spreadsheet',
      'Keeping your photos safe when the power is off',
      'Lighting up the screen so you can see',
    ],
    correct: 0,
    why_wrong: [
      '',
      'Keeping things safe when the power is off is the job of storage, not the CPU.',
      'Lighting up the screen is the job of the display, not the CPU.',
    ],
    hints: ['Which job needs someone to follow steps and calculate?'],
  }),
  chunks: [
    {
      title: 'An everyday example',
      blocks: [
        block({
          type: 'scene', caption: 'A **cook** works in a kitchen. The cook reads a recipe.',
          actors: [
            actor({ id: 'worker', sprite: 'child', x: 25, y: 55, motion: 'walk_in', label: 'cook' }),
            actor({ id: 'steps', sprite: 'book', x: 72, y: 55, motion: 'pop_in', label: 'recipe' }),
          ],
          arrows: [{ from: 'steps', to: 'worker', label: 'tells' }],
        }),
        block({
          type: 'scene', caption: 'The cook follows the steps, one by one, and makes the food.',
          actors: [
            actor({ id: 'worker', sprite: 'child', x: 25, y: 55, label: 'cook' }),
            actor({ id: 'steps', sprite: 'book', x: 55, y: 55, label: 'recipe' }),
            actor({ id: 'result', sprite: 'cookie', x: 85, y: 55, motion: 'pop_in', label: 'food' }),
          ],
          arrows: [{ from: 'steps', to: 'worker', label: 'tells' }, { from: 'worker', to: 'result', label: 'makes' }],
        }),
      ],
    },
    {
      title: 'The real thing',
      blocks: [
        block({
          type: 'scene', caption: 'A **CPU** is the cook inside your computer.',
          actors: [
            actor({ id: 'worker', sprite: 'chip', x: 25, y: 55, motion: 'pop_in', label: 'CPU', say: 'I follow steps' }),
            actor({ id: 'steps', sprite: 'book', x: 55, y: 55, label: 'program' }),
            actor({ id: 'result', sprite: 'computer', x: 85, y: 55, motion: 'pop_in', label: 'computer' }),
          ],
          arrows: [{ from: 'steps', to: 'worker', label: 'tells' }, { from: 'worker', to: 'result', label: 'shows' }],
        }),
        block({
          type: 'scene', caption: 'The recipe is a **program**. The CPU follows its steps, very fast.',
          actors: [
            actor({ id: 'worker', sprite: 'chip', x: 25, y: 55, motion: 'glow', label: 'CPU' }),
            actor({ id: 'steps', sprite: 'book', x: 55, y: 55, label: 'program' }),
            actor({ id: 'result', sprite: 'phone', x: 85, y: 55, label: 'your screen' }),
          ],
          arrows: [{ from: 'steps', to: 'worker', label: 'tells' }, { from: 'worker', to: 'result', label: 'shows' }],
        }),
        block({ type: 'ask', caption: '**Which job is the CPU doing?**' }),
      ],
    },
  ],
})

// ---- "what is X" in the world of physics: no person and no computer, just cars, a house and trees ------
export const velocityPlan = plan({
  category: 'general',
  asked: 'What is velocity?',
  mode: 'concept',
  verify: verify({
    kind: 'choice',
    options: [
      'A car that drives 50 km in 1 hour toward the north',
      'A car that is 50 km long',
      'A car parked on a road, facing north',
    ],
    correct: 0,
    why_wrong: [
      '',
      'Velocity is about how something moves, not how big it is.',
      'A parked car is not moving, so it has no speed to measure.',
    ],
    hints: ['Velocity needs two things: how fast, and which way.'],
  }),
  chunks: [
    {
      title: 'An everyday example',
      blocks: [
        block({
          type: 'scene', caption: 'Two cars leave the same place at the same time.',
          actors: [
            actor({ id: 'start', sprite: 'house', x: 12, y: 52, label: 'start' }),
            actor({ id: 'fast', sprite: 'car', x: 50, y: 24, label: 'fast car' }),
            actor({ id: 'slow', sprite: 'car', x: 50, y: 80, label: 'slow car' }),
          ],
          arrows: [{ from: 'start', to: 'fast', label: 'starts' }, { from: 'start', to: 'slow', label: 'starts' }],
        }),
        block({
          type: 'scene', caption: 'After one hour, the fast car has gone much farther.',
          actors: [
            actor({ id: 'start', sprite: 'house', x: 12, y: 52, label: 'start' }),
            actor({ id: 'fast', sprite: 'car', x: 50, y: 24, label: 'fast car' }),
            actor({ id: 'slow', sprite: 'car', x: 50, y: 80, label: 'slow car' }),
            actor({ id: 'far', sprite: 'tree', x: 88, y: 24, label: 'far' }),
            actor({ id: 'near', sprite: 'tree', x: 72, y: 80, label: 'near' }),
          ],
          arrows: [
            { from: 'start', to: 'fast', label: 'starts' }, { from: 'start', to: 'slow', label: 'starts' },
            { from: 'fast', to: 'far', label: 'reaches' }, { from: 'slow', to: 'near', label: 'reaches' },
          ],
        }),
      ],
    },
    {
      title: 'The real thing',
      blocks: [
        block({
          type: 'scene', caption: '**Velocity** tells how fast something moves, and which way.',
          actors: [
            actor({ id: 'start', sprite: 'house', x: 12, y: 52, label: 'start' }),
            actor({ id: 'fast', sprite: 'car', x: 50, y: 24, label: 'big velocity', motion: 'glow' }),
            actor({ id: 'slow', sprite: 'car', x: 50, y: 80, label: 'small velocity' }),
            actor({ id: 'far', sprite: 'tree', x: 88, y: 24, label: 'far' }),
            actor({ id: 'near', sprite: 'tree', x: 72, y: 80, label: 'near' }),
          ],
          arrows: [
            { from: 'start', to: 'fast', label: 'starts' }, { from: 'start', to: 'slow', label: 'starts' },
            { from: 'fast', to: 'far', label: 'north' }, { from: 'slow', to: 'near', label: 'north' },
          ],
        }),
        block({ type: 'ask', caption: '**Which one tells a car\'s velocity?**' }),
      ],
    },
  ],
})

/** Each example with the question it answers. Used in the prompt. */
export const EXAMPLES: [question: string, plan: Plan][] = [
  ['I have 3 apples and get 4 more', applesPlan],
  ['7 squares', squaresPlan],
  ['A notebook costs 25 baht. You buy 4 and pay with 200 baht. How much change?', changePlan],
  ['12 / 3', dividePlan],
  ['15% of 200', percentPlan],
  ['5 / 6', fractionPlan],
  ['x + 3 = 10', algebraPlan],
  ['differentiate x^3', derivativePlan],
  ['what is velocity?', velocityPlan],
  ['what is a CPU?', cpuPlan],
  ['what is artificial intelligence?', conceptPlan],
  ['5 apples, gave away 8', refusal('invalid', 'You only have 5 apples, so you cannot give away 8.')],
  ['3 and 4', refusal('unclear', 'I can see 3 and 4. What do you want to do with them? Pick one.', [], ['3 + 4', '4 - 3', 'Which is bigger, 3 or 4?'])],
]
