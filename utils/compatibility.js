/**
 * 兼容性检查相关工具函数
 */

// 检查CPU与主板兼容性
const checkCpuMotherboardCompatibility = (cpu, motherboard) => {
  if (!cpu || !motherboard) return true; // 如果缺少组件，暂不检查
  
  const cpuName = cpu.name.toLowerCase();
  const motherboardName = motherboard.name.toLowerCase();
  
  // 检查接口类型兼容性
  let cpuSocket = '';
  let motherboardSocket = '';
  
  // 确定CPU接口类型
  if (cpuName.includes('intel')) {
    if (cpuName.includes('13') || cpuName.includes('14')) {
      cpuSocket = 'lga1700';
    } else if (cpuName.includes('11') || cpuName.includes('12')) {
      cpuSocket = 'lga1700';
    } else if (cpuName.includes('10') || cpuName.includes('9')) {
      cpuSocket = 'lga1200';
    } else if (cpuName.includes('8') || cpuName.includes('7')) {
      cpuSocket = 'lga1151';
    }
  } else if (cpuName.includes('amd') || cpuName.includes('ryzen')) {
    if (cpuName.includes('7000')) {
      cpuSocket = 'am5';
    } else if (cpuName.includes('5000') || cpuName.includes('3000')) {
      cpuSocket = 'am4';
    }
  }
  
  // 确定主板接口类型
  if (motherboardName.includes('lga1700')) {
    motherboardSocket = 'lga1700';
  } else if (motherboardName.includes('lga1200')) {
    motherboardSocket = 'lga1200';
  } else if (motherboardName.includes('lga1151')) {
    motherboardSocket = 'lga1151';
  } else if (motherboardName.includes('am5')) {
    motherboardSocket = 'am5';
  } else if (motherboardName.includes('am4')) {
    motherboardSocket = 'am4';
  } else {
    // 从主板芯片组推断接口
    if (motherboardName.includes('z790') || motherboardName.includes('b760') || motherboardName.includes('h770')) {
      motherboardSocket = 'lga1700';
    } else if (motherboardName.includes('z690') || motherboardName.includes('b660') || motherboardName.includes('h670')) {
      motherboardSocket = 'lga1700';
    } else if (motherboardName.includes('z590') || motherboardName.includes('b560') || motherboardName.includes('h570')) {
      motherboardSocket = 'lga1200';
    } else if (motherboardName.includes('z490') || motherboardName.includes('b460') || motherboardName.includes('h470')) {
      motherboardSocket = 'lga1200';
    } else if (motherboardName.includes('x670') || motherboardName.includes('b650')) {
      motherboardSocket = 'am5';
    } else if (motherboardName.includes('x570') || motherboardName.includes('b550') || motherboardName.includes('a520')) {
      motherboardSocket = 'am4';
    } else if (motherboardName.includes('x470') || motherboardName.includes('b450')) {
      motherboardSocket = 'am4';
    }
  }
  
  // 检查接口是否兼容
  if (cpuSocket && motherboardSocket && cpuSocket !== motherboardSocket) {
    return {
      compatible: false,
      message: `CPU(${cpuSocket})与主板(${motherboardSocket})接口不兼容`
    };
  }
  
  return { compatible: true };
};

// 检查GPU与机箱兼容性
const checkGpuCaseCompatibility = (gpu, computerCase) => {
  if (!gpu || !computerCase) return true; // 如果缺少组件，暂不检查
  
  const gpuName = gpu.name.toLowerCase();
  const caseName = computerCase.name.toLowerCase();
  
  // 提取GPU长度
  const gpuLengthMatch = gpuName.match(/(\d+)\s*mm/);
  const gpuLength = gpuLengthMatch ? parseInt(gpuLengthMatch[1]) : 0;
  
  // 提取机箱最大显卡长度
  const caseLengthMatch = caseName.match(/显卡.*?(\d+)\s*mm/);
  const maxGpuLength = caseLengthMatch ? parseInt(caseLengthMatch[1]) : 400; // 默认400mm
  
  // 检查长度是否兼容
  if (gpuLength && maxGpuLength && gpuLength > maxGpuLength) {
    return {
      compatible: false,
      message: `显卡长度(${gpuLength}mm)超过机箱支持的最大长度(${maxGpuLength}mm)`
    };
  }
  
  return { compatible: true };
};

// 检查内存与主板兼容性
const checkRamMotherboardCompatibility = (ram, motherboard) => {
  if (!ram || !motherboard) return true; // 如果缺少组件，暂不检查
  
  const ramName = ram.name.toLowerCase();
  const motherboardName = motherboard.name.toLowerCase();
  
  // 确定内存类型
  let ramType = '';
  if (ramName.includes('ddr5')) {
    ramType = 'ddr5';
  } else if (ramName.includes('ddr4')) {
    ramType = 'ddr4';
  } else if (ramName.includes('ddr3')) {
    ramType = 'ddr3';
  }
  
  // 确定主板支持的内存类型
  let motherboardRamType = '';
  if (motherboardName.includes('ddr5')) {
    motherboardRamType = 'ddr5';
  } else if (motherboardName.includes('ddr4')) {
    motherboardRamType = 'ddr4';
  } else if (motherboardName.includes('ddr3')) {
    motherboardRamType = 'ddr3';
  } else {
    // 从主板芯片组推断内存类型
    if (motherboardName.includes('z790') || motherboardName.includes('b760') || motherboardName.includes('x670') || motherboardName.includes('b650')) {
      motherboardRamType = 'ddr5';
    } else if (motherboardName.includes('z690') || motherboardName.includes('b660')) {
      // Z690/B660平台可能同时支持DDR4和DDR5，需要根据具体型号判断
      if (motherboardName.includes('ddr5')) {
        motherboardRamType = 'ddr5';
      } else {
        motherboardRamType = 'ddr4';
      }
    } else if (motherboardName.includes('z590') || motherboardName.includes('b560') || motherboardName.includes('x570') || motherboardName.includes('b550')) {
      motherboardRamType = 'ddr4';
    }
  }
  
  // 检查内存类型是否兼容
  if (ramType && motherboardRamType && ramType !== motherboardRamType) {
    return {
      compatible: false,
      message: `内存(${ramType.toUpperCase()})与主板(${motherboardRamType.toUpperCase()})不兼容`
    };
  }
  
  return { compatible: true };
};

// 检查电源功率是否足够
const checkPowerSupplyWattage = (components, powerSupply) => {
  if (!components || !powerSupply) return true; // 如果缺少组件，暂不检查
  
  const { cpu, gpu } = components;
  const powerSupplyName = powerSupply.name.toLowerCase();
  
  // 提取电源功率
  const wattageMatch = powerSupplyName.match(/(\d+)w/i);
  const availableWattage = wattageMatch ? parseInt(wattageMatch[1]) : 0;
  
  // 估算所需功率
  let requiredWattage = 100; // 基础功率(主板、风扇等)
  
  // CPU功率
  if (cpu) {
    const cpuName = cpu.name.toLowerCase();
    if (cpuName.includes('i9') || cpuName.includes('ryzen 9')) {
      requiredWattage += 150;
    } else if (cpuName.includes('i7') || cpuName.includes('ryzen 7')) {
      requiredWattage += 125;
    } else if (cpuName.includes('i5') || cpuName.includes('ryzen 5')) {
      requiredWattage += 100;
    } else if (cpuName.includes('i3') || cpuName.includes('ryzen 3')) {
      requiredWattage += 75;
    }
  }
  
  // GPU功率
  if (gpu) {
    const gpuName = gpu.name.toLowerCase();
    if (gpuName.includes('rtx 4090')) {
      requiredWattage += 450;
    } else if (gpuName.includes('rtx 4080')) {
      requiredWattage += 350;
    } else if (gpuName.includes('rtx 4070 ti')) {
      requiredWattage += 300;
    } else if (gpuName.includes('rtx 4070')) {
      requiredWattage += 250;
    } else if (gpuName.includes('rtx 4060 ti')) {
      requiredWattage += 200;
    } else if (gpuName.includes('rtx 4060')) {
      requiredWattage += 170;
    } else if (gpuName.includes('rtx 3090')) {
      requiredWattage += 350;
    } else if (gpuName.includes('rtx 3080')) {
      requiredWattage += 320;
    } else if (gpuName.includes('rtx 3070')) {
      requiredWattage += 220;
    } else if (gpuName.includes('rtx 3060')) {
      requiredWattage += 170;
    } else if (gpuName.includes('rx 7900')) {
      requiredWattage += 350;
    } else if (gpuName.includes('rx 7800')) {
      requiredWattage += 270;
    } else if (gpuName.includes('rx 7700')) {
      requiredWattage += 220;
    } else if (gpuName.includes('rx 7600')) {
      requiredWattage += 170;
    }
  }
  
  // 增加30%的余量，确保电源稳定
  const recommendedWattage = Math.ceil(requiredWattage * 1.3);
  
  // 检查电源功率是否足够
  if (availableWattage && availableWattage < recommendedWattage) {
    return {
      compatible: false,
      message: `电源功率(${availableWattage}W)不足，建议至少${recommendedWattage}W`,
      recommendedWattage
    };
  }
  
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
  
  // GPU与机箱兼容性
  const gpuCaseCheck = checkGpuCaseCompatibility(gpu, computerCase);
  if (gpuCaseCheck && !gpuCaseCheck.compatible) {
    issues.push({
      type: 'gpu_case',
      message: gpuCaseCheck.message
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
  
  // 电源功率检查
  const powerCheck = checkPowerSupplyWattage(configComponents, powerSupply);
  if (powerCheck && !powerCheck.compatible) {
    issues.push({
      type: 'power_supply',
      message: powerCheck.message,
      recommendedWattage: powerCheck.recommendedWattage
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