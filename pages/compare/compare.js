const app = getApp();

Page({
  data: {
    // 配置列表相关
    userConfigs: [], // 用户所有配置列表
    presetConfigs: [], // 预设配置列表
    loading: true,    // 加载状态
    
    // 选择与对比相关
    selectedConfigs: [], // 已选中的配置(最多3个)
    maxSelections: 3,    // 最多可选择的配置数
    
    // 对比显示相关
    currentTab: 'overview', // 当前显示的标签页: overview, performance, components
    currentComponent: 'all', // 当前查看的组件类型
    componentTypes: [      // 组件类型列表
      { id: 'all', name: '全部组件' },
      { id: 'cpu', name: 'CPU' },
      { id: 'motherboard', name: '主板' },
      { id: 'ram', name: '内存' },
      { id: 'gpu', name: '显卡' },
      { id: 'storage', name: '存储' },
      { id: 'psu', name: '电源' },
      { id: 'case', name: '机箱' },
      { id: 'cooling', name: '散热器' },
      { id: 'monitor', name: '显示器' }
    ],
    
    // 性能评分相关
    performanceMetrics: [
      { id: 'totalScore', name: '总体评分' },
      { id: 'gamingScore', name: '游戏性能' },
      { id: 'workScore', name: '工作性能' },
      { id: 'valueScore', name: '性价比' },
      { id: 'compatibilityScore', name: '兼容性' }
    ],
    
    // 主题色
    themeColor: '#ff8c00',
    secondaryColor: '#ffaf4d'
  },
  
  // 页面加载
  onLoad: function(options) {
    console.log('配置对比页面加载');
    
    // 获取用户所有配置和预设配置
    this.loadAllConfigs();
  },
  
  // 页面显示
  onShow: function() {
    // 检查是否需要刷新配置列表
    if (this.data.needRefresh) {
      this.loadAllConfigs();
      this.setData({ needRefresh: false });
    }
  },
  
  // 加载所有配置
  loadAllConfigs: function() {
    this.setData({ loading: true });
    
    // 从全局获取用户配置列表
    let userConfigs = app.globalData.userConfigs || [];
    
    // 从全局获取预设配置列表
    let presetConfigs = app.globalData.presetPlans || [];
    
    // 预处理用户配置
    userConfigs = userConfigs.map(config => {
      return {
        ...config,
        type: 'user',
        checked: false,
        dateObj: new Date(config.createdAt || 0)
      };
    }).sort((a, b) => b.dateObj - a.dateObj); // 按创建时间倒序排序
    
    // 预处理预设配置
    presetConfigs = presetConfigs.map(config => {
      return {
        ...config,
        type: 'preset',
        checked: false
      };
    });
    
    this.setData({
      userConfigs: userConfigs,
      presetConfigs: presetConfigs,
      loading: false
    });
    
    console.log('加载配置列表完成', userConfigs.length, presetConfigs.length);
  },
  
  // 切换配置选择
  toggleConfigSelection: function(e) {
    const { id, type } = e.currentTarget.dataset;
    let targetList = type === 'user' ? 'userConfigs' : 'presetConfigs';
    
    // 获取当前配置列表和已选配置
    const configList = [...this.data[targetList]];
    let selectedConfigs = [...this.data.selectedConfigs];
    
    // 找到目标配置
    const configIndex = configList.findIndex(item => item.id === id);
    if (configIndex < 0) return;
    
    // 切换选中状态
    const isChecked = !configList[configIndex].checked;
    
    // 如果要选中，检查是否超出最大选择数
    if (isChecked && selectedConfigs.length >= this.data.maxSelections) {
      wx.showToast({
        title: `最多只能选择${this.data.maxSelections}个配置进行对比`,
        icon: 'none'
      });
      return;
    }
    
    // 更新配置选中状态
    configList[configIndex].checked = isChecked;
    
    // 更新已选配置列表
    if (isChecked) {
      selectedConfigs.push(configList[configIndex]);
    } else {
      selectedConfigs = selectedConfigs.filter(item => !(item.id === id && item.type === type));
    }
    
    // 更新界面状态
    const updateData = { selectedConfigs };
    updateData[targetList] = configList;
    this.setData(updateData);
    
    console.log('当前已选配置:', selectedConfigs.length);
  },
  
  // 开始对比
  startCompare: function() {
    const { selectedConfigs } = this.data;
    
    // 检查是否至少选择了两个配置
    if (selectedConfigs.length < 2) {
      wx.showToast({
        title: '请至少选择两个配置进行对比',
        icon: 'none'
      });
      return;
    }
    
    console.log("原始配置数据:", JSON.stringify(selectedConfigs));
    
    // 格式化配置数据，使用类似预览页的方法
    const processedConfigs = selectedConfigs.map(config => {
      // 深拷贝配置，避免修改原始数据
      const processedConfig = JSON.parse(JSON.stringify(config));
      
      // 处理组件数据，确保每个组件数据的格式统一
      if (processedConfig.components) {
        const formattedComponents = {};
        
        // 遍历每个组件类型
        this.data.componentTypes.forEach(type => {
          if (type.id === 'all') return; // 跳过"全部"类型
          
          const component = processedConfig.components[type.id];
          if (component) {
            // 确保每个组件有标准化的字段
            formattedComponents[type.id] = {
              name: component.name || component['名称'] || '未知组件',
              price: component.price || component['价格'] || 0,
              id: component.id || '',
              type: type.id,
              // 提取关键规格数据
              specs: this.extractComponentSpecs(component, type.id)
            };
          }
        });
        
        processedConfig.components = formattedComponents;
      }
      
      return processedConfig;
    });
    
    // 计算性能评分
    this.calculatePerformanceScores(processedConfigs);
    
    // 切换到对比页面并更新处理后的配置
    this.setData({
      showCompareResult: true,
      selectedConfigs: processedConfigs,
      currentTab: 'components', // 直接跳转到组件对比页面
      currentComponent: 'cpu'   // 设置默认显示CPU组件
    });
  },
  
  // 提取组件规格信息
  extractComponentSpecs: function(component, componentType) {
    const specs = [];
    
    // 处理原始数据格式，如果有rawData字段则尝试解析
    if (component.rawData) {
      try {
        // 如果rawData是字符串，尝试解析为对象
        const rawData = typeof component.rawData === 'string' 
          ? JSON.parse(component.rawData) 
          : component.rawData;
          
        // 合并rawData到组件对象
        if (typeof rawData === 'object' && rawData !== null) {
          Object.keys(rawData).forEach(key => {
            if (component[key] === undefined) {
              component[key] = rawData[key];
            }
          });
        }
      } catch (e) {
        console.error('解析rawData失败:', e);
      }
    }
    
    // 过滤掉不应包含在规格中的字段名称和标签
    const excludeLabels = ['名称', '品牌', '价格', 'name', 'brand', 'price', 'originalPrice', '原价', '现价', '型号', 'model', '产品编号', 'productNumber'];
    
    // 提取所有可能包含规格信息的字段
    // 检查组件中是否有specs数组，有则直接使用
    if (component.specs && Array.isArray(component.specs)) {
      component.specs.forEach(spec => {
        if (spec && spec.label && spec.value) {
          // 过滤掉名称和价格相关的规格
          if (!excludeLabels.includes(spec.label)) {
            specs.push({
              label: spec.label,
              value: spec.value
            });
          }
        }
      });
      
      // 如果已有规格，就直接返回
      if (specs.length > 0) {
        return specs;
      }
    }
    
    // 根据组件类型提取关键规格
    switch(componentType) {
      case 'cpu':
        this.addSpecIfExists(specs, component, '核心数', 'coreCount', 'cores');
        this.addSpecIfExists(specs, component, '线程数', 'threadCount', 'threads');
        this.addSpecIfExists(specs, component, '频率', 'frequency', '基础频率', 'baseFrequency', 'clockSpeed');
        this.addSpecIfExists(specs, component, '加速频率', 'boostFrequency', 'turboFrequency', '睿频');
        this.addSpecIfExists(specs, component, '接口', 'socket', 'socketType');
        this.addSpecIfExists(specs, component, '功耗', 'tdp', 'power', 'wattage');
        this.addSpecIfExists(specs, component, '缓存', 'cache', 'cacheSize');
        this.addSpecIfExists(specs, component, '工艺', 'process', 'lithography', 'nm');
        this.addSpecIfExists(specs, component, '核显', 'integratedGraphics', 'igpu');
        break;
        
      case 'gpu':
        this.addSpecIfExists(specs, component, '显存', 'memory', 'vram', 'videoMemory');
        this.addSpecIfExists(specs, component, '显存类型', 'memoryType', 'vramType');
        this.addSpecIfExists(specs, component, '显存频率', 'memoryFrequency', 'vramFrequency', 'memorySpeed');
        this.addSpecIfExists(specs, component, '显存位宽', 'memoryBus', 'memoryInterface', 'busWidth');
        this.addSpecIfExists(specs, component, '核心频率', 'coreFrequency', 'coreSpeed', 'clockSpeed');
        this.addSpecIfExists(specs, component, '加速频率', 'boostFrequency', 'turboFrequency');
        this.addSpecIfExists(specs, component, '流处理器', 'streamProcessors', 'cudaCores', 'shaderUnits');
        this.addSpecIfExists(specs, component, '系列', 'series', 'family');
        this.addSpecIfExists(specs, component, '接口', 'interface', 'slot', 'port');
        this.addSpecIfExists(specs, component, '功耗', 'tdp', 'power', 'wattage');
        this.addSpecIfExists(specs, component, '供电接口', 'powerConnector', 'powerPin');
        break;
        
      case 'motherboard':
        this.addSpecIfExists(specs, component, '芯片组', 'chipset', 'chipsetType');
        this.addSpecIfExists(specs, component, '接口', 'socket', 'socketType', 'cpuSocket');
        this.addSpecIfExists(specs, component, '内存插槽', 'memorySlots', 'dimm');
        this.addSpecIfExists(specs, component, '内存类型', 'memoryType', 'ramType', 'supportedMemory');
        this.addSpecIfExists(specs, component, '最大内存', 'maxMemory', 'maxRam');
        this.addSpecIfExists(specs, component, '内存频率', 'memoryFrequency', 'supportedFrequency');
        this.addSpecIfExists(specs, component, 'SATA接口', 'sataConnectors', 'sataCount', 'sata');
        this.addSpecIfExists(specs, component, 'M.2接口', 'm2Slots', 'm2Count', 'm2');
        this.addSpecIfExists(specs, component, 'PCIe插槽', 'pciSlots', 'pciCount', 'pcie');
        this.addSpecIfExists(specs, component, 'USB接口', 'usbPorts', 'usb');
        this.addSpecIfExists(specs, component, 'WiFi', 'wifi', 'wirelessSupport', 'wireless');
        this.addSpecIfExists(specs, component, '蓝牙', 'bluetooth');
        this.addSpecIfExists(specs, component, '板型', 'formFactor', 'size');
        break;
        
      case 'ram':
        this.addSpecIfExists(specs, component, '容量', 'capacity', 'size', 'totalSize');
        this.addSpecIfExists(specs, component, '频率', 'frequency', 'speed', 'clockSpeed');
        this.addSpecIfExists(specs, component, '类型', 'type', 'memoryType');
        this.addSpecIfExists(specs, component, '条数', 'stickCount', 'moduleCount', 'count');
        this.addSpecIfExists(specs, component, '单条容量', 'moduleSize', 'perStick');
        this.addSpecIfExists(specs, component, '时序', 'timing', 'latency', 'cl');
        this.addSpecIfExists(specs, component, '电压', 'voltage');
        this.addSpecIfExists(specs, component, '散热片', 'heatsink', 'hasHeatsink', 'cooling');
        this.addSpecIfExists(specs, component, 'RGB灯效', 'rgb', 'lighting', 'hasRGB');
        break;
        
      case 'storage':
        this.addSpecIfExists(specs, component, '容量', 'capacity', 'size', 'totalSize');
        this.addSpecIfExists(specs, component, '类型', 'type', 'storageType', 'driveType');
        this.addSpecIfExists(specs, component, '接口', 'interface', 'connection', 'port');
        this.addSpecIfExists(specs, component, '读取速度', 'readSpeed', 'sequentialRead');
        this.addSpecIfExists(specs, component, '写入速度', 'writeSpeed', 'sequentialWrite');
        this.addSpecIfExists(specs, component, '缓存', 'cache', 'buffer');
        this.addSpecIfExists(specs, component, '硬盘转速', 'rpm', 'rotationSpeed');
        this.addSpecIfExists(specs, component, '颗粒类型', 'nandType', 'flash');
        this.addSpecIfExists(specs, component, '寿命', 'tbw', 'terabytesWritten', 'endurance');
        this.addSpecIfExists(specs, component, '尺寸', 'formFactor', 'size', 'dimension');
        break;
        
      case 'cooling':
        this.addSpecIfExists(specs, component, '散热方式', 'type', 'coolingType', 'coolerType');
        this.addSpecIfExists(specs, component, '风扇数量', 'fanCount', 'fans');
        this.addSpecIfExists(specs, component, '风扇尺寸', 'fanSize', 'fanDimension');
        this.addSpecIfExists(specs, component, '转速', 'rpm', 'fanSpeed', 'rotationSpeed');
        this.addSpecIfExists(specs, component, '噪音', 'noise', 'noiseLevel', 'db');
        this.addSpecIfExists(specs, component, '散热量', 'tdp', 'coolingCapacity', 'heatDissipation');
        this.addSpecIfExists(specs, component, '高度', 'height', 'coolerHeight');
        this.addSpecIfExists(specs, component, '散热片材质', 'material', 'finMaterial');
        this.addSpecIfExists(specs, component, '热管数量', 'heatpipes', 'heatpipeCount');
        this.addSpecIfExists(specs, component, 'RGB灯效', 'rgb', 'hasRGB', 'lighting');
        this.addSpecIfExists(specs, component, '支持接口', 'socket', 'socketSupport', 'compatibility');
        break;
        
      case 'psu':
        this.addSpecIfExists(specs, component, '功率', 'power', 'wattage', 'capacity');
        this.addSpecIfExists(specs, component, '认证', 'certification', 'rating', '80PLUS');
        this.addSpecIfExists(specs, component, '模组类型', 'moduleType', 'modularity', 'cableType');
        this.addSpecIfExists(specs, component, '风扇尺寸', 'fanSize', 'fan');
        this.addSpecIfExists(specs, component, '风扇数量', 'fanCount');
        this.addSpecIfExists(specs, component, '接口', 'connectors', 'cables');
        this.addSpecIfExists(specs, component, '尺寸', 'size', 'dimension', 'formFactor');
        this.addSpecIfExists(specs, component, '效率', 'efficiency');
        this.addSpecIfExists(specs, component, '保修', 'warranty');
        break;
        
      case 'case':
        this.addSpecIfExists(specs, component, '类型', 'type', 'formFactor', 'towerType');
        this.addSpecIfExists(specs, component, '尺寸', 'size', 'dimensions', 'dimension');
        this.addSpecIfExists(specs, component, '材质', 'material', 'caseMaterial', 'construction');
        this.addSpecIfExists(specs, component, '驱动器位', 'driveBays', 'bayCount');
        this.addSpecIfExists(specs, component, '3.5英寸位', '3.5Bays', 'hddBays');
        this.addSpecIfExists(specs, component, '2.5英寸位', '2.5Bays', 'ssdBays');
        this.addSpecIfExists(specs, component, '扩展槽位', 'expansionSlots', 'pciSlots');
        this.addSpecIfExists(specs, component, '最大散热高度', 'maxCoolerHeight', 'cpuCoolerHeightLimit');
        this.addSpecIfExists(specs, component, '最大GPU长度', 'maxGpuLength', 'gpuLengthLimit');
        this.addSpecIfExists(specs, component, '最大电源长度', 'maxPsuLength', 'psuLengthLimit');
        this.addSpecIfExists(specs, component, '侧板类型', 'sidePanel', 'sidePanelType');
        this.addSpecIfExists(specs, component, '风扇支持', 'fanSupport', 'fanOptions');
        this.addSpecIfExists(specs, component, '前置接口', 'frontPorts', 'frontIo');
        this.addSpecIfExists(specs, component, 'RGB灯效', 'rgb', 'hasRGB', 'lighting');
        break;
        
      case 'monitor':
        this.addSpecIfExists(specs, component, '尺寸', 'size', 'screenSize', 'displaySize');
        this.addSpecIfExists(specs, component, '分辨率', 'resolution', 'displayResolution');
        this.addSpecIfExists(specs, component, '刷新率', 'refreshRate', 'hz');
        this.addSpecIfExists(specs, component, '面板类型', 'panelType', 'displayType');
        this.addSpecIfExists(specs, component, '响应时间', 'responseTime', 'response');
        this.addSpecIfExists(specs, component, '亮度', 'brightness', 'nits');
        this.addSpecIfExists(specs, component, '对比度', 'contrastRatio', 'contrast');
        this.addSpecIfExists(specs, component, '曲率', 'curvature', 'curved');
        this.addSpecIfExists(specs, component, '接口', 'ports', 'interfaces', 'connections');
        this.addSpecIfExists(specs, component, 'HDR', 'hdr', 'hdrSupport');
        this.addSpecIfExists(specs, component, '自适应同步', 'adaptiveSync', 'freesync', 'gsync');
        this.addSpecIfExists(specs, component, '色域覆盖', 'colorGamut', 'colorSpace');
        this.addSpecIfExists(specs, component, '支架调节', 'standAdjustment', 'ergonomics');
        this.addSpecIfExists(specs, component, '内置扬声器', 'speakers', 'hasAudio');
        break;
        
      case 'caseFan':
        this.addSpecIfExists(specs, component, '尺寸', 'size', 'fanSize', 'dimension');
        this.addSpecIfExists(specs, component, '转速', 'rpm', 'speed', 'rotationSpeed');
        this.addSpecIfExists(specs, component, '风量', 'airflow', 'cfm');
        this.addSpecIfExists(specs, component, '静压', 'staticPressure', 'mmh2o');
        this.addSpecIfExists(specs, component, '噪音', 'noise', 'db');
        this.addSpecIfExists(specs, component, '接口', 'connector', 'interface');
        this.addSpecIfExists(specs, component, 'PWM', 'pwm', 'isPwm');
        this.addSpecIfExists(specs, component, 'RGB灯效', 'rgb', 'lighting', 'hasRGB');
        break;
    }
    
    // 尝试确保至少有一些基本信息
    // 如果specs数组为空，尝试从原始对象提取所有看起来像属性的键值对
    if (specs.length === 0) {
      Object.keys(component).forEach(key => {
        // 跳过常见的非规格字段
        if (['id', 'name', '名称', 'price', '价格', 'rawData', 'checked', 'type'].includes(key) ||
            excludeLabels.includes(key)) {
          return;
        }
        
        // 跳过函数、数组和对象
        const value = component[key];
        if (typeof value === 'function' || Array.isArray(value) || 
            (typeof value === 'object' && value !== null)) {
          return;
        }
        
        // 添加到规格中
        specs.push({
          label: key,
          value: value
        });
      });
    }
    
    // 过滤掉任何可能混入的品牌、名称和价格信息
    return specs.filter(spec => !excludeLabels.includes(spec.label));
  },
  
  // 辅助函数：添加规格（如果存在）- 增强版，支持多种格式值
  addSpecIfExists: function(specs, component, label, ...possibleKeys) {
    // 检查中文键和英文键
    for (const key of possibleKeys) {
      if (component[key] !== undefined && component[key] !== null && component[key] !== '') {
        let value = component[key];
        
        // 格式化值，确保显示友好
        if (typeof value === 'boolean') {
          value = value ? '是' : '否';
        } else if (typeof value === 'number') {
          // 保留两位小数（如有必要）
          value = value % 1 === 0 ? value.toString() : value.toFixed(2);
        }
        
        specs.push({
          label: label,
          value: value
        });
        return;
      }
    }
    
    // 检查中文键
    if (component[label] !== undefined && component[label] !== null && component[label] !== '') {
      let value = component[label];
      
      // 格式化值
      if (typeof value === 'boolean') {
        value = value ? '是' : '否';
      } else if (typeof value === 'number') {
        value = value % 1 === 0 ? value.toString() : value.toFixed(2);
      }
      
      specs.push({
        label: label,
        value: value
      });
    }
  },
  
  // 计算性能评分
  calculatePerformanceScores: function(configs) {
    const configsWithScores = configs.map(config => {
      // 获取配置中的组件
      const components = config.components || {};
      
      // 基础评分
      let totalScore = 50;
      let gamingScore = 40;
      let workScore = 40;
      
      // 根据CPU评分
      const cpu = components.cpu;
      if (cpu) {
        // 简单评分逻辑，实际可以根据具体CPU型号和参数更精细地评分
        if (cpu.name && cpu.name.includes('i9') || cpu.name.includes('Ryzen 9')) {
          totalScore += 20;
          gamingScore += 20;
          workScore += 25;
        } else if (cpu.name && cpu.name.includes('i7') || cpu.name.includes('Ryzen 7')) {
          totalScore += 15;
          gamingScore += 15;
          workScore += 20;
        } else if (cpu.name && cpu.name.includes('i5') || cpu.name.includes('Ryzen 5')) {
          totalScore += 10;
          gamingScore += 10;
          workScore += 15;
        }
      }
      
      // 根据GPU评分
      const gpu = components.gpu;
      if (gpu) {
        // 简单评分逻辑
        if (gpu.name && (gpu.name.includes('RTX 40') || gpu.name.includes('RX 7900'))) {
          totalScore += 25;
          gamingScore += 30;
          workScore += 20;
        } else if (gpu.name && (gpu.name.includes('RTX 30') || gpu.name.includes('RX 6800'))) {
          totalScore += 20;
          gamingScore += 25;
          workScore += 15;
        } else if (gpu.name && (gpu.name.includes('RTX 20') || gpu.name.includes('GTX 16'))) {
          totalScore += 15;
          gamingScore += 15;
          workScore += 10;
        }
      }
      
      // 根据内存评分
      const ram = components.ram;
      if (ram) {
        let ramCapacity = '';
        // 从规格中提取容量信息
        if (ram.specs && ram.specs.length > 0) {
          const capacitySpec = ram.specs.find(spec => spec.label === '容量');
          if (capacitySpec) {
            ramCapacity = capacitySpec.value;
          }
        }
        
        if (typeof ramCapacity === 'string') {
          if (ramCapacity.includes('64') || ramCapacity.includes('128')) {
            totalScore += 10;
            workScore += 15;
            gamingScore += 5;
          } else if (ramCapacity.includes('32')) {
            totalScore += 8;
            workScore += 10;
            gamingScore += 5;
          } else if (ramCapacity.includes('16')) {
            totalScore += 5;
            workScore += 5;
            gamingScore += 3;
          }
        }
      }
      
      // 性价比计算 (总分/价格)×1000
      const totalPrice = config.totalPrice || 0;
      const valueScore = totalPrice > 0 ? Math.round((totalScore / totalPrice) * 1000) : 0;
      
      // 兼容性评分 (预设全部为90，用户配置根据兼容性系统打分)
      let compatibilityScore = config.type === 'preset' ? 90 : 70;
      
      // 限制评分范围
      totalScore = Math.min(100, Math.max(0, totalScore));
      gamingScore = Math.min(100, Math.max(0, gamingScore));
      workScore = Math.min(100, Math.max(0, workScore));
      
      // 给配置添加评分
      config.performanceScores = {
        totalScore,
        gamingScore,
        workScore,
        valueScore,
        compatibilityScore
      };
      
      return config;
    });
    
    return configsWithScores;
  },
  
  // 返回选择页面
  backToSelection: function() {
    this.setData({
      showCompareResult: false
    });
  },
  
  // 切换标签页
  switchTab: function(e) {
    const tab = e.currentTarget.dataset.tab;
    this.setData({
      currentTab: tab
    });
  },
  
  // 切换组件类型
  switchComponentType: function(e) {
    const componentType = e.currentTarget.dataset.type;
    this.setData({
      currentComponent: componentType
    });
  },
  
  // 分享给好友
  onShareAppMessage: function() {
    return {
      title: '我发现了一个超实用的电脑配置对比工具',
      path: '/pages/compare/compare'
    };
  }
}); 