// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({ env: 'your-cloud-env-id' })
const db = cloud.database()

// 获取组件集合名称
function getCollectionName(componentType) {
  // 根据组件类型返回对应的集合名称，确保与getComponentsData保持一致
  const collectionMap = {
    'cpu': 'cpu_data',
    'motherboard': 'motherboard_data',
    'cooling': 'cooler_data',
    'cooler': 'cooler_data',     // 增加cooler别名兼容
    'memory': 'memory_data',
    'ram': 'memory_data',        // 增加ram别名兼容
    'storage': 'disk_data',
    'disk': 'disk_data',         // 增加disk别名兼容
    'gpu': 'gpu_data',
    'case': 'case_data',
    'psu': 'power_data',
    'power': 'power_data'        // 增加power别名兼容
  };
  return collectionMap[componentType] || componentType;
}

// 检查集合是否存在且有数据
async function checkCollectionExists(collectionName) {
  try {
    const countResult = await db.collection(collectionName).count();
    return {
      exists: true,
      count: countResult.total
    };
  } catch (error) {
    console.error(`检查集合 ${collectionName} 时出错:`, error);
    return {
      exists: false,
      error: error
    };
  }
}

// 确保数据格式统一，保持_id和id字段，确保不丢失品牌和名称
function ensureDataFormat(data) {
  if (!Array.isArray(data)) return [];
  
  return data.map(item => {
    // 如果没有id字段但有_id字段，复制_id到id
    if (!item.id && item._id) {
      item.id = item._id;
    }
    
    // 确保specs字段格式一致
    if (item.specs && !Array.isArray(item.specs)) {
      // 如果specs不是数组而是对象，转换为数组格式
      const specsArray = [];
      for (const key in item.specs) {
        specsArray.push({
          label: key,
          value: item.specs[key]
        });
      }
      item.specs = specsArray;
    } else if (!item.specs) {
      // 如果没有specs字段，尝试从其他可能的字段提取规格信息
      item.specs = [];
      
      // 排除这些通用字段，不把它们当作规格
      const excludedFields = ['id', '_id', 'name', 'brand', 'price', 'image', 'brandLogo', 'createdAt', 'updatedAt'];
      
      for (const key in item) {
        if (!excludedFields.includes(key) && typeof item[key] !== 'object' && item[key] !== null) {
          item.specs.push({
            label: key,
            value: item[key]
          });
        }
      }
    }
    
    // 确保基本字段存在
    if (!item.brand) item.brand = '未知品牌';
    if (!item.name) item.name = `未命名${item.id}`;
    if (!item.price) item.price = '*';
    
    return item;
  });
}

// 从组件中提取Socket信息
function extractSocketInfo(component) {
  if (!component) return null;
  
  // 同时检查多个可能的字段名称
  const socketValue = component.接口 || component.socket || '';
  
  // 如果找到值，进行规范化处理
  if (socketValue) {
    // 规范化接口字符串（去除空格，转换为大写）
    return socketValue.replace(/\s+/g, '').toUpperCase();
  }
  
  return null;
}

// 从组件中提取内存类型
function extractMemoryType(component) {
  if (!component) return null;
  
  // 直接使用接口类型字段
  if (component.接口类型) {
    return component.接口类型;
  }
  
  // 从主板的内存插槽字段中提取内存类型部分
  if (component.内存插槽) {
    const memSlotMatch = component.内存插槽.match(/\d+\s*[\*×xX]\s*([DdRr]\d+)/);
    if (memSlotMatch) {
      return memSlotMatch[1].toUpperCase();
    }
  }
  
  return null;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { componentType, selectedComponents } = event
  
  try {
    console.log('请求兼容性过滤:', componentType, selectedComponents);
    
    // 获取组件对应的集合名称
    const collectionName = getCollectionName(componentType);
    console.log('访问集合:', collectionName);
    
    // 检查集合是否存在且有数据
    const collectionCheck = await checkCollectionExists(collectionName);
    if (!collectionCheck.exists) {
      console.error(`集合 ${collectionName} 不存在`);
      return {
        success: false,
        error: `${componentType} 组件集合不存在`,
        data: []
      };
    }
    
    if (collectionCheck.count === 0) {
      console.warn(`集合 ${collectionName} 没有数据`);
      return {
        success: true,
        data: [],
        message: `${componentType} 组件没有数据`
      };
    }
    
    // 从对应集合获取所有该类型的组件
    const allComponents = await db.collection(collectionName).get();
    
    // 如果没有选择其他组件，直接返回所有组件
    if (!selectedComponents || Object.keys(selectedComponents).length === 0) {
      const formattedData = ensureDataFormat(allComponents.data);
      return { 
        success: true,
        data: formattedData,
        message: `获取${formattedData.length}个组件数据`
      }
    }
    
    // 根据组件类型执行不同的兼容性检查
    let compatibleItems = allComponents.data
    
    // CPU与主板兼容性检查
    if (componentType === 'motherboard' && selectedComponents.cpu) {
      console.log('检查CPU与主板兼容性');
      
      // 获取已选CPU的socket类型
      const cpuCollectionName = getCollectionName('cpu');
      // 检查CPU集合是否存在
      const cpuCollectionCheck = await checkCollectionExists(cpuCollectionName);
      if (!cpuCollectionCheck.exists) {
        console.error(`CPU集合 ${cpuCollectionName} 不存在`);
        return {
          success: false,
          error: `CPU组件集合不存在`,
          data: []
        };
      }
      
      try {
        const cpuData = await db.collection(cpuCollectionName)
          .doc(selectedComponents.cpu)
          .get();
        
        // 尝试提取CPU的Socket信息
        const cpuSocket = extractSocketInfo(cpuData.data);
        console.log('提取到的CPU Socket:', cpuSocket);
        
        if (cpuSocket) {
          // 过滤支持该socket的主板
          compatibleItems = compatibleItems.filter(motherboard => {
            const mbSocket = extractSocketInfo(motherboard);
            console.log(`主板: ${motherboard.name}, Socket: ${mbSocket}`);
            return mbSocket && mbSocket === cpuSocket;
          });
          
          console.log(`过滤后剩余${compatibleItems.length}个兼容主板`);
        } else {
          console.warn('无法从CPU中提取Socket信息');
        }
      } catch (error) {
        console.error('获取CPU数据时出错:', error);
        return {
          success: false,
          error: `无法获取CPU数据: ${error.message}`,
          data: []
        };
      }
    }
    
    // 反向检查：选择主板时，过滤兼容的CPU
    if (componentType === 'cpu' && selectedComponents.motherboard) {
      console.log('检查主板与CPU兼容性');
      
      // 获取已选主板支持的socket类型
      const motherboardCollectionName = getCollectionName('motherboard');
      // 检查主板集合是否存在
      const mbCollectionCheck = await checkCollectionExists(motherboardCollectionName);
      if (!mbCollectionCheck.exists) {
        console.error(`主板集合 ${motherboardCollectionName} 不存在`);
        return {
          success: false,
          error: `主板组件集合不存在`,
          data: []
        };
      }
      
      try {
        const motherboardData = await db.collection(motherboardCollectionName)
          .doc(selectedComponents.motherboard)
          .get();
        
        // 尝试提取主板的Socket信息
        const motherboardSocket = extractSocketInfo(motherboardData.data);
        console.log('提取到的主板Socket:', motherboardSocket);
        
        if (motherboardSocket) {
          // 过滤socket兼容的CPU
          compatibleItems = compatibleItems.filter(cpu => {
            const cpuSocket = extractSocketInfo(cpu);
            return cpuSocket && cpuSocket === motherboardSocket;
          });
          
          console.log(`过滤后剩余${compatibleItems.length}个兼容CPU`);
        } else {
          console.warn('无法从主板中提取Socket信息');
        }
      } catch (error) {
        console.error('获取主板数据时出错:', error);
        return {
          success: false,
          error: `无法获取主板数据: ${error.message}`,
          data: []
        };
      }
    }
    
    // 内存与主板兼容性检查
    if ((componentType === 'memory' || componentType === 'ram') && selectedComponents.motherboard) {
      console.log('检查内存与主板兼容性');
      
      // 获取已选主板支持的内存类型
      const motherboardCollectionName = getCollectionName('motherboard');
      try {
        const motherboardData = await db.collection(motherboardCollectionName)
          .doc(selectedComponents.motherboard)
          .get();
        
        // 尝试提取主板支持的内存类型
        const motherboardMemoryType = extractMemoryType(motherboardData.data);
        console.log('主板支持的内存类型:', motherboardMemoryType);
        
        if (motherboardMemoryType) {
          // 过滤类型兼容的内存
          compatibleItems = compatibleItems.filter(memory => {
            const memoryType = extractMemoryType(memory);
            return memoryType && memoryType === motherboardMemoryType;
          });
          
          console.log(`过滤后剩余${compatibleItems.length}个兼容内存`);
        } else {
          console.warn('无法从主板中提取内存类型信息');
        }
      } catch (error) {
        console.error('获取主板数据时出错:', error);
        return {
          success: false,
          error: `无法获取主板数据: ${error.message}`,
          data: []
        };
      }
    }
    
    // 确保所有项目的数据格式一致，特别是不丢失品牌和名称
    const formattedCompatibleItems = ensureDataFormat(compatibleItems);
    
    return { 
      success: true,
      data: formattedCompatibleItems,
      message: `找到${formattedCompatibleItems.length}个兼容组件`
    }
  } catch (error) {
    console.error('兼容性检查出错:', error);
    return {
      success: false,
      error: error.message || '兼容性检查失败',
      data: [] // 返回空数组而不是null，避免前端处理错误
    }
  }
} 