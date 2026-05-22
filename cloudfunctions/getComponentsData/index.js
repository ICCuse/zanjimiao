// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 可选的品牌名称标准化映射 - 只用于辅助显示，不再强制使用
const brandNameMap = {
  'intel': '英特尔',
  'amd': 'AMD',
  'asus': '华硕',
  'gigabyte': '技嘉', 
  'msi': '微星',
  'asrock': '华擎',
  'samsung': '三星',
  'kingston': '金士顿',
  'corsair': '海盗船',
  'nvidia': '英伟达',
  'western digital': '西数',
  'wd': '西数',
  'seagate': '希捷'
};

/**
 * 云函数入口函数
 * @param {Object} event - 事件对象
 * @param {string} event.componentType - 组件类型，如'cpu'
 * @param {string} [event.brand] - 可选的品牌过滤
 * @param {number} [event.limit] - 可选的结果数量限制
 * @param {boolean} [event.fetchAll] - 是否获取所有品牌的数据
 */
exports.main = async (event, context) => {
  console.log('[云函数] 接收到请求参数:', event);
  
  const db = cloud.database();
  
  try {
    const { componentType, brand = 'all', limit = 100, fetchAll = false, mode, getAllBrands = false } = event;
    
    // 检查组件类型是否有效
    if (!componentType) {
      console.error('[云函数] 缺少componentType参数');
      return {
        code: 1,
        message: '缺少组件类型参数',
        data: []
      };
    }
    
    // 获取品牌统计
    if (mode === 'brandStats') {
      console.log(`[云函数] 请求获取${componentType}品牌统计`);
      return await getBrandStatistics(db, componentType);
    }
    
    // 获取集合名称
    const collectionMapping = {
      'cpu': 'cpu_data',
      'motherboard': 'motherboard_data',
      'ram': 'memory_data',     // 确保'ram'类型映射到'memory_data'
      'memory': 'memory_data',  // 兼容"memory"类型
      'gpu': 'gpu_data',
      'storage': 'disk_data',
      'disk': 'disk_data',      // 兼容"disk"类型
      'psu': 'power_data',
      'power': 'power_data',    // 兼容"power"类型
      'case': 'case_data',
      'cooling': 'cooler_data',
      'cooler': 'cooler_data',  // 兼容"cooler"类型
      'monitor': 'monitor_data'
    };
    
    const collectionName = collectionMapping[componentType];
    
    if (!collectionName) {
      console.error(`[云函数] 无效的组件类型: ${componentType}`);
        return {
          code: 1,
        message: `不支持的组件类型`,
          data: null
      };
    }
    
    console.log(`[云函数] 准备查询集合: ${collectionName}, 品牌: ${brand}, 限制: ${limit}`);
    
    // 检查集合是否存在数据
    try {
      const collectionCheck = await db.collection(collectionName).count();
      console.log(`[云函数] 集合 ${collectionName} 包含 ${collectionCheck.total} 条记录`);
      
      if (collectionCheck.total === 0) {
        console.warn(`[云函数] 集合 ${collectionName} 不包含任何数据`);
        return {
          code: 3,
          message: `${componentType}组件暂无数据`,
          data: [],
          brands: [],
          noDataAvailable: true
        };
      }
    } catch (error) {
      console.error(`[云函数] 检查集合 ${collectionName} 时出错:`, error);
      // 如果集合不存在或其他错误，也返回无数据信息
      return {
        code: 3,
        message: `${componentType}组件暂无数据`,
        data: [],
        brands: [],
        noDataAvailable: true
      };
    }

    // 对所有组件使用统一的查询逻辑
    return await queryComponent(db, componentType, collectionName, brand, limit, fetchAll, getAllBrands);
    
  } catch (error) {
    console.error('[云函数] 查询出错:', error);
    return {
      code: 500,
      message: `查询出错: ${error.message}`,
      data: []
    };
  }
};

/**
 * 统一的组件查询逻辑
 * 用于查询所有类型的组件
 */
async function queryComponent(db, componentType, collectionName, brand, limit, fetchAll, getAllBrands) {
  console.log(`[云函数] 开始查询${componentType}数据, brand=${brand}`);
  
  try {
    // 创建超时Promise
    const timeout = new Promise((resolve) => {
      setTimeout(() => {
        resolve({
          code: 4,
          message: `${componentType}查询超时`,
          data: [],
          brands: [],
          timeout: true
        });
      }, 10000); // 10秒超时
    });

    // 获取完整的品牌统计信息
    const brandStatsPromise = getBrandStatistics(db, componentType);
    const brandStatsResult = await Promise.race([brandStatsPromise, timeout]);
    
    // 检查是否已经超时
    if (brandStatsResult.timeout) return brandStatsResult;
    
    // 提取品牌信息
    let brandList = [];
    let fullBrandsList = [];
    
    if (brandStatsResult.code === 0 && brandStatsResult.data && brandStatsResult.data.brands) {
      fullBrandsList = brandStatsResult.data.brands;
      brandList = fullBrandsList.map(b => b.displayName || b.brandName);
      console.log(`[云函数] ${componentType}品牌列表(${brandList.length}个):`, brandList);
    } else {
      // 如果获取品牌统计失败，尝试使用老方法获取品牌列表
      const brandListPromise = getComponentBrands(db, collectionName);
      const oldBrandList = await Promise.race([brandListPromise, timeout]);
      
      // 检查是否已经超时
      if (oldBrandList.timeout) return oldBrandList;
      
      brandList = oldBrandList;
      // 转换为品牌对象列表
      fullBrandsList = brandList.map(b => ({
        brandName: b,
        displayName: b,
        count: 0
      }));
      console.log(`[云函数] ${componentType}品牌列表(使用老方法获取, ${brandList.length}个):`, brandList);
    }
    
    // 构建查询 - 应用品牌筛选
    let query = db.collection(collectionName);
    
    // 如果品牌不是'all'，则应用品牌筛选
    if (brand !== 'all' && brand !== '全部') {
      console.log(`[云函数] 应用品牌筛选: ${brand}`);
      
      // 创建灵活的品牌匹配条件
      // 尝试匹配brand、品牌字段和名称中的品牌
      const brandCondition = db.command.or([
        { brand: db.command.eq(brand) },
        { 品牌: db.command.eq(brand) },
        // 使用正则表达式进行模糊匹配
        { name: db.RegExp({
            regexp: brand,
            options: 'i'  // 不区分大小写
          }) 
        },
        { 名称: db.RegExp({
            regexp: brand,
            options: 'i'  // 不区分大小写
          }) 
        }
      ]);
      
      query = query.where(brandCondition);
    } else {
      console.log(`[云函数] 不应用品牌筛选，查询所有${componentType}数据`);
    }
    
    // 获取数据
    const queryPromise = query.limit(limit).get();
    const result = await Promise.race([queryPromise, timeout]);
    
    // 检查是否已经超时
    if (result.timeout) return result;
    console.log(`[云函数] 查询完成，找到${result.data.length}条${componentType}记录`);
    
    // 如果没有找到数据，返回空数据和品牌列表
    if (result.data.length === 0) {
      return {
        code: 3,
        message: `${componentType}组件暂无数据`,
        data: [],
        brands: getAllBrands ? fullBrandsList : brandList,
        noDataAvailable: true
      };
    }
    
    // 标准化数据
    const standardizedData = standardizeData(result.data, componentType);
    
    // 返回结果
    return {
      code: 0,
      message: '成功',
      data: standardizedData,
      brands: getAllBrands ? fullBrandsList : brandList
    };
  } catch (error) {
    console.error(`[云函数] ${componentType}查询出错:`, error);
    return {
      code: 500,
      message: `${componentType}查询出错: ${error.message}`,
      data: [],
      brands: []
    };
  }
}

/**
 * 获取组件的品牌列表
 * @param {Object} db - 数据库实例
 * @param {string} collectionName - 集合名称
 */
async function getComponentBrands(db, collectionName) {
  try {
    // 先检查集合是否有数据
    const countResult = await db.collection(collectionName).count();
    if (countResult.total === 0) {
      console.log(`[云函数] 集合 ${collectionName} 为空，返回空品牌列表`);
      return [];
    }
    
    // 执行聚合查询获取不同的品牌
    const brandAgg = await db.collection(collectionName)
      .aggregate()
      .group({
        _id: {
          brand: '$brand',
          品牌: '$品牌'
        },
        count: db.command.aggregate.sum(1)
      })
      .end();
    
    // 提取有效的品牌名称
    const brandList = [];
    brandAgg.list.forEach(item => {
      let brandName = '';
      
      if (item._id.brand) {
        brandName = item._id.brand;
      } else if (item._id.品牌) {
        brandName = item._id.品牌;
      }
      
      if (brandName && !brandList.includes(brandName)) {
        brandList.push(brandName);
      }
    });
    
    return brandList;
  } catch (error) {
    console.error('[云函数] 获取品牌列表失败:', error);
    return [];
  }
}

/**
 * 获取组件品牌统计数据
 * @param {Object} db - 数据库实例
 * @param {string} componentType - 组件类型
 */
async function getBrandStatistics(db, componentType) {
  console.log(`[云函数:品牌统计] 开始获取${componentType}品牌统计`);
  
  try {
    // 获取集合名称
    const collectionMapping = {
      'cpu': 'cpu_data',
      'motherboard': 'motherboard_data',
      'ram': 'memory_data',
      'memory': 'memory_data',
      'gpu': 'gpu_data',
      'storage': 'disk_data',
      'disk': 'disk_data',
      'psu': 'power_data',
      'power': 'power_data',
      'case': 'case_data',
      'cooling': 'cooler_data',
      'cooler': 'cooler_data',
      'monitor': 'monitor_data'
    };
    
    const collectionName = collectionMapping[componentType];
    
    if (!collectionName) {
      console.error(`[云函数:品牌统计] 无效的组件类型: ${componentType}`);
      return {
        code: 2,
        message: `无效的组件类型: ${componentType}`,
        data: []
      };
    }
    
    // 检查集合是否有数据
    const countResult = await db.collection(collectionName).count();
    if (countResult.total === 0) {
      console.log(`[云函数:品牌统计] 集合 ${collectionName} 为空，返回空品牌统计`);
      return {
        code: 3,
        message: `${componentType}组件暂无数据`,
        data: {
          brands: []
        },
        noDataAvailable: true
      };
    }
    
    // 执行聚合查询获取品牌统计 - 增加数据量限制，确保能获取到更多品牌
    const brandAgg = await db.collection(collectionName)
      .aggregate()
      .limit(10000)  // 大幅增加数据量限制，确保获取所有品牌
      .group({
        _id: {
          brand: '$brand',
          brand2: '$品牌'
        },
        count: db.command.aggregate.sum(1)
      })
      .end();
    
    console.log(`[云函数:品牌统计] ${componentType}品牌聚合结果(${brandAgg.list.length}个):`, 
                brandAgg.list.length > 0 ? brandAgg.list.slice(0, 3) : []);
    
    // 提取有效的品牌名称和计数
    const brandStats = [];
    const brandMap = new Map(); // 用于去重
    
    brandAgg.list.forEach(item => {
      let brandName = '';
      
      if (item._id.brand) {
        brandName = item._id.brand;
      } else if (item._id.brand2) {
        brandName = item._id.brand2;
      }
      
      if (brandName) {
        // 如果品牌包含括号，只保留括号前的部分
        if (brandName.includes('(')) {
          brandName = brandName.split('(')[0].trim();
        }
        
        // 去重添加到结果列表
        if (!brandMap.has(brandName)) {
          brandMap.set(brandName, true);
          brandStats.push({
            brandName: brandName,
            displayName: brandName,
            count: item.count
          });
        } else {
          // 如果品牌已存在，增加计数
          const existingBrand = brandStats.find(b => b.brandName === brandName);
          if (existingBrand) {
            existingBrand.count += item.count;
          }
        }
      }
    });
    
    console.log(`[云函数:品牌统计] ${componentType}品牌统计完成，共${brandStats.length}个品牌`);
    
    // 对品牌按计数排序，以便前端展示时更有条理
    brandStats.sort((a, b) => b.count - a.count);
        
        return {
      code: 0,
      message: '成功',
      data: {
        brands: brandStats
      }
    };
  } catch (error) {
    console.error(`[云函数:品牌统计] ${componentType}品牌统计出错:`, error);
    
    return {
      code: 500,
      message: `品牌统计出错: ${error.message}`,
      data: {
        brands: []
      }
    };
  }
}

/**
 * 标准化组件数据，确保字段名和格式一致
 * @param {Array} data - 组件数据
 * @param {string} type - 组件类型
 * @returns {Array} 标准化后的数据
 */
function standardizeData(data, type) {
  // 检查输入数据是否有效
  if (!data || !Array.isArray(data)) {
    console.warn(`[云函数:标准化] 无效的${type}数据`);
    return [];
  }
  
  console.log(`[云函数:标准化] 开始标准化${data.length}条${type}数据`);
  
  // 价格调整系数 - 增加13.5%
  const PRICE_ADJUSTMENT_RATE = 1.135;
  
  try {
    // 对数据进行最小化标准化处理，保留所有原始数据
    const standardized = data.map(item => {
      // 保留原始品牌名
      const brandName = item.brand || item.品牌 || '';
      
      // 获取原始价格
      const originalPrice = parseFloat(item.price || item.价格 || 0) || 0;
      
      // 调整价格 - 四舍五入到整数
      const adjustedPrice = Math.round(originalPrice * PRICE_ADJUSTMENT_RATE);
      
      // 只处理基本字段，确保ID、名称、价格、品牌等基础信息存在
      const result = {
        id: item._id || item.id || '',
        名称: item.name || item.名称 || item.型号 || '',
        原始价格: originalPrice, // 保存原始价格，以便后台需要时使用
        价格: adjustedPrice, // 使用调整后的价格
        品牌: brandName,
        
        // 直接复制所有原始数据到顶层，但是价格使用调整后的
        ...item,
        价格: adjustedPrice, // 确保顶层也使用调整后的价格
        
        // 额外保留一份原始数据，以便前端可以访问
        rawData: {...item, 价格: adjustedPrice} // 原始数据中使用调整后的价格
      };
      
      // 为了兼容性，保留英文字段，但不使其成为主要字段
      result.name = result.名称;
      result.originalPrice = result.原始价格;
      result.price = result.价格;
      result.brand = result.品牌;
      
      // 为了保持与之前版本的兼容性，仍然提供specs数组，但不过滤任何属性
      const specs = [];
      
      // 将所有非对象类型的字段添加到specs中，不过滤
      for (const key in item) {
        if (typeof item[key] !== 'object' && 
            key !== '_id' && key !== 'id') {
          
          const label = /[\u4e00-\u9fa5]/.test(key) ? key : key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
          
          // 如果是价格字段，使用调整后的价格
          let value = item[key];
          if (key === 'price' || key === '价格') {
            value = adjustedPrice;
          }
          
          specs.push({
            label: label,
            value: String(value === null || value === undefined ? '' : value)
          });
        }
      }
      
      // 确保specs中也有中文价格字段
      const hasPriceInSpecs = specs.some(spec => spec.label === '价格');
      if (!hasPriceInSpecs) {
        specs.push({
          label: '价格',
          value: String(adjustedPrice)
        });
      }
      
      // 保存specs数组，但不过滤
      result.specs = specs;
      
      return result;
    });
    
    console.log(`[云函数:标准化] ${type}数据标准化完成`);
    return standardized;
  } catch (error) {
    console.error(`[云函数:标准化] 标准化${type}数据时出错:`, error);
    // 如果出错，返回原始数据
    return data.map(item => ({
      ...item,
      id: item._id || item.id || '',
      rawData: item,
      // 确保即使出错也有中文字段
      名称: item.name || item.名称 || '',
      价格: parseFloat(item.price || item.价格 || 0) || 0,
      品牌: item.brand || item.品牌 || ''
    }));
  }
} 