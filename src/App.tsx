import {
  Box,
  Coins,
  Heart,
  Hotel,
  PackagePlus,
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
type Phase = "explore" | "animating" | "chooseTraining" | "battle" | "reward" | "recruit" | "prep" | "shop" | "gameover" | "clear";
type Tone = "good" | "bad" | "neutral" | "rare";

type Stats = Record<StatKey, number>;

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

type Skill = {
  id: string;
  name: string;
  description: string;
  cost?: number;
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
      slotIndex: number;
      nextIndex: number;
      text: string;
      tone: Tone;
      target: "enemy" | "ally" | "self" | "party";
      targetUnitId?: string;
      value?: number;
    }
  | {
      type: "enemy";
      text: string;
      targetUnitId: string;
      value: number;
      tone: Tone;
    };

type BattleResult = {
  win: boolean;
  logs: string[];
  units: Unit[];
  enemyName: string;
  enemyMaxHp: number;
  events: BattleEvent[];
};

type BattleView = {
  enemyName: string;
  enemyHp: number;
  enemyMaxHp: number;
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
  description: "敵1体に威力分のダメージ。",
};

const skillPool: Skill[] = [
  {
    id: "heavy-slash",
    name: "強打",
    description: "敵1体に威力+2ダメージ。",
  },
  {
    id: "guard",
    name: "ガード",
    description: "自分に体力分の一時HPを付与。",
  },
  {
    id: "quick-stab",
    name: "早駆け",
    description: "敵1体に機敏+1ダメージ。",
  },
  {
    id: "heal",
    name: "応急手当",
    description: "最もHP割合が低い味方を体力+2回復。",
  },
  {
    id: "firebolt",
    name: "火球",
    cost: 2,
    description: "マナ2相当。敵1体に威力+5ダメージ。",
  },
  {
    id: "rally",
    name: "号令",
    description: "味方全員を威力分回復。",
  },
];

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

const initialBoard: Tile[] = [
  { id: "t-v-single", name: "体力訓練", type: "training", stat: "vitality", scope: "single", level: 1 },
  { id: "t-p-single", name: "威力訓練", type: "training", stat: "power", scope: "single", level: 1 },
  { id: "t-a-single", name: "機敏訓練", type: "training", stat: "agility", scope: "single", level: 1 },
  { id: "item", name: "アイテム", type: "item", level: 1 },
  { id: "treasure", name: "宝箱", type: "treasure", level: 1, rare: true },
  { id: "skill", name: "戦闘訓練", type: "skill", level: 1 },
  { id: "shop", name: "SHOP", type: "shop", level: 1 },
  { id: "inn", name: "宿屋", type: "inn", level: 1 },
  emptyTile("empty-1"),
  emptyTile("empty-2"),
];

const initialHero: Unit = {
  id: "hero",
  name: "アレン",
  job: "勇者",
  stats: { vitality: 10, power: 5, agility: 5 },
  hp: 50,
  boardIndex: 0,
  skillBoard: [normalAttack, normalAttack, normalAttack, normalAttack],
};

let idCounter = 0;

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

function uniqueRewards(count: number): Reward[] {
  const tileChoices = [
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
  const fighters = units.map((unit) => ({ ...unit, hp: Math.min(unit.hp, maxHp(unit)), tempHp: 0 }));
  const enemy = {
    name: battleCount === 10 ? "最終ボス" : battleCount % 3 === 0 ? "中ボス" : "魔物",
    hp: 28 + battleCount * 12,
    maxHp: 28 + battleCount * 12,
    power: 4 + battleCount * 2,
    agility: 3 + battleCount,
  };
  const logs: string[] = [`${enemy.name}が現れた。`];
  const events: BattleEvent[] = [];

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

  for (let round = 1; round <= 10; round += 1) {
    const actors = [
      ...fighters.filter((unit) => unit.hp > 0).map((unit) => ({ type: "unit" as const, agility: unit.stats.agility, unit })),
      { type: "enemy" as const, agility: enemy.agility, unit: null },
    ].sort((a, b) => b.agility - a.agility);

    for (const actor of actors) {
      if (enemy.hp <= 0 || fighters.every((unit) => unit.hp <= 0)) break;

      if (actor.type === "enemy") {
        const target = fighters.filter((unit) => unit.hp > 0).sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0];
        const damage = enemy.power;
        const absorbed = Math.min(target.tempHp, damage);
        target.tempHp -= absorbed;
        target.hp -= damage - absorbed;
        const text = `${enemy.name}の攻撃。${target.name}に${damage}ダメージ。`;
        logs.push(text);
        events.push({ type: "enemy", text, targetUnitId: target.id, value: damage, tone: "bad" });
        continue;
      }

      const unit = actor.unit;
      const slotIndex = unit.boardIndex % unit.skillBoard.length;
      const skill = unit.skillBoard[slotIndex];
      unit.boardIndex = (unit.boardIndex + 1) % unit.skillBoard.length;

      if (skill.id === "guard") {
        unit.tempHp += unit.stats.vitality;
        const text = `${unit.name}のガード。一時HP+${unit.stats.vitality}。`;
        logs.push(text);
        events.push({
          type: "unit",
          unitId: unit.id,
          unitName: unit.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: unit.boardIndex,
          text,
          tone: "good",
          target: "self",
          value: unit.stats.vitality,
        });
      } else if (skill.id === "quick-stab") {
        const damage = unit.stats.agility + 1;
        enemy.hp -= damage;
        const text = `${unit.name}の早駆け。${damage}ダメージ。`;
        logs.push(text);
        events.push({
          type: "unit",
          unitId: unit.id,
          unitName: unit.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: unit.boardIndex,
          text,
          tone: "bad",
          target: "enemy",
          value: damage,
        });
      } else if (skill.id === "heal") {
        const target = fighters.filter((u) => u.hp > 0).sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0];
        const amount = unit.stats.vitality + 2;
        target.hp = Math.min(maxHp(target), target.hp + amount);
        const text = `${unit.name}の応急手当。${target.name}を${amount}回復。`;
        logs.push(text);
        events.push({
          type: "unit",
          unitId: unit.id,
          unitName: unit.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: unit.boardIndex,
          text,
          tone: "good",
          target: "ally",
          targetUnitId: target.id,
          value: amount,
        });
      } else if (skill.id === "firebolt") {
        const damage = unit.stats.power + 5;
        enemy.hp -= damage;
        const text = `${unit.name}の火球。${damage}ダメージ。`;
        logs.push(text);
        events.push({
          type: "unit",
          unitId: unit.id,
          unitName: unit.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: unit.boardIndex,
          text,
          tone: "bad",
          target: "enemy",
          value: damage,
        });
      } else if (skill.id === "rally") {
        fighters.forEach((u) => {
          if (u.hp > 0) u.hp = Math.min(maxHp(u), u.hp + unit.stats.power);
        });
        const text = `${unit.name}の号令。味方全員を${unit.stats.power}回復。`;
        logs.push(text);
        events.push({
          type: "unit",
          unitId: unit.id,
          unitName: unit.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: unit.boardIndex,
          text,
          tone: "good",
          target: "party",
          value: unit.stats.power,
        });
      } else if (skill.id === "heavy-slash") {
        const damage = unit.stats.power + 2;
        enemy.hp -= damage;
        const text = `${unit.name}の強打。${damage}ダメージ。`;
        logs.push(text);
        events.push({
          type: "unit",
          unitId: unit.id,
          unitName: unit.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: unit.boardIndex,
          text,
          tone: "bad",
          target: "enemy",
          value: damage,
        });
      } else {
        const damage = unit.stats.power;
        enemy.hp -= damage;
        const text = `${unit.name}の通常攻撃。${damage}ダメージ。`;
        logs.push(text);
        events.push({
          type: "unit",
          unitId: unit.id,
          unitName: unit.name,
          skillName: skill.name,
          slotIndex,
          nextIndex: unit.boardIndex,
          text,
          tone: "bad",
          target: "enemy",
          value: damage,
        });
      }
    }
  }

  return {
    win: enemy.hp <= 0,
    logs,
    units: fighters.map(({ tempHp: _tempHp, ...unit }) => ({ ...unit, hp: Math.max(0, unit.hp) })),
    enemyName: enemy.name,
    enemyMaxHp: enemy.maxHp,
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
  const [lastRoll, setLastRoll] = useState<number | null>(null);
  const [fixedRoll, setFixedRoll] = useState<number | null>(null);
  const [pendingTraining, setPendingTraining] = useState<{ stat: StatKey; amount: number } | null>(null);
  const [rewards, setRewards] = useState<Reward[]>([]);
  const [shopOffers, setShopOffers] = useState<Tile[]>([]);
  const [recruits, setRecruits] = useState<Omit<Unit, "hp" | "boardIndex">[]>([]);
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
  const [floatingTexts, setFloatingTexts] = useState<FloatingText[]>([]);
  const [battleView, setBattleView] = useState<BattleView | null>(null);
  const [rewardPulse, setRewardPulse] = useState<number | null>(null);
  const [inventoryPulse, setInventoryPulse] = useState(false);
  const [coinPulse, setCoinPulse] = useState(false);

  const aliveUnits = useMemo(() => units.filter((unit) => unit.hp > 0).length, [units]);
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
      await finishTurn();
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
      await finishTurn();
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

    setBattleView({
      enemyName: result.enemyName,
      enemyHp: result.enemyMaxHp,
      enemyMaxHp: result.enemyMaxHp,
      message: `${result.enemyName}が現れた`,
      tone: "neutral",
    });
    await wait(520);

    let enemyHp = result.enemyMaxHp;
    for (const event of result.events) {
      if (event.type === "item") {
        setBattleView((current) => current && { ...current, message: event.text, tone: event.tone });
        if (event.text.includes("14")) {
          enemyHp = Math.max(0, enemyHp - 14);
          addFloatingText("enemy", "enemy", "-14", "bad");
        }
        await wait(260);
        continue;
      }

      if (event.type === "unit") {
        setActiveSkill({ unitId: event.unitId, slotIndex: event.slotIndex });
        setBattleView((current) =>
          current && {
            ...current,
            enemyHp: event.target === "enemy" && event.value ? Math.max(0, enemyHp - event.value) : current.enemyHp,
            message: event.text,
            activeUnitId: event.unitId,
            activeSlot: event.slotIndex,
            tone: event.tone,
          },
        );
        if (event.target === "enemy" && event.value) {
          enemyHp = Math.max(0, enemyHp - event.value);
          addFloatingText("enemy", "enemy", `-${event.value}`, "bad");
        } else if (event.targetUnitId && event.value) {
          addFloatingText("unit", event.targetUnitId, `+${event.value}`, "good");
          void flashUnit(event.targetUnitId, "good");
        } else if (event.target === "party" && event.value) {
          currentUnits.forEach((unit) => addFloatingText("unit", unit.id, `+${event.value}`, "good"));
        } else if (event.target === "self" && event.value) {
          addFloatingText("unit", event.unitId, `+${event.value}`, "good");
        }
        setUnits((current) =>
          current.map((unit) => (unit.id === event.unitId ? { ...unit, boardIndex: event.nextIndex } : unit)),
        );
        await wait(260);
        setActiveSkill(null);
        continue;
      }

      setBattleView((current) => current && { ...current, message: event.text, tone: event.tone });
      addFloatingText("unit", event.targetUnitId, `-${event.value}`, "bad");
      void flashUnit(event.targetUnitId, "bad");
      await wait(260);
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
    await wait(720);

    if (!result.win) {
      setBattleView(null);
      setBanner(null);
      setPhase("gameover");
      return;
    }

    setBattleCount(nextBattle);
    setCoins((value) => value + 8 + nextBattle);
    await flashCoins(`+${8 + nextBattle}`);

    if (nextBattle >= 10) {
      setBattleView(null);
      setBanner(null);
      setPhase("clear");
      return;
    }

    if (nextBattle % 3 === 0 && currentUnits.length < 3) {
      const candidates = recruitPool.filter((unit) => !currentUnits.some((owned) => owned.id === unit.id)).slice(0, 3);
      setRecruits(candidates);
      setBattleView(null);
      setBanner(null);
      setPhase("recruit");
      return;
    }

    setRewards(uniqueRewards(3));
    setBattleView(null);
    setBanner(null);
    setPhase("reward");
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
    setPhase("prep");
  }

  async function recruit(candidate: Omit<Unit, "hp" | "boardIndex">) {
    if (locked) return;
    const newUnit: Unit = { ...candidate, hp: candidate.stats.vitality * 5, boardIndex: 0 };
    setUnits((current) => [...current, newUnit]);
    pushLog(`${candidate.name}が仲間になった。`);
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
    setLastRoll(null);
    setFixedRoll(null);
    setPendingTraining(null);
    setRewards([]);
    setShopOffers([]);
    setRecruits([]);
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
    setRewardPulse(null);
    setInventoryPulse(false);
    setCoinPulse(false);
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
              <button key={`${item.id}-${index}`} className="inventoryButton" onClick={() => void useItem(item, index)} disabled={phase !== "explore" || locked}>
                <Sparkles size={16} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
            {renderFloating("inventory", "inventory")}
          </div>
          <h2>ログ</h2>
          <ol className="logList">
            {log.map((entry, index) => (
              <li key={`${entry}-${index}`} className={index === 0 ? "newLog" : ""}>
                {entry}
              </li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="units">
        {units.map((unit) => (
          <article key={unit.id} className={`unitCard ${unitPulse[unit.id] ? `pulse-${unitPulse[unit.id]}` : ""}`}>
            <div className="unitHeader">
              <div>
                <h3>{unit.name}</h3>
                <p>{unit.job}</p>
              </div>
              <span>
                {unit.hp}/{maxHp(unit)}
              </span>
            </div>
            <div className="hpBar">
              <i style={{ width: `${Math.max(0, Math.min(100, (unit.hp / maxHp(unit)) * 100))}%` }} />
            </div>
            <div className="stats">
              <span>体力 {unit.stats.vitality}</span>
              <span>威力 {unit.stats.power}</span>
              <span>機敏 {unit.stats.agility}</span>
            </div>
            <div className="skillBoard">
              {unit.skillBoard.map((skill, index) => (
                <button
                  key={`${unit.id}-${skill.id}-${index}`}
                  className={`skillSlot ${unit.boardIndex === index ? "next" : ""} ${
                    activeSkill?.unitId === unit.id && activeSkill.slotIndex === index ? "firing" : ""
                  }`}
                  onClick={() => phase === "prep" && void installSkill(unit.id, index)}
                  disabled={phase !== "prep" || selectedSkillIndex === null || locked}
                  title={skill.description}
                >
                  {skill.name}
                </button>
              ))}
            </div>
            {renderFloating("unit", unit.id)}
          </article>
        ))}
      </section>

      {(phase === "chooseTraining" ||
        phase === "battle" ||
        phase === "reward" ||
        phase === "recruit" ||
        phase === "prep" ||
        phase === "shop" ||
        phase === "gameover" ||
        phase === "clear") && (
        <section className="modalLayer">
          <div className={`modal ${phase === "battle" ? "battleModal" : ""}`}>
            {phase === "chooseTraining" && pendingTraining && (
              <>
                <h2>{statLabels[pendingTraining.stat]}訓練</h2>
                <p>強化するユニットを選択。</p>
                <div className="choiceGrid">
                  {units.map((unit) => (
                    <button key={unit.id} onClick={() => void applyTraining(unit.id)} className="choiceButton">
                      <strong>{unit.name}</strong>
                      <span>
                        {statLabels[pendingTraining.stat]} +{pendingTraining.amount}
                      </span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {phase === "battle" && battleView && (
              <>
                <h2>オートバトル</h2>
                <div className={`battleStage ${battleView.tone}`}>
                  <div className="enemyCard">
                    <strong>{battleView.enemyName}</strong>
                    <div className="hpBar enemyHp">
                      <i style={{ width: `${Math.max(0, Math.min(100, (battleView.enemyHp / battleView.enemyMaxHp) * 100))}%` }} />
                    </div>
                    {renderFloating("enemy", "enemy")}
                  </div>
                  <p>{battleView.message}</p>
                </div>
              </>
            )}

            {phase === "reward" && (
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

            {phase === "recruit" && (
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

            {phase === "shop" && (
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

            {phase === "prep" && (
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
                        onClick={() => setSelectedTileIndex(index)}
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
                        onClick={() => setSelectedSkillIndex(index)}
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
                  <button className="primaryButton" onClick={() => setPhase("explore")}>
                    <Play size={18} />
                    探索へ
                  </button>
                </div>
              </>
            )}

            {(phase === "gameover" || phase === "clear") && (
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
