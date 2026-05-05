import { StudyModule } from '../types';

export const WRONG_REASON_PRESETS: Record<string, string[]> = {
  [StudyModule.VERBAL]: ['语境误读', '偷换概念', '近义辨析', '细节漏看', '感情色彩误判'],
  [StudyModule.REASONING]: ['推导错误', '属性找错', '逻辑断层', '概念扩大', '条件缺失'],
  [StudyModule.DATA]: ['粗心算错', '公式记混', '找数找错', '单位陷阱', '年份看漏', '结构误解'],
  [StudyModule.QUANT]: ['方法笨拙', '计算失误', '题型不明', '公式生疏', '解题超时'],
  [StudyModule.POLITICS]: ['考点记混', '理解偏差', '时政延时', '关键词漏读'],
  [StudyModule.ESSAY]: ['立意偏差', '结构混乱', '素材贫乏', '逻辑不通'],
};
