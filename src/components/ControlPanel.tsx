import { useState, useCallback, useRef } from 'react';
import {
  ARM_CONTROLLER_CONFIG,
  buildArmApiUrl,
  parseResourceHandle,
} from '../config/armController';
import './ControlPanel.css';

/** Represents a single step in the auto operation sequence */
interface AutoStep {
  label: string;
  x: number;
  y: number;
  depth: number;
  /** Optional delay in ms after this step (default: 100ms) */
  delayAfter?: number;
  /** If set, performs a swipe from (x,y) to swipeTo coordinates instead of a click */
  swipeTo?: { x: number; y: number };
  /** Delay in ms before raising stylus after swipe (default: 50ms) */
  swipeHoldDelay?: number;
}

/** Shared prefix steps (language, PIN, navigation to wallet import) */
const PREFIX_STEPS: AutoStep[] = [
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
const SUFFIX_STEPS: AutoStep[] = [
  { label: '点击继续', x: 55, y: 85, depth: 12 },
  { label: '点击下一步', x: 55, y: 85, depth: 12 },
  { label: '点击完成', x: 55, y: 85, depth: 12, delayAfter: 2000 },
  { label: '复位', x: 0, y: 0, depth: 12 },
];

/** Sequence configuration: only contains the variable parts */
interface OperationSequence {
  id: string;
  name: string;
  selectTypeStep: AutoStep | null;
  wordSteps: AutoStep[];
  /** If true, skip PREFIX_STEPS when assembling full sequence */
  skipPrefix?: boolean;
  /** If true, skip SUFFIX_STEPS when assembling full sequence */
  skipSuffix?: boolean;
}

/** 12 words "all" input steps */
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

/** Reset wallet steps */
const RESET_WALLET_STEPS: AutoStep[] = [
  // Wake up password keyboard (double click)
  { label: '唤醒键盘0', x: 35, y: 85, depth: 12 },
  { label: '唤醒键盘1', x: 35, y: 85, depth: 12 },
  { label: '唤醒键盘2', x: 35, y: 85, depth: 12, delayAfter: 1000 },
  // Enter PIN 1111
  { label: '输入PIN码1', x: 25, y: 50, depth: 12 },
  { label: '输入PIN码2', x: 25, y: 50, depth: 12 },
  { label: '输入PIN码3', x: 25, y: 50, depth: 12 },
  { label: '输入PIN码4', x: 25, y: 50, depth: 12 },
  { label: '点击确认', x: 55, y: 85, depth: 12, delayAfter: 2000 },
  // Enter settings
  { label: '进入设置APP', x: 50, y: 65, depth: 12 },
  { label: '进入钱包栏目', x: 50, y: 55, depth: 12 },
  // Swipe up
  { label: '向上滑动', x: 35, y: 85, depth: 12, swipeTo: { x: 35, y: 70 } },
  // Double click
  { label: '点击1', x: 50, y: 85, depth: 12 },
  { label: '点击2', x: 50, y: 85, depth: 12 },
  // Settings navigation
  { label: '点击设置项1', x: 25, y: 40, depth: 12 },
  { label: '点击设置项2', x: 25, y: 55, depth: 12 },
  // Swipe left to right, hold before release, then wait
  { label: '向右滑动', x: 20, y: 75, depth: 12, swipeTo: { x: 60, y: 75 }, swipeHoldDelay: 500, delayAfter: 5000 },
  // Final confirmation with wait
  { label: '点击确认', x: 25, y: 85, depth: 12, delayAfter: 10000 },
  // Reset to origin
  { label: '复位', x: 0, y: 0, depth: 12 },
];

// ============================================================================
// Keyboard coordinate mapping and helper functions for mnemonic test cases
// ============================================================================

/** Keyboard letter coordinates */
const LETTER_COORDS: Record<string, { x: number; y: number }> = {
  q: { x: 19, y: 74 }, w: { x: 24, y: 74 }, e: { x: 28, y: 74 }, r: { x: 33, y: 74 },
  t: { x: 37, y: 74 }, y: { x: 41, y: 74 }, u: { x: 45, y: 74 }, i: { x: 50, y: 74 },
  o: { x: 55, y: 74 }, p: { x: 59, y: 74 },
  a: { x: 19, y: 80 }, s: { x: 24, y: 80 }, d: { x: 29, y: 80 }, f: { x: 34, y: 80 },
  g: { x: 39, y: 80 }, h: { x: 44, y: 80 }, j: { x: 49, y: 80 }, k: { x: 54, y: 80 },
  l: { x: 59, y: 80 },
  z: { x: 25, y: 88 }, x: { x: 30, y: 88 }, c: { x: 35, y: 88 }, v: { x: 39, y: 88 },
  b: { x: 44, y: 88 }, n: { x: 49, y: 88 }, m: { x: 54, y: 88 },
};

/** Confirm button coordinate */
const CONFIRM_COORD = { x: 59, y: 87 };

/**
 * Generates AutoStep array from a list of words.
 * Each word becomes: letter steps + confirm step.
 */
function generateWordSteps(words: string[]): AutoStep[] {
  const steps: AutoStep[] = [];
  words.forEach((word, wordIndex) => {
    const lowerWord = word.toLowerCase();
    // Add comment for word number
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
      label: `W${wordIndex + 1}:确认`,
      x: CONFIRM_COORD.x,
      y: CONFIRM_COORD.y,
      depth: 12,
      delayAfter: 2000,
    });
  });
  return steps;
}

// ============================================================================
// Mnemonic word lists
// ============================================================================

/** 12-word mnemonics */
const MNEMONIC_12_1 = 'air census life sheriff attack include paper provide fantasy left opera sauce'.split(' ');
const MNEMONIC_12_2 = 'relief exchange burst bullet topple manage impose dumb raise panther sibling shove'.split(' ');
const MNEMONIC_12_3 = 'pyramid enforce season tide flag brisk law anchor refuse require reward negative'.split(' ');

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

// ============================================================================
// Generated step arrays for each test case
// ============================================================================

/** Steps for one-normal-12 */
const STEPS_ONE_NORMAL_12 = generateWordSteps(MNEMONIC_12_1);
/** Steps for two-normal-12 */
const STEPS_TWO_NORMAL_12 = generateWordSteps(MNEMONIC_12_2);
/** Steps for three-normal-12 */
const STEPS_THREE_NORMAL_12 = generateWordSteps(MNEMONIC_12_3);

/** Steps for one-normal-18 */
const STEPS_ONE_NORMAL_18 = generateWordSteps(MNEMONIC_18_1);
/** Steps for two-normal-18 */
const STEPS_TWO_NORMAL_18 = generateWordSteps(MNEMONIC_18_2);
/** Steps for three-normal-18 */
const STEPS_THREE_NORMAL_18 = generateWordSteps(MNEMONIC_18_3);

/** Steps for one-normal-24 */
const STEPS_ONE_NORMAL_24 = generateWordSteps(MNEMONIC_24_1);
/** Steps for two-normal-24 */
const STEPS_TWO_NORMAL_24 = generateWordSteps(MNEMONIC_24_2);
/** Steps for three-normal-24 */
const STEPS_THREE_NORMAL_24 = generateWordSteps(MNEMONIC_24_3);

/** Steps for count20_one_normal */
const STEPS_COUNT20_ONE_NORMAL = generateWordSteps(SLIP39_20_1);
/** Steps for count20_two_normal (3 shares combined) */
const STEPS_COUNT20_TWO_NORMAL = generateWordSteps(SLIP39_20_2_ALL);
/** Steps for count20_three_normal (16 shares combined) */
const STEPS_COUNT20_THREE_NORMAL = generateWordSteps(SLIP39_20_16_ALL);

/** Steps for count33_one_normal */
const STEPS_COUNT33_ONE_NORMAL = generateWordSteps(SLIP39_33_1);
/** Steps for count33_two_normal (3 shares combined) */
const STEPS_COUNT33_TWO_NORMAL = generateWordSteps(SLIP39_33_2_ALL);

/** Available operation sequences */
const OPERATION_SEQUENCES: OperationSequence[] = [
  // Legacy test case
  {
    id: 'words-12',
    name: '12个词(all)',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: WORDS_12_STEPS,
  },
  // Reset wallet
  {
    id: 'reset-wallet',
    name: '重置钱包',
    selectTypeStep: null,
    wordSteps: RESET_WALLET_STEPS,
    skipPrefix: true,
    skipSuffix: true,
  },
  // ============================================================================
  // 12-word mnemonics
  // ============================================================================
  {
    id: 'one-normal-12',
    name: '12词-1',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: STEPS_ONE_NORMAL_12,
  },
  {
    id: 'two-normal-12',
    name: '12词-2',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: STEPS_TWO_NORMAL_12,
  },
  {
    id: 'three-normal-12',
    name: '12词-3',
    selectTypeStep: { label: '选择12个单词', x: 25, y: 50, depth: 12 },
    wordSteps: STEPS_THREE_NORMAL_12,
  },
  // ============================================================================
  // 18-word mnemonics
  // ============================================================================
  {
    id: 'one-normal-18',
    name: '18词-1',
    selectTypeStep: { label: '选择18个单词', x: 25, y: 60, depth: 12 },
    wordSteps: STEPS_ONE_NORMAL_18,
  },
  {
    id: 'two-normal-18',
    name: '18词-2',
    selectTypeStep: { label: '选择18个单词', x: 25, y: 60, depth: 12 },
    wordSteps: STEPS_TWO_NORMAL_18,
  },
  {
    id: 'three-normal-18',
    name: '18词-3',
    selectTypeStep: { label: '选择18个单词', x: 25, y: 60, depth: 12 },
    wordSteps: STEPS_THREE_NORMAL_18,
  },
  // ============================================================================
  // 24-word mnemonics
  // ============================================================================
  {
    id: 'one-normal-24',
    name: '24词-1',
    selectTypeStep: { label: '选择24个单词', x: 25, y: 80, depth: 12 },
    wordSteps: STEPS_ONE_NORMAL_24,
  },
  {
    id: 'two-normal-24',
    name: '24词-2',
    selectTypeStep: { label: '选择24个单词', x: 25, y: 80, depth: 12 },
    wordSteps: STEPS_TWO_NORMAL_24,
  },
  {
    id: 'three-normal-24',
    name: '24词-3',
    selectTypeStep: { label: '选择24个单词', x: 25, y: 80, depth: 12 },
    wordSteps: STEPS_THREE_NORMAL_24,
  },
  // ============================================================================
  // slip39 20-word mnemonics
  // ============================================================================
  {
    id: 'count20_one_normal',
    name: 'slip39-20词-1份',
    selectTypeStep: { label: '选择20个单词', x: 25, y: 70, depth: 12 },
    wordSteps: STEPS_COUNT20_ONE_NORMAL,
  },
  {
    id: 'count20_two_normal',
    name: 'slip39-20词-2/3',
    selectTypeStep: { label: '选择20个单词', x: 25, y: 70, depth: 12 },
    wordSteps: STEPS_COUNT20_TWO_NORMAL,
  },
  {
    id: 'count20_three_normal',
    name: 'slip39-20词-16/16',
    selectTypeStep: { label: '选择20个单词', x: 25, y: 70, depth: 12 },
    wordSteps: STEPS_COUNT20_THREE_NORMAL,
  },
  // ============================================================================
  // slip39 33-word mnemonics
  // ============================================================================
  {
    id: 'count33_one_normal',
    name: 'slip39-33词-1份',
    selectTypeStep: { label: '选择33个单词', x: 25, y: 90, depth: 12 },
    wordSteps: STEPS_COUNT33_ONE_NORMAL,
  },
  {
    id: 'count33_two_normal',
    name: 'slip39-33词-3/2',
    selectTypeStep: { label: '选择33个单词', x: 25, y: 90, depth: 12 },
    wordSteps: STEPS_COUNT33_TWO_NORMAL,
  },
];

/** Assembles the full steps sequence from a sequence configuration */
const getFullSteps = (sequence: OperationSequence): AutoStep[] => {
  const steps: AutoStep[] = [];

  // Add prefix steps if not skipped
  if (!sequence.skipPrefix) {
    steps.push(...PREFIX_STEPS);
  }

  // Add selectTypeStep and continue button if present
  if (sequence.selectTypeStep) {
    steps.push(sequence.selectTypeStep);
    steps.push({ label: '点击继续', x: 55, y: 85, depth: 12 });
  }

  // Add word steps
  steps.push(...sequence.wordSteps);

  // Add suffix steps if not skipped
  if (!sequence.skipSuffix) {
    steps.push(...SUFFIX_STEPS);
  }

  return steps;
};

interface ControlPanelState {
  isConnected: boolean;
  resourceHandle: number;
  serverIP: string;
  comPort: string;
  stepSize: number;
  zDepth: number;
  currentX: number;
  currentY: number;
  isLoading: boolean;
  isReady: boolean;
  error: string | null;
  isAutoRunning: boolean;
  autoProgress: number;
  selectedSequenceId: string;
}

interface LogEntry {
  id: number;
  time: string;
  action: string;
  detail: string;
}

function ControlPanel() {
  const [state, setState] = useState<ControlPanelState>({
    isConnected: false,
    resourceHandle: 0,
    serverIP: ARM_CONTROLLER_CONFIG.defaultServerIP,
    comPort: ARM_CONTROLLER_CONFIG.defaultComPort,
    stepSize: ARM_CONTROLLER_CONFIG.defaultStepSize,
    zDepth: ARM_CONTROLLER_CONFIG.defaultZDepth,
    currentX: 0,
    currentY: 0,
    isLoading: false,
    isReady: false,
    error: null,
    isAutoRunning: false,
    autoProgress: 0,
    selectedSequenceId: OPERATION_SEQUENCES[0].id,
  });

  // Ref to track if auto operation should be cancelled
  const autoOperationCancelledRef = useRef(false);

  const [logs, setLogs] = useState<LogEntry[]>([]);

  const addLog = useCallback((action: string, detail: string) => {
    const now = new Date();
    const time = now.toLocaleTimeString('zh-CN', { hour12: false });
    setLogs(prev => [
      { id: Date.now(), time, action, detail },
      ...prev.slice(0, 49),
    ]);
  }, []);

  /**
   * Sends a command to the arm controller via HTTP.
   * Uses Electron IPC to bypass CORS restrictions.
   * Falls back to fetch API when Electron is unavailable (development mode).
   *
   * @param params - Command parameters (duankou, hco, daima)
   * @returns Server response as string
   * @throws Error if request fails
   */
  const sendCommand = useCallback(async (params: { duankou: string; hco: number; daima: string }): Promise<string> => {
    const url = buildArmApiUrl(state.serverIP, params);
    try {
      if (window.electronAPI?.httpRequest) {
        const response = await window.electronAPI.httpRequest(url);
        return response.data;
      } else {
        const response = await fetch(url);
        const text = await response.text();
        return text;
      }
    } catch (error) {
      throw new Error(`Request failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }, [state.serverIP]);

  const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

  /**
   * Connects to the arm controller by opening the COM port.
   * After successful connection, waits for device to be ready before enabling controls.
   */
  const handleConnect = async () => {
    if (state.isLoading) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      const result = await sendCommand({
        duankou: state.comPort,
        hco: 0,
        daima: '0',
      });
      
      const resourceHandle = parseResourceHandle(result);
      
      if (resourceHandle > 0) {
        setState(prev => ({
          ...prev,
          isConnected: true,
          resourceHandle,
          isLoading: false,
          isReady: false,
        }));
        
        await delay(ARM_CONTROLLER_CONFIG.deviceReadyDelay);
        
        setState(prev => ({ ...prev, isReady: true }));
      } else {
        setState(prev => ({
          ...prev,
          isLoading: false,
          error: 'Failed to open port. Check if port is occupied.',
        }));
      }
    } catch (error) {
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Connection failed',
      }));
    }
  };

  /**
   * Disconnects from the arm controller.
   * First resets machine position to origin, then closes the COM port.
   * Can be called even when not connected to release any previous connection.
   */
  const handleDisconnect = async () => {
    if (state.isLoading) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      if (state.isConnected && state.resourceHandle > 0) {
        await sendCommand({
          duankou: '0',
          hco: state.resourceHandle,
          daima: 'X0Y0Z0',
        });
        
        await delay(ARM_CONTROLLER_CONFIG.commandDelay);
        
        await sendCommand({
          duankou: '0',
          hco: state.resourceHandle,
          daima: '0',
        });
      }
      
      setState(prev => ({
        ...prev,
        isConnected: false,
        resourceHandle: 0,
        currentX: 0,
        currentY: 0,
        isLoading: false,
        isReady: false,
      }));
    } catch (error) {
      setState(prev => ({
        ...prev,
        isConnected: false,
        resourceHandle: 0,
        currentX: 0,
        currentY: 0,
        isLoading: false,
        isReady: false,
      }));
    }
  };

  /**
   * Moves the arm in the specified direction by the current step size.
   * Y axis is inverted: Y decreases when moving up, increases when moving down.
   * Coordinates are clamped to non-negative values.
   *
   * @param direction - Movement direction (up, down, left, right)
   */
  const handleMove = async (direction: 'up' | 'down' | 'left' | 'right') => {
    if (state.isLoading || !state.isConnected || !state.isReady) return;
    
    let newX = state.currentX;
    let newY = state.currentY;
    
    switch (direction) {
      case 'up':
        newY -= state.stepSize;
        break;
      case 'down':
        newY += state.stepSize;
        break;
      case 'left':
        newX -= state.stepSize;
        break;
      case 'right':
        newX += state.stepSize;
        break;
    }
    
    newX = Math.max(0, newX);
    newY = Math.max(0, newY);
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    const directionLabel = { up: '上', down: '下', left: '左', right: '右' }[direction];
    
    try {
      await sendCommand({
        duankou: '0',
        hco: state.resourceHandle,
        daima: `X${newX}Y${newY}`,
      });
      
      addLog('移动', `${directionLabel} (${state.currentX},${state.currentY}) → (${newX},${newY})`);
      
      setState(prev => ({
        ...prev,
        currentX: newX,
        currentY: newY,
        isLoading: false,
      }));
    } catch (error) {
      addLog('错误', `移动失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Move failed',
      }));
    }
  };

  /**
   * Performs a click operation at the current position.
   * Lowers the pen (Z6), waits briefly, then raises it (Z0).
   */
  const handleClick = async () => {
    if (state.isLoading || !state.isConnected || !state.isReady) return;
    
    setState(prev => ({ ...prev, isLoading: true, error: null }));
    
    try {
      await sendCommand({
        duankou: '0',
        hco: state.resourceHandle,
        daima: `Z${state.zDepth}`,
      });
      
      await delay(ARM_CONTROLLER_CONFIG.clickDelay);
      
      await sendCommand({
        duankou: '0',
        hco: state.resourceHandle,
        daima: `Z${ARM_CONTROLLER_CONFIG.zUp}`,
      });
      
      addLog('点击', `位置 (${state.currentX},${state.currentY}) 深度 Z${state.zDepth}`);
      
      setState(prev => ({ ...prev, isLoading: false }));
    } catch (error) {
      addLog('错误', `点击失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      setState(prev => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : 'Click operation failed',
      }));
    }
  };

  /**
   * Executes the selected auto operation sequence.
   * Performs move and click operations for each step with configurable delay between steps.
   */
  const handleAutoOperation = async () => {
    if (state.isLoading || !state.isConnected || !state.isReady || state.isAutoRunning) return;

    const sequence = OPERATION_SEQUENCES.find(s => s.id === state.selectedSequenceId);
    if (!sequence) return;

    const steps = getFullSteps(sequence);

    autoOperationCancelledRef.current = false;
    setState(prev => ({ ...prev, isAutoRunning: true, autoProgress: 0, error: null }));
    addLog('自动', `开始执行自动操作序列: ${sequence.name}`);

    try {
      for (let i = 0; i < steps.length; i++) {
        // Check if operation was cancelled
        if (autoOperationCancelledRef.current) {
          addLog('自动', '操作已取消');
          break;
        }

        const step = steps[i];
        setState(prev => ({ ...prev, autoProgress: i + 1 }));

        if (step.swipeTo) {
          // Swipe operation: move to start -> lower stylus -> move to end -> raise stylus
          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.x}Y${step.y}`,
          });

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${step.depth}`,
          });

          await delay(50);

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.swipeTo.x}Y${step.swipeTo.y}`,
          });

          // Wait before raising stylus (use custom hold delay or default 50ms)
          await delay(step.swipeHoldDelay ?? 50);

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${ARM_CONTROLLER_CONFIG.zUp}`,
          });

          addLog('自动', `${step.label} (${step.x},${step.y}) → (${step.swipeTo.x},${step.swipeTo.y})`);
        } else {
          // Click operation: move to position -> lower stylus -> raise stylus
          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `X${step.x}Y${step.y}`,
          });

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${step.depth}`,
          });

          await delay(ARM_CONTROLLER_CONFIG.clickDelay);

          await sendCommand({
            duankou: '0',
            hco: state.resourceHandle,
            daima: `Z${ARM_CONTROLLER_CONFIG.zUp}`,
          });

          addLog('自动', `${step.label} (${step.x},${step.y})`);
        }

        // Wait before next step (use custom delay or default 100ms)
        await delay(step.delayAfter ?? 200);
      }

      if (!autoOperationCancelledRef.current) {
        addLog('自动', '自动操作序列完成');
      }
    } catch (error) {
      addLog('错误', `自动操作失败: ${error instanceof Error ? error.message : 'Unknown'}`);
      setState(prev => ({
        ...prev,
        error: error instanceof Error ? error.message : 'Auto operation failed',
      }));
    } finally {
      setState(prev => ({ ...prev, isAutoRunning: false, autoProgress: 0 }));
    }
  };

  /**
   * Cancels the ongoing auto operation.
   */
  const handleCancelAutoOperation = () => {
    autoOperationCancelledRef.current = true;
  };

  const isControlDisabled = !state.isConnected || !state.isReady || state.isLoading || state.isAutoRunning;

  return (
    <div className="control-panel">
      <div className="control-section connection-section">
        <h3>连接设置</h3>
        <div className="connection-row">
          <input
            type="text"
            value={state.serverIP}
            onChange={(e) => setState(prev => ({ ...prev, serverIP: e.target.value }))}
            disabled={state.isConnected}
            placeholder="IP 地址"
            className="input-ip"
          />
          <input
            type="text"
            value={state.comPort}
            onChange={(e) => setState(prev => ({ ...prev, comPort: e.target.value }))}
            disabled={state.isConnected}
            placeholder="串口"
            className="input-port"
          />
          <div className="position-display">
            <span className="coordinate">X: {state.currentX}</span>
            <span className="coordinate">Y: {state.currentY}</span>
          </div>
          <button
            className={`btn btn-connect ${state.isConnected ? 'btn-secondary' : 'btn-primary'}`}
            onClick={state.isConnected ? handleDisconnect : handleConnect}
            disabled={state.isLoading || state.isAutoRunning}
          >
            {state.isLoading
              ? (state.isConnected ? '断开中...' : '连接中...')
              : (state.isConnected ? '断开连接' : '连接')}
          </button>
        </div>
      </div>

      <div className="control-section auto-operation-section">
        <h3>自动操作</h3>
        <div className="auto-operation-row">
          <select
            value={state.selectedSequenceId}
            onChange={(e) => setState(prev => ({ ...prev, selectedSequenceId: e.target.value }))}
            disabled={state.isAutoRunning || !state.isConnected || !state.isReady || state.isLoading}
            className="sequence-select"
            aria-label="选择操作序列"
          >
            {OPERATION_SEQUENCES.map(seq => (
              <option key={seq.id} value={seq.id}>{seq.name}</option>
            ))}
          </select>
          <button
            className={`btn btn-auto ${state.isAutoRunning ? 'btn-secondary' : 'btn-primary'}`}
            onClick={state.isAutoRunning ? handleCancelAutoOperation : handleAutoOperation}
            disabled={!state.isConnected || !state.isReady || state.isLoading}
          >
            {state.isAutoRunning
              ? `取消 (${state.autoProgress}/${getFullSteps(OPERATION_SEQUENCES.find(s => s.id === state.selectedSequenceId)!).length})`
              : '开始'}
          </button>
          {state.isAutoRunning && (
            <div
              className="auto-progress"
              style={{ '--progress-percent': `${(state.autoProgress / getFullSteps(OPERATION_SEQUENCES.find(s => s.id === state.selectedSequenceId)!).length) * 100}%` } as React.CSSProperties}
            >
              <div className="auto-progress-bar" />
            </div>
          )}
        </div>
      </div>

      {state.error && (
        <div className="error-message">
          {state.error}
        </div>
      )}

      <div className="control-content">
        <div className="control-left">
          <div className="direction-section">
            <div className="control-selectors">
              <label>
                <span>步长</span>
                <select
                  value={state.stepSize}
                  onChange={(e) => setState(prev => ({ ...prev, stepSize: parseInt(e.target.value, 10) }))}
                  disabled={isControlDisabled}
                >
                  {ARM_CONTROLLER_CONFIG.stepOptions.map(step => (
                    <option key={step} value={step}>{step}</option>
                  ))}
                </select>
              </label>
              <label>
                <span>深度</span>
                <select
                  value={state.zDepth}
                  onChange={(e) => setState(prev => ({ ...prev, zDepth: parseInt(e.target.value, 10) }))}
                  disabled={isControlDisabled}
                >
                  {ARM_CONTROLLER_CONFIG.zDepthOptions.map(depth => (
                    <option key={depth} value={depth}>Z{depth}</option>
                  ))}
                </select>
              </label>
            </div>

            <div className="direction-controls">
              <div className="direction-grid">
                <div className="grid-cell"></div>
                <div className="grid-cell">
                  <button
                    className="direction-btn"
                    onClick={() => handleMove('up')}
                    disabled={isControlDisabled}
                    title="向上"
                  >
                    ↑
                  </button>
                </div>
                <div className="grid-cell"></div>
                <div className="grid-cell">
                  <button
                    className="direction-btn"
                    onClick={() => handleMove('left')}
                    disabled={isControlDisabled}
                    title="向左"
                  >
                    ←
                  </button>
                </div>
                <div className="grid-cell">
                  <button
                    className="click-btn"
                    onClick={handleClick}
                    disabled={isControlDisabled}
                    title="点击"
                  >
                    点击
                  </button>
                </div>
                <div className="grid-cell">
                  <button
                    className="direction-btn"
                    onClick={() => handleMove('right')}
                    disabled={isControlDisabled}
                    title="向右"
                  >
                    →
                  </button>
                </div>
                <div className="grid-cell"></div>
                <div className="grid-cell">
                  <button
                    className="direction-btn"
                    onClick={() => handleMove('down')}
                    disabled={isControlDisabled}
                    title="向下"
                  >
                    ↓
                  </button>
                </div>
                <div className="grid-cell"></div>
              </div>
            </div>
          </div>
        </div>

        <div className="control-right">
          <div className="action-logs">
            {logs.length === 0 ? (
              <div className="logs-empty">暂无操作日志</div>
            ) : (
              <div className="logs-list">
                {logs.map(log => (
                  <div key={log.id} className="log-entry">
                    <span className="log-time">{log.time}</span>
                    <span className="log-action">{log.action}</span>
                    <span className="log-detail">{log.detail}</span>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default ControlPanel;
