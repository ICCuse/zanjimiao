/**
 * 兼容性检查相关工具函数
 * 注意：主要兼容性判断已移至前端实现，此文件仅作为辅助工具
 */

// 获取应用实例
const app = getApp();

// 调试日志函数
const debugLog = function(...args) {
  if (app && app.globalData && app.globalData.debugMode && app.globalData.debugMode.compatibilityLog) {
    console.log(...args);
  }
};

// 检查CPU与主板兼容性
const checkCpuMotherboardCompatibility = (cpu, motherboard) => {
  if (!cpu || !motherboard) return true; // 如果缺少组件，暂不检查
  
  // 同时检查socket和接口字段，确保不会漏掉有效值
  const cpuSocket = cpu.接口 || cpu.socket || '';
  const motherboardSocket = motherboard.接口 || motherboard.socket || '';
  
  // 规范化接口字符串（去除空格，转换为大写），确保格式一致
  const normCpuSocket = cpuSocket.replace(/\s+/g, '').toUpperCase();
  const normMbSocket = motherboardSocket.replace(/\s+/g, '').toUpperCase();
  
  debugLog(`[兼容性检查] 接口比较: CPU(${cpuSocket} [标准化:${normCpuSocket}]) vs 主板(${motherboardSocket} [标准化:${normMbSocket}])`);
  
  // 检查接口是否兼容
  if (normCpuSocket && normMbSocket && normCpuSocket !== normMbSocket) {
    return {
      compatible: false,
      message: `CPU(${cpuSocket})与主板(${motherboardSocket})接口不兼容`
    };
  }
  
  return { compatible: true };
};

// 检查GPU与机箱兼容性 
// 简化直接返回兼容
const checkGpuCaseCompatibility = (gpu, computerCase) => {
  return { compatible: true };
};

// 检查内存与主板兼容性
const checkRamMotherboardCompatibility = (ram, motherboard) => {
  if (!ram || !motherboard) return true; // 如果缺少组件，暂不检查
  
  // 直接使用组件原始接口类型值
  const ramType = ram.接口类型 || '';
  
  // 从主板的内存插槽字段中提取内存类型部分
  let mbMemoryType = '';
  if (motherboard.内存插槽) {
    // 使用更灵活的正则表达式匹配各种格式："4*D5", "4×D5", "4 x D5"等
    const memSlotMatch = motherboard.内存插槽.match(/\d+\s*[\*×xX]\s*([DdRr]\d+)/);
    if (memSlotMatch) {
      mbMemoryType = memSlotMatch[1].toUpperCase();
    }
  }
  
  debugLog(`[兼容性检查] 内存类型比较: 内存(${ramType}) vs 主板(${mbMemoryType})`);
  
  // 只有当两者都有值且不相等时，才判定为不兼容
  if (ramType && mbMemoryType && ramType !== mbMemoryType) {
    return {
      compatible: false,
      message: `内存(${ramType})与主板(${mbMemoryType})不兼容`
    };
  }
  
  return { compatible: true };
};

// 检查电源功率是否足够
// 简化直接返回兼容
const checkPowerSupplyWattage = (components, powerSupply) => {
  return { compatible: true };
};

// 检查整体配置兼容性
const checkCompatibility = (configComponents) => {
  if (!configComponents) return []; // 如果缺少组件，返回空数组
  
  const { cpu, motherboard, gpu, ram, storage, computerCase, powerSupply } = configComponents;
  const issues = [];
  
  // CPU与主板兼容性
  const cpuMotherboardCheck = checkCpuMotherboardCompatibility(cpu, motherboard);
  if (cpuMotherboardCheck && !cpuMotherboardCheck.compatible) {
    issues.push({
      type: 'cpu_motherboard',
      message: cpuMotherboardCheck.message
    });
  }
  
  // 内存与主板兼容性
  const ramMotherboardCheck = checkRamMotherboardCompatibility(ram, motherboard);
  if (ramMotherboardCheck && !ramMotherboardCheck.compatible) {
    issues.push({
      type: 'ram_motherboard',
      message: ramMotherboardCheck.message
    });
  }
  
  return issues;
};

module.exports = {
  checkCpuMotherboardCompatibility,
  checkGpuCaseCompatibility,
  checkRamMotherboardCompatibility,
  checkPowerSupplyWattage,
  checkCompatibility
}; 