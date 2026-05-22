const app = getApp();

// 日期格式化工具函数
const formatDate = (date) => {
  if (!date) return '';
  if (typeof date === 'string') {
    date = new Date(date);
  }
  return `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, '0')}-${date.getDate().toString().padStart(2, '0')}`;
};

Page({
  data: {
    loading: true,
    error: false,
    errorMsg: '加载失败，请重试',
    configId: '',
    config: null,
    totalPrice: 0,
    hasAnyComponent: false,
    qrCodePath: '',
    pagePath: 'pages/shared/shared',
    scene: ''  // 场景值，用于从二维码中获取configId
  },

  onLoad: function(options) {
    console.log('分享页面加载 options:', options);
    
    // 检查是否从本地数据加载
    if (options.fromLocal && options.fromLocal === 'true') {
      console.log('从本地全局数据加载配置');
      this.loadFromLocalData();
      return;
    }
    
    let configId = '';
    
    // 尝试从URL参数获取configId
    if (options.id) {
      configId = options.id;
    } 
    // 尝试从场景值获取configId
    else if (options.scene) {
      this.setData({ scene: options.scene });
      try {
        const scene = decodeURIComponent(options.scene);
        const params = new URLSearchParams('?' + scene);
        configId = params.get('id');
      } catch (error) {
        console.error('解析场景值失败：', error);
      }
    }

    if (configId) {
      this.setData({ configId });
      this.loadConfigData();
      // 由于云函数未上传，暂时关闭二维码生成
      // this.generateQrCode();
    } else {
      this.setData({
        loading: false,
        error: true,
        errorMsg: '未找到配置ID'
      });
    }
  },

  // 从本地全局数据加载配置
  loadFromLocalData: function() {
    const config = app.globalData.sharedConfig;
    
    if (!config) {
      this.setData({
        loading: false,
        error: true,
        errorMsg: '未找到配置数据'
      });
      return;
    }
    
    // 确保日期格式正确
    if (config.createdAt) {
      config.createdAt = formatDate(config.createdAt);
    } else if (config.createTime) {
      config.createdAt = formatDate(config.createTime);
    } else {
      config.createdAt = formatDate(new Date());
    }

    // 标准化数据格式
    const standardizedConfig = this.standardizeConfig(config);

    // 计算总价
    let totalPrice = 0;
    let hasAnyComponent = false;
    
    const components = [
      'cpu', 'motherboard', 'memory', 'gpu', 'ssd', 'hdd', 
      'powerSupply', 'case', 'cooling', 'caseFan', 'monitor'
    ];
    
    components.forEach(type => {
      if (standardizedConfig[type]) {
        const price = standardizedConfig[type].totalPrice || standardizedConfig[type].price || 0;
        totalPrice += parseFloat(price);
        hasAnyComponent = true;
        console.log(`组件 ${type} 价格: ${price}`);
      }
    });
    
    console.log('机箱散热信息:', standardizedConfig.caseFan);
    
    this.setData({
      loading: false,
      config: standardizedConfig,
      totalPrice: totalPrice.toFixed(2),
      hasAnyComponent
    });
  },

  // 加载配置数据
  loadConfigData: function() {
    const { configId } = this.data;
    if (!configId) {
      this.setData({
        loading: false,
        error: true,
        errorMsg: '缺少配置ID'
      });
      return;
    }

    this.setData({
      loading: true,
      error: false
    });

    console.log('正在加载配置：', configId);
    
    wx.cloud.callFunction({
      name: 'getConfig',
      data: {
        configId
      }
    }).then(res => {
      console.log('获取配置成功：', res);
      
      if (res.result && res.result.success && res.result.data) {
        const config = res.result.data;
        
        // 确保日期格式正确
        if (config.createdAt) {
          config.createdAt = formatDate(config.createdAt);
        } else if (config.createTime) {
          config.createdAt = formatDate(config.createTime);
        } else {
          config.createdAt = formatDate(new Date());
        }

        // 标准化数据格式 - 确保需要的字段都存在
        const standardizedConfig = this.standardizeConfig(config);

        // 计算总价
        let totalPrice = 0;
        let hasAnyComponent = false;
        
        const components = [
          'cpu', 'motherboard', 'memory', 'gpu', 'ssd', 'hdd', 
          'powerSupply', 'case', 'cooling', 'caseFan', 'monitor'
        ];
        
        components.forEach(type => {
          if (standardizedConfig[type]) {
            // 如果组件有totalPrice字段(针对有数量的组件)，使用totalPrice
            // 否则使用price字段
            const price = standardizedConfig[type].totalPrice || standardizedConfig[type].price || 0;
            totalPrice += parseFloat(price);
            hasAnyComponent = true;
            console.log(`组件 ${type} 价格: ${price}`);
          }
        });
        
        // 特别检查机箱散热是否存在
        console.log('机箱散热信息:', standardizedConfig.caseFan);
        
        this.setData({
          loading: false,
          config: standardizedConfig,
          totalPrice: totalPrice.toFixed(2),
          hasAnyComponent
        });
      } else {
        this.setData({
          loading: false,
          error: true,
          errorMsg: '配置不存在或已被删除'
        });
      }
    }).catch(err => {
      console.error('获取配置失败：', err);
      this.setData({
        loading: false,
        error: true,
        errorMsg: '加载失败，请重试'
      });
    });
  },

  // 标准化配置数据
  standardizeConfig: function(config) {
    console.log('开始标准化配置数据:', config);
    
    // 创建标准化后的配置对象
    const standardized = {
      title: config.title || config.name || '我的电脑配置',
      createdAt: config.createdAt || formatDate(new Date()),
      totalPrice: config.totalPrice || 0
    };
    
    // 字段映射 - 确保本地与云端使用相同的字段名
    const fieldMapping = {
      // 云端字段名: 本地字段名
      'memory': 'memory',  // 确保memory字段保持一致
      'powerSupply': 'powerSupply', // 确保powerSupply字段保持一致
      'ram': 'memory',     // 兼容旧数据中可能使用ram的情况
      'psu': 'powerSupply' // 兼容旧数据中可能使用psu的情况
    };
    
    // 组件字段列表
    const componentFields = [
      'cpu', 'motherboard', 'memory', 'ram', 'gpu', 'ssd', 'hdd', 
      'storage', 'powerSupply', 'psu', 'case', 'cooling', 'caseFan', 'monitor'
    ];
    
    // 优先使用标准格式：从components对象中提取数据
    if (config.components) {
      console.log('使用标准格式从components对象提取组件数据');
      
      // 处理components中的每个组件
      componentFields.forEach(field => {
        if (config.components[field]) {
          // 获取标准化字段名
          const standardField = fieldMapping[field] || field;
          
          // 复制组件数据
          standardized[standardField] = {...config.components[field]};
          
          // 提取组件的品牌和型号信息
          this.extractBrandAndModel(standardized[standardField], field);
          
          console.log(`从components中提取了${field}组件:`, standardized[standardField]);
        }
      });
    }
    
    // 向后兼容：处理直接在config中的组件（只在components中没有该组件时处理）
    componentFields.forEach(field => {
      if (config[field] && !standardized[fieldMapping[field] || field]) {
        // 获取标准化字段名
        const standardField = fieldMapping[field] || field;
        
        // 复制组件数据
        standardized[standardField] = {...config[field]};
        
        // 提取组件的品牌和型号信息
        this.extractBrandAndModel(standardized[standardField], field);
        
        console.log(`从config根级别提取了${field}组件:`, standardized[standardField]);
      }
    });
    
    // 确保所有组件的价格字段正确
    componentFields.forEach(field => {
      const standardField = fieldMapping[field] || field;
      
      if (standardized[standardField]) {
        // 确保价格字段存在
        if (!standardized[standardField].price && standardized[standardField]['价格']) {
          standardized[standardField].price = standardized[standardField]['价格'];
        }
        
        // 处理数量字段 - 确保价格计算正确
        if (standardized[standardField].quantity && standardized[standardField].quantity > 1) {
          // 如果有单价字段，使用单价计算总价
          if (standardized[standardField].unitPrice) {
            standardized[standardField].price = parseFloat(standardized[standardField].unitPrice) * 
                                              standardized[standardField].quantity;
          }
          // 如果有总价字段，确保价格字段等于总价
          else if (standardized[standardField].totalPrice) {
            standardized[standardField].price = standardized[standardField].totalPrice;
          }
        }
      }
    });
    
    // 特殊处理caseFan组件 - 确保机箱散热能正确显示
    if (standardized.caseFan) {
      console.log('处理机箱散热组件:', standardized.caseFan);
      
      // 如果刚好是数组(可能存在多个风扇)，取第一个作为显示
      if (Array.isArray(standardized.caseFan)) {
        console.log('机箱散热是数组，取第一个作为显示');
        standardized.caseFan = standardized.caseFan[0];
      }
    }
    
    console.log('标准化后的配置:', standardized);
    return standardized;
  },

  // 提取品牌和型号信息的辅助函数
  extractBrandAndModel: function(component, componentType) {
    if (!component || !component.name) return;
    
    // 首先检查是否已有品牌和型号字段
    if (!component.brand) {
      // 根据组件类型提取品牌
      switch(componentType) {
        case 'cpu':
          // CPU品牌识别
          if (component.name.includes('Intel') || component.name.includes('英特尔') ||
              component.name.includes('酷睿') || component.name.includes('奔腾') || 
              component.name.includes('赛扬')) {
            component.brand = '英特尔';
          } else if (component.name.includes('AMD') || component.name.includes('锐龙') || 
                   component.name.includes('Ryzen')) {
            component.brand = 'AMD';
          }
          break;
          
        case 'gpu':
          // 显卡品牌识别
          if (component.name.includes('NVIDIA') || 
              (component.name.match(/RTX|GTX|Quadro/i) && !component.name.match(/Radeon|AMD/i))) {
            component.brand = 'NVIDIA';
          } else if (component.name.includes('AMD') || component.name.includes('Radeon') || 
                   (component.name.match(/RX\s*\d{3,4}/i) && !component.name.match(/NVIDIA|GeForce/i))) {
            component.brand = 'AMD';
          } else {
            // 常见显卡厂商品牌
            const gpuBrands = ['华硕', 'ASUS', '微星', 'MSI', '技嘉', 'GIGABYTE', 
                             '七彩虹', 'Colorful', '影驰', 'GALAX', '索泰', 'ZOTAC', 
                             '耕升', 'GAINWARD', '蓝宝石', 'SAPPHIRE', '讯景', 'XFX', 
                             '映众', 'INNO3D', '丽台', 'LEADTEK'];
            for (const brand of gpuBrands) {
              if (component.name.includes(brand)) {
                component.brand = brand;
                break;
              }
            }
          }
          break;
          
        case 'motherboard':
        case 'mainboard':
          // 主板品牌识别
          const motherboardBrands = ['华硕', 'ASUS', '微星', 'MSI', '技嘉', 'GIGABYTE', 
                                  '华擎', 'ASRock', '铭瑄', 'MAXSUN', '七彩虹', 'Colorful', 
                                  '映泰', 'BIOSTAR', '梅捷', 'MAXSUN', '昂达', 'ONDA'];
          for (const brand of motherboardBrands) {
            if (component.name.includes(brand)) {
              component.brand = brand;
              break;
            }
          }
          break;
          
        case 'memory':
        case 'ram':
          // 内存品牌识别
          const ramBrands = ['金士顿', 'Kingston', '海盗船', 'Corsair', '芝奇', 'G.SKILL', 
                           '威刚', 'ADATA', '英睿达', 'Crucial', '镁光', 'Micron', '三星', 'Samsung', 
                           '十铨', 'Team', '宇瞻', 'Apacer', '光威', 'GLOWAY'];
          for (const brand of ramBrands) {
            if (component.name.includes(brand)) {
              component.brand = brand;
              break;
            }
          }
          break;
          
        case 'storage':
        case 'ssd':
        case 'hdd':
          // 存储设备品牌识别
          const storageBrands = ['西部数据', 'WD', 'Western Digital', '希捷', 'Seagate', '三星', 'Samsung', 
                              '英特尔', 'Intel', '东芝', 'Toshiba', '闪迪', 'SanDisk', '金士顿', 'Kingston', 
                              '浦科特', 'Plextor', '美光', 'Micron', '英睿达', 'Crucial', '海康威视', 'HIKVISION',
                              '威刚', 'ADATA', '联想', 'Lenovo', '光威', 'GLOWAY'];
          for (const brand of storageBrands) {
            if (component.name.includes(brand)) {
              component.brand = brand;
              break;
            }
          }
          break;
          
        case 'psu':
        case 'powerSupply':
          // 电源品牌识别
          const psuBrands = ['海韵', 'Seasonic', '安钛克', 'Antec', '振华', 'Super Flower', 
                          '酷冷至尊', 'Cooler Master', '海盗船', 'Corsair', '全汉', 'FSP', 
                          '长城', 'Great Wall', '鑫谷', 'Segotep', '航嘉', 'Huntkey'];
          for (const brand of psuBrands) {
            if (component.name.includes(brand)) {
              component.brand = brand;
              break;
            }
          }
          break;
          
        default:
          // 通用品牌识别：尝试从名称的第一部分提取
          if (component.name.includes(' ')) {
            const parts = component.name.split(' ');
            component.brand = parts[0];
          } else if (component.name.includes('-')) {
            const parts = component.name.split('-');
            component.brand = parts[0];
          }
          break;
      }
    }
    
    // 提取型号信息（如果尚未提取）
    if (!component.model) {
      // 根据组件类型提取型号
      switch(componentType) {
        case 'cpu':
          // CPU型号提取
          if (component.brand === '英特尔' || component.name.includes('Intel')) {
            const match = component.name.match(/i[3579]-\d{4,5}[A-Za-z]*|\d{4}[A-Za-z]*/);
            if (match) component.model = match[0];
          } else if (component.brand === 'AMD' || component.name.includes('AMD')) {
            const match = component.name.match(/Ryzen\s*\d\s*\d{4}[A-Za-z]*|锐龙\s*\d\s*\d{4}[A-Za-z]*/);
            if (match) component.model = match[0];
          }
          break;
          
        case 'gpu':
          // 显卡型号提取
          const gpuMatch = component.name.match(/RTX\s*\d{4}(\s*[A-Za-z]+)?|GTX\s*\d{4}(\s*[A-Za-z]+)?|RX\s*\d{4}(\s*[A-Za-z]+)?|Quadro\s*[A-Za-z\d]+|P\d{4}/i);
          if (gpuMatch) component.model = gpuMatch[0];
          break;
          
        case 'motherboard':
        case 'mainboard':
          // 主板型号提取
          if (component.brand && component.name) {
            // 移除品牌部分
            component.model = component.name.replace(component.brand, '').trim();
            // 如果仍然过长，尝试提取主要部分
            if (component.model.length > 20) {
              const match = component.model.match(/[A-Z]\d{1,3}[A-Z\-]*/i);
              if (match) component.model = match[0];
            }
          }
          break;
          
        default:
          // 通用型号提取：使用名称中的非品牌部分
          if (component.brand && component.name) {
            // 移除品牌部分获取型号
            let model = component.name.replace(component.brand, '').trim();
            // 处理分隔符
            if (model.startsWith('-') || model.startsWith(' ')) {
              model = model.substring(1).trim();
            }
            component.model = model;
          } else if (component.name && component.name.includes(' ')) {
            // 如无品牌但有空格，将第一个空格后的内容作为型号
            const parts = component.name.split(' ');
            if (parts.length > 1) {
              component.model = parts.slice(1).join(' ');
            }
          }
          break;
      }
    }
    
    return component;
  },

  // 生成小程序码
  generateQrCode: function() {
    const { configId, pagePath } = this.data;
    
    if (!configId) return;
    
    const path = `${pagePath}?id=${configId}`;
    console.log('生成二维码 path:', path);
    
    // 调用云函数生成小程序码
    wx.cloud.callFunction({
      name: 'getQrCode',
      data: {
        path,
        width: 280
      }
    }).then(res => {
      console.log('生成二维码成功：', res);
      if (res.result && res.result.fileID) {
        this.setData({
          qrCodePath: res.result.fileID
        });
      }
    }).catch(err => {
      console.error('生成二维码失败：', err);
    });
  },

  // 保存图片
  onSaveImage: function() {
    const that = this;
    
    // 检查授权状态
    wx.getSetting({
      success(res) {
        if (!res.authSetting['scope.writePhotosAlbum']) {
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success() {
              that.drawAndSaveImage();
            },
            fail() {
              wx.showModal({
                title: '提示',
                content: '需要授权保存图片到相册',
                confirmText: '去设置',
                success(res) {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        } else {
          that.drawAndSaveImage();
        }
      }
    });
  },

  // 绘制并保存图片
  drawAndSaveImage: function() {
    const { config, totalPrice } = this.data;
    if (!config) {
      wx.showToast({
        title: '配置数据不完整',
        icon: 'none'
      });
      return;
    }

    wx.showLoading({
      title: '正在生成图片...',
    });

    const ctx = wx.createCanvasContext('shareCanvas');
    const canvasWidth = 750;
    const canvasHeight = 1800;

    // 设置黑色背景
    ctx.setFillStyle('#121212');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 1. 绘制标题栏（橙色背景）
    ctx.setFillStyle('#ff9500');
    ctx.fillRect(0, 0, canvasWidth, 100);
    
    // 1.1 绘制标题
    ctx.setFontSize(36);
    ctx.setFillStyle('#fff');
    ctx.fillText(config.title || config.name || '我的电脑配置', 30, 60);

    // 2. 绘制总价
    ctx.setFillStyle('#333');
    ctx.fillRect(0, 100, canvasWidth, 50);
    ctx.setFontSize(30);
    ctx.setFillStyle('#fff');
    ctx.fillText(`总价: ¥${totalPrice}`, 30, 135);

    // 3. 绘制配件清单标题
    ctx.setFillStyle('#333');
    ctx.fillRect(0, 150, canvasWidth, 50);
    ctx.setFontSize(28);
    ctx.setFillStyle('#ff9500');
    ctx.fillText('配件清单', 30, 185);

    // 4. 定义组件图标映射
    const componentIcons = {
      'cpu': '💻',
      'gpu': '🎮',
      'motherboard': '💻',
      'memory': '🧠',
      'ram': '🧠',
      'ssd': '💾',
      'hdd': '💾',
      'storage': '💾',
      'cooling': '❄️',
      'caseFan': '🌀',
      'powerSupply': '⚡',
      'psu': '⚡',
      'case': '📦',
      'monitor': '🖥️'
    };

    // 5. 定义组件中文名映射
    const componentNames = {
      'cpu': 'CPU',
      'gpu': '显卡',
      'motherboard': '主板',
      'memory': '内存',
      'ram': '内存',
      'ssd': '固态硬盘',
      'hdd': '机械硬盘',
      'storage': '存储',
      'cooling': 'CPU散热',
      'caseFan': '机箱散热',
      'powerSupply': '电源',
      'psu': '电源',
      'case': '机箱',
      'monitor': '显示器'
    };

    // 6. 绘制组件列表
    let yPos = 210;
    let componentCount = 0;

    // 直接列出要渲染的组件类型（按照截图中的顺序）
    const componentTypes = ['cpu', 'gpu', 'motherboard', 'memory', 'ssd', 'hdd', 'cooling', 'caseFan', 'powerSupply', 'case', 'monitor'];
    
    componentTypes.forEach(type => {
      // 尝试获取组件数据（从各种可能的位置）
      let component = config[type];
      
      if (component) {
        componentCount++;
        
        // 绘制组件背景
        ctx.setFillStyle('#222');
        ctx.fillRect(0, yPos, canvasWidth, 140);
        
        // 绘制组件图标
        ctx.setFontSize(28);
        ctx.setFillStyle('#fff');
        ctx.fillText(componentIcons[type] || '📦', 30, yPos + 40);
        
        // 绘制组件类型名称
        ctx.setFontSize(28);
        ctx.setFillStyle('#ff9500');
        ctx.fillText(componentNames[type] || type, 70, yPos + 40);
        
        // 绘制组件名称
        ctx.setFontSize(26);
        ctx.setFillStyle('#fff');
        const name = component.name || '';
        const displayName = name.length > 25 ? name.substring(0, 23) + '...' : name;
        ctx.fillText(displayName, 70, yPos + 80);
        
        // 绘制组件品牌（优先使用提取的品牌，否则显示品牌字段）
        ctx.setFontSize(22);
        ctx.setFillStyle('#999');
        ctx.fillText(`品牌: ${component.brand || ''}`, 70, yPos + 120);
        
        // 绘制组件规格（优先使用提取的型号，否则显示规格字段）
        if (component.model || component.spec) {
          ctx.setFontSize(22);
          ctx.setFillStyle('#999');
          ctx.fillText(component.model || component.spec || '', 250, yPos + 120);
        }
        
        // 绘制价格
        const price = component.price || component['价格'] || '0';
        ctx.setFontSize(30);
        ctx.setFillStyle('#ff9500');
        ctx.fillText(`¥${price}`, 600, yPos + 40);
        
        yPos += 150;
      }
    });
    
    // 7. 如果没有找到组件，显示提示
    if (componentCount === 0) {
      ctx.setFillStyle('#444');
      ctx.fillRect(0, 210, canvasWidth, 100);
      ctx.setFontSize(30);
      ctx.setFillStyle('#fff');
      ctx.fillText('未找到配置组件数据', 200, 270);
    }
    
    // 8. 添加小程序二维码
    const qrCodeY = Math.max(yPos + 50, canvasHeight - 250);
    ctx.setFillStyle('#222');
    ctx.fillRect(0, qrCodeY, canvasWidth, 150);
    
    // 绘制二维码提示文字
    ctx.setFontSize(24);
    ctx.setFillStyle('#fff');
    ctx.fillText('扫描二维码，使用攒机喵小程序', 50, qrCodeY + 40);
    
    // 绘制二维码说明
    ctx.setFontSize(20);
    ctx.setFillStyle('#aaa');
    ctx.fillText('一键定制您的专属电脑配置', 50, qrCodeY + 70);
    
    // 加载并绘制二维码图片
    wx.getImageInfo({
      src: 'cloud://your-cloud-env-id.7063-your-cloud-env-id-1349103669/gh_4f3461424cf8_258.jpg',
      success: function(res) {
        // 绘制二维码 - 在页脚区域的右侧
        ctx.drawImage(res.path, 500, qrCodeY + 10, 120, 120);
        
        // 9. 绘制页脚
        const footerY = qrCodeY + 150;
        ctx.setFillStyle('#222');
        ctx.fillRect(0, footerY, canvasWidth, 80);
        
        ctx.setFontSize(24);
        ctx.setFillStyle('#999');
        ctx.fillText('最机喵小程序 - 专业电脑配置助手', 30, footerY + 50);
        
        // 10. 完成绘制并保存
        ctx.draw(false, () => {
          setTimeout(() => {
            wx.canvasToTempFilePath({
              canvasId: 'shareCanvas',
              success: (res) => {
                wx.hideLoading();
                wx.saveImageToPhotosAlbum({
                  filePath: res.tempFilePath,
                  success: () => {
                    wx.showToast({
                      title: '保存成功',
                      icon: 'success'
                    });
                  },
                  fail: (err) => {
                    console.error('保存失败：', err);
                    wx.showToast({
                      title: '保存失败',
                      icon: 'none'
                    });
                  }
                });
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('生成图片失败：', err);
                wx.showToast({
                  title: '生成图片失败',
                  icon: 'none'
                });
              }
            });
          }, 500); // 增加延迟时间，确保绘制完成
        });
      },
      fail: function(err) {
        console.error('加载二维码图片失败：', err);
        // 即使二维码加载失败，也继续绘制其余部分
        // 9. 绘制页脚
        const footerY = qrCodeY + 150;
        ctx.setFillStyle('#222');
        ctx.fillRect(0, footerY, canvasWidth, 80);
        
        ctx.setFontSize(24);
        ctx.setFillStyle('#999');
        ctx.fillText('最机喵小程序 - 专业电脑配置助手', 30, footerY + 50);
        
        // 10. 完成绘制并保存
        ctx.draw(false, () => {
          setTimeout(() => {
            wx.canvasToTempFilePath({
              canvasId: 'shareCanvas',
              success: (res) => {
                wx.hideLoading();
                wx.saveImageToPhotosAlbum({
                  filePath: res.tempFilePath,
                  success: () => {
                    wx.showToast({
                      title: '保存成功',
                      icon: 'success'
                    });
                  },
                  fail: (err) => {
                    console.error('保存失败：', err);
                    wx.showToast({
                      title: '保存失败',
                      icon: 'none'
                    });
                  }
                });
              },
              fail: (err) => {
                wx.hideLoading();
                console.error('生成图片失败：', err);
                wx.showToast({
                  title: '生成图片失败',
                  icon: 'none'
                });
              }
            });
          }, 500); // 增加延迟时间，确保绘制完成
        });
      }
    });
  },

  // 导入配置
  importConfig: function() {
    const { configId, config } = this.data;
    
    // 如果有本地配置数据，使用本地数据
    if (config) {
      this.importLocalConfig(config);
      return;
    }
    
    // 如果有配置ID，从云端导入
    if (!configId) {
      wx.showToast({
        title: '无效的配置ID',
        icon: 'none'
      });
      return;
    }
    
    // 直接导入，无需检查登录状态
    wx.showLoading({
      title: '正在导入...',
    });
    
    wx.cloud.callFunction({
      name: 'importConfig',
      data: {
        configId
      }
    }).then(res => {
      wx.hideLoading();
      
      if (res.result && res.result.success) {
        wx.showToast({
          title: '导入成功',
          icon: 'success'
        });
        
        // 导入成功后跳转到配置页
        setTimeout(() => {
          this.goToConfig();
        }, 1500);
      } else {
        wx.showToast({
          title: res.result.message || '导入失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      wx.hideLoading();
      console.error('导入失败：', err);
      wx.showToast({
        title: '导入失败，请重试',
        icon: 'none'
      });
    });
  },
  
  // 导入本地配置
  importLocalConfig: function(config) {
    wx.showLoading({
      title: '正在导入...',
    });
    
    try {
      // 准备配置数据
      const components = {};
      
      // 处理配置组件数据
      if (config.components) {
        // 如果有标准化的components字段
        Object.keys(config.components).forEach(key => {
          if (config.components[key]) {
            components[key] = config.components[key];
          }
        });
      } else {
        // 如果使用旧格式，每个组件类型是顶级字段
        const componentTypes = [
          'cpu', 'motherboard', 'ram', 'memory', 'gpu', 
          'storage', 'ssd', 'hdd', 'psu', 'powerSupply', 
          'case', 'cooling', 'caseFan', 'monitor'
        ];
        
        componentTypes.forEach(type => {
          // 处理字段名映射
          const mappedType = this.mapComponentType(type);
          
          if (config[type] && !components[mappedType]) {
            components[mappedType] = config[type];
          }
        });
      }
      
      console.log('处理后的组件数据:', components);
      
      // 将配置保存到全局数据
      const app = getApp();
      app.globalData.selectedItems = components;
      app.globalData.configName = config.title || config.name || '导入的配置';
      
      wx.hideLoading();
      
      wx.showToast({
        title: '导入成功',
        icon: 'success'
      });
      
      // 导入成功后跳转到配置页
      setTimeout(() => {
        this.goToConfig();
      }, 1500);
    } catch (error) {
      wx.hideLoading();
      console.error('处理配置数据失败:', error);
      
      wx.showToast({
        title: '导入失败',
        icon: 'none'
      });
    }
  },
  
  // 组件类型名称映射
  mapComponentType: function(type) {
    const mapping = {
      'memory': 'ram',
      'ram': 'ram',
      'powerSupply': 'psu',
      'psu': 'psu',
      'ssd': 'storage',
      'hdd': 'storage'
    };
    
    return mapping[type] || type;
  },

  // 返回配置页
  goToConfig: function() {
    wx.reLaunch({
      url: '/pages/config/config',
    });
  },

  // 分享给朋友
  onShareAppMessage: function() {
    const { config } = this.data;
    const title = config && config.title 
      ? `【${config.title}】电脑配置方案，总价: ¥${this.data.totalPrice}`
      : '我的电脑配置方案，快来看看吧！';
      
    // 生成本地分享路径，不依赖configId
    return {
      title,
      path: `pages/shared/shared?fromLocal=true`, 
      imageUrl: '/images/share-bg.jpg'
    };
  }
}); 