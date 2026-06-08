import {
  Box,
  BookOpen,
  Coins,
  Heart,
  Hotel,
  PackagePlus,
  Pause,
  Play,
  Plus,
  RefreshCw,
  ScrollText,
  Shield,
  ShoppingCart,
  Sparkles,
  Swords,
  Trash2,
  Zap,
} from "lucide-react";
import { useMemo, useState } from "react";

type StatKey = "vitality" | "power" | "agility";
type TileType = "empty" | "training" | "item" | "treasure" | "skill" | "shop" | "inn";
type Scope = "single" | "all";
type PauseView = "menu" | "skills";
type Phase =
  | "explore"
  | "animating"
  | "chooseTraining"
  | "chooseTile"
  | "battle"
  | "reward"
  | "recruit"
  | "prep"
  | "shop"
  | "gameover"
  | "clear";
type Tone = "good" | "bad" | "neutral" | "rare";

type Stats = Record<StatKey, number>;
type SkillEffect =
  | "attack"
  | "heavySlash"
  | "guard"
  | "quickStab"
  | "heal"
  | "firebolt"
  | "rally"
  | "spiritSlash"
  | "poison"
  | "focus"
  | "slot"
  | "burning"
  | "dash";

type Tile = {
  id: string;
  name: string;
  type: TileType;
  level: number;
  stat?: StatKey;
  scope?: Scope;
  rare?: boolean;
};

type Unit = {
  id: string;
  name: string;
  job: string;
  stats: Stats;
  hp: number;
  skillBoard: Skill[];
  boardIndex: number;
};

type BattleUnit = Unit & {
  tempHp: number;
  focus: number;
  swiftTurns: number;
  swiftBonus: number;
  charges: Record<string, number>;
  burns: Record<number, number>;
};

type Skill = {
  id: string;
  name: string;
  description: string;
  effect: SkillEffect;
  cost?: number;
};

type EnemySkill = {
  id: string;
  name: string;
  description: string;
  effect: "strike" | "heavy" | "cleave" | "recover";
};

type EnemyCombatant = {
  name: string;
  hp: number;
  maxHp: number;
  power: number;
  agility: number;
  skillBoard: EnemySkill[];
  boardIndex: number;
};

type Item = {
  id: string;
  name: string;
  timing: "dice" | "battle";
  description: string;
};

type Reward =
  | { kind: "tile"; tile: Tile }
  | { kind: "skill"; skill: Skill }
  | { kind: "coins"; amount: number };

type FloatingText = {
  id: string;
  target: "unit" | "tile" | "enemy" | "inventory" | "coins";
  targetId: string;
  text: string;
  tone: Tone;
};

type BattleEvent =
  | {
      type: "item";
      text: string;
      tone: Tone;
    }
  | {
      type: "unit";
      unitId: string;
      unitName: string;
      skillName: string;
      roll: number;
      slotIndex: number;
      nextIndex: number;
      text: string;
      tone: Tone;
      target: "enemy" | "ally" | "self" | "party" | "coins" | "none";
      targetUnitId?: string;
      value?: number;
    }
  | {
      type: "effect";
      text: string;
      tone: Tone;
      target: "enemy" | "unit" | "coins";
      targetUnitId?: string;
      value?: number;
    }
  | {
      type: "enemy";
      enemyName: string;
      skillName: string;
      slotIndex: number;
      nextIndex: number;
      text: string;
      target: "unit" | "party" | "self";
      targetUnitId?: string;
      value?: number;
      tone: Tone;
    };

type BattleResult = {
  win: boolean;
  logs: string[];
  units: Unit[];
  enemyName: string;
  enemyMaxHp: number;
  enemySkillBoard: EnemySkill[];
  coins: number;
  events: BattleEvent[];
};

type BattleView = {
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
  enemySkillBoard: EnemySkill[];
  enemyBoardIndex: number;
  message: string;
  activeUnitId?: string;
  activeSlot?: number;
  tone: Tone;
};

const statLabels: Record<StatKey, string> = {
  vitality: "体力",
  power: "威力",
  agility: "機敏",
};

const normalAttack: Skill = {
  id: "normal",
  name: "通常攻撃",
  effect: "attack",
  description: "敵1体に威力分のダメージ。",
};

const skillPool: Skill[] = [
  {
    id: "heavy-slash",
    name: "強打",
    effect: "heavySlash",
    description: "敵1体に威力+2ダメージ。",
  },
  {
    id: "guard",
    name: "ガード",
    effect: "guard",
    description: "自分に体力分の一時HPを付与。",
  },
  {
    id: "quick-stab",
    name: "早駆け",
    effect: "quickStab",
    description: "敵1体に機敏+1ダメージ。",
  },
  {
    id: "heal",
    name: "応急手当",
    effect: "heal",
    description: "最もHP割合が低い味方を体力+2回復。",
  },
  {
    id: "firebolt",
    name: "火球",
    effect: "firebolt",
    cost: 2,
    description: "マナ2相当。敵1体に威力+5ダメージ。",
  },
  {
    id: "rally",
    name: "号令",
    effect: "rally",
    description: "味方全員を威力分回復。",
  },
  {
    id: "spirit-slash",
    name: "気合い斬り",
    effect: "spiritSlash",
    description: "威力分のダメージ。2回止まると自分のHPを50%回復。",
  },
  {
    id: "poison-breath",
    name: "毒吹き",
    effect: "poison",
    description: "敵に毒3を付与。毒は毎ターン減衰しながらダメージ。",
  },
  {
    id: "focus",
    name: "集中",
    effect: "focus",
    description: "集中1を獲得。次の攻撃ダメージが2倍。",
  },
  {
    id: "slot",
    name: "スロット",
    effect: "slot",
    description: "1D6を振り、出目と同じゴールドを獲得。",
  },
  {
    id: "burning",
    name: "燃焼",
    effect: "burning",
    description: "止まったマスに燃焼3を配置。通過すると3ダメージ。",
  },
  {
    id: "dash",
    name: "ダッシュ",
    effect: "dash",
    description: "迅速3を3ターン獲得。戦闘出目が+3される。",
  },
];

const enemySkillPool: Record<string, EnemySkill> = {
  strike: {
    id: "enemy-strike",
    name: "爪撃",
    effect: "strike",
    description: "最も弱っている味方1体へ通常ダメージ。",
  },
  heavy: {
    id: "enemy-heavy",
    name: "強打",
    effect: "heavy",
    description: "最も弱っている味方1体へ大ダメージ。",
  },
  cleave: {
    id: "enemy-cleave",
    name: "なぎ払い",
    effect: "cleave",
    description: "味方全員へ小ダメージ。",
  },
  recover: {
    id: "enemy-recover",
    name: "再生",
    effect: "recover",
    description: "敵自身のHPを少し回復。",
  },
};

const recruitPool: Omit<Unit, "hp" | "boardIndex">[] = [
  {
    id: "mage",
    name: "リナ",
    job: "魔導士",
    stats: { vitality: 7, power: 7, agility: 4 },
    skillBoard: [normalAttack, skillPool[4], normalAttack, skillPool[2]],
  },
  {
    id: "knight",
    name: "ガレス",
    job: "騎士",
    stats: { vitality: 12, power: 4, agility: 2 },
    skillBoard: [normalAttack, skillPool[1], normalAttack, skillPool[3]],
  },
  {
    id: "thief",
    name: "ミラ",
    job: "盗賊",
    stats: { vitality: 8, power: 5, agility: 8 },
    skillBoard: [normalAttack, skillPool[2], normalAttack, skillPool[0]],
  },
  {
    id: "priest",
    name: "ノア",
    job: "祈祷師",
    stats: { vitality: 9, power: 4, agility: 5 },
    skillBoard: [normalAttack, skillPool[3], normalAttack, skillPool[5]],
  },
];

const itemPool: Item[] = [
  { id: "fixed-1", name: "小さな賽", timing: "dice", description: "次の出目を1に固定。" },
  { id: "fixed-2", name: "均しの賽", timing: "dice", description: "次の出目を2に固定。" },
  { id: "fixed-3", name: "跳ね賽", timing: "dice", description: "次の出目を3に固定。" },
  { id: "potion", name: "応急薬", timing: "battle", description: "次の戦闘開始時、全員を少し回復。" },
  { id: "bomb", name: "爆弾", timing: "battle", description: "次の戦闘開始時、敵に固定ダメージ。" },
  { id: "charm", name: "護符", timing: "battle", description: "次の戦闘開始時、全員に一時HP。" },
];

const emptyTile = (id: string): Tile => ({ id, name: "空き", type: "empty", level: 1 });

const initialBoard: Tile[] = Array.from({ length: 10 }, (_, index) => emptyTile(`empty-${index + 1}`));

const initialHero: Unit = {
  id: "hero",
  name: "アレン",
  job: "勇者",
  stats: { vitality: 10, power: 5, agility: 5 },
  hp: 50,
  boardIndex: 0,
  skillBoard: [normalAttack, normalAttack, normalAttack, normalAttack, normalAttack, normalAttack],
};

let idCounter = 0;

const battleTiming = {
  start: 900,
  item: 900,
  stepToSkill: 360,
  skillActivate: 460,
  hpChange: 650,
  enemyIntent: 620,
  enemyHit: 850,
  finish: 1000,
};

function createId(prefix: string) {
  idCounter += 1;
  return `${prefix}-${Date.now().toString(36)}-${idCounter.toString(36)}-${Math.random()
    .toString(36)
    .slice(2, 8)}`;
}

function wait(ms: number) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function maxHp(unit: Unit) {
  return unit.stats.vitality * 5;
}

function makeEnemy(battleCount: number): EnemyCombatant {
  const isBoss = battleCount === 10;
  const isMidBoss = battleCount % 3 === 0;
  return {
    name: isBoss ? "最終ボス" : isMidBoss ? "中ボス" : "魔物",
    hp: 28 + battleCount * 12,
    maxHp: 28 + battleCount * 12,
    power: 4 + battleCount * 2,
    agility: 3 + battleCount,
    boardIndex: 0,
    skillBoard: isBoss
      ? [enemySkillPool.heavy, enemySkillPool.cleave, enemySkillPool.recover, enemySkillPool.heavy]
      : isMidBoss
        ? [enemySkillPool.strike, enemySkillPool.heavy, enemySkillPool.cleave, enemySkillPool.strike]
        : [enemySkillPool.strike, enemySkillPool.strike, enemySkillPool.heavy, enemySkillPool.strike],
  };
}

function cloneTile(tile: Tile): Tile {
  return { ...tile, id: createId(tile.id) };
}

function makeTrainingTile(stat: StatKey, scope: Scope, rare = false): Tile {
  return {
    id: createId(`${scope}-${stat}`),
    name: `${scope === "all" ? "全体" : ""}${statLabels[stat]}訓練`,
    type: "training",
    stat,
    scope,
    level: 1,
    rare,
  };
}

function randomFrom<T>(items: T[]): T {
  return items[Math.floor(Math.random() * items.length)];
}

function tileChoicePool(): Tile[] {
  return [
    makeTrainingTile("vitality", "single"),
    makeTrainingTile("power", "single"),
    makeTrainingTile("agility", "single"),
    makeTrainingTile("vitality", "all", true),
    makeTrainingTile("power", "all", true),
    makeTrainingTile("agility", "all", true),
    cloneTile({ id: "item-reward", name: "アイテム", type: "item", level: 1 }),
    cloneTile({ id: "skill-reward", name: "戦闘訓練", type: "skill", level: 1 }),
    cloneTile({ id: "treasure-reward", name: "宝箱", type: "treasure", level: 1, rare: true }),
  ];
}

function tileChoices(count: number): Tile[] {
  return tileChoicePool()
    .sort(() => Math.random() - 0.5)
    .slice(0, count);
}

function uniqueRewards(count: number): Reward[] {
  const tileChoices = tileChoicePool();
  const rewards: Reward[] = [];
  while (rewards.length < count) {
    const roll = Math.random();
    if (roll < 0.55) rewards.push({ kind: "tile", tile: randomFrom(tileChoices) });
    else if (roll < 0.9) rewards.push({ kind: "skill", skill: randomFrom(skillPool) });
    else rewards.push({ kind: "coins", amount: 12 + rewards.length * 4 });
  }
  return rewards;
}

function tileIcon(type: TileType) {
  switch (type) {
    case "training":
      return <Zap size={18} />;
    case "item":
      return <PackagePlus size={18} />;
    case "treasure":
      return <Box size={18} />;
    case "skill":
      return <Swords size={18} />;
    case "shop":
      return <ShoppingCart size={18} />;
    case "inn":
      return <Hotel size={18} />;
    default:
      return <Plus size={18} />;
  }
}

function getTileDescription(tile: Tile) {
  if (tile.type === "training" && tile.stat && tile.scope) {
    const amount = tile.scope === "all" ? tile.level : tile.level + 1;
    return `${tile.scope === "all" ? "全員" : "1体選択"}の${statLabels[tile.stat]}+${amount}`;
  }
  if (tile.type === "item") return "アイテムを1つ入手。最大3個。";
  if (tile.type === "treasure") return "レアマスを入手。このマスは空きになる。";
  if (tile.type === "skill") return "スキルを1つ入手。準備フェーズで装備。";
  if (tile.type === "shop") return "コインでマスを購入。";
  if (tile.type === "inn") return "8コインで味方全員を回復。";
  return "効果なし。";
}

function runBattle(units: Unit[], battleCount: number, battleItems: Item[]): BattleResult {
  const fighters: BattleUnit[] = units.map((unit) => ({
    ...unit,
    hp: Math.min(unit.hp, maxHp(unit)),
    tempHp: 0,
    focus: 0,
    swiftTurns: 0,
    swiftBonus: 0,
    charges: {},
    burns: {},
  }));
  const enemy = makeEnemy(battleCount);
  const logs: string[] = [`${enemy.name}が現れた。`];
  const events: BattleEvent[] = [];
  let enemyPoison = 0;
  let battleCoins = 0;

  for (const item of battleItems) {
    if (item.id === "potion") {
      fighters.forEach((unit) => {
        unit.hp = Math.min(maxHp(unit), unit.hp + 8);
      });
      const text = "応急薬で味方全員を回復。";
      logs.push(text);
      events.push({ type: "item", text, tone: "good" });
    }
    if (item.id === "bomb") {
      enemy.hp -= 14;
      const text = "爆弾で敵に14ダメージ。";
      logs.push(text);
      events.push({ type: "item", text, tone: "bad" });
    }
    if (item.id === "charm") {
      fighters.forEach((unit) => {
        unit.tempHp += 8;
      });
      const text = "護符で味方全員に一時HP。";
      logs.push(text);
      events.push({ type: "item", text, tone: "good" });
    }
  }

  function unitEvent(
    unit: BattleUnit,
    skill: Skill,
    roll: number,
    slotIndex: number,
    text: string,
    tone: Tone,
    target: Extract<BattleEvent, { type: "unit" }>["target"],
    value?: number,
    targetUnitId?: string,
  ) {
    logs.push(text);
    events.push({
      type: "unit",
      unitId: unit.id,
      unitName: unit.name,
      skillName: skill.name,
      roll,
      slotIndex,
      nextIndex: unit.boardIndex,
      text,
      tone,
      target,
      targetUnitId,
      value,
    });
  }

  function effectEvent(text: string, tone: Tone, target: Extract<BattleEvent, { type: "effect" }>["target"], value?: number, targetUnitId?: string) {
    logs.push(text);
    events.push({ type: "effect", text, tone, target, value, targetUnitId });
  }

  function damageEnemy(unit: BattleUnit, baseDamage: number) {
    const focused = unit.focus > 0;
    if (focused) unit.focus -= 1;
    const damage = focused ? baseDamage * 2 : baseDamage;
    enemy.hp -= damage;
    return { damage, focused };
  }

  function resolveUnitSkill(unit: BattleUnit, skill: Skill, slotIndex: number, roll: number) {
    switch (skill.effect) {
      case "guard": {
        unit.tempHp += unit.stats.vitality;
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。一時HP+${unit.stats.vitality}。`, "good", "self", unit.stats.vitality);
        return;
      }
      case "quickStab": {
        const { damage, focused } = damageEnemy(unit, unit.stats.agility + 1);
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${damage}ダメージ${focused ? "。集中で2倍" : ""}。`, "bad", "enemy", damage);
        return;
      }
      case "heal": {
        const target = fighters.filter((u) => u.hp > 0).sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0];
        const amount = unit.stats.vitality + 2;
        target.hp = Math.min(maxHp(target), target.hp + amount);
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${target.name}を${amount}回復。`, "good", "ally", amount, target.id);
        return;
      }
      case "firebolt": {
        const { damage, focused } = damageEnemy(unit, unit.stats.power + 5);
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${damage}ダメージ${focused ? "。集中で2倍" : ""}。`, "bad", "enemy", damage);
        return;
      }
      case "rally": {
        fighters.forEach((target) => {
          if (target.hp > 0) target.hp = Math.min(maxHp(target), target.hp + unit.stats.power);
        });
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。味方全員を${unit.stats.power}回復。`, "good", "party", unit.stats.power);
        return;
      }
      case "heavySlash": {
        const { damage, focused } = damageEnemy(unit, unit.stats.power + 2);
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${damage}ダメージ${focused ? "。集中で2倍" : ""}。`, "bad", "enemy", damage);
        return;
      }
      case "spiritSlash": {
        const { damage, focused } = damageEnemy(unit, unit.stats.power);
        unit.charges[skill.id] = (unit.charges[skill.id] ?? 0) + 1;
        if (unit.charges[skill.id] >= 2) {
          unit.charges[skill.id] = 0;
          const heal = Math.ceil(maxHp(unit) * 0.5);
          unit.hp = Math.min(maxHp(unit), unit.hp + heal);
          unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${damage}ダメージ${focused ? "。集中で2倍" : ""}。HPを${heal}回復。`, "good", "ally", heal, unit.id);
          return;
        }
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${damage}ダメージ${focused ? "。集中で2倍" : ""}。チャージ${unit.charges[skill.id]}/2。`, "bad", "enemy", damage);
        return;
      }
      case "poison": {
        enemyPoison += 3;
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。敵に毒3を付与。`, "bad", "none");
        return;
      }
      case "focus": {
        unit.focus += 1;
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。集中+1。次の攻撃が2倍。`, "good", "self");
        return;
      }
      case "slot": {
        const gain = Math.ceil(Math.random() * 6);
        battleCoins += gain;
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${gain}ゴールド獲得。`, "good", "coins", gain);
        return;
      }
      case "burning": {
        unit.burns[slotIndex] = (unit.burns[slotIndex] ?? 0) + 3;
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。このマスに燃焼3を配置。`, "bad", "none");
        return;
      }
      case "dash": {
        unit.swiftTurns = 3;
        unit.swiftBonus = 3;
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。迅速3を3ターン獲得。`, "good", "self");
        return;
      }
      case "attack":
      default: {
        const { damage, focused } = damageEnemy(unit, unit.stats.power);
        unitEvent(unit, skill, roll, slotIndex, `${unit.name}の${skill.name}。${damage}ダメージ${focused ? "。集中で2倍" : ""}。`, "bad", "enemy", damage);
      }
    }
  }

  for (let round = 1; round <= 10; round += 1) {
    if (enemyPoison > 0) {
      enemy.hp -= enemyPoison;
      effectEvent(`毒で${enemyPoison}ダメージ。`, "bad", "enemy", enemyPoison);
      enemyPoison = Math.max(0, enemyPoison - 1);
    }
    if (enemy.hp <= 0 || fighters.every((unit) => unit.hp <= 0)) break;

    const actors = [
      ...fighters.filter((unit) => unit.hp > 0).map((unit) => ({ type: "unit" as const, agility: unit.stats.agility, unit })),
      { type: "enemy" as const, agility: enemy.agility, unit: null },
    ].sort((a, b) => b.agility - a.agility);

    for (const actor of actors) {
      if (enemy.hp <= 0 || fighters.every((unit) => unit.hp <= 0)) break;

      if (actor.type === "enemy") {
        const slotIndex = enemy.boardIndex % enemy.skillBoard.length;
        const skill = enemy.skillBoard[slotIndex];
        enemy.boardIndex = (enemy.boardIndex + 1) % enemy.skillBoard.length;

        if (skill.effect === "recover") {
          const amount = Math.ceil(enemy.power * 1.2);
          enemy.hp = Math.min(enemy.maxHp, enemy.hp + amount);
          const text = `${enemy.name}の${skill.name}。HPを${amount}回復。`;
          logs.push(text);
          events.push({
            type: "enemy",
            enemyName: enemy.name,
            skillName: skill.name,
            slotIndex,
            nextIndex: enemy.boardIndex,
            text,
            target: "self",
            value: amount,
            tone: "good",
          });
          continue;
        }

        if (skill.effect === "cleave") {
          const damage = Math.max(1, Math.floor(enemy.power * 0.55));
          fighters.forEach((target) => {
            if (target.hp <= 0) return;
            const absorbed = Math.min(target.tempHp, damage);
            target.tempHp -= absorbed;
            target.hp -= damage - absorbed;
          });
          const text = `${enemy.name}の${skill.name}。味方全員に${damage}ダメージ。`;
          logs.push(text);
          events.push({
            type: "enemy",
            enemyName: enemy.name,
            skillName: skill.name,
            slotIndex,
            nextIndex: enemy.boardIndex,
            text,
            target: "party",
            value: damage,
            tone: "bad",
          });
          continue;
        }

        const target = fighters.filter((unit) => unit.hp > 0).sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0];
        const damage = skill.effect === "heavy" ? enemy.power + 3 : enemy.power;
        const absorbed = Math.min(target.tempHp, damage);
        target.tempHp -= absorbed;
        target.hp -= damage - absorbed;
        const text = `${enemy.name}の${skill.name}。${target.name}に${damage}ダメージ。`;
        logs.push(text);
        events.push({
          type: "enemy",
          enemyName: enemy.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: enemy.boardIndex,
          text,
          target: "unit",
          targetUnitId: target.id,
          value: damage,
          tone: "bad",
        });
        continue;
      }

      const unit = actor.unit;
      const baseRoll = Math.ceil(Math.random() * 3);
      const swiftBonus = unit.swiftTurns > 0 ? unit.swiftBonus : 0;
      const battleRoll = baseRoll + swiftBonus;
      if (unit.swiftTurns > 0) {
        unit.swiftTurns -= 1;
        if (unit.swiftTurns <= 0) unit.swiftBonus = 0;
      }

      let slotIndex = unit.boardIndex;
      for (let step = 1; step <= battleRoll; step += 1) {
        slotIndex = (unit.boardIndex + step) % unit.skillBoard.length;
        if (unit.burns[slotIndex] > 0) {
          const burnDamage = 3;
          unit.hp = Math.max(0, unit.hp - burnDamage);
          unit.burns[slotIndex] -= 1;
          if (unit.burns[slotIndex] <= 0) delete unit.burns[slotIndex];
          effectEvent(`${unit.name}?????????${burnDamage}?????`, "bad", "unit", burnDamage, unit.id);
          if (unit.hp <= 0) break;
        }
      }
      if (unit.hp <= 0) continue;

      const skill = unit.skillBoard[slotIndex];
      unit.boardIndex = slotIndex;
      resolveUnitSkill(unit, skill, slotIndex, battleRoll);
    }
  }

  return {
    win: enemy.hp <= 0,
    logs,
    units: fighters.map(({ tempHp: _tempHp, focus: _focus, swiftTurns: _swiftTurns, swiftBonus: _swiftBonus, charges: _charges, burns: _burns, ...unit }) => ({
      ...unit,
      hp: Math.max(0, unit.hp),
    })),
    enemyName: enemy.name,
    enemyMaxHp: enemy.maxHp,
    enemySkillBoard: enemy.skillBoard,
    coins: battleCoins,
    events,
  };
}

export function App() {
  const [board, setBoard] = useState<Tile[]>(initialBoard);
  const [position, setPosition] = useState(0);
  const [turn, setTurn] = useState(0);
  const [battleCount, setBattleCount] = useState(0);
  const [units, setUnits] = useState<Unit[]>([initialHero]);
  const [coins, setCoins] = useState(18);
  const [items, setItems] = useState<Item[]>([]);
  const [battleItems, setBattleItems] = useState<Item[]>([]);
  const [tileInventory, setTileInventory] = useState<Tile[]>([]);
  const [skillInventory, setSkillInventory] = useState<Skill[]>([]);
  const [phase, setPhase] = useState<Phase>("explore");
  const [prepEndsTurn, setPrepEndsTurn] = useState(false);
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [fixedRoll, setFixedRoll] = useState<number | null>(null);
  const [pendingTraining, setPendingTraining] = useState<{ stat: StatKey; amount: number } | null>(null);
  const [pendingTileIndex, setPendingTileIndex] = useState<number | null>(null);
  const [pendingTileChoices, setPendingTileChoices] = useState<Tile[]>([]);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [shopOffers, setShopOffers] = useState<Tile[]>([]);
  const [recruits, setRecruits] = useState<Omit<Unit, "hp" | "boardIndex">[]>([]);
  const [selectedItemIndex, setSelectedItemIndex] = useState<number | null>(null);
  const [selectedTileIndex, setSelectedTileIndex] = useState<number | null>(null);
  const [selectedSkillIndex, setSelectedSkillIndex] = useState<number | null>(null);
  const [log, setLog] = useState<string[]>(["ラン開始。まずは勇者1体で盤面を育てる。"]);

  const [banner, setBanner] = useState<string | null>(null);
  const [diceRolling, setDiceRolling] = useState(false);
  const [movingTrail, setMovingTrail] = useState<number[]>([]);
  const [arrivalIndex, setArrivalIndex] = useState<number | null>(null);
  const [tileEffectIndex, setTileEffectIndex] = useState<number | null>(null);
  const [installedTileIndex, setInstalledTileIndex] = useState<number | null>(null);
  const [unitPulse, setUnitPulse] = useState<Record<string, Tone>>({});
  const [activeSkill, setActiveSkill] = useState<{ unitId: string; slotIndex: number } | null>(null);
  const [activeEnemySkill, setActiveEnemySkill] = useState<number | null>(null);
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [battleView, setBattleView] = useState<BattleView | null>(null);
  const [battleUnits, setBattleUnits] = useState<Unit[]>([]);
  const [rewardPulse, setRewardPulse] = useState<number | null>(null);
  const [inventoryPulse, setInventoryPulse] = useState(false);
  const [coinPulse, setCoinPulse] = useState(false);
  const [showLog, setShowLog] = useState(false);
  const [skillPopup, setSkillPopup] = useState<Skill | null>(null);
  const [pauseView, setPauseView] = useState<PauseView | null>(null);

  const aliveUnits = useMemo(() => units.filter((unit) => unit.hp > 0).length, [units]);
  const skillCatalog = useMemo(() => [normalAttack, ...skillPool], []);
  const locked = phase === "animating" || phase === "battle";

  function pushLog(message: string) {
    setLog((current) => [message, ...current].slice(0, 12));
  }

  function addFloatingText(target: FloatingText["target"], targetId: string, text: string, tone: Tone) {
    const id = createId("float");
    setFloatingTexts((current) => [...current, { id, target, targetId, text, tone }]);
    window.setTimeout(() => {
      setFloatingTexts((current) => current.filter((entry) => entry.id !== id));
    }, 900);
  }

  async function flashUnit(unitId: string, tone: Tone, text?: string) {
    setUnitPulse((current) => ({ ...current, [unitId]: tone }));
    if (text) addFloatingText("unit", unitId, text, tone);
    await wait(360);
    setUnitPulse((current) => {
      const next = { ...current };
      delete next[unitId];
      return next;
    });
  }

  async function flashTile(index: number, tone: Tone, text?: string) {
    setTileEffectIndex(index);
    if (text) addFloatingText("tile", String(index), text, tone);
    await wait(360);
    setTileEffectIndex(null);
  }

  async function flashInventory(text?: string) {
    setInventoryPulse(true);
    if (text) addFloatingText("inventory", "inventory", text, "good");
    await wait(360);
    setInventoryPulse(false);
  }

  async function flashCoins(text: string) {
    setCoinPulse(true);
    addFloatingText("coins", "coins", text, "good");
    await wait(360);
    setCoinPulse(false);
  }

  function updateUnit(id: string, updater: (unit: Unit) => Unit) {
    setUnits((current) => current.map((unit) => (unit.id === id ? updater(unit) : unit)));
  }

  async function finishTurn(nextUnits = units) {
    const nextTurn = turn + 1;
    setTurn(nextTurn);
    await wait(180);

    if (nextTurn % 5 === 0) {
      await startBattle(nextUnits);
      return;
    }

    setPhase("explore");
    setBanner(null);
  }

  async function rollDice() {
    if (phase !== "explore" || locked) return;

    setPhase("animating");
    setDiceRolling(true);
    setBanner("サイコロを振る");
    await wait(480);

    const roll = fixedRoll ?? Math.ceil(Math.random() * 3);
    setFixedRoll(null);
    setLastRoll(roll);
    setDiceRolling(false);
    setBanner(`${roll}マス進む`);
    addFloatingText("tile", String(position), `${roll}`, "neutral");
    await wait(420);

    const trail: number[] = [];
    let currentPosition = position;
    for (let step = 0; step < roll; step += 1) {
      currentPosition = (currentPosition + 1) % board.length;
      trail.push(currentPosition);
      setMovingTrail([...trail]);
      setPosition(currentPosition);
      await wait(180);
    }

    setArrivalIndex(currentPosition);
    setMovingTrail([]);
    const tile = board[currentPosition];
    pushLog(`${roll}進んで「${tile.name}」に止まった。`);
    await wait(360);
    setArrivalIndex(null);
    await resolveTile(tile, currentPosition);
    setBanner(null);
  }

  async function resolveTile(tile: Tile, tileIndex: number) {
    await flashTile(tileIndex, tile.rare ? "rare" : "neutral", tile.name);

    if (tile.type === "empty") {
      setPendingTileIndex(tileIndex);
      setPendingTileChoices(tileChoices(3));
      setBanner(null);
      setPhase("chooseTile");
      return;
    }

    if (tile.type === "training" && tile.stat && tile.scope) {
      const amount = tile.scope === "all" ? tile.level : tile.level + 1;
      if (tile.scope === "all") {
        const nextUnits = units.map((unit) => ({
          ...unit,
          stats: { ...unit.stats, [tile.stat!]: unit.stats[tile.stat!] + amount },
          hp: tile.stat === "vitality" ? unit.hp + amount * 5 : unit.hp,
        }));
        setUnits(nextUnits);
        setBanner(`全員の${statLabels[tile.stat]}+${amount}`);
        pushLog(`全員の${statLabels[tile.stat]}+${amount}。`);
        for (const unit of nextUnits) {
          void flashUnit(unit.id, "good", `+${amount}`);
        }
        await wait(520);
        await finishTurn(nextUnits);
      } else {
        setPendingTraining({ stat: tile.stat, amount });
        setBanner(null);
        setPhase("chooseTraining");
      }
      return;
    }

    if (tile.type === "item") {
      const item = randomFrom(itemPool);
      if (items.length >= 3) {
        setCoins((value) => value + 4);
        pushLog("アイテム欄が満杯。代わりに4コイン獲得。");
        await flashCoins("+4");
      } else {
        setItems((current) => [...current, item]);
        pushLog(`${item.name}を入手。`);
        await flashInventory(item.name);
      }
      await finishTurn();
      return;
    }

    if (tile.type === "treasure") {
      const rareTile = makeTrainingTile(randomFrom(["vitality", "power", "agility"] as StatKey[]), "all", true);
      setTileInventory((current) => [...current, rareTile].slice(0, 5));
      setBoard((current) => current.map((entry, index) => (index === tileIndex ? emptyTile(createId("empty")) : entry)));
      pushLog(`宝箱を消費して「${rareTile.name}」を入手。`);
      await flashInventory("レアマス");
      await finishTurn();
      return;
    }

    if (tile.type === "skill") {
      const skill = randomFrom(skillPool);
      setSkillInventory((current) => [...current, skill].slice(0, 6));
      pushLog(`スキル「${skill.name}」を入手。`);
      await flashInventory(skill.name);
      setPrepEndsTurn(true);
      setBanner(null);
      setPhase("prep");
      return;
    }

    if (tile.type === "shop") {
      setShopOffers(uniqueRewards(4).filter((reward): reward is { kind: "tile"; tile: Tile } => reward.kind === "tile").map((reward) => reward.tile).slice(0, 3));
      setBanner(null);
      setPhase("shop");
      return;
    }

    if (tile.type === "inn") {
      if (coins >= 8) {
        setCoins((value) => value - 8);
        const nextUnits = units.map((unit) => ({ ...unit, hp: maxHp(unit) }));
        setUnits(nextUnits);
        pushLog("宿屋で全員回復。");
        for (const unit of nextUnits) {
          void flashUnit(unit.id, "good", "回復");
        }
        await wait(520);
        await finishTurn(nextUnits);
      } else {
        pushLog("コイン不足で宿屋を使えなかった。");
        addFloatingText("coins", "coins", "不足", "bad");
        await wait(420);
        await finishTurn();
      }
    }
  }

  async function applyTraining(unitId: string) {
    if (!pendingTraining || locked) return;
    const { stat, amount } = pendingTraining;
    const nextUnits = units.map((unit) => {
      if (unit.id !== unitId) return unit;
      return {
        ...unit,
        stats: { ...unit.stats, [stat]: unit.stats[stat] + amount },
        hp: stat === "vitality" ? unit.hp + amount * 5 : unit.hp,
      };
    });
    setUnits(nextUnits);
    setPendingTraining(null);
    setPhase("animating");
    const target = units.find((unit) => unit.id === unitId);
    pushLog(`${target?.name}の${statLabels[stat]}+${amount}。`);
    await flashUnit(unitId, "good", `${statLabels[stat]}+${amount}`);
    await finishTurn(nextUnits);
  }

  async function startBattle(currentUnits: Unit[]) {
    setPhase("battle");
    setBanner("戦闘開始");
    const nextBattle = battleCount + 1;
    const usedBattleItems = battleItems;
    setBattleItems([]);
    const result = runBattle(currentUnits, nextBattle, usedBattleItems);
    setBattleUnits(currentUnits.map((unit) => ({ ...unit })));

    setBattleView({
      enemyName: result.enemyName,
      enemyHp: result.enemyMaxHp,
      enemyMaxHp: result.enemyMaxHp,
      enemySkillBoard: result.enemySkillBoard,
      enemyBoardIndex: 0,
      message: `${result.enemyName}が現れた`,
      tone: "neutral",
    });
    await wait(battleTiming.start);

    let enemyHp = result.enemyMaxHp;
    for (const event of result.events) {
      if (event.type === "item") {
        setBattleView((current) => current && { ...current, message: event.text, tone: event.tone });
        await wait(battleTiming.skillActivate);
        if (event.text.includes("14")) {
          enemyHp = Math.max(0, enemyHp - 14);
          setBattleView((current) => current && { ...current, enemyHp });
          addFloatingText("enemy", "enemy", "-14", "bad");
        }
        if (event.text.includes("回復")) {
          setBattleUnits((current) => current.map((unit) => ({ ...unit, hp: Math.min(maxHp(unit), unit.hp + 8) })));
        }
        await wait(battleTiming.item);
        continue;
      }

      if (event.type === "effect") {
        setBattleView((current) => current && { ...current, message: event.text, tone: event.tone });
        await wait(battleTiming.skillActivate);
        if (event.target === "enemy" && event.value) {
          enemyHp = Math.max(0, enemyHp - event.value);
          setBattleView((current) => current && { ...current, enemyHp });
          addFloatingText("enemy", "enemy", `-${event.value}`, "bad");
        } else if (event.target === "unit" && event.targetUnitId && event.value) {
          setBattleUnits((current) =>
            current.map((unit) => (unit.id === event.targetUnitId ? { ...unit, hp: Math.max(0, unit.hp - event.value!) } : unit)),
          );
          addFloatingText("unit", event.targetUnitId, `-${event.value}`, "bad");
          void flashUnit(event.targetUnitId, "bad");
        } else if (event.target === "coins" && event.value) {
          setCoins((value) => value + event.value!);
          await flashCoins(`+${event.value}`);
        }
        await wait(battleTiming.hpChange);
        continue;
      }

      if (event.type === "unit") {
        setActiveSkill(null);
        setBattleUnits((current) =>
          current.map((unit) => (unit.id === event.unitId ? { ...unit, boardIndex: event.slotIndex } : unit)),
        );
        setBattleView((current) =>
          current && {
            ...current,
            enemyHp: current.enemyHp,
            activeUnitId: event.unitId,
            activeSlot: event.slotIndex,
            tone: "neutral",
          },
        );
        await wait(battleTiming.stepToSkill);
        setActiveSkill({ unitId: event.unitId, slotIndex: event.slotIndex });
        setBattleView((current) =>
          current && {
            ...current,
            message: `出目${event.roll}: ${event.skillName} 発動`,
            tone: event.tone,
          },
        );
        await wait(battleTiming.skillActivate);
        if (event.target === "enemy" && event.value) {
          enemyHp = Math.max(0, enemyHp - event.value);
          setBattleView((current) => current && { ...current, enemyHp });
          addFloatingText("enemy", "enemy", `-${event.value}`, "bad");
        } else if (event.targetUnitId && event.value) {
          setBattleUnits((current) =>
            current.map((unit) =>
              unit.id === event.targetUnitId ? { ...unit, hp: Math.min(maxHp(unit), unit.hp + event.value!) } : unit,
            ),
          );
          addFloatingText("unit", event.targetUnitId, `+${event.value}`, "good");
          void flashUnit(event.targetUnitId, "good");
        } else if (event.target === "party" && event.value) {
          setBattleUnits((current) => current.map((unit) => ({ ...unit, hp: Math.min(maxHp(unit), unit.hp + event.value!) })));
          currentUnits.forEach((unit) => addFloatingText("unit", unit.id, `+${event.value}`, "good"));
        } else if (event.target === "self" && event.value) {
          addFloatingText("unit", event.unitId, `+${event.value}`, "good");
        } else if (event.target === "coins" && event.value) {
          setCoins((value) => value + event.value!);
          await flashCoins(`+${event.value}`);
        }
        setUnits((current) =>
          current.map((unit) => (unit.id === event.unitId ? { ...unit, boardIndex: event.nextIndex } : unit)),
        );
        setBattleView((current) => current && { ...current, message: event.text, tone: event.tone });
        await wait(battleTiming.hpChange);
        setBattleUnits((current) =>
          current.map((unit) => (unit.id === event.unitId ? { ...unit, boardIndex: event.nextIndex } : unit)),
        );
        setActiveSkill(null);
        continue;
      }

      setActiveEnemySkill(null);
      setBattleView(
        (current) =>
          current && {
            ...current,
            activeUnitId: undefined,
            activeSlot: undefined,
            enemyBoardIndex: event.slotIndex,
            tone: "neutral",
          },
      );
      await wait(battleTiming.stepToSkill);
      setActiveEnemySkill(event.slotIndex);
      setBattleView((current) => current && { ...current, message: `${event.skillName} 発動`, tone: event.tone });
      await wait(battleTiming.skillActivate);

      if (event.target === "self" && event.value) {
        enemyHp = Math.min(result.enemyMaxHp, enemyHp + event.value);
        setBattleView((current) => current && { ...current, enemyHp });
        addFloatingText("enemy", "enemy", `+${event.value}`, "good");
      } else if (event.target === "party" && event.value) {
        setBattleUnits((current) =>
          current.map((unit) => (unit.hp > 0 ? { ...unit, hp: Math.max(0, unit.hp - event.value!) } : unit)),
        );
        currentUnits.forEach((unit) => addFloatingText("unit", unit.id, `-${event.value}`, "bad"));
      } else if (event.targetUnitId && event.value) {
        setBattleUnits((current) =>
          current.map((unit) => (unit.id === event.targetUnitId ? { ...unit, hp: Math.max(0, unit.hp - event.value!) } : unit)),
        );
        addFloatingText("unit", event.targetUnitId, `-${event.value}`, "bad");
        void flashUnit(event.targetUnitId, "bad");
      }

      setBattleView((current) => current && { ...current, message: event.text, tone: event.tone });
      await wait(battleTiming.hpChange);
      setBattleView((current) => current && { ...current, enemyBoardIndex: event.nextIndex });
      setActiveEnemySkill(null);
    }
    setLog((current) => [...result.logs.reverse(), ...current].slice(0, 12));
    setUnits(result.units);
    setBattleView((current) =>
      current && {
        ...current,
        enemyHp: Math.max(0, enemyHp),
        message: result.win ? "勝利" : "敗北",
        tone: result.win ? "good" : "bad",
      },
    );
    await wait(battleTiming.finish);

    if (!result.win) {
      setBattleView(null);
      setBattleUnits([]);
      setBanner(null);
      setPhase("gameover");
      return;
    }

    setBattleCount(nextBattle);
    setCoins((value) => value + 8 + nextBattle);
    await flashCoins(`+${8 + nextBattle}`);

    if (nextBattle >= 10) {
      setBattleView(null);
      setBattleUnits([]);
      setBanner(null);
      setPhase("clear");
      return;
    }

    setRewards(uniqueRewards(3));
    setBattleView(null);
    setBattleUnits([]);
    setBanner(null);
    setPhase("reward");
  }

  async function chooseTileEffect(tile: Tile, index: number) {
    if (phase !== "chooseTile" || pendingTileIndex === null || locked) return;
    const boardIndex = pendingTileIndex;
    setRewardPulse(index);
    await wait(260);
    setBoard((current) => current.map((entry, entryIndex) => (entryIndex === boardIndex ? tile : entry)));
    setPendingTileIndex(null);
    setPendingTileChoices([]);
    setRewardPulse(null);
    setPhase("animating");
    pushLog(`空きマスに「${tile.name}」を設定。`);
    await resolveTile(tile, boardIndex);
  }

  async function chooseReward(reward: Reward, index: number) {
    if (locked) return;
    setRewardPulse(index);
    await wait(260);
    if (reward.kind === "tile") {
      setTileInventory((current) => [...current, reward.tile].slice(0, 5));
      pushLog(`未設置マス「${reward.tile.name}」を入手。`);
      await flashInventory(reward.tile.name);
    } else if (reward.kind === "skill") {
      setSkillInventory((current) => [...current, reward.skill].slice(0, 6));
      pushLog(`スキル「${reward.skill.name}」を入手。`);
      await flashInventory(reward.skill.name);
    } else {
      setCoins((value) => value + reward.amount);
      pushLog(`${reward.amount}コインを入手。`);
      await flashCoins(`+${reward.amount}`);
    }
    setRewardPulse(null);
    setRewards([]);
    setPrepEndsTurn(false);
    setPhase("prep");
  }

  async function recruit(candidate: Omit<Unit, "hp" | "boardIndex">) {
    if (locked) return;
    const newUnit: Unit = { ...candidate, hp: candidate.stats.vitality * 5, boardIndex: 0 };
    setUnits((current) => [...current, newUnit]);
    pushLog(`${candidate.name}が仲間になった。`);
    setPrepEndsTurn(false);
    setPhase("prep");
    await wait(80);
    await flashUnit(candidate.id, "good", "加入");
  }

  async function buyTile(tile: Tile, price: number) {
    if (coins < price || locked) {
      addFloatingText("coins", "coins", "不足", "bad");
      return;
    }
    setCoins((value) => value - price);
    setTileInventory((current) => [...current, tile].slice(0, 5));
    pushLog(`SHOPで「${tile.name}」を購入。`);
    await flashCoins(`-${price}`);
    await flashInventory(tile.name);
  }

  async function leaveShop() {
    if (locked) return;
    setShopOffers([]);
    setPhase("animating");
    await finishTurn();
  }

  async function leavePrep() {
    if (locked) return;
    setSelectedTileIndex(null);
    setSelectedSkillIndex(null);
    if (prepEndsTurn) {
      setPrepEndsTurn(false);
      setPhase("animating");
      await finishTurn();
      return;
    }
    setPhase("explore");
  }

  async function installTile(boardIndex: number) {
    if (selectedTileIndex === null || locked) return;
    const tile = tileInventory[selectedTileIndex];
    setInstalledTileIndex(boardIndex);
    await wait(220);
    setBoard((current) =>
      current.map((entry, index) => {
        if (index !== boardIndex) return entry;
        if (entry.name === tile.name && entry.type === tile.type) {
          return { ...entry, level: entry.level + 1 };
        }
        return tile;
      }),
    );
    setTileInventory((current) => current.filter((_, index) => index !== selectedTileIndex));
    setSelectedTileIndex(null);
    pushLog(`「${tile.name}」を${boardIndex + 1}マス目に設置。`);
    await flashTile(boardIndex, tile.rare ? "rare" : "good", "設置");
    setInstalledTileIndex(null);
  }

  async function installSkill(unitId: string, slotIndex: number) {
    if (selectedSkillIndex === null || locked) return;
    const skill = skillInventory[selectedSkillIndex];
    setActiveSkill({ unitId, slotIndex });
    await wait(220);
    updateUnit(unitId, (unit) => ({
      ...unit,
      skillBoard: unit.skillBoard.map((entry, index) => (index === slotIndex ? skill : entry)),
    }));
    setSkillInventory((current) => current.filter((_, index) => index !== selectedSkillIndex));
    setSelectedSkillIndex(null);
    pushLog(`${skill.name}を装備。`);
    addFloatingText("unit", unitId, "装備", "good");
    await wait(360);
    setActiveSkill(null);
  }

  async function useItem(item: Item, index: number) {
    if (phase !== "explore" || locked) return;
    setSelectedItemIndex(null);
    setItems((current) => current.filter((_, i) => i !== index));
    if (item.timing === "dice") {
      const value = Number(item.id.replace("fixed-", ""));
      setFixedRoll(value);
      pushLog(`${item.name}を使用。次の出目は${value}。`);
      setDiceRolling(true);
      await wait(240);
      setDiceRolling(false);
      return;
    }

    setBattleItems((current) => [...current, item]);
    pushLog(`${item.name}を次の戦闘に予約。`);
    setInventoryPulse(true);
    await wait(300);
    setInventoryPulse(false);
  }

  function resetGame() {
    setBoard(initialBoard);
    setPosition(0);
    setTurn(0);
    setBattleCount(0);
    setUnits([initialHero]);
    setCoins(18);
    setItems([]);
    setBattleItems([]);
    setTileInventory([]);
    setSkillInventory([]);
    setPhase("explore");
    setPrepEndsTurn(false);
    setLastRoll(null);
    setFixedRoll(null);
    setPendingTraining(null);
    setPendingTileIndex(null);
    setPendingTileChoices([]);
    setRewards([]);
    setShopOffers([]);
    setRecruits([]);
    setSelectedItemIndex(null);
    setSelectedTileIndex(null);
    setSelectedSkillIndex(null);
    setBanner(null);
    setDiceRolling(false);
    setMovingTrail([]);
    setArrivalIndex(null);
    setTileEffectIndex(null);
    setInstalledTileIndex(null);
    setUnitPulse({});
    setActiveSkill(null);
    setFloatingTexts([]);
    setBattleView(null);
    setBattleUnits([]);
    setRewardPulse(null);
    setInventoryPulse(false);
    setCoinPulse(false);
    setShowLog(false);
    setSkillPopup(null);
    setPauseView(null);
    setLog(["ラン開始。まずは勇者1体で盤面を育てる。"]);
  }

  function renderFloating(target: FloatingText["target"], targetId: string) {
    return floatingTexts
      .filter((entry) => entry.target === target && entry.targetId === targetId)
      .map((entry) => (
        <span key={entry.id} className={`floatText ${entry.tone}`}>
          {entry.text}
        </span>
      ));
  }

  function renderUnitPanel(
    unit: Unit,
    options: {
      className?: string;
      active?: boolean;
      onSkillSlot?: (slotIndex: number) => void;
      showHp?: boolean;
    } = {},
  ) {
    const showHp = options.showHp ?? true;
    return (
      <article
        className={[
          "unitInfoPanel",
          options.className ?? "",
          options.active ? "acting" : "",
          unitPulse[unit.id] ? `pulse-${unitPulse[unit.id]}` : "",
        ].join(" ")}
      >
        <div className="unitInfoHead">
          <h3>{unit.job}</h3>
          {showHp && <span>{unit.hp}/{maxHp(unit)}</span>}
        </div>
        {showHp && (
          <div className="hpBar">
            <i style={{ width: `${Math.max(0, Math.min(100, (unit.hp / maxHp(unit)) * 100))}%` }} />
          </div>
        )}
        <div className="unitInfoStats">
          <span>体 {unit.stats.vitality}</span>
          <span>威 {unit.stats.power}</span>
          <span>敏 {unit.stats.agility}</span>
        </div>
        <div className="unitInfoSkillBoard">
          {unit.skillBoard.map((skill, index) => {
            const firing = activeSkill?.unitId === unit.id && activeSkill.slotIndex === index;
            return (
              <button
                key={`${unit.id}-info-${skill.id}-${index}`}
                type="button"
                className={[
                  "unitInfoSkill",
                  unit.boardIndex === index ? "next" : "",
                  firing ? "firing" : "",
                ].join(" ")}
                onClick={(event) => {
                  event.stopPropagation();
                  if (options.onSkillSlot && selectedSkillIndex !== null && !locked) {
                    options.onSkillSlot(index);
                    return;
                  }
                  setSkillPopup(skill);
                }}
                title={skill.description}
              >
                <small>{index + 1}</small>
                <span>{skill.name}</span>
              </button>
            );
          })}
        </div>
        {renderFloating("unit", unit.id)}
      </article>
    );
  }

  return (
    <main className={`app ${locked ? "locked" : ""}`}>
      {banner && <div className="bannerPulse">{banner}</div>}
      <section className="topbar">
        <div>
          <h1>育成すごろくRPG</h1>
          <p>10マス盤面を改造しながら、3体パーティ完成と10戦突破を目指すプロトタイプ。</p>
        </div>
        <div className="statusStrip">
          <span className={coinPulse ? "coinPulse" : ""}>
            <Coins size={16} /> {coins}
            {renderFloating("coins", "coins")}
          </span>
          <span>
            <ScrollText size={16} /> {turn}T
          </span>
          <span>
            <Swords size={16} /> {battleCount}/10
          </span>
          <span>
            <Heart size={16} /> {aliveUnits}
          </span>
        </div>
      </section>

      <section className="layout">
        <div className="boardPanel">
          <div className="boardHeader">
            <h2>共通盤面</h2>
            <button className={`primaryButton diceButton ${diceRolling ? "rolling" : ""}`} onClick={() => void rollDice()} disabled={phase !== "explore" || locked}>
              <span className="dieCube" aria-hidden="true">
                {diceRolling ? "?" : fixedRoll ?? lastRoll ?? "D3"}
              </span>
              {diceRolling ? "..." : fixedRoll ? `${fixedRoll}進む` : "1D3を振る"}
            </button>
          </div>

          <div className="boardGrid">
            {board.map((tile, index) => (
              <button
                key={`${tile.id}-${index}`}
                className={[
                  "tile",
                  tile.type,
                  position === index ? "active" : "",
                  movingTrail.includes(index) ? "moving" : "",
                  arrivalIndex === index ? "arrived" : "",
                  tileEffectIndex === index ? "effect" : "",
                  installedTileIndex === index ? "installing" : "",
                ].join(" ")}
                onClick={() => phase === "prep" && void installTile(index)}
                disabled={phase !== "prep" || selectedTileIndex === null || locked}
                title={getTileDescription(tile)}
              >
                <span className="tileIndex">{index + 1}</span>
                <span className="tileIcon">{tileIcon(tile.type)}</span>
                <strong>{tile.name}</strong>
                <small>Lv{tile.level}</small>
                {position === index && (
                  <span className={`boardPiece ${movingTrail.includes(index) ? "hopping" : ""} ${arrivalIndex === index ? "landed" : ""}`} aria-label="現在地" />
                )}
                {renderFloating("tile", String(index))}
              </button>
            ))}
          </div>

          <div className="runControls">
            <span>直近出目: {lastRoll ?? "-"}</span>
            <span>次の戦闘まで: {5 - (turn % 5)}ターン</span>
            <button onClick={() => setPauseView("menu")} className="ghostButton" disabled={locked}>
              <Pause size={16} />
              一時停止
            </button>
            <button onClick={() => setShowLog(true)} className="ghostButton" disabled={locked}>
              <ScrollText size={16} />
              ログ
            </button>
            <button onClick={resetGame} className="ghostButton" disabled={locked}>
              <RefreshCw size={16} />
              リセット
            </button>
          </div>
        </div>

        <aside className="sidePanel">
          <h2>アイテム</h2>
          <div className={`itemList ${inventoryPulse ? "inventoryPulse" : ""}`}>
            {items.length === 0 && <p className="emptyText">未所持</p>}
            {items.map((item, index) => (
              <button
                key={`${item.id}-${index}`}
                className="inventoryButton"
                onClick={() => setSelectedItemIndex(index)}
                disabled={phase !== "explore" || locked}
              >
                <Sparkles size={16} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
            {renderFloating("inventory", "inventory")}
          </div>
        </aside>
      </section>

      <section className="units">
        {units.map((unit) => (
          <div key={unit.id}>{renderUnitPanel(unit, { onSkillSlot: (slotIndex) => void installSkill(unit.id, slotIndex) })}</div>
        ))}
      </section>

      {skillPopup && (
        <div className="skillPopupLayer" onClick={() => setSkillPopup(null)}>
          <aside className="skillPopup" onClick={(event) => event.stopPropagation()}>
            <div className="modalHeader">
              <h2>{skillPopup.name}</h2>
              <button className="ghostButton" onClick={() => setSkillPopup(null)}>
                閉じる
              </button>
            </div>
            <p>{skillPopup.description}</p>
          </aside>
        </div>
      )}

      {selectedItemIndex !== null && items[selectedItemIndex] && (
        <div className="skillPopupLayer" onClick={() => setSelectedItemIndex(null)}>
          <aside className="skillPopup itemPopup" onClick={(event) => event.stopPropagation()}>
            <div className="modalHeader">
              <h2>{items[selectedItemIndex].name}</h2>
              <button className="ghostButton" onClick={() => setSelectedItemIndex(null)}>
                閉じる
              </button>
            </div>
            <p>{items[selectedItemIndex].description}</p>
            <div className="itemPopupActions">
              <button className="primaryButton" onClick={() => void useItem(items[selectedItemIndex], selectedItemIndex)}>
                使用
              </button>
            </div>
          </aside>
        </div>
      )}

      {(pauseView ||
        showLog ||
        phase === "chooseTraining" ||
        phase === "chooseTile" ||
        phase === "battle" ||
        phase === "reward" ||
        phase === "recruit" ||
        phase === "prep" ||
        phase === "shop" ||
        phase === "gameover" ||
        phase === "clear") && (
        <section className="modalLayer">
          <div className={`modal ${phase === "battle" ? "battleModal" : ""}`}>
            {pauseView === "menu" && (
              <>
                <div className="modalHeader">
                  <h2>一時停止</h2>
                  <button className="ghostButton" onClick={() => setPauseView(null)}>
                    閉じる
                  </button>
                </div>
                <div className="pauseActions">
                  <button className="primaryButton" onClick={() => setPauseView(null)}>
                    <Play size={18} />
                    再開
                  </button>
                  <button className="ghostButton" onClick={() => setPauseView("skills")}>
                    <BookOpen size={18} />
                    スキル図鑑
                  </button>
                </div>
              </>
            )}

            {pauseView === "skills" && (
              <>
                <div className="modalHeader">
                  <h2>スキル図鑑</h2>
                  <button className="ghostButton" onClick={() => setPauseView("menu")}>
                    戻る
                  </button>
                </div>
                <div className="skillBookGrid">
                  {skillCatalog.map((skill) => (
                    <article key={`book-${skill.id}`} className="skillBookCard">
                      <strong>{skill.name}</strong>
                      <span>{skill.description}</span>
                    </article>
                  ))}
                </div>
              </>
            )}

            {!pauseView && showLog && (
              <>
                <div className="modalHeader">
                  <h2>ログ</h2>
                  <button className="ghostButton" onClick={() => setShowLog(false)}>
                    閉じる
                  </button>
                </div>
                <ol className="logList logModalList">
                  {log.map((entry, index) => (
                    <li key={`${entry}-${index}`} className={index === 0 ? "newLog" : ""}>
                      {entry}
                    </li>
                  ))}
                </ol>
              </>
            )}

            {!showLog && phase === "chooseTraining" && pendingTraining && (
              <>
                <h2>{statLabels[pendingTraining.stat]}訓練</h2>
                <p>強化するユニットを選択。</p>
                <div className="unitPanelGrid">
                  {units.map((unit) => (
                    <div
                      key={unit.id}
                      className="unitChoiceCard"
                      role="button"
                      tabIndex={0}
                      onClick={() => void applyTraining(unit.id)}
                      onKeyDown={(event) => {
                        if (event.key === "Enter" || event.key === " ") void applyTraining(unit.id);
                      }}
                    >
                      {renderUnitPanel(unit, { className: "selectable", showHp: true })}
                      <span className="unitChoiceBadge">
                        {statLabels[pendingTraining.stat]} +{pendingTraining.amount}
                      </span>
                    </div>
                  ))}
                </div>
              </>
            )}

            {!showLog && phase === "chooseTile" && pendingTileIndex !== null && (
              <>
                <h2>マス効果選択</h2>
                <p>{pendingTileIndex + 1}マス目に置く効果を選択。選んだ効果は今すぐ1回発動します。</p>
                <div className="choiceGrid rewardGrid">
                  {pendingTileChoices.map((tile, index) => (
                    <button
                      key={`${tile.id}-${index}`}
                      className={`choiceButton rewardCard ${rewardPulse === index ? "chosen" : ""}`}
                      onClick={() => void chooseTileEffect(tile, index)}
                    >
                      <span className={`tileMiniIcon ${tile.type}`}>{tileIcon(tile.type)}</span>
                      <strong>{tile.name}</strong>
                      <span>{getTileDescription(tile)}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {!showLog && phase === "battle" && battleView && (
              <>
                <h2>オートバトル</h2>
                <div className={`battleStage ${battleView.tone}`}>
                  <div className="enemyCard">
                    <strong>{battleView.enemyName}</strong>
                    <div className="hpBar enemyHp">
                      <i style={{ width: `${Math.max(0, Math.min(100, (battleView.enemyHp / battleView.enemyMaxHp) * 100))}%` }} />
                    </div>
                    <div className="battleSkillBoard enemySkillBoard">
                      {battleView.enemySkillBoard.map((skill, index) => (
                        <span
                          key={`enemy-battle-${skill.id}-${index}`}
                          className={[
                            "battleSkillSlot",
                            "enemySkillSlot",
                            battleView.enemyBoardIndex === index ? "cursor" : "",
                            activeEnemySkill === index ? "firing" : "",
                          ].join(" ")}
                        >
                          <small>{index + 1}</small>
                          {skill.name}
                          {(battleView.enemyBoardIndex === index || activeEnemySkill === index) && (
                            <i className={`skillPiece enemyPiece ${activeEnemySkill === index ? "strike" : ""}`} />
                          )}
                        </span>
                      ))}
                    </div>
                    {renderFloating("enemy", "enemy")}
                  </div>
                  <div className="battleUnits">
                    {battleUnits.map((unit) => (
                      <div key={unit.id}>{renderUnitPanel(unit, { className: "battleInfo", active: battleView.activeUnitId === unit.id })}</div>
                    ))}
                  </div>
                  <p>{battleView.message}</p>
                </div>
              </>
            )}

            {!showLog && phase === "reward" && (
              <>
                <h2>戦闘報酬</h2>
                <p>候補から1つ選択。</p>
                <div className="choiceGrid rewardGrid">
                  {rewards.map((reward, index) => (
                    <button key={index} className={`choiceButton rewardCard ${rewardPulse === index ? "chosen" : ""}`} onClick={() => void chooseReward(reward, index)}>
                      {reward.kind === "tile" && (
                        <>
                          <strong>{reward.tile.name}</strong>
                          <span>{getTileDescription(reward.tile)}</span>
                        </>
                      )}
                      {reward.kind === "skill" && (
                        <>
                          <strong>{reward.skill.name}</strong>
                          <span>{reward.skill.description}</span>
                        </>
                      )}
                      {reward.kind === "coins" && (
                        <>
                          <strong>{reward.amount}コイン</strong>
                          <span>SHOPや宿屋で使う。</span>
                        </>
                      )}
                    </button>
                  ))}
                </div>
              </>
            )}

            {!showLog && phase === "recruit" && (
              <>
                <h2>仲間加入</h2>
                <p>候補から1体を選択。</p>
                <div className="choiceGrid rewardGrid">
                  {recruits.map((candidate) => (
                    <button key={candidate.id} className="choiceButton rewardCard" onClick={() => void recruit(candidate)}>
                      <strong>{candidate.name}</strong>
                      <span>{candidate.job}</span>
                      <small>
                        体力{candidate.stats.vitality} 威力{candidate.stats.power} 機敏{candidate.stats.agility}
                      </small>
                    </button>
                  ))}
                </div>
              </>
            )}

            {!showLog && phase === "shop" && (
              <>
                <h2>SHOP</h2>
                <p>12コインでマスを購入。</p>
                <div className="choiceGrid rewardGrid">
                  {shopOffers.map((tile, index) => (
                    <button key={`${tile.id}-${index}`} className="choiceButton rewardCard" onClick={() => void buyTile(tile, 12)} disabled={coins < 12}>
                      <strong>{tile.name}</strong>
                      <span>{getTileDescription(tile)}</span>
                    </button>
                  ))}
                </div>
                <button className="primaryButton fullWidth" onClick={() => void leaveShop()}>
                  <Play size={18} />
                  出る
                </button>
              </>
            )}

            {!showLog && phase === "prep" && (
              <>
                <h2>準備フェーズ</h2>
                <p>所持マスやスキルを選び、盤面やスキルボードへ設置。</p>
                <div className="prepColumns">
                  <div>
                    <h3>未設置マス</h3>
                    {tileInventory.length === 0 && <p className="emptyText">なし</p>}
                    {tileInventory.map((tile, index) => (
                      <button
                        key={`${tile.id}-${index}`}
                        className={`inventoryButton ${selectedTileIndex === index ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedTileIndex(index);
                          setSelectedSkillIndex(null);
                        }}
                      >
                        {tileIcon(tile.type)}
                        <span>
                          <strong>{tile.name}</strong>
                          <small>{getTileDescription(tile)}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                  <div>
                    <h3>未装備スキル</h3>
                    {skillInventory.length === 0 && <p className="emptyText">なし</p>}
                    {skillInventory.map((skill, index) => (
                      <button
                        key={`${skill.id}-${index}`}
                        className={`inventoryButton ${selectedSkillIndex === index ? "selected" : ""}`}
                        onClick={() => {
                          setSelectedSkillIndex(index);
                          setSelectedTileIndex(null);
                        }}
                      >
                        <Shield size={16} />
                        <span>
                          <strong>{skill.name}</strong>
                          <small>{skill.description}</small>
                        </span>
                      </button>
                    ))}
                  </div>
                </div>
                {selectedTileIndex !== null && tileInventory[selectedTileIndex] && (
                  <div className="prepInstallPanel">
                    <h3>設置先を選択</h3>
                    <p>選択中: {tileInventory[selectedTileIndex].name}</p>
                    <p className="prepSelectedEffect">{getTileDescription(tileInventory[selectedTileIndex])}</p>
                    <div className="prepBoardGrid">
                      {board.map((tile, index) => (
                        <button
                          key={`prep-board-${tile.id}-${index}`}
                          className={`prepBoardTile ${position === index ? "current" : ""}`}
                          onClick={() => void installTile(index)}
                        >
                          <span>{index + 1}</span>
                          {tileIcon(tile.type)}
                          <strong>{tile.name}</strong>
                          <small>Lv{tile.level}</small>
                        </button>
                      ))}
                    </div>
                  </div>
                )}
                {selectedSkillIndex !== null && skillInventory[selectedSkillIndex] && (
                  <div className="prepInstallPanel">
                    <h3>装備先を選択</h3>
                    <p>選択中: {skillInventory[selectedSkillIndex].name}</p>
                    <p className="prepSelectedEffect">{skillInventory[selectedSkillIndex].description}</p>
                    <div className="prepSkillTargets">
                      {units.map((unit) => (
                        <div key={`prep-skill-${unit.id}`}>
                          {renderUnitPanel(unit, {
                            className: "selectable",
                            onSkillSlot: (slotIndex) => void installSkill(unit.id, slotIndex),
                          })}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
                <div className="prepActions">
                  <button
                    className="ghostButton"
                    onClick={() => {
                      if (selectedTileIndex !== null) {
                        setTileInventory((current) => current.filter((_, index) => index !== selectedTileIndex));
                        setSelectedTileIndex(null);
                      }
                      if (selectedSkillIndex !== null) {
                        setSkillInventory((current) => current.filter((_, index) => index !== selectedSkillIndex));
                        setSelectedSkillIndex(null);
                      }
                    }}
                    disabled={selectedTileIndex === null && selectedSkillIndex === null}
                  >
                    <Trash2 size={16} />
                    選択を破棄
                  </button>
                  <button className="primaryButton" onClick={() => void leavePrep()}>
                    <Play size={18} />
                    {prepEndsTurn ? "配置完了" : "探索へ"}
                  </button>
                </div>
              </>
            )}

            {!showLog && (phase === "gameover" || phase === "clear") && (
              <>
                <h2>{phase === "clear" ? "ラン勝利" : "ラン終了"}</h2>
                <p>{phase === "clear" ? "10戦を突破した。" : "戦闘に敗北した。"}</p>
                <button className="primaryButton fullWidth" onClick={resetGame}>
                  <RefreshCw size={18} />
                  もう一度
                </button>
              </>
            )}
          </div>
        </section>
      )}
    </main>
  );
}
