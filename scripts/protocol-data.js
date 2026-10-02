export const PROTOCOLS = Object.freeze({
  recovery: {
    key: "recovery",
    name: "Recovery Protocol",
    short: "RECOVERY",
    passive: null,
    ranks: [
      {
        rank: 1,
        name: "OVERCLOCK",
        description: "Если проверка основана на твоём самом высоком Attribute, после первоначального броска, но до решения о PUSH, можешь потратить X WP и добавить X D6 к Dice Pool. Получаешь X OVERLOAD.",
        activation: { mode: "variable", min: 1, max: 10, wpMultiplier: 1, overloadMultiplier: 1, label: "Standard Overclock" }
      },
      {
        rank: 2,
        name: "UNRESTRICTED ACCESS",
        description: "OVERCLOCK можно применять к проверке любого Attribute. Немедленно выбери один Operational Protocol и получи его Rank 1.",
        activation: null
      },
      {
        rank: 3,
        name: "DEEP OVERCLOCK",
        description: "При получении ранга увеличь один Attribute на 1. Альтернативный режим OVERCLOCK: 1 WP + 2 OVERLOAD → 1D8 Artifact Die.",
        activation: { wp: 1, overload: 2, label: "Deep Overclock D8" }
      },
      {
        rank: 4,
        name: "ADVANCED OVERCLOCK",
        description: "При получении ранга увеличь один Attribute на 1. Deep Overclock предоставляет 1D10 вместо 1D8 за 1 WP + 2 OVERLOAD.",
        activation: { wp: 1, overload: 2, label: "Deep Overclock D10" }
      },
      {
        rank: 5,
        name: "FULL SYSTEM ACCESS",
        description: "При получении ранга увеличь один Attribute на 1. MAX OVERLOAD +2. Deep Overclock: 2 WP + 4 OVERLOAD → 1D12 Artifact Die. REDLINE: 2 WP + 4 OVERLOAD, до конца раунда дополнительный Slow Action и повреждённые Attributes считаются равными нормальному максимуму для формирования Dice Pool.",
        activation: { choices: [
          { id: "deep", label: "Deep Overclock D12", wp: 2, overload: 4 },
          { id: "redline", label: "REDLINE", wp: 2, overload: 4 }
        ] }
      }
    ]
  },

  combat: {
    key: "combat",
    name: "Combat Protocol",
    short: "COMBAT",
    passive: {
      name: "KILL RESPONSE",
      description: "Когда мортар лично убивает гуманоида, получает 1D[Rank] WP. Не более одного срабатывания за раунд.",
      trigger: "wp-die"
    },
    ranks: [
      { rank: 1, name: "ARMOR PENETRATION", description: "После успешного попадания, но до броска брони: 1 WP. Атака получает БП ×0.5.", activation: { wp: 1 } },
      { rank: 2, name: "COMBAT CYCLING", description: "1 WP: дополнительная Fast Action только для вспомогательного боевого действия. Не более одного раза за раунд.", activation: { wp: 1 } },
      { rank: 3, name: "LETHALITY ROUTINE", description: "После успешного попадания, но до брони: X WP, не более Rank. Damage атаки +X.", activation: { mode: "variable-rank", min: 1, wpMultiplier: 1, overloadMultiplier: 1 } },
      { rank: 4, name: "COUNTERMEASURE", description: "Когда тебя атакуют: 1 WP, выполнить DODGE или PARRY без расходования обычного действия.", activation: { wp: 1 } },
      { rank: 5, name: "TERMINATION PROTOCOL", description: "После нанесения хотя бы 1 Damage после брони: 3 WP. Гуманоид погибает; Monster вместо этого получает +3 Damage. Один раз за бой.", activation: { wp: 3 } }
    ]
  },

  bulwark: {
    key: "bulwark",
    name: "Bulwark Protocol",
    short: "BULWARK",
    passive: {
      name: "IMPACT RESPONSE",
      description: "Первый раз за бой, когда вражеская атака наносит хотя бы 1 Damage после брони, получи 1D[Rank] WP. Врожденный Armor Rating становится 4.",
      trigger: "wp-die"
    },
    ranks: [
      { rank: 1, name: "INTERPOSITION", description: "Когда союзник становится целью атаки и ты можешь добраться до него за MOVE: 1 WP, становишься целью. За 2 WP это не расходует действие.", activation: { choices: [
        { id: "move", label: "INTERPOSITION · с действием", wp: 1, overload: 1 },
        { id: "free", label: "INTERPOSITION · без действия", wp: 2, overload: 2 }
      ] } },
      { rank: 2, name: "DAMAGE CONTROL", description: "После определения входящего Damage, до Armor: X WP, не более Rank. Уменьши Damage на X.", activation: { mode: "variable-rank", min: 1, wpMultiplier: 1, overloadMultiplier: 1 } },
      { rank: 3, name: "DEFENSIVE PRIORITY", description: "После попадания, до брони: 1 WP. Удвоить Armor; или отменить БП; или отказаться от брони и уменьшить Damage на 1d3.", activation: { wp: 1 } },
      { rank: 4, name: "REDUNDANT ACTUATORS", description: "Когда STR или AGI становится Broken: 2 WP. До конца следующего раунда действуешь так, словно Broken Attribute функционален.", activation: { wp: 2 } },
      { rank: 5, name: "CORE CONTAINMENT", description: "После физической Critical Injury: 3 WP, полностью отменить её. Attribute остаётся Broken. Один раз за игровую сессию.", activation: { wp: 3 } }
    ]
  },

  reconnaissance: {
    key: "reconnaissance",
    name: "Reconnaissance Protocol",
    short: "RECON",
    passive: {
      name: "THREAT ACQUISITION",
      description: "Успешный SCOUTING, впервые обнаруживший гуманоидную засаду или скрытого враждебного гуманоида, приносит 1D[Rank] WP. Одна цель/засада даёт WP только один раз.",
      trigger: "wp-die"
    },
    ranks: [
      { rank: 1, name: "ACTIVE SCAN", description: "Перед SCOUTING: 1 WP. Добавь 1D8 Artifact Die и игнорируй до -2 обычных модификаторов видимости.", activation: { wp: 1 } },
      { rank: 2, name: "THREAT PREDICTION", description: "При Initiative берёшь карты раньше остальных. За 1 WP можешь брать дополнительные карты, пока не выберешь одну.", activation: { mode: "variable", min: 1, max: 10, wpMultiplier: 1, overloadMultiplier: 1, label: "Дополнительные Initiative Cards" } },
      { rank: 3, name: "MULTISPECTRAL VISION", description: "1 WP: до конца Turn обычная темнота, дым, туман и аналогичные визуальные препятствия не мешают зрению.", activation: { wp: 1 } },
      { rank: 4, name: "PRECISION PROCESSING", description: "X WP, не более Rank: до конца сцены/боя +X MARKSMANSHIP и SCOUTING.", activation: { mode: "variable-rank", min: 1, wpMultiplier: 1, overloadMultiplier: 1 } },
      { rank: 5, name: "OMNIDIRECTIONAL ARRAY", description: "3 WP: до конца сцены нельзя застать врасплох обычными средствами; Sneak Attacks не получают обычных преимуществ; 1 бесплатный DODGE/раунд; атаки и SCOUTING с PRECISION PROCESSING получают 1 автоматический успех.", activation: { wp: 3 } }
    ]
  },

  engineering: {
    key: "engineering",
    name: "Engineering Protocol",
    short: "ENGINEERING",
    passive: {
      name: "TECHNICAL LEARNING",
      description: "Стоимость повышения CRAFTING и непосредственно ремесленных/инженерных General Talents уменьшается вдвое, если приобретаемый Rank не выше Engineering Protocol Rank. Округление вверх.",
      trigger: null
    },
    ranks: [
      { rank: 1, name: "DIAGNOSTICS", description: "Можно устанавливать протезы без обычных штрафов. Перед CRAFTING, связанным с механизмом, ремонтом или устройством: 1 WP, добавить 1D8 Artifact Die.", activation: { wp: 1 } },
      { rank: 2, name: "FIELD MAINTENANCE", description: "Перед ремонтом STR/AGI: 1 WP. Ремонт занимает 15 минут вместо Quarter Day.", activation: { wp: 1 } },
      { rank: 3, name: "SUBSTITUTE COMPONENTS", description: "Перед ремонтом: 1 WP. Точные запчасти можно заменить обычными. Сверхтехнологичные запчасти не заменяются.", activation: { wp: 1 } },
      { rank: 4, name: "CRITICAL RECONSTRUCTION", description: "Ремонт непостоянной механической Critical Injury: 2 WP + Resource Die точных запчастей, без CRAFTING. Injury полностью снимается.", activation: { wp: 2 } },
      { rank: 5, name: "PERFECT REPAIR", description: "3 WP при успешном ремонте: полностью восстановить STR/AGI и/или убрать Structural Damage при точных запчастях. Также снимает весь прежний OVERLOAD, кроме полученного от этой способности.", activation: { wp: 3, overload: 3 } }
    ]
  },

  mobility: {
    key: "mobility",
    name: "Mobility Protocol",
    short: "MOBILITY",
    passive: {
      name: "EXTENDED STRIDE",
      description: "Каждый RUN длиннее на количество метров, равное Mobility Protocol Rank + Recovery Protocol Rank.",
      trigger: null
    },
    ranks: [
      { rank: 1, name: "TERRAIN COMPENSATION", description: "1 WP: до конца Turn игнорируй обычные штрафы Difficult Terrain при беге, прыжках, лазании и перемещении.", activation: { wp: 1 } },
      { rank: 2, name: "SERVO BURST", description: "1 WP: немедленно выполнить MOVE без расходования обычного действия. Один раз за раунд.", activation: { wp: 1 } },
      { rank: 3, name: "VERTICAL TRACTION", description: "1 WP: до конца раунда перемещайся по вертикальным поверхностям как по обычным. 2 WP позволяют двигаться вверх ногами; в конце раунда ещё 1 WP, если остаёшься на стене/потолке.", activation: { choices: [
        { id: "wall", label: "VERTICAL TRACTION · стены", wp: 1, overload: 1 },
        { id: "ceiling", label: "VERTICAL TRACTION · вверх ногами", wp: 2, overload: 2 },
        { id: "hold", label: "VERTICAL TRACTION · удержаться", wp: 1, overload: 1 }
      ] } },
      { rank: 4, name: "ACCELERATED FRAME", description: "В начале хода: 2 WP. До конца раунда дополнительная Fast Action и +1 ко всем MOVE.", activation: { wp: 2 } },
      { rank: 5, name: "HIGH-SPEED STATE", description: "В начале хода: 3 WP. До конца раунда дополнительная Slow Action и Fast Action; каждый обычный MOVE преодолевает на одну зону больше (+10 м).", activation: { wp: 3 } }
    ]
  },

  command: {
    key: "command",
    name: "Command Protocol",
    short: "COMMAND",
    passive: {
      name: "COMMAND RESPONSE",
      description: "Первый раз за сцену/бой, когда другой персонаж успешно проходит проверку, усиленную Command Protocol, получи 1D[Rank] WP.",
      trigger: "wp-die"
    },
    ranks: [
      { rank: 1, name: "LINKED OVERCLOCK", description: "Другой персонаж в NEAR после первоначального броска, до PUSH: X WP, добавить X D6 к его Dice Pool. WP и OVERLOAD платит мортар.", activation: { mode: "variable", min: 1, max: 10, wpMultiplier: 1, overloadMultiplier: 1, label: "Linked Overclock" } },
      { rank: 2, name: "TACTICAL LINK", description: "После раздачи Initiative, до первого раунда: X WP, выбрать до X союзников NEAR и перераспределить между вами карты Initiative.", activation: { mode: "variable", min: 1, max: 10, wpMultiplier: 1, overloadMultiplier: 1, label: "Союзники Tactical Link" } },
      { rank: 3, name: "IMMEDIATE DIRECTIVE", description: "В начале хода другого персонажа NEAR: 1 WP. Он получает дополнительную Fast Action на текущий ход. Один раз за раунд.", activation: { wp: 1 } },
      { rank: 4, name: "COMMAND NETWORK", description: "В начале сцены/боя: 2 WP. Пока союзник NEAR воспринимает команды, твой HELP даёт ещё +1D6; LINKED OVERCLOCK даёт ещё +1D6. Прекращается при Broken WITS или PSYCHOSIS.", activation: { wp: 2 } },
      { rank: 5, name: "BATTLEFIELD ORCHESTRATION", description: "Дальность Command NEAR → SHORT. В начале раунда: 3 WP, до трёх союзников получают Fast Action; один из них дополнительно Slow Action.", activation: { wp: 3 } }
    ]
  }
});

export const PROTOCOL_ALIASES = Object.freeze({
  recovery: ["recovery protocol", "протокол восстановления"],
  combat: ["combat protocol", "боевой протокол"],
  bulwark: ["bulwark protocol", "протокол бастион", "протокол бастиона"],
  reconnaissance: ["reconnaissance protocol", "разведывательный протокол", "протокол разведки"],
  engineering: ["engineering protocol", "инженерный протокол"],
  mobility: ["mobility protocol", "протокол мобильности"],
  command: ["command protocol", "командный протокол"]
});
