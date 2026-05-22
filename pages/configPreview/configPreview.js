const app = getApp();

Page({
  data: {
    config: null,
    totalPrice: 0,
    configName: '我的配置',
    loading: true,
    tableData: [],
    componentTypes: [
      { id: 'cpu', name: 'CPU', icon: '📊' },
      { id: 'gpu', name: '显卡', icon: '🎮' },
      { id: 'motherboard', name: '主板', icon: '💻' },
      { id: 'ram', name: '内存', icon: '🔢' },
      { id: 'storage', name: '存储', icon: '💾' },
      { id: 'cooling', name: '散热', icon: '❄️' },
      { id: 'caseFan', name: '机箱散热', icon: '🌀' },
      { id: 'psu', name: '电源', icon: '⚡' },
      { id: 'case', name: '机箱', icon: '🖥️' },
      { id: 'monitor', name: '显示器', icon: '🖥️' }
    ]
  },

  onLoad: function(options) {
    // 检查是否从分享链接进入
    if (options.fromShare) {
      console.log('从分享链接进入预览页');
      // 如果是从分享进入，尝试从全局数据获取配置
      const sharedConfig = app.globalData.sharedConfig;
      if (sharedConfig) {
        // 初始化表格数据
        const tableData = this.formatTableData(sharedConfig);
        
        this.setData({
          config: sharedConfig,
          totalPrice: sharedConfig.totalPrice || 0,
          configName: sharedConfig.name || '我的配置',
          tableData: tableData,
          loading: false
        });
        return;
      }
    }

    // 正常从配置页进入
    // 从全局数据获取临时配置
    const tempConfig = app.globalData.tempConfig;
    
    if (!tempConfig || !tempConfig.components) {
      // 没有配置数据，显示错误
      wx.showToast({
        title: '未找到配置数据',
        icon: 'none',
        duration: 2000
      });
      
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
      
      return;
    }

    // 初始化表格数据
    const tableData = this.formatTableData(tempConfig);
    
    this.setData({
      config: tempConfig,
      totalPrice: tempConfig.totalPrice || 0,
      configName: tempConfig.name || '我的配置',
      tableData: tableData,
      loading: false
    });
  },
  
  // 格式化表格数据 - 增强版
  formatTableData: function(config) {
    const tableData = [];
    const components = config.components || config.selectedItems || {};
    
    // 获取组件规格映射 - 排序为每个组件类型最重要的几个规格
    const specMapping = {
      cpu: ['核心数', '频率', '接口'],
      motherboard: ['芯片组', '接口', '内存插槽'],
      ram: ['容量', '频率', '类型'],
      gpu: ['显存', '核心频率', '位宽'],
      storage: ['容量', '类型', '接口'],
      psu: ['功率', '80PLUS认证'],
      case: ['类型', '尺寸'],
      cooling: ['类型', '散热形式', '风扇尺寸'],
      caseFan: ['类型', '尺寸', '风量'],
      monitor: ['尺寸', '分辨率', '刷新率']
    };
    
    // 按照组件类型的优先级顺序添加组件
    this.data.componentTypes.forEach(type => {
      const component = components[type.id];
      if (component) {
        const quantity = component.quantity || 1;
        const price = component.price || component['价格'] || 0;
        // 不使用单独的品牌字段，因为品牌已包含在名称中
        
        // 准备规格列表并删除重复信息
        let specs = [];
        if (component.specs && Array.isArray(component.specs)) {
          // 从组件的规格数据中过滤掉已在显示名称中包含的信息
          specs = component.specs
            .filter(spec => 
              !spec.label.includes('品牌') && 
              !spec.label.includes('名称') && 
              !spec.label.includes('型号') && 
              !spec.label.includes('价格')
            )
            .slice(0, 3);
        } else {
          // 从组件的属性中构建规格数据
          const relevantSpecs = specMapping[type.id] || [];
          specs = relevantSpecs
            .filter(spec => component[spec] && 
              // 确保规格值未在组件名称中出现
              !component.name.includes(component[spec])
            )
            .map(spec => ({
              label: spec,
              value: component[spec]
            }));
        }
        
        // 提取品牌和型号信息 - 使用增强的提取逻辑
        const brandAndModel = this.extractBrandAndModel(component, type.id);
        
        // 添加表格行
        tableData.push({
          type: type.name,
          icon: type.icon,
          name: component.name || component['名称'] || '未知组件',
          price: price,
          quantity: quantity,
          subtotal: price * quantity,
          specs: specs,
          brand: brandAndModel.brand,
          model: brandAndModel.model
        });
      }
    });
    
    return tableData;
  },
  
  // 提取品牌和型号的辅助函数 - 参考配置对比页面的逻辑
  extractBrandAndModel: function(component, componentType) {
    let brand = '';
    let model = '';
    
    // 首先尝试从直接的品牌和型号字段获取
    if (component.brand) brand = component.brand;
    else if (component['品牌']) brand = component['品牌'];
    
    if (component.model) model = component.model;
    else if (component['型号']) model = component['型号'];
    
    // 如果有规格数组，尝试从中提取
    if (component.specs && Array.isArray(component.specs)) {
      for (const spec of component.specs) {
        if (!brand && (spec.label === '品牌' || spec.label.includes('品牌') || spec.label === 'brand')) {
          brand = spec.value;
        }
        if (!model && (spec.label === '型号' || spec.label.includes('型号') || 
                      spec.label === 'model' || spec.label.includes('系列'))) {
          model = spec.value;
        }
      }
    }
    
    // 如果还没有找到，根据组件类型从组件名称中提取
    if (!brand || !model) {
      // 根据组件类型使用不同的提取策略
      switch(componentType) {
        case 'cpu':
          // CPU品牌提取
          if (!brand) {
            if (component.name) {
              if (component.name.includes('Intel') || component.name.includes('英特尔') ||
                  component.name.includes('酷睿') || component.name.includes('奔腾') || 
                  component.name.includes('赛扬')) {
                brand = '英特尔';
              } else if (component.name.includes('AMD') || component.name.includes('锐龙') || 
                         component.name.includes('Ryzen')) {
                brand = 'AMD';
              }
            }
          }
          
          // CPU型号提取
          if (!model && component.name) {
            // 提取常见CPU型号模式
            let match;
            if (brand === '英特尔') {
              match = component.name.match(/i[3579]-\d{4,5}[A-Za-z]*|\d{4}[A-Za-z]*/);
            } else if (brand === 'AMD') {
              match = component.name.match(/Ryzen\s*\d\s*\d{4}[A-Za-z]*|锐龙\s*\d\s*\d{4}[A-Za-z]*/);
            }
            if (match) model = match[0];
          }
          break;
          
        case 'gpu':
          // 显卡品牌提取
          if (!brand) {
            if (component.name) {
              if (component.name.includes('NVIDIA') || component.name.includes('RTX') || 
                  component.name.includes('GTX') || component.name.includes('Quadro')) {
                brand = 'NVIDIA';
              } else if (component.name.includes('AMD') || component.name.includes('Radeon') || 
                         component.name.includes('RX')) {
                brand = 'AMD';
              } else {
                // 提取显卡常见品牌
                const gpuBrands = ['华硕', 'ASUS', '微星', 'MSI', '技嘉', 'GIGABYTE', 
                                  '七彩虹', 'Colorful', '影驰', 'GALAX', '索泰', 'ZOTAC', 
                                  '耕升', 'GAINWARD', '蓝宝石', 'SAPPHIRE', '讯景', 'XFX'];
                for (const gpuBrand of gpuBrands) {
                  if (component.name.includes(gpuBrand)) {
                    brand = gpuBrand;
                    break;
                  }
                }
              }
            }
          }
          
          // 显卡型号提取
          if (!model && component.name) {
            // 提取显卡型号
            const match = component.name.match(/RTX\s*\d{4}(\s*[A-Za-z]+)?|GTX\s*\d{4}(\s*[A-Za-z]+)?|RX\s*\d{4}(\s*[A-Za-z]+)?|Quadro\s*[A-Za-z\d]+|P\d{4}/i);
            if (match) model = match[0];
          }
          break;
          
        case 'motherboard':
          // 主板品牌提取
          if (!brand && component.name) {
            const motherboardBrands = ['华硕', 'ASUS', '微星', 'MSI', '技嘉', 'GIGABYTE', 
                                      '华擎', 'ASRock', '铭瑄', 'MAXSUN', '七彩虹', 'Colorful', 
                                      '映泰', 'BIOSTAR'];
            for (const mbBrand of motherboardBrands) {
              if (component.name.includes(mbBrand)) {
                brand = mbBrand;
                break;
              }
            }
          }
          
          // 主板型号提取（通常是名称中的系列和型号）
          if (!model && component.name && brand) {
            // 移除品牌名和常见前缀
            let nameWithoutBrand = component.name.replace(brand, '').trim();
            // 提取主板型号
            model = nameWithoutBrand;
          }
          break;
          
        // 其他组件类型的处理可以根据需要添加
          
        default:
          // 默认情况：尝试从名称中提取品牌和型号
          if (!brand && component.name) {
            // 如果名称中有空格，取第一个词作为品牌
            if (component.name.includes(' ')) {
              const nameParts = component.name.split(' ');
              brand = nameParts[0];
              
              // 如果没有型号，尝试从名称的其余部分提取
              if (!model && nameParts.length > 1) {
                model = nameParts.slice(1).join(' ');
              }
            } else if (component.name.includes('-')) {
              // 如果名称有连字符，尝试以连字符分割
              const nameParts = component.name.split('-');
              brand = nameParts[0];
              
              // 如果没有型号，尝试从名称的其余部分提取
              if (!model && nameParts.length > 1) {
                model = nameParts.slice(1).join('-');
              }
            }
          }
          break;
      }
    }
    
    return { brand, model };
  },
  
  // 返回配置页面
  backToConfig: function() {
    wx.navigateBack();
  },
  
  // 分享配置
  shareConfig: function() {
    // 显示分享选项
    wx.showActionSheet({
      itemList: ['分享给好友', '生成分享图片'],
      success: (res) => {
        if (res.tapIndex === 0) {
          // 分享给好友 - 自动触发onShareAppMessage
          wx.showShareMenu({
            withShareTicket: true,
            menus: ['shareAppMessage']
          });
        } else if (res.tapIndex === 1) {
          // 直接生成并保存分享图片
          this.drawAndSaveImage();
        }
      }
    });
  },
  
  // 绘制并保存图片
  drawAndSaveImage: function() {
    const { config, tableData, totalPrice } = this.data;
    
    if (!config) {
      wx.showToast({
        title: '配置数据不完整',
        icon: 'none'
      });
      return;
    }

    // 检查授权状态
    wx.getSetting({
      success: res => {
        if (!res.authSetting['scope.writePhotosAlbum']) {
          wx.authorize({
            scope: 'scope.writePhotosAlbum',
            success: () => {
              this.startDrawImage();
            },
            fail: () => {
              wx.showModal({
                title: '提示',
                content: '需要授权保存图片到相册',
                confirmText: '去设置',
                success: res => {
                  if (res.confirm) {
                    wx.openSetting();
                  }
                }
              });
            }
          });
        } else {
          this.startDrawImage();
        }
      }
    });
  },
  
  // 开始绘制图片
  startDrawImage: function() {
    wx.showLoading({
      title: '正在生成图片...',
    });

    const { tableData, totalPrice, configName } = this.data;
    const ctx = wx.createCanvasContext('shareCanvas');
    const canvasWidth = 750;
    const canvasHeight = 1800; // 增加高度以确保显示所有组件

    // 设置黑色背景
    ctx.setFillStyle('#121212');
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);

    // 1. 绘制标题栏（橙色背景）
    ctx.setFillStyle('#ff9500');
    ctx.fillRect(0, 0, canvasWidth, 100);
    
    // 1.1 绘制标题
    ctx.setFontSize(34);
    ctx.setFillStyle('#fff');
    ctx.fillText("攒机喵PC配置助手", 30, 60);

    // 2. 绘制总价
    ctx.setFillStyle('#2c2c2c');
    ctx.fillRect(0, 100, canvasWidth, 50);
    ctx.setFontSize(28);
    ctx.setFillStyle('#fff');
    ctx.fillText(`总价: ¥${totalPrice}`, 30, 135);

    // 3. 绘制配件清单标题
    ctx.setFillStyle('#2c2c2c');
    ctx.fillRect(0, 150, canvasWidth, 40);
    ctx.setFontSize(26);
    ctx.setFillStyle('#fff');
    ctx.fillText('配件清单', 30, 180);

    // 4. 绘制组件列表
    let yPos = 190;
    let componentCount = 0;
    
    // 组件图标映射
    const componentIcons = {
      'CPU': '💻',
      'cpu': '💻',
      '显卡': '🎮',
      'gpu': '🎮',
      '主板': '🖥️',
      'motherboard': '🖥️',
      '内存': '🧠',
      'memory': '🧠',
      'ram': '🧠',
      '存储': '💾',
      'storage': '💾',
      'ssd': '💾',
      'hdd': '💾',
      '固态': '💾',
      '散热': '❄️',
      'cooling': '❄️',
      'cooler': '❄️',
      '机箱散热': '🌀',
      'caseFan': '🌀',
      '电源': '⚡',
      'powerSupply': '⚡',
      'psu': '⚡',
      '机箱': '📦',
      'case': '📦',
      '显示器': '🖥️',
      'monitor': '🖥️'
    };
    
    // 绘制组件表格
    if (tableData && tableData.length > 0) {
      tableData.forEach(item => {
        componentCount++;
        
        // 计算每个组件需要的总高度 - 减少高度以增加密度
        const componentHeight = 120; // 固定高度以确保紧凑排列
        
        // 绘制组件背景 - 交替颜色
        ctx.setFillStyle(componentCount % 2 === 0 ? '#1a1a1a' : '#222222');
        ctx.fillRect(0, yPos, canvasWidth, componentHeight);
        
        // 绘制组件分隔线
        ctx.setStrokeStyle('#333333');
        ctx.beginPath();
        ctx.moveTo(0, yPos);
        ctx.lineTo(canvasWidth, yPos);
        ctx.stroke();
        
        // 绘制组件图标和类型
        const componentType = item.type || '';
        const icon = componentIcons[item.type] || componentIcons[componentType.toLowerCase()] || '📦';
        
        ctx.setFontSize(22);
        ctx.setFillStyle('#fff');
        ctx.fillText(icon, 20, yPos + 30);
        
        // 绘制组件类型名称
        ctx.setFontSize(22);
        ctx.setFillStyle('#ff9500');
        ctx.fillText(componentType + ':', 60, yPos + 30);
        
        // 绘制组件名称
        ctx.setFontSize(20);
        ctx.setFillStyle('#fff');
        const name = item.name || '';
        const displayName = name.length > 30 ? name.substring(0, 28) + '...' : name;
        ctx.fillText(displayName, 140, yPos + 30);
        
        // 绘制价格
        ctx.setFontSize(22);
        ctx.setFillStyle('#ff9500');
        ctx.fillText(`¥${item.subtotal || item.price}`, 630, yPos + 30);
        
        // 绘制品牌
        ctx.setFontSize(18);
        ctx.setFillStyle('#aaaaaa');
        ctx.fillText("品牌:", 60, yPos + 60);
        
        // 绘制型号
        ctx.setFontSize(18);
        ctx.setFillStyle('#aaaaaa');
        ctx.fillText("型号:", 60, yPos + 90);
        
        // 使用提取的品牌和型号
        ctx.fillText(item.brand || '', 100, yPos + 60);
        ctx.fillText(item.model || '', 100, yPos + 90);
        
        // 显示额外的规格信息
        if (item.specs && item.specs.length > 0) {
          let extraInfo = "";
          let secondExtraInfo = "";
          
          // 遍历规格，显示额外信息
          item.specs.forEach((spec, index) => {
            if (index === 0) {
              extraInfo = `${spec.label}: ${spec.value}`;
            } else if (index === 1) {
              secondExtraInfo = `${spec.label}: ${spec.value}`;
            }
          });
          
          // 显示额外信息（如有）
          if (extraInfo) {
            ctx.fillText(extraInfo, 260, yPos + 60);
          }
          
          // 显示第二条额外信息（如有）
          if (secondExtraInfo) {
            ctx.fillText(secondExtraInfo, 260, yPos + 90);
          }
          
          // 如果有数量，显示数量
          if (item.quantity && item.quantity > 1) {
            ctx.setFontSize(18);
            ctx.setFillStyle('#aaaaaa');
            ctx.fillText(`数量: ${item.quantity}`, 550, yPos + 60);
          }
        }
        
        // 更新Y坐标 - 减少间距
        yPos += componentHeight + 1; // 最小间距，确保高密度显示
      });
    } else {
      // 如果没有组件数据
      ctx.setFillStyle('#444');
      ctx.fillRect(0, 220, canvasWidth, 100);
      ctx.setFontSize(30);
      ctx.setFillStyle('#fff');
      ctx.fillText('未找到配置组件数据', 200, 270);
    }
    
    // 5. 添加小程序二维码
    const qrCodeY = Math.min(yPos + 30, canvasHeight - 250);
    ctx.setFillStyle('#1a1a1a');
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
        
        // 6. 绘制页脚
        const footerY = qrCodeY + 150;
        ctx.setFillStyle('#1a1a1a');
        ctx.fillRect(0, footerY, canvasWidth, 60);
        
        ctx.setFontSize(20);
        ctx.setFillStyle('#aaaaaa');
        ctx.fillText('攒机喵 - 专业电脑配置助手', 30, footerY + 40);
        
        // 完成绘制并保存
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
        // 6. 绘制页脚
        const footerY = qrCodeY + 150;
        ctx.setFillStyle('#1a1a1a');
        ctx.fillRect(0, footerY, canvasWidth, 60);
        
        ctx.setFontSize(20);
        ctx.setFillStyle('#aaaaaa');
        ctx.fillText('攒机喵 - 专业电脑配置助手', 30, footerY + 40);
        
        // 完成绘制并保存
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
  
  // 保存配置到云数据库
  saveToCloud: function(callback) {
    wx.showLoading({
      title: '准备分享...',
    });
    
    // 获取完整配置数据，包括所有组件
    const originalConfig = this.data.config;
    const components = originalConfig.components || originalConfig.selectedItems || {};
    
    // 确保所有组件数据完整，特别注意caseFan
    // 记录已处理组件的日志，方便调试
    console.log('保存到云端的组件数据：', components);
    console.log('机箱散热数据：', components.caseFan);
    
    // 准备要保存的配置数据 - 使用统一的数据结构
    const configToSave = {
      // 使用标准数据结构 - components对象包含所有组件
      components: components,
      totalPrice: this.data.totalPrice,
      name: this.data.configName,
      title: this.data.configName,
      createdAt: new Date(),
      updateTime: new Date()
    };
    
    console.log('最终保存的完整配置数据:', configToSave);
    
    // 调用云函数保存配置
    wx.cloud.callFunction({
      name: 'saveConfig',
      data: {
        config: configToSave
      },
      success: res => {
        wx.hideLoading();
        console.log('保存配置结果:', res);
        if (res.result && res.result.success) {
          // 保存配置ID到全局变量
          app.globalData.currentConfigId = res.result.configId;
          
          if (callback) callback();
        } else {
          wx.showToast({
            title: '保存配置失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        wx.hideLoading();
        console.error('保存配置失败:', err);
        wx.showToast({
          title: '保存配置失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 保存配置
  saveConfig: function() {
    const app = getApp();
    
    // 使用统一的登录方法
    if (app.globalData.hasLogin) {
      // 用户已登录，直接保存
      this.saveToCloud(() => {
        wx.showToast({
          title: '配置已保存',
          icon: 'success'
        });
      });
    } else {
      // 用户未登录，使用app.login
      app.login(() => {
        // 登录成功后重新检查状态再保存
        if (app.globalData.hasLogin) {
          this.saveToCloud(() => {
            wx.showToast({
              title: '配置已保存',
              icon: 'success'
            });
          });
        }
      });
    }
  },
  
  // 分享给微信好友
  onShareAppMessage: function() {
    // 不再保存到云端，直接使用本地数据分享
    return {
      title: `我的电脑配置方案：¥${this.data.totalPrice}`,
      path: `/pages/configPreview/configPreview?fromShare=true`,
      imageUrl: '/images/share-bg.jpg'
    };
  },
  
  // 生成并保存分享图片 - 兼容旧版代码
  generateShareImage: function() {
    // 直接调用绘制和保存图片的函数
    this.drawAndSaveImage();
  }
}); 