/**
 * 智能推荐数据服务
 * 负责获取组件数据和提供兼容性检查功能
 */

// 调试日志函数
const debugLog = function(...args) {
  const app = getApp();
  if (app && app.globalData && app.globalData.debugMode && app.globalData.debugMode.recommendLog) {
    console.log('[推荐系统]', ...args);
  }
};

/**
 * 获取组件数据
 * 复用配置页的组件获取逻辑
 * @param {string} componentType - 组件类型
 * @returns {Promise<Array>} - 组件数据数组
 */
const getComponentsData = function(componentType) {
  debugLog(`正在获取${componentType}组件数据...`);
  
  return new Promise((resolve, reject) => {
    // 检查本地缓存
    const cacheKey = `components_cache_${componentType}`;
    const cachedData = wx.getStorageSync(cacheKey);
    
    if (cachedData && cachedData.timestamp && (Date.now() - cachedData.timestamp < 3600000)) {
      debugLog(`使用缓存的${componentType}数据，共${cachedData.data.length}个组件`);
      resolve(cachedData.data);
      return;
    }
    
    // 无缓存或缓存过期，从云函数获取
    wx.cloud.callFunction({
      name: 'getComponentsData',
      data: {
        componentType: componentType === 'cooling' ? 'cooler' : componentType,
        brand: 'all',
        limit: 5000,
        fetchAll: true
      }
    })
    .then(res => {
      if (res.result && res.result.data) {
        const components = res.result.data.map(item => ({
          id: item.id || item._id || 'unknown',
          ...item,
          type: componentType,
          rawData: item
        }));
        
        debugLog(`成功获取${componentType}数据，共${components.length}个组件`);
        
        // 更新缓存
        wx.setStorageSync(cacheKey, {
          timestamp: Date.now(),
          data: components
        });
        
        resolve(components);
      } else {
        reject(new Error(`获取${componentType}组件数据失败：${res.result ? res.result.message : '未知错误'}`));
      }
    })
    .catch(err => {
      debugLog(`获取${componentType}组件数据出错:`, err);
      reject(err);
    });
  });
};

/**
 * 批量获取多种组件数据
 * @param {Array<string>} componentTypes - 要获取的组件类型数组
 * @returns {Promise<Object>} - 包含各类型组件数据的对象
 */
const getAllComponentsData = function(componentTypes) {
  debugLog(`批量获取组件数据: ${componentTypes.join(', ')}`);
  
  return new Promise((resolve, reject) => {
    const promises = componentTypes.map(type => getComponentsData(type));
    
    Promise.all(promises)
      .then(results => {
        const componentsData = {};
        componentTypes.forEach((type, index) => {
          componentsData[type] = results[index];
        });
        resolve(componentsData);
      })
      .catch(err => {
        debugLog('批量获取组件数据出错:', err);
        reject(err);
      });
  });
};

/**
 * 检查CPU与主板兼容性
 * @param {Object} cpu - CPU组件
 * @param {Object} motherboard - 主板组件
 * @returns {boolean} - 是否兼容
 */
const checkCpuMotherboardCompatibility = (cpu, motherboard) => {
  if (!cpu || !motherboard) return true; // 如果缺少组件，暂不检查
  
  // 同时检查socket和接口字段，确保不会漏掉有效值
  const cpuSocket = cpu.接口 || cpu.socket || '';
  const motherboardSocket = motherboard.接口 || motherboard.socket || '';
  
  // 规范化接口字符串（去除空格，转换为大写），确保格式一致
  const normCpuSocket = cpuSocket.replace(/\s+/g, '').toUpperCase();
  const normMbSocket = motherboardSocket.replace(/\s+/g, '').toUpperCase();
  
  debugLog(`接口比较: CPU(${cpuSocket}) vs 主板(${motherboardSocket})`);
  
  // 检查接口是否兼容
  return !normCpuSocket || !normMbSocket || normCpuSocket === normMbSocket;
};

/**
 * 检查内存与主板兼容性
 * @param {Object} ram - 内存组件
 * @param {Object} motherboard - 主板组件
 * @returns {boolean} - 是否兼容
 */
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
  
  debugLog(`内存类型比较: 内存(${ramType}) vs 主板(${mbMemoryType})`);
  
  // 只有当两者都有值且不相等时，才判定为不兼容
  return !ramType || !mbMemoryType || ramType === mbMemoryType;
};

/**
 * 按关键词筛选组件
 * 复用配置页的关键词筛选逻辑
 * @param {Array} components - 组件数组
 * @param {string} keyword - 关键词
 * @param {string} componentType - 组件类型
 * @returns {Array} - 筛选后的组件数组
 */
const filterComponentsByKeyword = function(components, keyword, componentType) {
  if (!keyword || keyword.trim() === '') return components;
  
  // 统一转小写并去除首尾空格，方便不区分大小写匹配
  const trimmedKeyword = keyword.trim().toLowerCase();
  debugLog(`关键词筛选: ${trimmedKeyword}, 组件数量: ${components.length}`);
  
  // 将关键词分割成多个部分，支持空格分隔的多关键词搜索
  const keywordParts = trimmedKeyword.split(/\s+/).filter(part => part.length > 0);
  
  // 如果没有有效关键词，返回原组件列表
  if (keywordParts.length === 0) return components;
  
  return components.filter(item => {
    // 所有关键词部分都必须匹配才返回true（AND逻辑）
    return keywordParts.every(keywordPart => {
      // 1. 名称匹配
      const itemName = (item['名称'] || item.name || '').toLowerCase();
      if (itemName.includes(keywordPart)) return true;
      
      // 2. 品牌匹配
      const itemBrand = (item['品牌'] || item.brand || '').toLowerCase();
      if (itemBrand.includes(keywordPart)) return true;
      
      // 3. 型号匹配
      const itemModel = (item['型号'] || item.model || '').toLowerCase();
      if (itemModel.includes(keywordPart)) return true;
      
      // 4. 组件特有字段匹配
      if (componentType === 'cpu') {
        // CPU特有字段
        const coreParts = [
          item['核心数'] || item.core_count || '',
          item['线程数'] || item.thread_count || '',
          item['频率'] || item.frequency || item.base_frequency || '',
          item['睿频'] || item.boost_frequency || '',
          item['缓存'] || item.cache || '',
          item['架构'] || item.architecture || ''
        ].map(String).map(s => s.toLowerCase());
        
        // 任何一个字段匹配即可
        if (coreParts.some(part => part.includes(keywordPart))) return true;
      }
      // 其他组件类型类似处理
      // ...
      
      return false;
    });
  });
};

/**
 * 根据预算和组件类型获取最佳组件
 * @param {string} componentType - 组件类型
 * @param {number} budget - 预算
 * @param {string} priority - 优先级（性能/性价比/静音）
 * @param {Object} compatibilityReqs - 兼容性要求
 * @returns {Promise<Object>} - 最佳组件
 */
const getBestComponent = function(componentType, budget, priority, compatibilityReqs = null) {
  return new Promise((resolve, reject) => {
    getComponentsData(componentType)
      .then(components => {
        // 先筛选预算范围内的组件
        let affordableComponents = components.filter(item => {
          const price = parseFloat(item.价格 || item.price || 0);
          return price > 0 && price <= budget;
        });
        
        debugLog(`预算${budget}内的${componentType}组件数量: ${affordableComponents.length}`);
        
        // 如果有兼容性要求，进行兼容性筛选
        if (compatibilityReqs) {
          if (componentType === 'motherboard' && compatibilityReqs.cpu) {
            affordableComponents = affordableComponents.filter(item => 
              checkCpuMotherboardCompatibility(compatibilityReqs.cpu, item)
            );
          } else if (componentType === 'ram' && compatibilityReqs.motherboard) {
            affordableComponents = affordableComponents.filter(item => 
              checkRamMotherboardCompatibility(item, compatibilityReqs.motherboard)
            );
          }
          // 其他兼容性检查...
        }
        
        debugLog(`兼容性筛选后的${componentType}组件数量: ${affordableComponents.length}`);
        
        // 如果没有符合条件的组件，则尝试放宽预算限制
        if (affordableComponents.length === 0) {
          debugLog(`没有找到符合条件的${componentType}组件，尝试放宽预算限制`);
          affordableComponents = components.filter(item => {
            const price = parseFloat(item.价格 || item.price || 0);
            return price > 0 && price <= budget * 1.2; // 放宽20%预算
          });
          
          // 如果还是没有，则返回null
          if (affordableComponents.length === 0) {
            resolve(null);
            return;
          }
        }
        
        // 根据优先级选择最佳组件
        let bestComponent;
        
        if (priority === 'performance') {
          // 性能优先 - 选择预算内价格最高的
          bestComponent = affordableComponents.sort((a, b) => {
            return parseFloat(b.价格 || b.price || 0) - parseFloat(a.价格 || a.price || 0);
          })[0];
        } else if (priority === 'value') {
          // 性价比优先 - 选择中等价位的（预算的60%-80%之间）
          const targetMin = budget * 0.6;
          const targetMax = budget * 0.8;
          
          const midRangeComponents = affordableComponents.filter(item => {
            const price = parseFloat(item.价格 || item.price || 0);
            return price >= targetMin && price <= targetMax;
          });
          
          bestComponent = midRangeComponents.length > 0 
            ? midRangeComponents[Math.floor(Math.random() * midRangeComponents.length)] 
            : affordableComponents[Math.floor(affordableComponents.length / 2)];
        } else if (priority === 'quiet') {
          // 静音优先 - 在CPU和散热器上选择功耗较低的型号
          if (componentType === 'cpu') {
            // 筛选TDP较低的CPU
            affordableComponents.sort((a, b) => {
              const tdpA = parseInt((a.功耗 || a.tdp || '').replace(/\D/g, '') || 100);
              const tdpB = parseInt((b.功耗 || b.tdp || '').replace(/\D/g, '') || 100);
              return tdpA - tdpB;
            });
            bestComponent = affordableComponents[0];
          } else if (componentType === 'cooling') {
            // 优先选择水冷或大型风冷
            const waterCooling = affordableComponents.filter(item => 
              (item.散热形式 || item.type || '').includes('水冷')
            );
            bestComponent = waterCooling.length > 0 
              ? waterCooling[Math.floor(Math.random() * waterCooling.length)]
              : affordableComponents[Math.floor(Math.random() * affordableComponents.length)];
          } else {
            // 其他组件随机选择
            bestComponent = affordableComponents[Math.floor(Math.random() * affordableComponents.length)];
          }
        } else {
          // 默认随机选择
          bestComponent = affordableComponents[Math.floor(Math.random() * affordableComponents.length)];
        }
        
        resolve(bestComponent);
      })
      .catch(err => {
        debugLog(`获取最佳${componentType}组件出错:`, err);
        reject(err);
      });
  });
};

module.exports = {
  getComponentsData,
  getAllComponentsData,
  checkCpuMotherboardCompatibility,
  checkRamMotherboardCompatibility,
  filterComponentsByKeyword,
  getBestComponent
}; 