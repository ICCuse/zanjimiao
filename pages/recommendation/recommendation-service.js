/**
 * 智能推荐服务
 * 负责根据用户需求生成配置推荐
 */

// 导入数据服务
const dataService = require('./data-service');

// 调试日志函数
const debugLog = function(...args) {
  const app = getApp();
  if (app && app.globalData && app.globalData.debugMode && app.globalData.debugMode.recommendLog) {
    console.log('[推荐系统]', ...args);
  }
};

/**
 * 根据用途获取组件重要性权重
 * @param {string} purpose - 用途(gaming/work/office/other)
 * @returns {Object} - 各组件的重要性权重
 */
const getPurposeWeights = function(purpose) {
  switch(purpose) {
    case 'gaming':
      return {
        cpu: 0.25,
        gpu: 0.4,
        motherboard: 0.1,
        ram: 0.1,
        storage: 0.05,
        psu: 0.05,
        case: 0.025,
        cooling: 0.025
      };
    case 'work':
      return {
        cpu: 0.4,
        gpu: 0.15,
        motherboard: 0.1,
        ram: 0.15,
        storage: 0.1,
        psu: 0.05,
        case: 0.025,
        cooling: 0.025
      };
    case 'office':
      return {
        cpu: 0.3,
        gpu: 0.05,
        motherboard: 0.15,
        ram: 0.15,
        storage: 0.15,
        psu: 0.05,
        case: 0.1,
        cooling: 0.05
      };
    default:
      return {
        cpu: 0.3,
        gpu: 0.2,
        motherboard: 0.1,
        ram: 0.1,
        storage: 0.1,
        psu: 0.075,
        case: 0.075,
        cooling: 0.05
      };
  }
};

/**
 * 根据总预算和权重分配各组件预算
 * @param {number} totalBudget - 总预算
 * @param {Object} weights - 各组件权重
 * @returns {Object} - 各组件预算
 */
const allocateBudget = function(totalBudget, weights) {
  const budgetAllocation = {};
  
  // 为每个组件分配预算
  Object.keys(weights).forEach(component => {
    budgetAllocation[component] = Math.round(totalBudget * weights[component]);
  });
  
  debugLog('预算分配:', budgetAllocation);
  return budgetAllocation;
};

/**
 * 增加预算分配的随机性
 * @param {Object} allocation - 原始预算分配
 * @param {number} factor - 随机因子(0-1)
 * @param {number} totalBudget - 总预算
 * @returns {Object} - 调整后的预算分配
 */
const addRandomness = function(allocation, factor, totalBudget) {
  const randomizedAllocation = {...allocation};
  
  // 为每个组件添加随机波动
  Object.keys(randomizedAllocation).forEach(key => {
    // 随机因子在 -factor 到 +factor 之间
    const variation = (Math.random() * 2 - 1) * factor;
    randomizedAllocation[key] = Math.round(randomizedAllocation[key] * (1 + variation));
  });
  
  // 确保总预算不变
  let totalAllocated = 0;
  Object.values(randomizedAllocation).forEach(value => {
    totalAllocated += value;
  });
  
  // 如果总分配预算与目标不符，进行调整
  if (totalAllocated !== totalBudget) {
    const ratio = totalBudget / totalAllocated;
    Object.keys(randomizedAllocation).forEach(key => {
      randomizedAllocation[key] = Math.round(randomizedAllocation[key] * ratio);
    });
  }
  
  debugLog('随机化后的预算分配:', randomizedAllocation);
  return randomizedAllocation;
};

/**
 * 智能推荐主函数
 * @param {Object} userPreference - 用户偏好
 * @param {number} randomFactor - 随机因子(0-1)，0表示不添加随机性
 * @returns {Promise<Object>} - 推荐配置
 */
const generateRecommendation = function(userPreference, randomFactor = 0) {
  debugLog('开始生成推荐方案, 用户偏好:', userPreference);
  
  return new Promise(async (resolve, reject) => {
    try {
      // 获取组件权重
      const weights = getPurposeWeights(userPreference.purpose);
      
      // 分配预算
      let budgetAllocation = allocateBudget(userPreference.budget, weights);
      
      // 如果启用随机性，对预算分配进行随机调整
      if (randomFactor > 0) {
        budgetAllocation = addRandomness(budgetAllocation, randomFactor, userPreference.budget);
      }
      
      // 存储所选组件
      const selectedComponents = {};
      
      // 根据用途确定组件选择顺序
      let componentOrder;
      if (userPreference.purpose === 'gaming') {
        // 游戏: 先选GPU，再选CPU
        componentOrder = ['gpu', 'cpu', 'motherboard', 'ram', 'storage', 'cooling', 'psu', 'case'];
      } else if (userPreference.purpose === 'work') {
        // 工作: 先选CPU，再选显存大的GPU
        componentOrder = ['cpu', 'ram', 'motherboard', 'storage', 'gpu', 'cooling', 'psu', 'case'];
      } else {
        // 默认或办公: 标准顺序
        componentOrder = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooling'];
      }
      
      // 逐个选择组件
      for (const component of componentOrder) {
        debugLog(`选择组件: ${component}, 预算: ${budgetAllocation[component]}`);
        
        // 构建兼容性要求对象
        const compatibilityReqs = {};
        if (selectedComponents.cpu) compatibilityReqs.cpu = selectedComponents.cpu;
        if (selectedComponents.motherboard) compatibilityReqs.motherboard = selectedComponents.motherboard;
        if (selectedComponents.case) compatibilityReqs.case = selectedComponents.case;
        if (selectedComponents.gpu) compatibilityReqs.gpu = selectedComponents.gpu;
        
        // 获取最佳组件
        const bestComponent = await dataService.getBestComponent(
          component, 
          budgetAllocation[component], 
          userPreference.priority,
          compatibilityReqs
        );
        
        if (bestComponent) {
          selectedComponents[component] = bestComponent;
        } else {
          debugLog(`警告: 未能找到合适的${component}组件`);
          // 如果没有找到合适组件，可以尝试调整预算
          if (component === 'cpu' || component === 'gpu') {
            // 对于核心组件，增加预算
            const newBudget = budgetAllocation[component] * 1.5;
            debugLog(`增加${component}预算至${newBudget}尝试重新选择`);
            
            const retryComponent = await dataService.getBestComponent(
              component, newBudget, userPreference.priority, compatibilityReqs
            );
            
            if (retryComponent) {
              selectedComponents[component] = retryComponent;
              // 调整其他组件的预算
              const budgetDiff = parseFloat(retryComponent.价格 || retryComponent.price || 0) - budgetAllocation[component];
              const remainingComponents = componentOrder.filter(c => !selectedComponents[c]);
              
              if (budgetDiff > 0 && remainingComponents.length > 0) {
                const deductPerComponent = Math.round(budgetDiff / remainingComponents.length);
                remainingComponents.forEach(c => {
                  budgetAllocation[c] = Math.max(100, budgetAllocation[c] - deductPerComponent);
                });
                debugLog('调整后的预算分配:', budgetAllocation);
              }
            } else {
              // 使用默认选项
              selectedComponents[component] = generateDefaultComponent(component, {
                budget: budgetAllocation[component],
                priority: userPreference.priority,
                purpose: userPreference.purpose
              });
            }
          } else {
            // 对于非核心组件，使用默认选项
            selectedComponents[component] = generateDefaultComponent(component, {
              budget: budgetAllocation[component],
              priority: userPreference.priority,
              purpose: userPreference.purpose
            });
          }
        }
      }
      
      // 计算总价
      let totalPrice = 0;
      Object.values(selectedComponents).forEach(component => {
        totalPrice += parseFloat(component.价格 || component.price || 0);
      });
      
      // 计算性能评分（简单版）
      let performanceScore = 0;
      
      // CPU占30%
      const cpuPrice = parseFloat(selectedComponents.cpu.价格 || selectedComponents.cpu.price || 0);
      performanceScore += (cpuPrice / 5000) * 30; // 假设5000是顶级CPU
      
      // GPU占40%
      const gpuPrice = parseFloat(selectedComponents.gpu.价格 || selectedComponents.gpu.price || 0);
      performanceScore += (gpuPrice / 8000) * 40; // 假设8000是顶级GPU
      
      // 其他组件共占30%
      const otherComponents = ['motherboard', 'ram', 'storage', 'cooling'];
      const otherTotal = otherComponents.reduce((sum, component) => {
        return sum + parseFloat(selectedComponents[component].价格 || selectedComponents[component].price || 0);
      }, 0);
      performanceScore += (otherTotal / 8000) * 30; // 假设8000是其他组件的顶级总和
      
      // 限制性能评分在0-100之间
      performanceScore = Math.min(100, Math.max(0, Math.round(performanceScore)));
      
      // 计算性价比评分
      const valueScore = Math.min(100, Math.round((performanceScore / (totalPrice / 10000)) * 100));
      
      // 构建推荐结果
      const recommendation = {
        components: selectedComponents,
        totalPrice: Math.round(totalPrice),
        performanceScore,
        valueScore,
        preference: userPreference
      };
      
      debugLog('推荐方案生成完成:', recommendation);
      resolve(recommendation);
      
    } catch (error) {
      debugLog('生成推荐方案出错:', error);
      reject(error);
    }
  });
};

/**
 * 判断两个配置是否过于相似
 * @param {Object} config1 - 配置1
 * @param {Object} config2 - 配置2
 * @returns {boolean} - 是否相似
 */
const isSimilarConfig = function(config1, config2) {
  if (!config1 || !config2) return false;
  
  // 检查核心组件是否相同
  const cpu1 = config1.components.cpu;
  const cpu2 = config2.components.cpu;
  const gpu1 = config1.components.gpu;
  const gpu2 = config2.components.gpu;
  
  // 如果CPU和GPU都相同，则认为配置相似
  if (cpu1.id === cpu2.id && gpu1.id === gpu2.id) {
    return true;
  }
  
  // 检查总价差异
  const priceDiff = Math.abs(config1.totalPrice - config2.totalPrice);
  const priceSimilarity = priceDiff / config1.totalPrice;
  
  // 如果价格差异小于5%，且有至少3个相同组件，则认为配置相似
  if (priceSimilarity < 0.05) {
    let sameComponentsCount = 0;
    const components = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'cooling', 'psu', 'case'];
    
    components.forEach(component => {
      if (config1.components[component].id === config2.components[component].id) {
        sameComponentsCount++;
      }
    });
    
    return sameComponentsCount >= 3;
  }
  
  return false;
};

/**
 * 随机化推荐结果生成
 * @param {Object} userPreference - 用户偏好
 * @param {Object} previousConfig - 之前的配置结果
 * @returns {Promise<Object>} - 新的推荐配置
 */
const regenerateRecommendation = function(userPreference, previousConfig) {
  debugLog('重新生成推荐方案, 添加随机性');
  
  return new Promise(async (resolve, reject) => {
    try {
      // 使用30%的随机因子
      let newRecommendation = await generateRecommendation(userPreference, 0.3);
      
      // 确保新配置与之前的不同
      let attempts = 0;
      while (isSimilarConfig(newRecommendation, previousConfig) && attempts < 3) {
        debugLog(`新配置与之前相似，重新生成(尝试${attempts + 1}/3)`);
        // 增加随机因子
        newRecommendation = await generateRecommendation(userPreference, 0.3 + (attempts * 0.1));
        attempts++;
      }
      
      // 微调性能评分，让用户感知差异
      if (previousConfig) {
        const performanceDiff = Math.floor(Math.random() * 10) - 5; // -5到+5的随机调整
        newRecommendation.performanceScore = Math.min(100, Math.max(60, newRecommendation.performanceScore + performanceDiff));
        
        const valueDiff = Math.floor(Math.random() * 10) - 5; // -5到+5的随机调整
        newRecommendation.valueScore = Math.min(100, Math.max(60, newRecommendation.valueScore + valueDiff));
      }
      
      resolve(newRecommendation);
    } catch (error) {
      debugLog('重新生成推荐方案出错:', error);
      reject(error);
    }
  });
};

/**
 * 生成方案变更突出显示
 * @param {Object} oldConfig - 旧配置
 * @param {Object} newConfig - 新配置
 * @returns {Object} - 突出显示信息
 */
const generateHighlights = function(oldConfig, newConfig) {
  if (!oldConfig || !newConfig) return {};
  
  const highlights = {};
  const components = ['cpu', 'gpu', 'motherboard', 'ram', 'storage', 'cooling', 'psu', 'case'];
  
  components.forEach(component => {
    const oldComp = oldConfig.components[component];
    const newComp = newConfig.components[component];
    
    // 检查组件是否变更
    if (oldComp.id !== newComp.id) {
      highlights[component] = true;
    } else {
      highlights[component] = false;
    }
  });
  
  return highlights;
};

// 生成默认组件，当无法找到合适组件时使用
function generateDefaultComponent(type, recommendationData) {
  const timestamp = Date.now();
  const componentTypes = {
    cpu: {
      id: `default_cpu_${timestamp}`,
      type: 'cpu',
      name: '默认处理器',
      brand: 'Intel',
      model: 'Core i5',
      price: 1299,
      品牌: 'Intel',
      型号: 'Core i5',
      名称: '默认处理器',
      接口: 'LGA1700',
      socket: 'LGA1700',
      核心数: '6核12线程',
      频率: '3.3GHz',
      功耗: '65W',
      specs: [
        { label: '品牌', value: 'Intel' },
        { label: '型号', value: 'Core i5' },
        { label: '接口', value: 'LGA1700' },
        { label: '核心数', value: '6核12线程' },
        { label: '功耗', value: '65W' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    motherboard: {
      id: `default_motherboard_${timestamp}`,
      type: 'motherboard',
      name: '默认主板',
      brand: 'ASUS',
      model: 'PRIME B760M',
      price: 899,
      品牌: 'ASUS',
      型号: 'PRIME B760M',
      名称: '默认主板',
      接口: 'LGA1700',
      socket: 'LGA1700',
      芯片组: 'B760',
      规格: 'M-ATX',
      大小: 'M-ATX',
      specs: [
        { label: '品牌', value: 'ASUS' },
        { label: '型号', value: 'PRIME B760M' },
        { label: '接口', value: 'LGA1700' },
        { label: '芯片组', value: 'B760' },
        { label: '大小', value: 'M-ATX' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    ram: {
      id: `default_ram_${timestamp}`,
      type: 'ram',
      name: '默认内存',
      brand: '金士顿',
      model: 'FURY Beast DDR4',
      price: 329,
      品牌: '金士顿',
      型号: 'FURY Beast DDR4',
      名称: '默认内存',
      容量: '16GB',
      频率: '3200MHz',
      规格: 'DDR4',
      specs: [
        { label: '品牌', value: '金士顿' },
        { label: '型号', value: 'FURY Beast DDR4' },
        { label: '容量', value: '16GB' },
        { label: '频率', value: '3200MHz' },
        { label: '规格', value: 'DDR4' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    gpu: {
      id: `default_gpu_${timestamp}`,
      type: 'gpu',
      name: '默认显卡',
      brand: 'NVIDIA',
      model: 'RTX 3060',
      price: 2299,
      品牌: 'NVIDIA',
      型号: 'RTX 3060',
      名称: '默认显卡',
      显存: '12GB',
      性能: '中高端',
      功耗: '170W',
      specs: [
        { label: '品牌', value: 'NVIDIA' },
        { label: '型号', value: 'RTX 3060' },
        { label: '显存', value: '12GB' },
        { label: '功耗', value: '170W' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    storage: {
      id: `default_storage_${timestamp}`,
      type: 'storage',
      name: '默认存储',
      brand: '三星',
      model: '980 NVMe',
      price: 399,
      品牌: '三星',
      型号: '980 NVMe',
      名称: '默认存储',
      容量: '500GB',
      类型: 'NVMe SSD',
      接口: 'M.2',
      specs: [
        { label: '品牌', value: '三星' },
        { label: '型号', value: '980 NVMe' },
        { label: '容量', value: '500GB' },
        { label: '类型', value: 'NVMe SSD' },
        { label: '接口', value: 'M.2' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    psu: {
      id: `default_psu_${timestamp}`,
      type: 'psu',
      name: '默认电源',
      brand: '海韵',
      model: 'FOCUS GX',
      price: 599,
      品牌: '海韵',
      型号: 'FOCUS GX',
      名称: '默认电源',
      功率: '650W',
      认证: '80PLUS金牌',
      规格: 'ATX',
      specs: [
        { label: '品牌', value: '海韵' },
        { label: '型号', value: 'FOCUS GX' },
        { label: '功率', value: '650W' },
        { label: '认证', value: '80PLUS金牌' },
        { label: '规格', value: 'ATX' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    case: {
      id: `default_case_${timestamp}`,
      type: 'case',
      name: '默认机箱',
      brand: 'NZXT',
      model: 'H510',
      price: 499,
      品牌: 'NZXT',
      型号: 'H510',
      名称: '默认机箱',
      规格: 'ATX',
      大小: '中塔',
      颜色: '黑色',
      specs: [
        { label: '品牌', value: 'NZXT' },
        { label: '型号', value: 'H510' },
        { label: '规格', value: 'ATX' },
        { label: '大小', value: '中塔' },
        { label: '颜色', value: '黑色' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    cooling: {
      id: `default_cooling_${timestamp}`,
      type: 'cooling',
      name: '默认散热器',
      brand: '九州风神',
      model: '玄冰400',
      price: 129,
      品牌: '九州风神',
      型号: '玄冰400',
      名称: '默认散热器',
      类型: '风冷',
      散热类型: '风冷',
      兼容接口: 'Intel/AMD通用',
      specs: [
        { label: '品牌', value: '九州风神' },
        { label: '型号', value: '玄冰400' },
        { label: '类型', value: '风冷' },
        { label: '兼容接口', value: 'Intel/AMD通用' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    },
    monitor: {
      id: `default_monitor_${timestamp}`,
      type: 'monitor',
      name: '默认显示器',
      brand: '戴尔',
      model: 'S2722QC',
      price: 1799,
      品牌: '戴尔',
      型号: 'S2722QC',
      名称: '默认显示器',
      尺寸: '27英寸',
      分辨率: '4K UHD',
      刷新率: '60Hz',
      specs: [
        { label: '品牌', value: '戴尔' },
        { label: '型号', value: 'S2722QC' },
        { label: '尺寸', value: '27英寸' },
        { label: '分辨率', value: '4K UHD' },
        { label: '刷新率', value: '60Hz' },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    }
  };

  // 如果找不到请求的类型，则返回通用默认组件
  if (!componentTypes[type]) {
    console.warn(`未知组件类型: ${type}，返回通用默认组件`);
    return {
      id: `default_${type}_${timestamp}`,
      type: type,
      name: `默认${type}`,
      brand: '推荐系统',
      price: 999,
      品牌: '推荐系统',
      名称: `默认${type}`,
      specs: [
        { label: '品牌', value: '推荐系统' },
        { label: '类型', value: type },
        { label: '备注', value: '推荐系统默认选择' }
      ]
    };
  }

  return componentTypes[type];
}

module.exports = {
  generateRecommendation,
  regenerateRecommendation,
  isSimilarConfig,
  generateHighlights
}; 