import {
  Box,
  Coins,
  Dices,
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
type TileType =
  | "empty"
  | "training"
  | "item"
  | "treasure"
  | "skill"
  | "shop"
  | "inn";
type Scope = "single" | "all";
type Phase = "explore" | "chooseTraining" | "reward" | "recruit" | "prep" | "shop" | "gameover" | "clear";

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

type BattleResult = {
  win: boolean;
  logs: string[];
  units: Unit[];
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
    description: "マナ不要。敵1体に威力+2ダメージ。",
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

function runBattle(units: Unit[], battleCount: number, battleItems: Item[]): BattleResult {
  const fighters = units.map((unit) => ({ ...unit, hp: Math.min(unit.hp, maxHp(unit)), tempHp: 0 }));
  const enemy = {
    name: battleCount === 10 ? "最終ボス" : battleCount % 3 === 0 ? "中ボス" : "魔物",
    hp: 28 + battleCount * 12,
    power: 4 + battleCount * 2,
    agility: 3 + battleCount,
  };
  const logs: string[] = [`${enemy.name}が現れた。`];

  for (const item of battleItems) {
    if (item.id === "potion") {
      fighters.forEach((unit) => {
        unit.hp = Math.min(maxHp(unit), unit.hp + 8);
      });
      logs.push("応急薬で味方全員を回復。");
    }
    if (item.id === "bomb") {
      enemy.hp -= 14;
      logs.push("爆弾で敵に14ダメージ。");
    }
    if (item.id === "charm") {
      fighters.forEach((unit) => {
        unit.tempHp += 8;
      });
      logs.push("護符で味方全員に一時HP。");
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
        logs.push(`${enemy.name}の攻撃。${target.name}に${damage}ダメージ。`);
        continue;
      }

      const unit = actor.unit;
      const skill = unit.skillBoard[unit.boardIndex % unit.skillBoard.length];
      unit.boardIndex = (unit.boardIndex + 1) % unit.skillBoard.length;

      if (skill.id === "guard") {
        unit.tempHp += unit.stats.vitality;
        logs.push(`${unit.name}のガード。一時HP+${unit.stats.vitality}。`);
      } else if (skill.id === "quick-stab") {
        const damage = unit.stats.agility + 1;
        enemy.hp -= damage;
        logs.push(`${unit.name}の早駆け。${damage}ダメージ。`);
      } else if (skill.id === "heal") {
        const target = fighters.filter((u) => u.hp > 0).sort((a, b) => a.hp / maxHp(a) - b.hp / maxHp(b))[0];
        const amount = unit.stats.vitality + 2;
        target.hp = Math.min(maxHp(target), target.hp + amount);
        logs.push(`${unit.name}の応急手当。${target.name}を${amount}回復。`);
      } else if (skill.id === "firebolt") {
        const damage = unit.stats.power + 5;
        enemy.hp -= damage;
        logs.push(`${unit.name}の火球。${damage}ダメージ。`);
      } else if (skill.id === "rally") {
        fighters.forEach((u) => {
          if (u.hp > 0) u.hp = Math.min(maxHp(u), u.hp + unit.stats.power);
        });
        logs.push(`${unit.name}の号令。味方全員を${unit.stats.power}回復。`);
      } else if (skill.id === "heavy-slash") {
        const damage = unit.stats.power + 2;
        enemy.hp -= damage;
        logs.push(`${unit.name}の強打。${damage}ダメージ。`);
      } else {
        const damage = unit.stats.power;
        enemy.hp -= damage;
        logs.push(`${unit.name}の通常攻撃。${damage}ダメージ。`);
      }
    }
  }

  return {
    win: enemy.hp <= 0,
    logs,
    units: fighters.map(({ tempHp: _tempHp, ...unit }) => ({ ...unit, hp: Math.max(0, unit.hp) })),
  };
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

  const aliveUnits = useMemo(() => units.filter((unit) => unit.hp > 0).length, [units]);

  function pushLog(message: string) {
    setLog((current) => [message, ...current].slice(0, 12));
  }

  function updateUnit(id: string, updater: (unit: Unit) => Unit) {
    setUnits((current) => current.map((unit) => (unit.id === id ? updater(unit) : unit)));
  }

  function finishTurn(nextUnits = units) {
    const nextTurn = turn + 1;
    setTurn(nextTurn);

    if (nextTurn % 5 === 0) {
      startBattle(nextUnits);
    }
  }

  function rollDice() {
    if (phase !== "explore") return;
    const roll = fixedRoll ?? Math.ceil(Math.random() * 3);
    setFixedRoll(null);
    setLastRoll(roll);
    const nextPosition = (position + roll) % board.length;
    setPosition(nextPosition);
    const tile = board[nextPosition];
    pushLog(`${roll}進んで「${tile.name}」に止まった。`);
    resolveTile(tile, nextPosition);
  }

  function resolveTile(tile: Tile, tileIndex: number) {
    if (tile.type === "empty") {
      finishTurn();
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
        pushLog(`全員の${statLabels[tile.stat]}+${amount}。`);
        finishTurn(nextUnits);
      } else {
        setPendingTraining({ stat: tile.stat, amount });
        setPhase("chooseTraining");
      }
      return;
    }

    if (tile.type === "item") {
      const item = randomFrom(itemPool);
      if (items.length >= 3) {
        setCoins((value) => value + 4);
        pushLog(`アイテム欄が満杯。代わりに4コイン獲得。`);
      } else {
        setItems((current) => [...current, item]);
        pushLog(`${item.name}を入手。`);
      }
      finishTurn();
      return;
    }

    if (tile.type === "treasure") {
      const rareTile = makeTrainingTile(randomFrom(["vitality", "power", "agility"] as StatKey[]), "all", true);
      setTileInventory((current) => [...current, rareTile].slice(0, 5));
      setBoard((current) => current.map((entry, index) => (index === tileIndex ? emptyTile(createId("empty")) : entry)));
      pushLog(`宝箱を消費して「${rareTile.name}」を入手。`);
      finishTurn();
      return;
    }

    if (tile.type === "skill") {
      const skill = randomFrom(skillPool);
      setSkillInventory((current) => [...current, skill].slice(0, 6));
      pushLog(`スキル「${skill.name}」を入手。`);
      finishTurn();
      return;
    }

    if (tile.type === "shop") {
      setShopOffers(uniqueRewards(3).filter((reward): reward is { kind: "tile"; tile: Tile } => reward.kind === "tile").map((reward) => reward.tile));
      setPhase("shop");
      return;
    }

    if (tile.type === "inn") {
      if (coins >= 8) {
        setCoins((value) => value - 8);
        const nextUnits = units.map((unit) => ({ ...unit, hp: maxHp(unit) }));
        setUnits(nextUnits);
        pushLog("宿屋で全員回復。");
        finishTurn(nextUnits);
      } else {
        pushLog("コイン不足で宿屋を使えなかった。");
        finishTurn();
      }
    }
  }

  function applyTraining(unitId: string) {
    if (!pendingTraining) return;
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
    setPhase("explore");
    pushLog(`${units.find((unit) => unit.id === unitId)?.name}の${statLabels[stat]}+${amount}。`);
    finishTurn(nextUnits);
  }

  function startBattle(currentUnits: Unit[]) {
    const usedBattleItems = battleItems;
    setBattleItems([]);
    const result = runBattle(currentUnits, battleCount + 1, usedBattleItems);
    setLog((current) => [...result.logs.reverse(), ...current].slice(0, 12));
    setUnits(result.units);

    if (!result.win) {
      setPhase("gameover");
      return;
    }

    const nextBattle = battleCount + 1;
    setBattleCount(nextBattle);
    setCoins((value) => value + 8 + nextBattle);

    if (nextBattle >= 10) {
      setPhase("clear");
      return;
    }

    if (nextBattle % 3 === 0 && units.length < 3) {
      const candidates = recruitPool.filter((unit) => !units.some((owned) => owned.id === unit.id)).slice(0, 3);
      setRecruits(candidates);
      setPhase("recruit");
      return;
    }

    setRewards(uniqueRewards(3));
    setPhase("reward");
  }

  function chooseReward(reward: Reward) {
    if (reward.kind === "tile") {
      setTileInventory((current) => [...current, reward.tile].slice(0, 5));
      pushLog(`未設置マス「${reward.tile.name}」を入手。`);
    } else if (reward.kind === "skill") {
      setSkillInventory((current) => [...current, reward.skill].slice(0, 6));
      pushLog(`スキル「${reward.skill.name}」を入手。`);
    } else {
      setCoins((value) => value + reward.amount);
      pushLog(`${reward.amount}コインを入手。`);
    }
    setRewards([]);
    setPhase("prep");
  }

  function recruit(candidate: Omit<Unit, "hp" | "boardIndex">) {
    const newUnit: Unit = { ...candidate, hp: candidate.stats.vitality * 5, boardIndex: 0 };
    setUnits((current) => [...current, newUnit]);
    setPhase("prep");
    pushLog(`${candidate.name}が仲間になった。`);
  }

  function buyTile(tile: Tile, price: number) {
    if (coins < price) return;
    setCoins((value) => value - price);
    setTileInventory((current) => [...current, tile].slice(0, 5));
    pushLog(`SHOPで「${tile.name}」を購入。`);
  }

  function leaveShop() {
    setShopOffers([]);
    setPhase("explore");
    finishTurn();
  }

  function installTile(boardIndex: number) {
    if (selectedTileIndex === null) return;
    const tile = tileInventory[selectedTileIndex];
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
  }

  function installSkill(unitId: string, slotIndex: number) {
    if (selectedSkillIndex === null) return;
    const skill = skillInventory[selectedSkillIndex];
    updateUnit(unitId, (unit) => ({
      ...unit,
      skillBoard: unit.skillBoard.map((entry, index) => (index === slotIndex ? skill : entry)),
    }));
    setSkillInventory((current) => current.filter((_, index) => index !== selectedSkillIndex));
    setSelectedSkillIndex(null);
    pushLog(`${skill.name}を装備。`);
  }

  function useItem(item: Item, index: number) {
    if (item.timing === "dice") {
      const value = Number(item.id.replace("fixed-", ""));
      setFixedRoll(value);
      setItems((current) => current.filter((_, i) => i !== index));
      pushLog(`${item.name}を使用。次の出目は${value}。`);
      return;
    }

    setBattleItems((current) => [...current, item]);
    setItems((current) => current.filter((_, i) => i !== index));
    pushLog(`${item.name}を次の戦闘に予約。`);
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
    setRecruits([]);
    setSelectedTileIndex(null);
    setSelectedSkillIndex(null);
    setLog(["ラン開始。まずは勇者1体で盤面を育てる。"]);
  }

  return (
    <main className="app">
      <section className="topbar">
        <div>
          <h1>育成すごろくRPG</h1>
          <p>10マス盤面を改造しながら、3体パーティ完成と10戦突破を目指すプロトタイプ。</p>
        </div>
        <div className="statusStrip">
          <span>
            <Coins size={16} /> {coins}
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
            <button className="primaryButton" onClick={rollDice} disabled={phase !== "explore"}>
              <Dices size={18} />
              {fixedRoll ? `${fixedRoll}進む` : "1D3を振る"}
            </button>
          </div>

          <div className="boardGrid">
            {board.map((tile, index) => (
              <button
                key={`${tile.id}-${index}`}
                className={`tile ${tile.type} ${position === index ? "active" : ""}`}
                onClick={() => phase === "prep" && installTile(index)}
                disabled={phase !== "prep" || selectedTileIndex === null}
                title={getTileDescription(tile)}
              >
                <span className="tileIndex">{index + 1}</span>
                <span className="tileIcon">{tileIcon(tile.type)}</span>
                <strong>{tile.name}</strong>
                <small>Lv{tile.level}</small>
              </button>
            ))}
          </div>

          <div className="runControls">
            <span>直近出目: {lastRoll ?? "-"}</span>
            <span>次の戦闘まで: {5 - (turn % 5)}ターン</span>
            <button onClick={resetGame} className="ghostButton">
              <RefreshCw size={16} />
              リセット
            </button>
          </div>
        </div>

        <aside className="sidePanel">
          <h2>アイテム</h2>
          <div className="itemList">
            {items.length === 0 && <p className="emptyText">未所持</p>}
            {items.map((item, index) => (
              <button key={`${item.id}-${index}`} className="inventoryButton" onClick={() => useItem(item, index)} disabled={phase !== "explore"}>
                <Sparkles size={16} />
                <span>
                  <strong>{item.name}</strong>
                  <small>{item.description}</small>
                </span>
              </button>
            ))}
          </div>
          <h2>ログ</h2>
          <ol className="logList">
            {log.map((entry, index) => (
              <li key={`${entry}-${index}`}>{entry}</li>
            ))}
          </ol>
        </aside>
      </section>

      <section className="units">
        {units.map((unit) => (
          <article key={unit.id} className="unitCard">
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
                  className={`skillSlot ${unit.boardIndex === index ? "next" : ""}`}
                  onClick={() => phase === "prep" && installSkill(unit.id, index)}
                  disabled={phase !== "prep" || selectedSkillIndex === null}
                  title={skill.description}
                >
                  {skill.name}
                </button>
              ))}
            </div>
          </article>
        ))}
      </section>

      {(phase === "chooseTraining" ||
        phase === "reward" ||
        phase === "recruit" ||
        phase === "prep" ||
        phase === "shop" ||
        phase === "gameover" ||
        phase === "clear") && (
        <section className="modalLayer">
          <div className="modal">
            {phase === "chooseTraining" && pendingTraining && (
              <>
                <h2>{statLabels[pendingTraining.stat]}訓練</h2>
                <p>強化するユニットを選択。</p>
                <div className="choiceGrid">
                  {units.map((unit) => (
                    <button key={unit.id} onClick={() => applyTraining(unit.id)} className="choiceButton">
                      <strong>{unit.name}</strong>
                      <span>{statLabels[pendingTraining.stat]} +{pendingTraining.amount}</span>
                    </button>
                  ))}
                </div>
              </>
            )}

            {phase === "reward" && (
              <>
                <h2>戦闘報酬</h2>
                <p>候補から1つ選択。</p>
                <div className="choiceGrid">
                  {rewards.map((reward, index) => (
                    <button key={index} className="choiceButton" onClick={() => chooseReward(reward)}>
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
                <div className="choiceGrid">
                  {recruits.map((candidate) => (
                    <button key={candidate.id} className="choiceButton" onClick={() => recruit(candidate)}>
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
                <div className="choiceGrid">
                  {shopOffers.map((tile, index) => (
                    <button key={`${tile.id}-${index}`} className="choiceButton" onClick={() => buyTile(tile, 12)} disabled={coins < 12}>
                      <strong>{tile.name}</strong>
                      <span>{getTileDescription(tile)}</span>
                    </button>
                  ))}
                </div>
                <button className="primaryButton fullWidth" onClick={leaveShop}>
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
