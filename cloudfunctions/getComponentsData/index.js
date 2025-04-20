// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: cloud.DYNAMIC_CURRENT_ENV }) // 使用当前云环境

// 品牌名称标准化映射
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
    const { componentType, brand = 'all', limit = 100, fetchAll = false, mode } = event;
    
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

    // 特殊处理CPU和GPU组件
    if (componentType === 'cpu' || componentType === 'gpu') {
      return await queryWithBrandAnalysis(db, componentType, collectionName, brand, limit, fetchAll);
    }
    
    // 对所有其他组件，使用通用查询逻辑
    return await queryGenericComponent(db, componentType, collectionName, brand, limit, fetchAll);
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
 * 使用品牌分析的查询逻辑
 * 特别适用于CPU和GPU等有明确品牌分组的组件
 */
async function queryWithBrandAnalysis(db, componentType, collectionName, brand, limit, fetchAll) {
  console.log(`[云函数:品牌分析] 开始查询${componentType}数据，包含品牌分析`);
  
  try {
    // 首先检查集合中是否有数据
    const countResult = await db.collection(collectionName).count();
    if (countResult.total === 0) {
      console.log(`[云函数:品牌分析] ${collectionName}集合为空，快速返回`);
      return {
        code: 3,
        message: `${componentType}组件暂无数据`,
        data: [],
        brands: [],
        noDataAvailable: true
      };
    }
    
    // 1. 首先进行品牌分析，但限制记录数量以提高性能
    console.log(`[云函数:品牌分析] 开始分析${componentType}品牌分布`);
    const brandAnalysis = await db.collection(collectionName)
      .aggregate()
      .limit(100) // 限制聚合分析的数据量
      .group({
        _id: db.command.aggregate.cond({
          if: db.command.aggregate.gt(['$brand', null]),
          then: '$brand',
          else: db.command.aggregate.cond({
            if: db.command.aggregate.gt(['$品牌', null]),
            then: '$品牌',
            else: '未知'
          })
        }),
        count: db.command.aggregate.sum(1)
      })
      .end();
    
    // 提取品牌信息并标准化
    const brandStats = {};
    const brandsList = [];
    
    if (brandAnalysis.list && brandAnalysis.list.length > 0) {
      brandAnalysis.list.forEach(item => {
        if (item._id && item._id !== '未知') {
          // 标准化品牌名称
          const normalizedBrand = standardizeBrandName(item._id, componentType);
          
          // 累加相同品牌下的计数
          if (brandStats[normalizedBrand]) {
            brandStats[normalizedBrand] += item.count;
          } else {
            brandStats[normalizedBrand] = item.count;
            brandsList.push(normalizedBrand);
          }
        }
      });
    }
    
    console.log(`[云函数:品牌分析] ${componentType}品牌统计:`, brandStats);
    console.log(`[云函数:品牌分析] 检测到的品牌列表:`, brandsList);
    
    // 确保CPU类型总是包含英特尔和AMD
    if (componentType === 'cpu') {
      if (!brandsList.includes('英特尔')) {
        brandsList.push('英特尔');
        brandStats['英特尔'] = brandStats['英特尔'] || 0;
      }
      if (!brandsList.includes('AMD')) {
        brandsList.push('AMD');
        brandStats['AMD'] = brandStats['AMD'] || 0;
      }
    }
    
    // 如果是GPU，确保英伟达和AMD都在列表中
    if (componentType === 'gpu') {
      if (!brandsList.includes('英伟达')) {
        brandsList.push('英伟达');
        brandStats['英伟达'] = brandStats['英伟达'] || 0;
      }
      if (!brandsList.includes('AMD')) {
        brandsList.push('AMD');
        brandStats['AMD'] = brandStats['AMD'] || 0;
      }
    }
    
    // 检查是否所有品牌的计数为0，如果是，表示可能数据库有问题
    const allBrandsEmpty = Object.values(brandStats).every(count => count === 0);
    if (allBrandsEmpty && brandsList.length > 0) {
      console.log(`[云函数:品牌分析] 所有品牌计数为0，可能数据库格式有问题，尝试直接查询`);
      // 直接查询一批数据，不按品牌过滤
      const basicQuery = await db.collection(collectionName).limit(limit).get();
      if (basicQuery.data.length === 0) {
        console.log(`[云函数:品牌分析] 集合${collectionName}确实没有数据，快速返回`);
        return {
          code: 3,
          message: `${componentType}组件暂无数据`,
          data: [],
          brands: brandsList,
          noDataAvailable: true
        };
      }
    }
    
    // 2. 根据请求的品牌和品牌分析结果构建查询
    let finalData = [];
    const brandLog = {};
    
    // 如果请求特定品牌（非'all'）且不是fetchAll模式
    if (brand !== 'all' && !fetchAll) {
      // 标准化请求的品牌名称
      const requestedBrand = standardizeBrandName(brand, componentType);
      console.log(`[云函数:品牌分析] 请求查询品牌 ${brand}，标准化为: ${requestedBrand}`);
      
      // 如果品牌分析显示该品牌在数据库中计数为0且不是CPU或GPU的主要品牌，直接返回空结果
      if (brandStats[requestedBrand] === 0 && 
          !((componentType === 'cpu' && (requestedBrand === '英特尔' || requestedBrand === 'AMD')) ||
            (componentType === 'gpu' && (requestedBrand === '英伟达' || requestedBrand === 'AMD')))) {
        console.log(`[云函数:品牌分析] 品牌${requestedBrand}在数据库中没有记录，快速返回`);
        return {
          code: 0,
          message: `${requestedBrand}品牌暂无${componentType}数据`,
          data: [],
          brands: brandsList,
          brandStats: brandStats
        };
      }
      
      // 构建匹配条件（CPU和GPU有特殊处理）
      let matchCondition;
      if (componentType === 'cpu') {
        if (requestedBrand === '英特尔') {
          // 英特尔CPU匹配条件
          matchCondition = db.command.or([
            { brand: db.RegExp({ regexp: 'intel', options: 'i' }) },
            { 品牌: db.RegExp({ regexp: 'intel', options: 'i' }) },
            { 品牌: '英特尔' },
            { brand: '英特尔' },
            { name: db.RegExp({ regexp: 'intel|酷睿|core|i[3579]|奔腾|pentium|赛扬|celeron', options: 'i' }) },
            { 名称: db.RegExp({ regexp: 'intel|酷睿|core|i[3579]|奔腾|pentium|赛扬|celeron', options: 'i' }) }
          ]);
        } else if (requestedBrand === 'AMD') {
          // AMD CPU匹配条件
          matchCondition = db.command.or([
            { brand: db.RegExp({ regexp: 'amd', options: 'i' }) },
            { 品牌: db.RegExp({ regexp: 'amd', options: 'i' }) },
            { brand: 'AMD' },
            { 品牌: 'AMD' },
            { name: db.RegExp({ regexp: 'amd|ryzen|锐龙|r[3579]|athlon|速龙', options: 'i' }) },
            { 名称: db.RegExp({ regexp: 'amd|ryzen|锐龙|r[3579]|athlon|速龙', options: 'i' }) }
          ]);
        } else {
          // 其他品牌的通用匹配
          matchCondition = db.command.or([
            { brand: requestedBrand },
            { 品牌: requestedBrand },
            { brand: db.RegExp({ regexp: requestedBrand, options: 'i' }) },
            { 品牌: db.RegExp({ regexp: requestedBrand, options: 'i' }) }
          ]);
        }
      } else {
        // 其他组件的通用匹配
        matchCondition = db.command.or([
          { brand: requestedBrand },
          { 品牌: requestedBrand },
          { brand: db.RegExp({ regexp: requestedBrand, options: 'i' }) },
          { 品牌: db.RegExp({ regexp: requestedBrand, options: 'i' }) }
        ]);
      }
      
      // 执行查询
      const brandResult = await db.collection(collectionName)
        .where(matchCondition)
        .limit(limit)
        .get();
      
      console.log(`[云函数:品牌分析] ${requestedBrand}品牌查询结果: ${brandResult.data.length}条`);
      
      // 标准化数据
      if (brandResult.data.length > 0) {
        const brandData = standardizeData(brandResult.data, componentType);
        finalData = brandData;
        brandLog[requestedBrand] = brandData.length;
      } else {
        // 如果是主要品牌但没有匹配结果，尝试宽松匹配
        if ((componentType === 'cpu' && (requestedBrand === '英特尔' || requestedBrand === 'AMD')) ||
            (componentType === 'gpu' && (requestedBrand === '英伟达' || requestedBrand === 'AMD'))) {
          
          console.log(`[云函数:品牌分析] ${requestedBrand}是主要品牌但未找到匹配，尝试宽松匹配`);
          
          // 构建宽松匹配条件
          let looseMatchCondition;
          if (componentType === 'cpu') {
            if (requestedBrand === '英特尔') {
              looseMatchCondition = {
                name: db.RegExp({ regexp: 'intel|i[3579]|酷睿|core', options: 'i' })
              };
            } else if (requestedBrand === 'AMD') {
              looseMatchCondition = {
                name: db.RegExp({ regexp: 'amd|ryzen|r[3579]|锐龙', options: 'i' })
              };
            }
          } else if (componentType === 'gpu') {
            if (requestedBrand === '英伟达') {
              looseMatchCondition = {
                name: db.RegExp({ regexp: 'nvidia|geforce|rtx|gtx', options: 'i' })
              };
            } else if (requestedBrand === 'AMD') {
              looseMatchCondition = {
                name: db.RegExp({ regexp: 'amd|radeon|rx', options: 'i' })
              };
            }
          }
          
          if (looseMatchCondition) {
            const looseResult = await db.collection(collectionName)
              .where(looseMatchCondition)
              .limit(limit)
              .get();
            
            console.log(`[云函数:品牌分析] ${requestedBrand}宽松匹配结果: ${looseResult.data.length}条`);
            
            if (looseResult.data.length > 0) {
              const looseData = standardizeData(looseResult.data, componentType);
              finalData = looseData;
              brandLog[requestedBrand + '(宽松)'] = looseData.length;
            } else {
              // 宽松匹配也没结果，直接返回空数据
              console.log(`[云函数:品牌分析] ${requestedBrand}宽松匹配无结果，返回空数据和品牌列表`);
              return {
                code: 0,
                message: `未找到${requestedBrand}品牌的${componentType}`,
                data: [],
                brands: brandsList,
                brandStats: brandStats
              };
            }
          } else {
            // 不需要宽松匹配的品牌，直接返回空结果
            console.log(`[云函数:品牌分析] ${requestedBrand}无需宽松匹配，返回空结果`);
            return {
              code: 0,
              message: `未找到${requestedBrand}品牌的${componentType}`,
              data: [],
              brands: brandsList,
              brandStats: brandStats
            };
          }
        } else {
          // 非主要品牌，直接返回空结果
          console.log(`[云函数:品牌分析] ${requestedBrand}不是主要品牌，返回空结果`);
          return {
            code: 0,
            message: `未找到${requestedBrand}品牌的${componentType}`,
            data: [],
            brands: brandsList,
            brandStats: brandStats
          };
        }
      }
    } else {
      // 获取所有品牌的数据
      console.log(`[云函数:品牌分析] 获取所有${componentType}数据`);
      
      // 直接查询一定数量的数据，不做复杂过滤，提高性能
      const allResult = await db.collection(collectionName)
        .limit(limit)
        .get();
      
      console.log(`[云函数:品牌分析] 获取所有${componentType}数据: ${allResult.data.length}条`);
      
      if (allResult.data.length > 0) {
        const allData = standardizeData(allResult.data, componentType);
        finalData = allData;
        brandLog['all'] = allData.length;
      } else {
        // 没有数据，直接返回空结果
        console.log(`[云函数:品牌分析] 集合${collectionName}没有数据，返回空结果`);
        return {
          code: 3,
          message: `${componentType}组件暂无数据`,
          data: [],
          brands: brandsList,
          brandStats: brandStats,
          noDataAvailable: true
        };
      }
    }
    
    // 记录品牌查询结果
    console.log(`[云函数:品牌分析] 最终数据品牌分布:`, brandLog);
    
    // 返回数据以及品牌统计信息
    return {
      code: 0,
      message: '成功',
      data: finalData,
      brands: brandsList,
      brandStats: brandStats
    };
  } catch (error) {
    console.error(`[云函数:品牌分析] ${componentType}数据查询出错:`, error);
    return {
      code: 500,
      message: `${componentType}数据查询出错: ${error.message}`,
      data: []
    };
  }
}

/**
 * 通用组件数据查询
 * @param {Object} db - 数据库实例
 * @param {string} componentType - 组件类型
 * @param {string} collectionName - 集合名称
 * @param {string} brand - 品牌名称
 * @param {number} limit - 记录数限制
 * @param {boolean} fetchAll - 是否获取所有品牌
 */
async function queryGenericComponent(db, componentType, collectionName, brand, limit, fetchAll) {
  console.log(`[云函数:通用] 开始查询${componentType}数据, 品牌: ${brand}, 限制: ${limit}`);
  
  try {
    // 设置查询超时保护
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

    // 获取品牌列表
    const brandListPromise = getComponentBrands(db, collectionName);
    const brandList = await Promise.race([brandListPromise, timeout]);
    
    // 检查是否已经超时
    if (brandList.timeout) return brandList;
    console.log(`[云函数:通用] ${componentType}品牌列表:`, brandList);
    
    // 构建查询
    let query = db.collection(collectionName);
    
    // 如果指定了品牌且不是'all'，添加品牌过滤条件
    if (brand && brand !== 'all' && !fetchAll) {
      console.log(`[云函数:通用] 应用${componentType}品牌过滤: ${brand}`);
      
      // 尝试多种品牌字段匹配，因为不同数据源可能使用不同字段
      query = query.where(db.command.or([
        { brand: db.RegExp({ regexp: brand, options: 'i' }) },
        { 品牌: db.RegExp({ regexp: brand, options: 'i' }) },
        { brand: brand },
        { 品牌: brand },
        { name: db.RegExp({ regexp: brand, options: 'i' }) },
        { 名称: db.RegExp({ regexp: brand, options: 'i' }) }
      ]));
    }
    
    // 获取数据
    const queryPromise = query.limit(limit).get();
    const result = await Promise.race([queryPromise, timeout]);
    
    // 检查是否已经超时
    if (result.timeout) return result;
    console.log(`[云函数:通用] 查询完成，找到${result.data.length}条${componentType}记录`);
    
    // 如果没有找到数据并且指定了品牌，尝试获取所有数据
    if (result.data.length === 0 && brand !== 'all' && !fetchAll) {
      console.log(`[云函数:通用] 未找到${brand}品牌的${componentType}数据，尝试获取所有数据`);
      const allResultPromise = db.collection(collectionName).limit(limit).get();
      const allResult = await Promise.race([allResultPromise, timeout]);
      
      // 检查是否已经超时
      if (allResult.timeout) return allResult;
      
      if (allResult.data.length > 0) {
        console.log(`[云函数:通用] 获取到${allResult.data.length}条${componentType}数据`);
        const standardizedData = standardizeData(allResult.data, componentType);
        return {
          code: 0,
          message: `未找到特定品牌，返回所有${componentType}数据`,
          data: standardizedData,
          brands: brandList
        };
      } else {
        // 如果集合存在但没有数据，返回空数据而不是错误
        return {
          code: 3,
          message: `${componentType}组件暂无数据`,
          data: [],
          brands: [],
          noDataAvailable: true
        };
      }
    }
    
    // 标准化数据
    const standardizedData = standardizeData(result.data, componentType);
    
    // 返回结果
    return {
      code: 0,
      message: '成功',
      data: standardizedData,
      brands: brandList
    };
  } catch (error) {
    console.error(`[云函数:通用] ${componentType}查询出错:`, error);
    return {
      code: 500,
      message: `${componentType}查询出错: ${error.message}`,
      data: []
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
        // 标准化品牌名称
        const standardBrand = standardizeBrandName(brandName, '');
        if (standardBrand && !brandList.includes(standardBrand)) {
          brandList.push(standardBrand);
        }
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
    
    // 执行聚合查询获取品牌统计
    const brandAgg = await db.collection(collectionName)
      .aggregate()
      .group({
        _id: {
          brand: '$brand',
          brand2: '$品牌'
        },
        count: db.command.aggregate.sum(1)
      })
      .end();
    
    console.log(`[云函数:品牌统计] ${componentType}品牌聚合结果:`, brandAgg);
    
    // 提取有效的品牌名称和计数
    const brandStats = [];
    brandAgg.list.forEach(item => {
      let brandName = '';
      
      if (item._id.brand) {
        brandName = item._id.brand;
      } else if (item._id.brand2) {
        brandName = item._id.brand2;
      }
      
      if (brandName) {
        // 特殊处理Intel品牌名称
        if (brandName.toLowerCase() === 'intel') {
          brandName = '英特尔';
        }
        
        // 如果品牌包含括号，只保留括号前的部分
        if (brandName.includes('(')) {
          brandName = brandName.split('(')[0].trim();
        }
        
        // 添加到结果列表
        brandStats.push({
          brandName: brandName,
          displayName: brandName,
          count: item.count
        });
      }
    });
    
    // 确保CPU类型总是包含英特尔和AMD
    if (componentType === 'cpu') {
      const hasIntel = brandStats.some(b => b.brandName === '英特尔');
      const hasAMD = brandStats.some(b => b.brandName === 'AMD');
      
      if (!hasIntel) {
        brandStats.push({ brandName: '英特尔', displayName: '英特尔', count: 0 });
      }
      
      if (!hasAMD) {
        brandStats.push({ brandName: 'AMD', displayName: 'AMD', count: 0 });
      }
    }
    
    console.log(`[云函数:品牌统计] ${componentType}品牌统计完成，共${brandStats.length}个品牌`);
        
        return {
      code: 0,
      message: '成功',
      data: {
        brands: brandStats
      }
    };
  } catch (error) {
    console.error(`[云函数:品牌统计] ${componentType}品牌统计出错:`, error);
    
    // 确保即使出错也返回基本的品牌数据（对CPU特别处理）
    if (componentType === 'cpu') {
      return {
        code: 0,
        message: '使用默认品牌数据',
        data: {
          brands: [
            { brandName: '英特尔', displayName: '英特尔', count: 1 },
            { brandName: 'AMD', displayName: 'AMD', count: 1 }
          ]
        }
      };
    }
    
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
  
  try {
    // 对数据进行标准化处理
    const standardized = data.map(item => {
      // 基本字段标准化
      const result = {
        id: item._id || item.id || '',
        name: item.name || item.名称 || item.型号 || '',
        price: parseFloat(item.price || item.价格 || 0) || 0,
        // 标准化品牌名称
        brand: standardizeBrandName(item.brand || item.品牌 || '', type),
        // 保留原始数据，确保前端可以访问所有属性
        rawData: item
      };
      
      // 根据组件类型处理特殊字段
      if (type === 'cpu') {
        // CPU特殊字段
        result.socket = item.socket || item.接口 || '';
        // 扩展CPU规格列表，确保显示更多参数
        result.specs = [
          { label: '核心数', value: item.cores || item.核心数 || item.core_count || '' },
          { label: '线程数', value: item.threads || item.线程数 || item.thread_count || '' },
          { label: '基础频率', value: item.frequency || item.频率 || item.base_frequency || '' },
          { label: '加速频率', value: item.boost_frequency || item.加速频率 || item.turbo_frequency || '' },
          { label: '缓存', value: item.cache || item.缓存 || '' },
          { label: '功耗', value: item.tdp || item.功耗 || '' },
          { label: '制程', value: item.process || item.制程 || '' },
          { label: '发布时间', value: item.release_date || item.发布时间 || '' }
        ].filter(spec => spec.value); // 过滤掉没有值的规格
      } else if (type === 'motherboard') {
        // 主板特殊字段
        result.socket = item.socket || item.接口 || '';
        result.chipset = item.chipset || item.芯片组 || '';
        result.specs = [
          { label: '芯片组', value: item.chipset || item.芯片组 || '' },
          { label: '内存插槽', value: item.memory_slots || item.内存插槽 || '' },
          { label: '内存类型', value: item.memory_type || item.内存类型 || '' },
          { label: 'M.2', value: (item.m2_slots || item.M2接口 || '0') + '个' },
          { label: 'SATA接口', value: item.sata_ports || item.SATA接口 || '' },
          { label: 'PCI-E插槽', value: item.pcie_slots || item.PCI插槽 || '' },
          { label: '板型', value: item.form_factor || item.板型 || '' },
          { label: 'USB接口', value: item.usb_ports || item.USB接口 || '' }
        ].filter(spec => spec.value);
      } else if (type === 'ram' || type === 'memory') {
        // 内存特殊字段
        result.specs = [
          { label: '容量', value: item.capacity || item.容量 || '' },
          { label: '频率', value: item.frequency || item.频率 || '' },
          { label: '类型', value: item.type || item.类型 || 'DDR4' },
          { label: '延迟', value: item.latency || item.时序 || item.延迟 || '' },
          { label: '电压', value: item.voltage || item.电压 || '' },
          { label: '散热片', value: item.heatsink || item.散热片 ? '有' : '无' }
        ].filter(spec => spec.value);
      } else if (type === 'gpu') {
        // 显卡特殊字段
        result.specs = [
          { label: '显存', value: item.vram || item.显存 || '' },
          { label: '显存类型', value: item.vram_type || item.显存类型 || '' },
          { label: '核心频率', value: item.core_clock || item.核心频率 || '' },
          { label: '显存频率', value: item.memory_clock || item.显存频率 || '' },
          { label: '接口', value: item.interface || item.接口 || 'PCIe' },
          { label: '功耗', value: item.tdp || item.功耗 || '' },
          { label: '供电接口', value: item.power_connectors || item.供电接口 || '' },
          { label: '长度', value: item.length || item.长度 || '' }
        ].filter(spec => spec.value);
      } else if (type === 'storage' || type === 'disk') {
        // 存储设备特殊字段
        result.specs = [
          { label: '容量', value: item.capacity || item.容量 || '' },
          { label: '类型', value: item.type || item.类型 || 'SSD' },
          { label: '接口', value: item.interface || item.接口 || 'SATA' },
          { label: '读取速度', value: item.read_speed || item.读取速度 || '' },
          { label: '写入速度', value: item.write_speed || item.写入速度 || '' },
          { label: '缓存', value: item.cache || item.缓存 || '' },
          { label: 'TBW', value: item.tbw || item.TBW || '' }
        ].filter(spec => spec.value);
      } else if (type === 'psu' || type === 'power') {
        // 电源特殊字段
        result.specs = [
          { label: '功率', value: item.wattage || item.功率 || '' },
          { label: '认证', value: item.certification || item.认证 || '' },
          { label: '模组化', value: item.modular || item.模组化 || '' },
          { label: '风扇尺寸', value: item.fan_size || item.风扇尺寸 || '' },
          { label: '效率', value: item.efficiency || item.效率 || '' },
          { label: '保修', value: item.warranty || item.保修 || '' }
        ].filter(spec => spec.value);
      } else if (type === 'case') {
        // 机箱特殊字段
        result.specs = [
          { label: '类型', value: item.type || item.类型 || '' },
          { label: '支持板型', value: item.motherboard_support || item.支持板型 || '' },
          { label: '尺寸', value: item.dimensions || item.尺寸 || '' },
          { label: '扩展槽数', value: item.expansion_slots || item.扩展槽 || '' },
          { label: '硬盘位', value: item.drive_bays || item.硬盘位 || '' },
          { label: '侧板', value: item.side_panel || item.侧板 || '' },
          { label: 'USB接口', value: item.usb_ports || item.USB接口 || '' }
        ].filter(spec => spec.value);
      } else if (type === 'cooling' || type === 'cooler') {
        // 散热器特殊字段
        result.specs = [
          { label: '类型', value: item.type || item.类型 || '' },
          { label: '风扇尺寸', value: item.fan_size || item.风扇尺寸 || '' },
          { label: '风扇数量', value: item.fan_count || item.风扇数量 || '' },
          { label: '噪音水平', value: item.noise_level || item.噪音 || '' },
          { label: '转速', value: item.rpm || item.转速 || '' },
          { label: '兼容接口', value: item.socket_compatibility || item.兼容接口 || '' },
          { label: '散热方式', value: item.cooling_method || item.散热方式 || '' }
        ].filter(spec => spec.value);
      } else if (type === 'monitor') {
        // 显示器特殊字段
        result.specs = [
          { label: '分辨率', value: item.resolution || item.分辨率 || '' },
          { label: '尺寸', value: item.size || item.尺寸 || '' },
          { label: '刷新率', value: item.refresh_rate || item.刷新率 || '' },
          { label: '面板类型', value: item.panel_type || item.面板类型 || '' },
          { label: '响应时间', value: item.response_time || item.响应时间 || '' },
          { label: '接口', value: item.connectivity || item.接口 || '' },
          { label: 'HDR', value: item.hdr || item.HDR || '' },
          { label: '亮度', value: item.brightness || item.亮度 || '' }
        ].filter(spec => spec.value);
      } else {
        // 其他组件通用处理
        // 尝试从原始数据中提取可能的规格信息
        result.specs = [];
        
        // 尝试从原始数据中提取规格
        for (const key in item) {
          if (key !== 'id' && key !== '_id' && key !== 'name' && key !== '名称' && 
              key !== 'brand' && key !== '品牌' && key !== 'price' && key !== '价格') {
            
            // 跳过对象类型的属性
            if (typeof item[key] === 'object') continue;
            
            // 格式化属性名，去掉下划线，首字母大写
            let label = key.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase());
            
            // 如果是中文属性，直接使用
            if (/[\u4e00-\u9fa5]/.test(key)) {
              label = key;
            }
            
            result.specs.push({
              label: label,
              value: String(item[key])
            });
          }
        }
        
        // 尝试从原始数据中的specs或规格字段提取信息
        const possibleSpecFields = ['规格', 'specs', '参数'];
        
        for (const field of possibleSpecFields) {
          if (item[field] && typeof item[field] === 'object') {
            // 如果有规格字段且是对象，转换为数组
            const specs = Object.entries(item[field]).map(([key, value]) => ({
              label: key,
              value: String(value)
            }));
            // 合并规格
            result.specs = [...result.specs, ...specs];
            break;
          }
        }
      }
      
      // 排序规格，确保最重要的规格靠前显示
      if (result.specs && result.specs.length > 0) {
        const importantLabels = {
          'cpu': ['核心数', '线程数', '基础频率', '加速频率', '功耗', '缓存'],
          'gpu': ['显存', '显存类型', '核心频率', '功耗'],
          'ram': ['容量', '频率', '类型', '延迟'],
          'motherboard': ['芯片组', '内存插槽', 'M.2', 'SATA接口'],
          'storage': ['容量', '类型', '接口', '读取速度', '写入速度'],
          'psu': ['功率', '认证', '模组化'],
          'case': ['类型', '支持板型', '尺寸'],
          'cooling': ['类型', '风扇尺寸', '散热方式'],
          'monitor': ['分辨率', '尺寸', '刷新率', '面板类型']
        };
        
        const typeLabels = importantLabels[type] || [];
        
        // 按照重要性排序规格
        if (typeLabels.length > 0) {
          result.specs.sort((a, b) => {
            const indexA = typeLabels.indexOf(a.label);
            const indexB = typeLabels.indexOf(b.label);
            
            // 如果两个标签都在重要标签列表中，按列表顺序排序
            if (indexA !== -1 && indexB !== -1) {
              return indexA - indexB;
            }
            
            // 如果只有一个在列表中，将其排在前面
            if (indexA !== -1) return -1;
            if (indexB !== -1) return 1;
            
            // 如果都不在列表中，维持原顺序
            return 0;
          });
        }
      }
      
      return result;
    });
    
    console.log(`[云函数:标准化] ${type}数据标准化完成`);
    return standardized;
  } catch (error) {
    console.error(`[云函数:标准化] 标准化${type}数据时出错:`, error);
    // 尝试进行基本的转换
    return data.map(item => ({
      id: item._id || item.id || '',
      name: item.name || item.名称 || item.型号 || '',
      brand: item.brand || item.品牌 || '',
      price: parseFloat(item.price || item.价格 || 0) || 0,
      type: type,
      rawData: item,
      specs: []
    }));
  }
}

/**
 * 标准化品牌名称
 * @param {string} brand - 原始品牌名称
 * @param {string} type - 组件类型
 * @returns {string} 标准化后的品牌名称
 */
function standardizeBrandName(brand, type) {
  if (!brand) return '';
  
  // 转换为小写进行比较
  const lowerBrand = brand.toLowerCase();
  
  // 如果品牌包含括号，只保留括号前的部分
  let processedBrand = brand;
  if (brand.includes('(')) {
    processedBrand = brand.split('(')[0].trim();
  }
  
  // 为CPU特殊处理品牌名称
  if (type === 'cpu') {
    if (lowerBrand.includes('intel') || lowerBrand === 'inter') {
      return '英特尔';
    } else if (lowerBrand.includes('amd')) {
      return 'AMD';
    }
  }
  
  // 其他品牌映射
  const brandMapping = {
    'intel': '英特尔',
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
  
  // 查找映射
  for (const [key, value] of Object.entries(brandMapping)) {
    if (lowerBrand.includes(key)) {
      return value;
    }
  }
  
  // 如果没有匹配，返回原始品牌
  return processedBrand;
} 