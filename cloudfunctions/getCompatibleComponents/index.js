// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'pcconfig-7grn6s1naf2b91d9' // 使用正确的云环境ID
})

const db = cloud.database()

// 获取组件集合名称
function getCollectionName(componentType) {
  // 根据组件类型返回对应的集合名称
  const collectionMap = {
    'cpu': 'cpu_data',
    'motherboard': 'motherboard_data',
    'cooling': 'cooler_data',
    'memory': 'memory_data',
    'storage': 'disk_data',
    'gpu': 'gpu_data',
    'case': 'case_data',
    'psu': 'power_data'
  };
  return collectionMap[componentType] || componentType;
}

// 云函数入口函数
exports.main = async (event, context) => {
  const { componentType, selectedComponents } = event
  
  try {
    console.log('请求兼容性过滤:', componentType, selectedComponents);
    
    // 获取组件对应的集合名称
    const collectionName = getCollectionName(componentType);
    console.log('访问集合:', collectionName);
    
    // 从对应集合获取所有该类型的组件
    const allComponents = await db.collection(collectionName).get();
    
    // 如果没有选择其他组件，直接返回所有组件
    if (!selectedComponents || Object.keys(selectedComponents).length === 0) {
      return { 
        success: true,
        data: allComponents.data 
      }
    }
    
    // 根据组件类型执行不同的兼容性检查
    let compatibleItems = allComponents.data
    
    // CPU与主板兼容性检查
    if (componentType === 'motherboard' && selectedComponents.cpu) {
      console.log('检查CPU与主板兼容性');
      
      // 获取已选CPU的socket类型
      const cpuData = await db.collection('cpu_data')
        .doc(selectedComponents.cpu)
        .get()
      
      if (cpuData.data && cpuData.data.socket) {
        const cpuSocket = cpuData.data.socket;
        console.log('CPU Socket:', cpuSocket);
        
        // 过滤支持该socket的主板
        compatibleItems = compatibleItems.filter(motherboard => 
          motherboard.socket && 
          motherboard.socket.toLowerCase() === cpuSocket.toLowerCase()
        );
        
        console.log(`过滤后剩余${compatibleItems.length}个兼容主板`);
      }
    }
    
    // 反向检查：选择主板时，过滤兼容的CPU
    if (componentType === 'cpu' && selectedComponents.motherboard) {
      console.log('检查主板与CPU兼容性');
      
      // 获取已选主板支持的socket类型
      const motherboardData = await db.collection('motherboard_data')
        .doc(selectedComponents.motherboard)
        .get()
      
      if (motherboardData.data && motherboardData.data.socket) {
        const motherboardSocket = motherboardData.data.socket;
        console.log('主板Socket:', motherboardSocket);
        
        // 过滤socket兼容的CPU
        compatibleItems = compatibleItems.filter(cpu => 
          cpu.socket && cpu.socket.toLowerCase() === motherboardSocket.toLowerCase()
        );
        
        console.log(`过滤后剩余${compatibleItems.length}个兼容CPU`);
      }
    }
    
    // CPU与散热器兼容性检查
    if (componentType === 'cooling' && selectedComponents.cpu) {
      console.log('检查CPU与散热器兼容性');
      
      // 获取已选CPU的socket类型
      const cpuData = await db.collection('cpu_data')
        .doc(selectedComponents.cpu)
        .get()
      
      if (cpuData.data && cpuData.data.socket) {
        const cpuSocket = cpuData.data.socket;
        console.log('CPU Socket:', cpuSocket);
        
        // 过滤支持该socket的散热器
        compatibleItems = compatibleItems.filter(cooler => 
          cooler.supportedSockets && 
          cooler.supportedSockets.includes(cpuSocket)
        );
        
        console.log(`过滤后剩余${compatibleItems.length}个兼容散热器`);
      }
    }
    
    // 反向检查：选择散热器时，过滤兼容的CPU
    if (componentType === 'cpu' && selectedComponents.cooling) {
      console.log('检查散热器与CPU兼容性');
      
      // 获取已选散热器支持的socket类型
      const coolerData = await db.collection('cooler_data')
        .doc(selectedComponents.cooling)
        .get()
      
      if (coolerData.data && coolerData.data.supportedSockets) {
        const supportedSockets = coolerData.data.supportedSockets;
        console.log('散热器支持的Socket:', supportedSockets);
        
        // 过滤socket兼容的CPU
        compatibleItems = compatibleItems.filter(cpu => 
          cpu.socket && supportedSockets.includes(cpu.socket)
        );
        
        console.log(`过滤后剩余${compatibleItems.length}个兼容CPU`);
      }
    }
    
    // 显卡与机箱兼容性检查
    if (componentType === 'gpu' && selectedComponents.case) {
      console.log('检查显卡与机箱兼容性');
      
      // 获取已选机箱的详细信息
      const caseData = await db.collection('case_data')
        .doc(selectedComponents.case)
        .get()
      
      if (caseData.data && caseData.data.maxGpuLength) {
        const maxGpuLength = caseData.data.maxGpuLength;
        console.log('机箱最大显卡长度:', maxGpuLength);
        
        // 过滤长度兼容的显卡
        compatibleItems = compatibleItems.filter(gpu => 
          !gpu.length || gpu.length <= maxGpuLength
        );
        
        console.log(`过滤后剩余${compatibleItems.length}个兼容显卡`);
      }
    }
    
    // 反向检查：选择显卡时，过滤兼容的机箱
    if (componentType === 'case' && selectedComponents.gpu) {
      console.log('检查机箱与显卡兼容性');
      
      // 获取已选显卡的长度
      const gpuData = await db.collection('gpu_data')
        .doc(selectedComponents.gpu)
        .get()
      
      if (gpuData.data && gpuData.data.length) {
        const gpuLength = gpuData.data.length;
        console.log('显卡长度:', gpuLength);
        
        // 过滤能容纳该显卡的机箱
        compatibleItems = compatibleItems.filter(caseItem => 
          !caseItem.maxGpuLength || caseItem.maxGpuLength >= gpuLength
        );
        
        console.log(`过滤后剩余${compatibleItems.length}个兼容机箱`);
      }
    }
    
    // 电源功率兼容性检查
    if (componentType === 'psu' && (selectedComponents.cpu || selectedComponents.gpu)) {
      console.log('检查电源功率兼容性');
      
      let requiredPower = 0;
      
      // 获取CPU功耗
      if (selectedComponents.cpu) {
        const cpuData = await db.collection('cpu_data')
          .doc(selectedComponents.cpu)
          .get()
        
        if (cpuData.data && cpuData.data.tdp) {
          requiredPower += cpuData.data.tdp;
        } else {
          // 如果没有TDP数据，使用默认值
          requiredPower += 125; // 假设为125W
        }
      }
      
      // 获取GPU功耗
      if (selectedComponents.gpu) {
        const gpuData = await db.collection('gpu_data')
          .doc(selectedComponents.gpu)
          .get()
        
        if (gpuData.data && gpuData.data.tdp) {
          requiredPower += gpuData.data.tdp;
        } else {
          // 如果没有TDP数据，使用默认值
          requiredPower += 250; // 假设为250W
        }
      }
      
      // 其他组件大约100W
      requiredPower += 100;
      
      // 电源建议至少比需求高20%
      const recommendedPower = Math.ceil(requiredPower * 1.2);
      console.log('建议电源功率:', recommendedPower, 'W');
      
      // 过滤功率足够的电源
      compatibleItems = compatibleItems.filter(psu => 
        psu.power && psu.power >= recommendedPower
      );
      
      console.log(`过滤后剩余${compatibleItems.length}个兼容电源`);
    }
    
    return { 
      success: true,
      data: compatibleItems,
      message: `找到${compatibleItems.length}个兼容组件`
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