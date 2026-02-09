/**
 * Auto Operation Sequences
 *
 * Defines all predefined operation sequences for device automation.
 * Uses a PageAction-based architecture where atomic page operations
 * can be freely composed into complex automation workflows.
 *
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
  /** If true, moves arm to position without clicking, then triggers OCR capture */
  ocrCapture?: boolean;
  /** If set, performs verification OCR and clicks the correct option */
  ocrVerify?: {
    options: { x: number; y: number; depth: number }[];
  };
}

/**
 * PageAction: an atomic, reusable page-level operation.
 * Each action represents one logical interaction on a device page
 * (e.g., "select language", "enter PIN", "click create wallet").
 * Actions can be freely composed into sequences.
 */
export interface PageAction {
  id: string;
  name: string;
  /** Logical group for organization (e.g., '初始设置', '钱包路径') */
  group: string;
  /** Steps that make up this action */
  steps: AutoStep[];
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
// Page Action Definitions
// ============================================================================

/** All page actions organized by logical groups */
const ALL_PAGE_ACTIONS: PageAction[] = [
  // --------------------------------------------------------------------------
  // 初始设置 (Initial Setup)
  // --------------------------------------------------------------------------
  {
    id: 'lang-zh',
    name: '选择中文',
    group: '初始设置',
    steps: [
      { label: '选择语言', x: 30, y: 55, depth: 12 },
      { label: '点击继续', x: 30, y: 85, depth: 12 },
    ],
  },
  {
    id: 'pin-1111',
    name: '输入PIN码1111',
    group: '初始设置',
    steps: [
      { label: '输入PIN码1', x: 25, y: 50, depth: 12 },
      { label: '输入PIN码2', x: 25, y: 50, depth: 12 },
      { label: '输入PIN码3', x: 25, y: 50, depth: 12 },
      { label: '输入PIN码4', x: 25, y: 50, depth: 12 },
      { label: '点击确认', x: 55, y: 85, depth: 12 },
      { label: '再次确认PIN码1', x: 25, y: 50, depth: 12 },
      { label: '再次确认PIN码2', x: 25, y: 50, depth: 12 },
      { label: '再次确认PIN码3', x: 25, y: 50, depth: 12 },
      { label: '再次确认PIN码4', x: 25, y: 50, depth: 12 },
      { label: '点击确认', x: 55, y: 85, depth: 12 },
    ],
  },
  {
    id: 'nav-continue-setup',
    name: '继续+稍后设置',
    group: '初始设置',
    steps: [
      { label: '点击继续', x: 55, y: 85, depth: 12 },
      { label: '点击稍后设置', x: 55, y: 85, depth: 12 },
    ],
  },

  // --------------------------------------------------------------------------
  // 钱包路径 (Wallet Path)
  // --------------------------------------------------------------------------
  {
    id: 'nav-import',
    name: '导入钱包',
    group: '钱包路径',
    steps: [
      { label: '点击导入钱包', x: 55, y: 85, depth: 12 },
    ],
  },
  {
    id: 'nav-create',
    name: '创建新钱包',
    group: '钱包路径',
    steps: [
      { label: '创建新钱包', x: 35, y: 75, depth: 12 },
    ],
  },

  // --------------------------------------------------------------------------
  // 导入钱包 (Import Wallet)
  // --------------------------------------------------------------------------
  {
    id: 'select-mnemonic',
    name: '选择助记词',
    group: '导入钱包',
    steps: [
      { label: '点击助记词', x: 55, y: 75, depth: 12 },
    ],
  },

  // --------------------------------------------------------------------------
  // 词数选择 (Word Count Selection)
  // --------------------------------------------------------------------------
  {
    id: 'select-12-words',
    name: '选择12个单词',
    group: '词数选择',
    steps: [
      { label: '选择12个单词', x: 25, y: 50, depth: 12 },
      { label: '点击继续', x: 55, y: 85, depth: 12 },
    ],
  },
  {
    id: 'select-18-words',
    name: '选择18个单词',
    group: '词数选择',
    steps: [
      { label: '选择18个单词', x: 25, y: 60, depth: 12 },
      { label: '点击继续', x: 55, y: 85, depth: 12 },
    ],
  },
  {
    id: 'select-20-words',
    name: '选择20个单词',
    group: '词数选择',
    steps: [
      { label: '选择20个单词', x: 25, y: 70, depth: 12 },
      { label: '点击继续', x: 55, y: 85, depth: 12 },
    ],
  },
  {
    id: 'select-24-words',
    name: '选择24个单词',
    group: '词数选择',
    steps: [
      { label: '选择24个单词', x: 25, y: 80, depth: 12 },
      { label: '点击继续', x: 55, y: 85, depth: 12 },
    ],
  },
  {
    id: 'select-33-words',
    name: '选择33个单词',
    group: '词数选择',
    steps: [
      { label: '选择33个单词', x: 25, y: 90, depth: 12 },
      { label: '点击继续', x: 55, y: 85, depth: 12 },
    ],
  },

  // --------------------------------------------------------------------------
  // 创建钱包 (Create Wallet Flow)
  // --------------------------------------------------------------------------
  {
    id: 'create-backup-confirm',
    name: '备份确认',
    group: '创建钱包',
    steps: [
      { label: '开始备份勾选1', x: 20, y: 40, depth: 12 },
      { label: '开始备份勾选2', x: 20, y: 50, depth: 12 },
      { label: '开始备份勾选3', x: 20, y: 65, depth: 12 },
      { label: '点击备份', x: 40, y: 85, depth: 12 },
    ],
  },
  {
    id: 'create-screenshot',
    name: '截图识别',
    group: '创建钱包',
    steps: [
      { label: '移动到截图位置', x: 85, y: 0, depth: 12, ocrCapture: true, delayAfter: 2000 },
    ],
  },
  {
    id: 'create-continue',
    name: '继续备份',
    group: '创建钱包',
    steps: [
      { label: '点击继续', x: 40, y: 85, depth: 12 },
      { label: '点击继续', x: 50, y: 85, depth: 12 },
    ],
  },
  {
    id: 'create-verify-word',
    name: '验证单词',
    group: '创建钱包',
    steps: [
      {
        label: '验证单词',
        x: 85, y: 0, depth: 12,
        ocrVerify: {
          options: [
            { x: 35, y: 65, depth: 12 },
            { x: 35, y: 75, depth: 12 },
            { x: 35, y: 85, depth: 12 },
          ],
        },
        delayAfter: 2000,
      },
    ],
  },


  // --------------------------------------------------------------------------
  // 助记词输入 (Mnemonic Word Input)
  // --------------------------------------------------------------------------
  {
    id: 'input-words-12-all',
    name: '12个词(all)',
    group: '助记词输入',
    steps: WORDS_12_STEPS,
  },
  {
    id: 'input-mnemonic-12-1',
    name: '12词-1 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_12_1),
  },
  {
    id: 'input-mnemonic-12-2',
    name: '12词-2 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_12_2),
  },
  {
    id: 'input-mnemonic-12-3',
    name: '12词-3 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_12_3),
  },
  {
    id: 'input-mnemonic-12-api',
    name: '签名方法 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_12_API),
  },
  {
    id: 'input-mnemonic-18-1',
    name: '18词-1 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_18_1),
  },
  {
    id: 'input-mnemonic-18-2',
    name: '18词-2 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_18_2),
  },
  {
    id: 'input-mnemonic-18-3',
    name: '18词-3 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_18_3),
  },
  {
    id: 'input-mnemonic-24-1',
    name: '24词-1 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_24_1),
  },
  {
    id: 'input-mnemonic-24-2',
    name: '24词-2 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_24_2),
  },
  {
    id: 'input-mnemonic-24-3',
    name: '24词-3 输入',
    group: '助记词输入',
    steps: generateWordSteps(MNEMONIC_24_3),
  },
  {
    id: 'input-slip39-20-1',
    name: 'slip39-20词-1份 输入',
    group: '助记词输入',
    steps: generateWordSteps(SLIP39_20_1),
  },
  {
    id: 'input-slip39-20-2-all',
    name: 'slip39-20词-2/3 输入',
    group: '助记词输入',
    steps: generateWordSteps(SLIP39_20_2_ALL),
  },
  {
    id: 'input-slip39-20-16-all',
    name: 'slip39-20词-16/16 输入',
    group: '助记词输入',
    steps: generateWordSteps(SLIP39_20_16_ALL),
  },
  {
    id: 'input-slip39-33-1',
    name: 'slip39-33词-1份 输入',
    group: '助记词输入',
    steps: generateWordSteps(SLIP39_33_1),
  },
  {
    id: 'input-slip39-33-2-all',
    name: 'slip39-33词-3/2 输入',
    group: '助记词输入',
    steps: generateWordSteps(SLIP39_33_2_ALL),
  },

  // --------------------------------------------------------------------------
  // 完成 (Finish)
  // --------------------------------------------------------------------------
  {
    id: 'suffix-finish',
    name: '完成流程',
    group: '完成',
    steps: [
      { label: '点击继续', x: 55, y: 85, depth: 12 },
      { label: '点击下一步', x: 55, y: 85, depth: 12 },
      { label: '点击完成', x: 55, y: 85, depth: 12, delayAfter: 2000 },
      { label: '复位', x: 0, y: 0, depth: 12 },
    ],
  },

  // --------------------------------------------------------------------------
  // 设备管理 (Device Management)
  // --------------------------------------------------------------------------
  {
    id: 'reset-wallet-action',
    name: '重置钱包流程',
    group: '设备管理',
    steps: [
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
    ],
  },
];

/** PageAction lookup map for O(1) access */
const PAGE_ACTION_MAP = new Map<string, PageAction>(
  ALL_PAGE_ACTIONS.map((a) => [a.id, a])
);

// ============================================================================
// Sequence Definitions (composed from PageActions)
// ============================================================================

/**
 * Auto sequence definition.
 * Sequences are composed of ordered PageAction IDs.
 */
export interface AutoSequence {
  id: string;
  name: string;
  category: string;
  /** Ordered list of PageAction IDs that compose this sequence */
  actions: string[];
}

/** Import wallet shared action prefix */
const IMPORT_PREFIX: string[] = [
  'lang-zh', 'pin-1111', 'nav-continue-setup', 'nav-import', 'select-mnemonic',
];

/** Create wallet shared action prefix */
const CREATE_PREFIX: string[] = [
  'lang-zh', 'pin-1111', 'nav-continue-setup', 'nav-create',
];

const ALL_SEQUENCES: AutoSequence[] = [
  // ============================================================================
  // 设备管理
  // ============================================================================
  {
    id: 'reset-wallet',
    name: '重置钱包',
    category: '设备管理',
    actions: ['reset-wallet-action'],
  },

  // ============================================================================
  // 创建钱包
  // ============================================================================
  {
    id: 'create-wallet',
    name: '创建新钱包',
    category: '创建钱包',
    actions: [...CREATE_PREFIX, 'create-backup-confirm', 'create-screenshot', 'create-continue', 'create-verify-word', 'create-verify-word', 'create-verify-word'],
  },

  // ============================================================================
  // BIP39 12词
  // ============================================================================
  {
    id: 'words-12',
    name: '12个词(all)',
    category: 'BIP39 12词',
    actions: [...IMPORT_PREFIX, 'select-12-words', 'input-words-12-all', 'suffix-finish'],
  },
  {
    id: 'one-normal-12',
    name: '12词-1',
    category: 'BIP39 12词',
    actions: [...IMPORT_PREFIX, 'select-12-words', 'input-mnemonic-12-1', 'suffix-finish'],
  },
  {
    id: 'two-normal-12',
    name: '12词-2',
    category: 'BIP39 12词',
    actions: [...IMPORT_PREFIX, 'select-12-words', 'input-mnemonic-12-2', 'suffix-finish'],
  },
  {
    id: 'three-normal-12',
    name: '12词-3',
    category: 'BIP39 12词',
    actions: [...IMPORT_PREFIX, 'select-12-words', 'input-mnemonic-12-3', 'suffix-finish'],
  },
  {
    id: 'api-normal-12',
    name: '签名方法',
    category: 'BIP39 12词',
    actions: [...IMPORT_PREFIX, 'select-12-words', 'input-mnemonic-12-api', 'suffix-finish'],
  },

  // ============================================================================
  // BIP39 18词
  // ============================================================================
  {
    id: 'one-normal-18',
    name: '18词-1',
    category: 'BIP39 18词',
    actions: [...IMPORT_PREFIX, 'select-18-words', 'input-mnemonic-18-1', 'suffix-finish'],
  },
  {
    id: 'two-normal-18',
    name: '18词-2',
    category: 'BIP39 18词',
    actions: [...IMPORT_PREFIX, 'select-18-words', 'input-mnemonic-18-2', 'suffix-finish'],
  },
  {
    id: 'three-normal-18',
    name: '18词-3',
    category: 'BIP39 18词',
    actions: [...IMPORT_PREFIX, 'select-18-words', 'input-mnemonic-18-3', 'suffix-finish'],
  },

  // ============================================================================
  // BIP39 24词
  // ============================================================================
  {
    id: 'one-normal-24',
    name: '24词-1',
    category: 'BIP39 24词',
    actions: [...IMPORT_PREFIX, 'select-24-words', 'input-mnemonic-24-1', 'suffix-finish'],
  },
  {
    id: 'two-normal-24',
    name: '24词-2',
    category: 'BIP39 24词',
    actions: [...IMPORT_PREFIX, 'select-24-words', 'input-mnemonic-24-2', 'suffix-finish'],
  },
  {
    id: 'three-normal-24',
    name: '24词-3',
    category: 'BIP39 24词',
    actions: [...IMPORT_PREFIX, 'select-24-words', 'input-mnemonic-24-3', 'suffix-finish'],
  },

  // ============================================================================
  // SLIP39 20词
  // ============================================================================
  {
    id: 'count20_one_normal',
    name: 'slip39-20词-1份',
    category: 'SLIP39 20词',
    actions: [...IMPORT_PREFIX, 'select-20-words', 'input-slip39-20-1', 'suffix-finish'],
  },
  {
    id: 'count20_two_normal',
    name: 'slip39-20词-2/3',
    category: 'SLIP39 20词',
    actions: [...IMPORT_PREFIX, 'select-20-words', 'input-slip39-20-2-all', 'suffix-finish'],
  },
  {
    id: 'count20_three_normal',
    name: 'slip39-20词-16/16',
    category: 'SLIP39 20词',
    actions: [...IMPORT_PREFIX, 'select-20-words', 'input-slip39-20-16-all', 'suffix-finish'],
  },

  // ============================================================================
  // SLIP39 33词
  // ============================================================================
  {
    id: 'count33_one_normal',
    name: 'slip39-33词-1份',
    category: 'SLIP39 33词',
    actions: [...IMPORT_PREFIX, 'select-33-words', 'input-slip39-33-1', 'suffix-finish'],
  },
  {
    id: 'count33_two_normal',
    name: 'slip39-33词-3/2',
    category: 'SLIP39 33词',
    actions: [...IMPORT_PREFIX, 'select-33-words', 'input-slip39-33-2-all', 'suffix-finish'],
  },
];

// ============================================================================
// PageAction Query Functions
// ============================================================================

/**
 * Gets a page action by ID.
 */
export function getPageAction(id: string): PageAction | undefined {
  return PAGE_ACTION_MAP.get(id);
}

/**
 * Gets all page actions.
 */
export function getAllPageActions(): PageAction[] {
  return [...ALL_PAGE_ACTIONS];
}

/**
 * Gets page actions filtered by group.
 */
export function getPageActionsByGroup(group: string): PageAction[] {
  return ALL_PAGE_ACTIONS.filter((a) => a.group === group);
}

/**
 * Gets all unique page action groups in display order.
 */
export function getAllPageActionGroups(): string[] {
  const seen = new Set<string>();
  const groups: string[] = [];
  for (const action of ALL_PAGE_ACTIONS) {
    if (!seen.has(action.group)) {
      seen.add(action.group);
      groups.push(action.group);
    }
  }
  return groups;
}

// ============================================================================
// Sequence Query Functions
// ============================================================================

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
 * Gets all unique categories in display order.
 */
export function getAllCategories(): string[] {
  const seen = new Set<string>();
  const categories: string[] = [];
  for (const seq of ALL_SEQUENCES) {
    if (!seen.has(seq.category)) {
      seen.add(seq.category);
      categories.push(seq.category);
    }
  }
  return categories;
}

/**
 * Gets sequences filtered by category.
 */
export function getSequencesByCategory(category: string): AutoSequence[] {
  return ALL_SEQUENCES.filter((s) => s.category === category);
}

/**
 * Resolves a sequence's actions into a flat list of AutoSteps.
 * Each action ID is looked up in the PageAction registry and its steps are concatenated.
 */
export function getFullSteps(sequence: AutoSequence): AutoStep[] {
  const steps: AutoStep[] = [];
  for (const actionId of sequence.actions) {
    const action = PAGE_ACTION_MAP.get(actionId);
    if (action) {
      steps.push(...action.steps);
    } else {
      console.warn(`[sequences] Unknown page action ID: ${actionId}`);
    }
  }
  return steps;
}
