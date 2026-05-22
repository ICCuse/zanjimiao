const cloud = require('wx-server-sdk')

cloud.init({
  env: 'your-cloud-env-id'
})

// 初始化云数据库
const db = cloud.database()
const _ = db.command
const componentsCollection = db.collection('components')

// 获取组件列表
async function getComponentsList(type) {
  try {
    let query = componentsCollection;
    
    // 如果指定了类型，则添加筛选条件
    if (type && type !== 'all') {
      query = query.where({
        type: type
      });
    }
    
    // 获取组件总数
    const countResult = await query.count();
    const total = countResult.total;
    
    // 分批获取所有数据
    const MAX_LIMIT = 100;
    const batchTimes = Math.ceil(total / MAX_LIMIT);
    const tasks = [];
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = query.skip(i * MAX_LIMIT).limit(MAX_LIMIT).get();
      tasks.push(promise);
    }
    
    // 等待所有查询完成
    const results = await Promise.all(tasks);
    
    // 合并查询结果
    const components = [];
    results.forEach(result => {
      components.push(...result.data);
    });
    
    return {
      success: true,
      components: components
    };
  } catch (error) {
    console.error('获取组件列表失败:', error);
    return {
      success: false,
      error: error.message || '获取组件列表失败'
    };
  }
}

// 确保admin_settings集合存在
async function ensureAdminSettings() {
  try {
    const settingsCollection = db.collection('admin_settings');
    const result = await settingsCollection.limit(1).get();
    
    if (result.data.length === 0) {
      // 添加默认记录
      await settingsCollection.add({
        data: {
          appKey: '',
          appSecret: '',
          createdAt: Date.now(),
          updatedAt: Date.now()
        }
      });
    }
    
    return true;
  } catch (error) {
    console.error('创建admin_settings失败:', error);
    throw error;
  }
}

// 从数据库获取京东API配置
async function getJDConfig() {
  try {
    // 确保admin_settings集合存在
    await ensureAdminSettings();
    
    // 获取京东API配置
    const settingsCollection = db.collection('admin_settings');
    const result = await settingsCollection.limit(1).get();
    
    if (result.data.length > 0) {
      const settings = result.data[0];
      return {
        success: true,
        appKey: settings.appKey || '',
        appSecret: settings.appSecret || ''
      };
    } else {
      return {
        success: false,
        error: '未找到配置信息'
      };
    }
  } catch (error) {
    console.error('获取京东API配置失败:', error);
    return {
      success: false,
      error: error.message || '获取配置失败'
    };
  }
}

// 更新SKU ID
async function updateSkuId(event) {
  const { componentId, data } = event;
  
  if (!componentId) {
    return {
      success: false,
      error: '缺少组件ID'
    };
  }
  
  try {
    await componentsCollection.doc(componentId).update({
      data: {
        skuId: data.skuId,
        lastPriceUpdate: null  // 清除上次价格更新时间
      }
    });
    
    return {
      success: true,
      message: 'SKU关联成功'
    };
  } catch (error) {
    console.error('更新SKU ID失败:', error);
    return {
      success: false,
      error: error.message || '更新SKU ID失败'
    };
  }
}

// 创建测试组件数据
async function createTestComponents(event) {
  try {
    // 测试组件数据
    const testComponents = [
      {
        name: '英特尔 酷睿 i5-12400F',
        brand: 'Intel',
        model: 'Core i5-12400F',
        type: 'cpu',
        price: 1099,
        description: '6核12线程 台式机处理器',
        skuId: '100016034372',
        createdAt: Date.now()
      },
      {
        name: '华硕 TUF GAMING B660M-PLUS',
        brand: 'ASUS',
        model: 'TUF GAMING B660M-PLUS',
        type: 'motherboard',
        price: 1199,
        description: 'Intel B660芯片组 mATX主板',
        skuId: '100027465981',
        createdAt: Date.now()
      },
      {
        name: '金士顿 FURY Beast DDR4 3200MHz',
        brand: 'Kingston',
        model: 'FURY Beast DDR4',
        type: 'ram',
        price: 259,
        description: '8GB DDR4 3200MHz 台式机内存',
        createdAt: Date.now(),
        supplierPrice: 210
      }
    ];
    
    // 添加到数据库
    const addPromises = testComponents.map(comp => {
      return componentsCollection.add({
        data: comp
      });
    });
    
    const results = await Promise.all(addPromises);
    
    return {
      success: true,
      message: `成功创建了 ${results.length} 个测试组件`,
      components: results
    };
  } catch (error) {
    console.error('创建测试组件失败:', error);
    return {
      success: false,
      error: error.message || '创建测试组件失败'
    };
  }
}

// 触发价格更新
async function triggerPriceUpdate(event) {
  // 从event中获取priceSource参数，默认为jdApi
  const priceSource = event.priceSource || 'jdApi';
  
  console.log(`触发价格更新云函数，使用价格来源: ${priceSource}`);
  
  try {
    // 调用价格更新云函数，传递价格来源参数
    const result = await cloud.callFunction({
      name: 'updateComponentsPrice',
      data: {
        priceSource
      }
    });
    
    return {
      success: true,
      message: '价格更新触发成功',
      result: result.result
    };
  } catch (error) {
    console.error('触发价格更新失败:', error);
    return {
      success: false,
      error: error.message || '触发价格更新失败',
      stack: error.stack
    };
  }
}

// 更新组件属性
async function updateComponent(event) {
  const { componentId, data } = event;
  
  if (!componentId) {
    return {
      success: false,
      error: '缺少组件ID'
    };
  }
  
  try {
    // 更新组件数据
    await db.collection('components').doc(componentId).update({
      data: data
    });
    
    return {
      success: true,
      message: '组件更新成功'
    };
  } catch (error) {
    console.error('更新组件失败:', error);
    return {
      success: false,
      error: error.message || '更新组件失败'
    };
  }
}

// 云函数入口函数
exports.main = async (event, context) => {
  // 从event获取action参数
  const { action } = event;
  
  // 根据action执行不同的操作
  switch (action) {
    case 'getJDConfig':
      return await getJDConfig();
    
    case 'getComponents':
      return await getComponentsList(event.type);
    
    case 'updateSkuId':
      return await updateSkuId(event);
    
    case 'createTestComponents':
      return await createTestComponents(event);
    
    case 'triggerPriceUpdate':
      return await triggerPriceUpdate(event);
    
    case 'updateComponent':
      return await updateComponent(event);
      
    default:
      return {
        success: false,
        error: `未知的操作: ${action}`
      };
  }
}; 