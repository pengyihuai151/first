import { StudyModule } from '../types';

/** 大模块定义（用于统计和计时） */
export interface ModuleDef {
  /** 大模块 */
  module: StudyModule;
  /** 大模块显示名 */
  label: string;
  /** 子模块列表（无子模块则为空数组） */
  children: { key: string; label: string }[];
}

/** 大模块 → 层级定义 */
export const MODULE_HIERARCHY: ModuleDef[] = [
  {
    module: StudyModule.VERBAL,
    label: '言语理解',
    children: [
      { key: 'verbal-logic-fill', label: '逻辑填空' },
      { key: 'verbal-passage', label: '篇章阅读' },
    ],
  },
  {
    module: StudyModule.REASONING,
    label: '判断推理',
    children: [
      { key: 'reasoning-graphic', label: '图形推理' },
      { key: 'reasoning-definition', label: '定义判断' },
      { key: 'reasoning-analogy', label: '类比推理' },
      { key: 'reasoning-logic', label: '逻辑推理' },
    ],
  },
  {
    module: StudyModule.DATA,
    label: '资料分析',
    children: [],
  },
  {
    module: StudyModule.QUANT,
    label: '数量关系',
    children: [],
  },
  {
    module: StudyModule.POLITICS,
    label: '常识判断',
    children: [],
  },
];

/** 所有子模块 key（扁平列表，用于标签） */
export const ALL_SUB_MODULE_KEYS = MODULE_HIERARCHY.flatMap((m) =>
  m.children.length > 0 ? m.children.map((c) => c.key) : []
);

/** 大模块 key → 大模块信息 */
export const MODULE_KEY_MAP: Record<string, ModuleDef> = {};
for (const m of MODULE_HIERARCHY) {
  MODULE_KEY_MAP[m.module] = m;
}

/** 子模块 key → { parentModule, label, parentLabel } */
export const SUB_MODULE_MAP: Record<
  string,
  { parentModule: StudyModule; label: string; parentLabel: string }
> = {};
for (const m of MODULE_HIERARCHY) {
  for (const c of m.children) {
    SUB_MODULE_MAP[c.key] = { parentModule: m.module, label: c.label, parentLabel: m.label };
  }
}

/** 获取大模块显示名 */
export function getModuleLabel(module: StudyModule): string {
  return MODULE_KEY_MAP[module]?.label ?? module;
}

/** 获取子模块显示名 */
export function getSubModuleLabel(key: string): string {
  return SUB_MODULE_MAP[key]?.label ?? key;
}

/** 某大模块是否有子模块 */
export function hasSubModules(module: StudyModule): boolean {
  return (MODULE_KEY_MAP[module]?.children.length ?? 0) > 0;
}

/** 某大模块下的子模块列表 */
export function getSubModules(module: StudyModule): { key: string; label: string }[] {
  return MODULE_KEY_MAP[module]?.children ?? [];
}

/** 某大模块下的总子模块数 */
export function getSubModuleCount(module: StudyModule): number {
  return getSubModules(module).length;
}

/** 获取大模块 key（用于存储） */
export function getModuleKey(module: StudyModule): StudyModule {
  return module;
}

/** 错题录入可选的细分标签（用于标签多选） */
export interface TagOption {
  key: string;
  label: string;
  /** 所属大模块 */
  module: StudyModule;
  /** 是否为子模块级标签 */
  isSubModule: boolean;
}

/** 所有可选项 */
export const TAG_OPTIONS: TagOption[] = MODULE_HIERARCHY.flatMap((m) => {
  if (m.children.length > 0) {
    // 有子模块：展开放到 tag 里
    return m.children.map((c) => ({
      key: c.key,
      label: c.label,
      module: m.module,
      isSubModule: true,
    }));
  }
  // 无子模块：直接用大模块作为 tag
  return [
    {
      key: m.module,
      label: m.label,
      module: m.module,
      isSubModule: false,
    },
  ];
});
