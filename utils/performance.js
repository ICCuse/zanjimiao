/**
 * 性能评估相关工具函数
 */

// 评估CPU性能
const evaluateCpuPerformance = (cpu) => {
  if (!cpu) return 50;
  
  const name = cpu.name.toLowerCase();
  let score = 50;
  
  // 根据CPU型号评分
  if (name.includes('i9') || name.includes('ryzen 9')) {
    score = 90;
  } else if (name.includes('i7') || name.includes('ryzen 7')) {
    score = 80;
  } else if (name.includes('i5') || name.includes('ryzen 5')) {
    score = 70;
  } else if (name.includes('i3') || name.includes('ryzen 3')) {
    score = 60;
  }
  
  // 考虑代数
  if (name.includes('14') || name.includes('14th') || name.includes('7000')) {
    score += 5;
  } else if (name.includes('13') || name.includes('13th') || name.includes('5000')) {
    score += 3;
  } else if (name.includes('12') || name.includes('12th') || name.includes('3000')) {
    score += 1;
  }
  
  return Math.min(score, 100);
};

// 评估GPU性能
const evaluateGpuPerformance = (gpu) => {
  if (!gpu) return 50;
  
  const name = gpu.name.toLowerCase();
  let score = 50;
  
  // 根据GPU型号评分
  if (name.includes('rtx 4090')) {
    score = 95;
  } else if (name.includes('rtx 4080')) {
    score = 90;
  } else if (name.includes('rtx 4070 ti')) {
    score = 85;
  } else if (name.includes('rtx 4070')) {
    score = 80;
  } else if (name.includes('rtx 4060 ti')) {
    score = 75;
  } else if (name.includes('rtx 4060')) {
    score = 70;
  } else if (name.includes('rtx 3090')) {
    score = 85;
  } else if (name.includes('rtx 3080')) {
    score = 80;
  } else if (name.includes('rtx 3070')) {
    score = 75;
  } else if (name.includes('rtx 3060')) {
    score = 70;
  } else if (name.includes('rtx 2080')) {
    score = 70;
  } else if (name.includes('rtx 2070')) {
    score = 65;
  } else if (name.includes('rtx 2060')) {
    score = 60;
  } else if (name.includes('gtx 1660')) {
    score = 55;
  } else if (name.includes('gtx 1650')) {
    score = 50;
  } else if (name.includes('rx 7900')) {
    score = 90;
  } else if (name.includes('rx 7800')) {
    score = 80;
  } else if (name.includes('rx 7700')) {
    score = 75;
  } else if (name.includes('rx 7600')) {
    score = 70;
  } else if (name.includes('rx 6900')) {
    score = 80;
  } else if (name.includes('rx 6800')) {
    score = 75;
  } else if (name.includes('rx 6700')) {
    score = 70;
  } else if (name.includes('rx 6600')) {
    score = 65;
  }
  
  return Math.min(score, 100);
};

// 评估内存性能
const evaluateRamPerformance = (ram, quantity = 1) => {
  if (!ram) return 50;
  
  const name = ram.name.toLowerCase();
  let score = 50;
  
  // 内存容量评分
  let capacity = 8; // 默认8GB
  const capacityMatch = name.match(/(\d+)gb/i);
  if (capacityMatch) {
    capacity = parseInt(capacityMatch[1]);
  }
  
  // 计算总容量
  const totalCapacity = capacity * quantity;
  
  if (totalCapacity >= 64) {
    score = 90;
  } else if (totalCapacity >= 32) {
    score = 80;
  } else if (totalCapacity >= 16) {
    score = 70;
  } else if (totalCapacity >= 8) {
    score = 60;
  }
  
  // 内存频率评分
  if (name.includes('ddr5')) {
    score += 10;
    
    // DDR5频率
    if (name.includes('6400') || name.includes('6000')) {
      score += 5;
    } else if (name.includes('5600') || name.includes('5200')) {
      score += 3;
    } else if (name.includes('4800')) {
      score += 1;
    }
  } else if (name.includes('ddr4')) {
    score += 5;
    
    // DDR4频率
    if (name.includes('3600') || name.includes('3200')) {
      score += 3;
    } else if (name.includes('3000') || name.includes('2933')) {
      score += 2;
    } else if (name.includes('2666') || name.includes('2400')) {
      score += 1;
    }
  }
  
  return Math.min(score, 100);
};

// 评估存储性能
const evaluateStoragePerformance = (storage) => {
  if (!storage) return 50;
  
  const name = storage.name.toLowerCase();
  let score = 50;
  
  // 存储类型评分
  if (name.includes('nvme') || name.includes('pcie 4.0') || name.includes('pcie4.0')) {
    score = 80;
    
    if (name.includes('pcie 5.0') || name.includes('pcie5.0')) {
      score = 90;
    }
  } else if (name.includes('ssd') || name.includes('固态')) {
    score = 70;
  } else if (name.includes('hdd') || name.includes('机械')) {
    score = 40;
  }
  
  // 容量评分
  if (name.includes('2tb') || name.includes('2 tb')) {
    score += 10;
  } else if (name.includes('1tb') || name.includes('1 tb')) {
    score += 5;
  } else if (name.includes('512gb') || name.includes('512 gb') || name.includes('500gb')) {
    score += 3;
  } else if (name.includes('256gb') || name.includes('256 gb')) {
    score += 1;
  }
  
  return Math.min(score, 100);
};

// 综合评估配置性能
const evaluatePerformance = (config) => {
  if (!config || !config.components) return { 
    overall: 50, 
    gaming: 50, 
    work: 50, 
    office: 50
  };
  
  const { cpu, gpu, ram, storage } = config.components;
  
  // 计算各部件性能分数
  const cpuScore = evaluateCpuPerformance(cpu);
  const gpuScore = evaluateGpuPerformance(gpu);
  const ramScore = evaluateRamPerformance(ram, ram ? ram.quantity || 1 : 1);
  const storageScore = evaluateStoragePerformance(storage);
  
  // 不同用途的权重
  const weights = {
    gaming: { cpu: 0.3, gpu: 0.5, ram: 0.1, storage: 0.1 },
    work: { cpu: 0.4, gpu: 0.3, ram: 0.2, storage: 0.1 },
    office: { cpu: 0.4, gpu: 0.1, ram: 0.3, storage: 0.2 }
  };
  
  // 计算不同用途的综合得分
  const gamingScore = 
    cpuScore * weights.gaming.cpu + 
    gpuScore * weights.gaming.gpu + 
    ramScore * weights.gaming.ram + 
    storageScore * weights.gaming.storage;
  
  const workScore = 
    cpuScore * weights.work.cpu + 
    gpuScore * weights.work.gpu + 
    ramScore * weights.work.ram + 
    storageScore * weights.work.storage;
  
  const officeScore = 
    cpuScore * weights.office.cpu + 
    gpuScore * weights.office.gpu + 
    ramScore * weights.office.ram + 
    storageScore * weights.office.storage;
  
  // 根据配置的用途确定整体得分
  let overallScore;
  if (config.purpose === 'gaming') {
    overallScore = gamingScore;
  } else if (config.purpose === 'work') {
    overallScore = workScore;
  } else if (config.purpose === 'office') {
    overallScore = officeScore;
  } else {
    // 默认平均权重
    overallScore = (gamingScore + workScore + officeScore) / 3;
  }
  
  return {
    overall: Math.round(overallScore),
    gaming: Math.round(gamingScore),
    work: Math.round(workScore),
    office: Math.round(officeScore)
  };
};

module.exports = {
  evaluateCpuPerformance,
  evaluateGpuPerformance,
  evaluateRamPerformance,
  evaluateStoragePerformance,
  evaluatePerformance
}; 