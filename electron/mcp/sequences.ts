/**
 * Auto Operation Sequences
 *
 * Defines all predefined operation sequences for device automation.
 * These sequences are used by both MCP tools and UI.
 */

/** Represents a single step in the auto operation sequence */
export interface AutoStep {
  label: string;
  x: number;
  y: number;
  depth: number;
  /** Optional delay in ms after this step (default: 200ms) */
  delayAfter?: number;
  /** If set, performs a swipe from (x,y) to swipeTo coordinates instead of a click */
  swipeTo?: { x: number; y: number };
  /** Delay in ms before raising stylus after swipe (default: 50ms) */
  swipeHoldDelay?: number;
}

// ============================================================================
// Keyboard coordinate mapping
// ============================================================================

/** Keyboard letter coordinates */
export const LETTER_COORDS: Record<string, { x: number; y: number }> = {
  q: { x: 19, y: 74 }, w: { x: 24, y: 74 }, e: { x: 28, y: 74 }, r: { x: 33, y: 74 },
  t: { x: 37, y: 74 }, y: { x: 41, y: 74 }, u: { x: 45, y: 74 }, i: { x: 50, y: 74 },
  o: { x: 55, y: 74 }, p: { x: 59, y: 74 },
  a: { x: 19, y: 80 }, s: { x: 24, y: 80 }, d: { x: 29, y: 80 }, f: { x: 34, y: 80 },
  g: { x: 39, y: 80 }, h: { x: 44, y: 80 }, j: { x: 49, y: 80 }, k: { x: 54, y: 80 },
  l: { x: 59, y: 80 },
  z: { x: 25, y: 88 }, x: { x: 30, y: 88 }, c: { x: 35, y: 88 }, v: { x: 39, y: 88 },
  b: { x: 44, y: 88 }, n: { x: 49, y: 88 }, m: { x: 54, y: 88 },
};

/** Number coordinates on PIN pad */
export const NUMBER_COORDS: Record<string, { x: number; y: number }> = {
  '1': { x: 25, y: 50 },
  '2': { x: 35, y: 50 },
  '3': { x: 45, y: 50 },
  '4': { x: 25, y: 60 },
  '5': { x: 35, y: 60 },
  '6': { x: 45, y: 60 },
  '7': { x: 25, y: 70 },
  '8': { x: 35, y: 70 },
  '9': { x: 45, y: 70 },
  '0': { x: 35, y: 80 },
};

/** Confirm button coordinate */
export const CONFIRM_COORD = { x: 59, y: 87 };

/** Cancel/Back button coordinate */
export const CANCEL_COORD = { x: 19, y: 87 };

/** Device button coordinates */
export const DEVICE_BUTTONS = {
  confirm: { x: 55, y: 85 },
  cancel: { x: 25, y: 85 },
  back: { x: 19, y: 87 },
  continue: { x: 55, y: 85 },
  next: { x: 55, y: 85 },
  finish: { x: 55, y: 85 },
};

// ============================================================================
// Helper functions
// ============================================================================

/**
 * Generates AutoStep array from a list of words.
 * Each word becomes: letter steps + confirm step.
 */
export function generateWordSteps(words: string[]): AutoStep[] {
  const steps: AutoStep[] = [];
  words.forEach((word, wordIndex) => {
    const lowerWord = word.toLowerCase();
    for (let i = 0; i < lowerWord.length; i++) {
      const letter = lowerWord[i];
      const coord = LETTER_COORDS[letter];
      if (coord) {
        steps.push({
          label: `W${wordIndex + 1}:${letter}`,
          x: coord.x,
          y: coord.y,
          depth: 12,
          delayAfter: 1000,
        });
      }
    }
    // Add confirm step after each word
    steps.push({
      label: `W${wordIndex + 1}:confirm`,
      x: CONFIRM_COORD.x,
      y: CONFIRM_COORD.y,
      depth: 12,
      delayAfter: 2000,
    });
  });
  return steps;
}

// ============================================================================
// Mnemonic test data
// ============================================================================

/** 12-word mnemonics */
const MNEMONIC_12_1 = 'air census life sheriff attack include paper provide fantasy left opera sauce'.split(' ');
const MNEMONIC_12_2 = 'relief exchange burst bullet topple manage impose dumb raise panther sibling shove'.split(' ');
const MNEMONIC_12_3 = 'pyramid enforce season tide flag brisk law anchor refuse require reward negative'.split(' ');
const MNEMONIC_12_API = 'journey timber such lumber buzz room march brave cotton chat ensure control'.split(' ');

/** 18-word mnemonics */
const MNEMONIC_18_1 = 'slab canyon coffee wine gold bronze rigid peace output security boy quick vital cat become stove tape super'.split(' ');
const MNEMONIC_18_2 = 'arrange private session nose dial echo skull robust erode rain odor mango solve angle festival amazing decorate menu'.split(' ');
const MNEMONIC_18_3 = 'riot fee raise forget always city spring million spike purse tackle impose faith remove hover snap leopard kitchen'.split(' ');

/** 24-word mnemonics */
const MNEMONIC_24_1 = 'gorilla absent bone address stay minimum artist train piano coil gadget truck almost voice runway drip pony pizza uncover expose country enlist avocado hotel'.split(' ');
const MNEMONIC_24_2 = 'jazz cactus tower knee gift crazy tourist exile valid short exhibit cute asthma segment dragon write jacket ribbon cheese ignore use dwarf small dove'.split(' ');
const MNEMONIC_24_3 = 'post flock violin raven size harvest media cash divide blade scale eternal action comic ball increase track unhappy ask speed timber exist trim expose'.split(' ');

/** slip39 20-word (1 share) */
const SLIP39_20_1 = 'fake kidney academic academic dwarf orange primary secret mixed auction priority daughter script smell smear judicial ceramic glen theory emphasis'.split(' ');

/** slip39 20-word (2-3: 3 shares) */
const SLIP39_20_2_SHARE1 = 'network vexed academic acid alive forbid database equation average advocate golden careful exhaust dance texture satisfy lair negative earth flash'.split(' ');
const SLIP39_20_2_SHARE2 = 'network vexed academic agency calcium memory elegant merchant welcome oral evidence bulb union company suitable spend loud miracle story withdraw'.split(' ');
const SLIP39_20_2_SHARE3 = 'network vexed academic always debut unhappy veteran trust goat cluster easel penalty entrance drift mild uncover short sack excuse kitchen'.split(' ');
const SLIP39_20_2_ALL = [...SLIP39_20_2_SHARE1, ...SLIP39_20_2_SHARE2, ...SLIP39_20_2_SHARE3];

/** slip39 20-word (16-16: 16 shares) */
const SLIP39_20_16_SHARE1 = 'platform helpful academic afraid custody blind shaft burning visual prune knit clay mason genuine march crisis smug wits woman taught'.split(' ');
const SLIP39_20_16_SHARE2 = 'platform helpful academic alto armed theory alpha paces welcome quick quiet device craft strike chemical ocean briefing space phantom legal'.split(' ');
const SLIP39_20_16_SHARE3 = 'platform helpful academic anxiety cage sympathy dramatic western acrobat transfer oral spew package style scroll pajamas curious grant center alto'.split(' ');
const SLIP39_20_16_SHARE4 = 'platform helpful academic award cards category salt guest pharmacy devote pistol focus identify infant evoke recall shaft empty hazard romantic'.split(' ');
const SLIP39_20_16_SHARE5 = 'platform helpful academic bike clogs estate duke thank bolt floral race phrase preach seafood strategy industry crowd length grant yield'.split(' ');
const SLIP39_20_16_SHARE6 = 'platform helpful academic bracelet clock daughter memory visitor result blanket garbage starting speak clay junction pitch ladybug jacket fluff ultimate'.split(' ');
const SLIP39_20_16_SHARE7 = 'platform helpful academic burning credit install sidewalk level museum evening permit duke cards findings aunt document improve woman general august'.split(' ');
const SLIP39_20_16_SHARE8 = 'platform helpful academic carve ajar edge similar glance darkness random envelope glen ancestor gums view venture wealthy learn ivory exotic'.split(' ');
const SLIP39_20_16_SHARE9 = 'platform helpful academic class depend gather story empty harvest overall craft leaves nuclear reject kernel that temple width presence speak'.split(' ');
const SLIP39_20_16_SHARE10 = 'platform helpful academic company adequate western resident dismiss mortgage emperor coastal sack example ancestor mason length mama timber rhythm buyer'.split(' ');
const SLIP39_20_16_SHARE11 = 'platform helpful academic crucial domain bedroom violence mental multiple language sympathy grin beaver salt excuse pants worthy vegan prepare unfold'.split(' ');
const SLIP39_20_16_SHARE12 = 'platform helpful academic deadline crush depart thank pregnant treat salon ambition miracle sidewalk speak practice taxi soldier scholar vitamins junk'.split(' ');
const SLIP39_20_16_SHARE13 = 'platform helpful academic deploy chemical afraid justice undergo deny excuse famous entrance scene early photo glance salon platform wildlife ladle'.split(' ');
const SLIP39_20_16_SHARE14 = 'platform helpful academic diploma cricket trend loud replace rapids payment paces theory easel spine cultural dictate hormone necklace blimp exact'.split(' ');
const SLIP39_20_16_SHARE15 = 'platform helpful academic dragon company true volume carve dough endorse force plot cinema remember skin transfer criminal hunting axle mayor'.split(' ');
const SLIP39_20_16_SHARE16 = 'platform helpful academic easel deadline evil museum spill funding muscle retreat smart timely oven transfer grownup deal armed merchant flash'.split(' ');
const SLIP39_20_16_ALL = [
  ...SLIP39_20_16_SHARE1, ...SLIP39_20_16_SHARE2, ...SLIP39_20_16_SHARE3, ...SLIP39_20_16_SHARE4,
  ...SLIP39_20_16_SHARE5, ...SLIP39_20_16_SHARE6, ...SLIP39_20_16_SHARE7, ...SLIP39_20_16_SHARE8,
  ...SLIP39_20_16_SHARE9, ...SLIP39_20_16_SHARE10, ...SLIP39_20_16_SHARE11, ...SLIP39_20_16_SHARE12,
  ...SLIP39_20_16_SHARE13, ...SLIP39_20_16_SHARE14, ...SLIP39_20_16_SHARE15, ...SLIP39_20_16_SHARE16,
];

/** slip39 33-word (1 share) */
const SLIP39_33_1 = 'station industry academic academic aunt similar picture filter chubby vintage insect hairy charity priority ugly mandate credit faint segment mobile cage junior receiver reject crazy sympathy extra helpful expand force counter lamp rescue'.split(' ');

/** slip39 33-word (3-2: 3 shares) */
const SLIP39_33_2_SHARE1 = 'yoga racism academic acid average silent year kind package pitch bracelet desert aide guilt render belong density forbid spark benefit trend junior fake dough silver spray adequate western liberty hearing strike prepare various'.split(' ');
const SLIP39_33_2_SHARE2 = 'yoga racism academic agency antenna aircraft nervous biology buyer invasion satoshi angry darkness skin guilt market fatal violence item platform painting width involve marathon parking duration pancake wildlife should execute silver metric oven'.split(' ');
const SLIP39_33_2_SHARE3 = 'yoga racism academic always album fitness demand priority negative both percent ceramic vegan pickup ajar cricket ecology engage owner glance sunlight replace canyon drink rocky living fridge move adjust phrase fatigue counter erode'.split(' ');
const SLIP39_33_2_ALL = [...SLIP39_33_2_SHARE1, ...SLIP39_33_2_SHARE2, ...SLIP39_33_2_SHARE3];

/** 12 words "all" input steps (legacy test) */
const WORDS_12_STEPS: AutoStep[] = [
  // Word 1: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 2: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 3: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 4: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 5: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 6: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 7: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 8: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 9: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 10: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 11: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
  // Word 12: "all"
  { label: '点击单词a', x: 19, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击单词l', x: 59, y: 80, depth: 12, delayAfter: 1000 },
  { label: '点击确认', x: 59, y: 87, depth: 12, delayAfter: 2000 },
];

// ============================================================================
// Sequence Definitions
// ============================================================================

/** Reset wallet steps */
const RESET_WALLET_STEPS: AutoStep[] = [
  // Wake up password keyboard (single click is enough)
  { label: 'Wake keyboard', x: 35, y: 85, depth: 12, delayAfter: 1000 },
  // Enter PIN 1111
  { label: 'PIN 1', x: 25, y: 50, depth: 12 },
  { label: 'PIN 2', x: 25, y: 50, depth: 12 },
  { label: 'PIN 3', x: 25, y: 50, depth: 12 },
  { label: 'PIN 4', x: 25, y: 50, depth: 12 },
  { label: 'Confirm', x: 55, y: 85, depth: 12, delayAfter: 2000 },
  // Enter settings
  { label: 'Settings app', x: 50, y: 65, depth: 12 },
  { label: 'Wallet section', x: 50, y: 55, depth: 12 },
  // Swipe up
  { label: 'Swipe up', x: 35, y: 85, depth: 12, swipeTo: { x: 35, y: 70 } },
  // Double click
  { label: 'Click 1', x: 50, y: 85, depth: 12 },
  { label: 'Click 2', x: 50, y: 85, depth: 12 },
  // Settings navigation
  { label: 'Setting 1', x: 25, y: 40, depth: 12 },
  { label: 'Setting 2', x: 25, y: 55, depth: 12 },
  // Swipe left to right, hold before release
  { label: 'Swipe right', x: 20, y: 75, depth: 12, swipeTo: { x: 60, y: 75 }, swipeHoldDelay: 500, delayAfter: 5000 },
  // Final confirmation with wait
  { label: 'Confirm', x: 25, y: 85, depth: 12, delayAfter: 10000 },
  // Reset to origin
  { label: 'Reset position', x: 0, y: 0, depth: 12 },
];

/** Auto sequence definition */
export interface AutoSequence {
  id: string;
  name: string;
  selectTypeStep: AutoStep | null;
  wordSteps: AutoStep[];
  skipPrefix?: boolean;
  skipSuffix?: boolean;
}

/** Shared prefix steps (language, PIN, navigation to wallet import) */
const SHARED_PREFIX_STEPS: AutoStep[] = [
  // Initial setup
  { label: '选择语言', x: 30, y: 55, depth: 12 },
  { label: '点击继续', x: 30, y: 85, depth: 12 },
  // Enter PIN code (4 digits)
  { label: '输入PIN码1', x: 25, y: 50, depth: 12 },
  { label: '输入PIN码2', x: 25, y: 50, depth: 12 },
  { label: '输入PIN码3', x: 25, y: 50, depth: 12 },
  { label: '输入PIN码4', x: 25, y: 50, depth: 12 },
  { label: '点击确认', x: 55, y: 85, depth: 12 },
  // Confirm PIN code (4 digits)
  { label: '再次确认PIN码1', x: 25, y: 50, depth: 12 },
  { label: '再次确认PIN码2', x: 25, y: 50, depth: 12 },
  { label: '再次确认PIN码3', x: 25, y: 50, depth: 12 },
  { label: '再次确认PIN码4', x: 25, y: 50, depth: 12 },
  { label: '点击确认', x: 55, y: 85, depth: 12 },
  // Navigation
  { label: '点击继续', x: 55, y: 85, depth: 12 },
  { label: '点击稍后设置', x: 55, y: 85, depth: 12 },
  { label: '点击导入钱包', x: 55, y: 85, depth: 12 },
  { label: '点击助记词', x: 55, y: 75, depth: 12 },
];

/** Shared suffix steps (continue, next, finish, reset) */
const SHARED_SUFFIX_STEPS: AutoStep[] = [
  { label: '点击继续', x: 55, y: 85, depth: 12 },
  { label: '点击下一步', x: 55, y: 85, depth: 12 },
  { label: '点击完成', x: 55, y: 85, depth: 12, delayAfter: 2000 },
  { label: '复位', x: 0, y: 0, depth: 12 },
];

// All sequences - now includes all test cases!
const ALL_SEQUENCES: AutoSequence[] = [
  // ============================================================================
  // Reset wallet (special operation)
  // ============================================================================
  {
    id: 'reset-wallet',
    name: '重置钱包',
    selectTypeStep: null,
    wordSteps: RESET_WALLET_STEPS,
    skipPrefix: true,
    skipSuffix: true,
  },
  // ============================================================================
  // Legacy test case
  // ============================================================================
  {
    id: 'words-12',
    name: '12个词(all)',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: WORDS_12_STEPS,
  },
  // ============================================================================
  // 12-word mnemonics
  // ============================================================================
  {
    id: 'one-normal-12',
    name: '12词-1',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_12_1),
  },
  {
    id: 'two-normal-12',
    name: '12词-2',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_12_2),
  },
  {
    id: 'three-normal-12',
    name: '12词-3',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_12_3),
  },
  {
    id: 'api-normal-12',
    name: '签名方法',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_12_API),
  },
  // ============================================================================
  // 18-word mnemonics
  // ============================================================================
  {
    id: 'one-normal-18',
    name: '18词-1',
    selectTypeStep: { label: '选择18个单词', x: 25, y: 60, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_18_1),
  },
  {
    id: 'two-normal-18',
    name: '18词-2',
    selectTypeStep: { label: '选择18个单词', x: 25, y: 60, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_18_2),
  },
  {
    id: 'three-normal-18',
    name: '18词-3',
    selectTypeStep: { label: '选择18个单词', x: 25, y: 60, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_18_3),
  },
  // ============================================================================
  // 24-word mnemonics
  // ============================================================================
  {
    id: 'one-normal-24',
    name: '24词-1',
    selectTypeStep: { label: '选择24个单词', x: 25, y: 80, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_24_1),
  },
  {
    id: 'two-normal-24',
    name: '24词-2',
    selectTypeStep: { label: '选择24个单词', x: 25, y: 80, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_24_2),
  },
  {
    id: 'three-normal-24',
    name: '24词-3',
    selectTypeStep: { label: '选择24个单词', x: 25, y: 80, depth: 12 },
    wordSteps: generateWordSteps(MNEMONIC_24_3),
  },
  // ============================================================================
  // slip39 20-word mnemonics
  // ============================================================================
  {
    id: 'count20_one_normal',
    name: 'slip39-20词-1份',
    selectTypeStep: { label: '选择20个单词', x: 25, y: 70, depth: 12 },
    wordSteps: generateWordSteps(SLIP39_20_1),
  },
  {
    id: 'count20_two_normal',
    name: 'slip39-20词-2/3',
    selectTypeStep: { label: '选择20个单词', x: 25, y: 70, depth: 12 },
    wordSteps: generateWordSteps(SLIP39_20_2_ALL),
  },
  {
    id: 'count20_three_normal',
    name: 'slip39-20词-16/16',
    selectTypeStep: { label: '选择20个单词', x: 25, y: 70, depth: 12 },
    wordSteps: generateWordSteps(SLIP39_20_16_ALL),
  },
  // ============================================================================
  // slip39 33-word mnemonics
  // ============================================================================
  {
    id: 'count33_one_normal',
    name: 'slip39-33词-1份',
    selectTypeStep: { label: '选择33个单词', x: 25, y: 90, depth: 12 },
    wordSteps: generateWordSteps(SLIP39_33_1),
  },
  {
    id: 'count33_two_normal',
    name: 'slip39-33词-3/2',
    selectTypeStep: { label: '选择33个单词', x: 25, y: 90, depth: 12 },
    wordSteps: generateWordSteps(SLIP39_33_2_ALL),
  },
];

/**
 * Gets a sequence by ID.
 */
export function getSequence(id: string): AutoSequence | undefined {
  return ALL_SEQUENCES.find((s) => s.id === id);
}

/**
 * Gets all available sequence IDs.
 */
export function getAllSequenceIds(): string[] {
  return ALL_SEQUENCES.map((s) => s.id);
}

/**
 * Gets the full steps for a sequence (including prefix/suffix if not skipped).
 */
export function getFullSteps(sequence: AutoSequence): AutoStep[] {
  const steps: AutoStep[] = [];

  if (!sequence.skipPrefix) {
    steps.push(...SHARED_PREFIX_STEPS);
  }

  // Add selectTypeStep and continue button if present
  if (sequence.selectTypeStep) {
    steps.push(sequence.selectTypeStep);
    steps.push({ label: '点击继续', x: 55, y: 85, depth: 12 });
  }

  steps.push(...sequence.wordSteps);

  if (!sequence.skipSuffix) {
    steps.push(...SHARED_SUFFIX_STEPS);
  }

  return steps;
}
