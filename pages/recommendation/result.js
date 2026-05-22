// 引入推荐服务
const recommendService = require('./recommendation-service');

const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    userPreference: {}, // 用户选择的偏好
    recommendConfig: {}, // 推荐的配置
    performanceScore: 0, // 性能评分
    valueScore: 0,       // 性价比评分
    isLoading: true,     // 加载状态
    
    // 组件类型配置
    componentTypes: [
      { id: 'cpu', name: 'CPU', icon: 'cpu' },
      { id: 'motherboard', name: '主板', icon: 'motherboard' },
      { id: 'gpu', name: '显卡', icon: 'gpu' },
      { id: 'ram', name: '内存', icon: 'ram' },
      { id: 'storage', name: '存储', icon: 'storage' },
      { id: 'cooling', name: '散热器', icon: 'cooler' },
      { id: 'psu', name: '电源', icon: 'psu' },
      { id: 'case', name: '机箱', icon: 'case' }
    ],
    
    // 展开状态
    expandedInfo: true,
    
    // 组件变更突出显示
    highlightedComponents: {}
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 设置导航栏标题
    wx.setNavigationBarTitle({
      title: '配置方案'
    });
    
    // 获取全局存储的推荐结果
    const app = getApp();
    let recommendResult = null;
    
    if (app.globalData && app.globalData.recommendResult) {
      recommendResult = app.globalData.recommendResult;
      
      // 更新页面数据
      this.setData({
        recommendConfig: recommendResult,
        userPreference: recommendResult.preference,
        performanceScore: recommendResult.performanceScore,
        valueScore: recommendResult.valueScore,
        isLoading: false
      });
      
      // 保存当前推荐结果，用于后续比较
      this.currentRecommendation = recommendResult;
    } else {
      // 如果没有推荐结果，可能是直接访问了结果页面
      // 显示错误提示并返回
      wx.showToast({
        title: '没有配置方案数据',
        icon: 'none',
        duration: 2000
      });
      
      // 2秒后返回
      setTimeout(() => {
        wx.navigateBack();
      }, 2000);
    }
  },
  
  /**
   * 切换组件列表展开状态
   */
  toggleExpandInfo: function() {
    this.setData({
      expandedInfo: !this.data.expandedInfo
    });
  },
  
  /**
   * 返回重新推荐
   */
  backToRecommend: function() {
    // 直接返回上一页
    wx.navigateBack();
  },
  
  /**
   * 重新生成推荐方案
   */
  regenerateRecommendation: function() {
    // 显示加载状态
    this.setData({
      isLoading: true
    });
    
    // 获取当前用户偏好
    const userPreference = this.data.userPreference;
    const previousConfig = this.currentRecommendation;
    
    // 调用服务重新生成推荐
    recommendService.regenerateRecommendation(userPreference, previousConfig)
      .then(newRecommendation => {
        console.log('重新生成推荐结果:', newRecommendation);
        
        // 生成变更突出显示
        const highlights = recommendService.generateHighlights(previousConfig, newRecommendation);
        
        // 更新页面数据
        this.setData({
          recommendConfig: newRecommendation,
          performanceScore: newRecommendation.performanceScore,
          valueScore: newRecommendation.valueScore,
          highlightedComponents: highlights,
          isLoading: false
        });
        
        // 更新当前推荐结果引用
        this.currentRecommendation = newRecommendation;
        
        // 保存到全局数据
        const app = getApp();
        app.globalData = app.globalData || {};
        app.globalData.recommendResult = newRecommendation;
      })
      .catch(error => {
        console.error('重新生成推荐方案失败:', error);
        
        // 停止加载
        this.setData({
          isLoading: false
        });
        
        // 显示错误提示
        wx.showToast({
          title: '重新生成失败，请重试',
          icon: 'none'
        });
      });
  },
  
  /**
   * 前往配置页调整配置
   */
  startConfig: function() {
    console.log('开始配置，加载推荐的组件到配置页');
    try {
      // 获取当前推荐的组件
      const components = this.data.recommendConfig.components || {};
      console.log('推荐组件数据:', components);
      
      // 创建selectedItems对象，用于传递到配置页
      const selectedItems = {};
      
      // 遍历所有组件，确保数据格式正确
      for (const type in components) {
        if (components.hasOwnProperty(type)) {
          const component = components[type];
          
          // 确保组件有所有必须的属性
          if (component) {
            // 确保有正确的ID
            const id = component.id || `component_${type}_${Date.now()}`;
            
            // 处理组件数据，确保有必要的属性
            selectedItems[type] = {
              id: id,
              type: type,
              ...component,
              // 确保规格数据存在
              specs: component.specs || [],
              // 确保名称存在
              name: component.name || component.名称 || `${component.brand || component.品牌 || ''}${component.model || component.型号 || '默认'}`,
              // 确保品牌存在
              brand: component.brand || component.品牌 || '',
              // 确保价格存在
              price: component.price || 0
            };
            
            // 生成增强的specs字段字符串，用于更好的显示
            // 根据不同组件类型生成不同的规格文本
            if (type === 'cpu') {
              selectedItems[type].specsText = `${component.coreCount || component['核心数'] || ''}核${component.threadCount || component['线程数'] || ''}线程 ${component.frequency || component['基础频率'] || ''} ${component.socket || component['接口'] || ''}`;
            } else if (type === 'motherboard') {
              selectedItems[type].specsText = `${component.chipset || component['芯片组'] || ''} ${component.socket || component['接口'] || ''} ${component.memoryType || component['内存类型'] || ''} ${component.formFactor || component['尺寸'] || ''}`;
            } else if (type === 'ram') {
              selectedItems[type].specsText = `${component.capacity || component['容量'] || ''} ${component.frequency || component['频率'] || ''} ${component.spec || component['规格'] || ''}`;
            } else if (type === 'gpu') {
              selectedItems[type].specsText = `${component.series || component['系列'] || ''} ${component.vram || component['显存'] || ''} ${component.coreFrequency || component['核心频率'] || ''} ${component.power || component['功耗'] || ''}`;
            } else if (type === 'storage') {
              selectedItems[type].specsText = `${component.capacity || component['容量'] || ''} ${component.type || component['类型'] || ''} ${component.interface || component['接口'] || ''} ${component.readSpeed || component['读取速度'] || ''}`;
            } else if (type === 'psu') {
              selectedItems[type].specsText = `${component.power || component['功率'] || ''} ${component.certification || component['认证'] || ''} ${component.moduleType || component['模组类型'] || ''}`;
            } else if (type === 'case') {
              selectedItems[type].specsText = `${component.type || component['类型'] || ''} ${component.size || component['尺寸'] || ''} ${component.material || component['材质'] || ''} ${component.fanCount || component['风扇数量'] || ''}个风扇`;
            } else if (type === 'cooling') {
              selectedItems[type].specsText = `${component.coolingType || component['散热方式'] || ''} ${component.fanCount || component['风扇数量'] || ''}个风扇 ${component.fanSize || component['风扇尺寸'] || ''} ${component.tdp || component['散热功率'] || ''}`;
            } else if (type === 'monitor') {
              selectedItems[type].specsText = `${component.size || component['尺寸'] || ''} ${component.resolution || component['分辨率'] || ''} ${component.refreshRate || component['刷新率'] || ''} ${component.panelType || component['面板类型'] || ''}`;
            }
            
            // 将specsText添加为specs数组中的一个项目，确保在其他页面也能显示
            if (selectedItems[type].specsText) {
              // 如果没有specs数组，创建一个
              if (!selectedItems[type].specs || !Array.isArray(selectedItems[type].specs)) {
                selectedItems[type].specs = [];
              }
              
              // 添加specsText作为一个spec项
              selectedItems[type].specs.push({
                label: '概览',
                value: selectedItems[type].specsText
              });
            }
            
            // 主板和CPU需要特殊处理，确保接口兼容性
            if (type === 'motherboard' && components.cpu) {
              selectedItems.motherboard.接口 = selectedItems.motherboard.接口 || components.cpu.接口 || components.cpu.socket || 'LGA1700';
              selectedItems.motherboard.socket = selectedItems.motherboard.socket || components.cpu.接口 || components.cpu.socket || 'LGA1700';
            }
            
            // 调试信息
            console.log(`已处理组件 ${type}:`, selectedItems[type]);
          }
        }
      }
      
      // 将选择的项目保存到全局数据
      const app = getApp();
      app.globalData.selectedItems = selectedItems;
      console.log('保存到全局数据:', app.globalData.selectedItems);
      
      // 跳转到配置页面
      wx.switchTab({
        url: '/pages/config/config',
        success: function() {
          console.log('成功跳转到配置页面');
        },
        fail: function(error) {
          console.error('跳转到配置页面失败:', error);
          wx.showToast({
            title: '跳转失败，请稍后再试',
            icon: 'none'
          });
        }
      });
    } catch (error) {
      console.error('配置跳转出错:', error);
      wx.showToast({
        title: '操作失败，请重试',
        icon: 'none'
      });
    }
  },
  
  /**
   * 保存方案
   */
  saveConfig: function() {
    // 获取当前配置
    const config = this.data.recommendConfig;
    
    // 检查是否有选择组件
    const components = config.components || {};
    const hasSelectedComponents = Object.keys(components).some(key => {
      return components[key] && (components[key].id || components[key]._id);
    });
    
    if (!hasSelectedComponents) {
      wx.showToast({
        title: '配置中没有组件',
        icon: 'none'
      });
      return;
    }
    
    // 获取应用实例
    const app = getApp();
    
    // 检查登录状态
    if (app.globalData.hasLogin) {
      // 已登录，直接保存
      this.doSaveConfig(config);
    } else {
      // 未登录，使用全局统一的登录方法
      app.login(() => {
        // 登录成功回调，重新保存
        if (app.globalData.hasLogin) {
          this.doSaveConfig(config);
        }
      });
    }
  },
  
  /**
   * 执行实际的保存配置操作
   */
  doSaveConfig: function(config) {
    // 创建配置对象
    const configToSave = {
      id: 'config_' + Date.now(),
      name: this.generateConfigName(this.data.userPreference),
      components: config.components || {},
      totalPrice: config.totalPrice || 0,
      createTime: new Date(),
      updateTime: new Date(),
      userPreference: this.data.userPreference // 保存用户偏好信息
    };
    
    console.log('准备保存配置:', configToSave);
    
    // 保存配置 - 使用全局app方法
    const app = getApp();
    app.saveUserConfig(configToSave).then(success => {
      if (success) {
        wx.showToast({
          title: '方案已保存',
          icon: 'success'
        });
        
        // 记录用户选择的配置用于未来推荐改进
        this.recordUserPreference(config);
        
        // 可以跳转到配置列表页
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/configList/configList'
          });
        }, 1500);
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('保存配置失败:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    });
  },
  
  /**
   * 生成配置名称
   */
  generateConfigName: function(preference) {
    const purposeMap = {
      'gaming': '游戏配置',
      'work': '工作配置',
      'office': '办公配置',
      'other': '通用配置'
    };
    
    const purpose = purposeMap[preference.purpose] || '自定义配置';
    const now = new Date();
    const dateStr = `${now.getMonth() + 1}月${now.getDate()}日`;
    
    return `${purpose}-${dateStr}`;
  },
  
  /**
   * 记录用户偏好
   */
  recordUserPreference: function(config) {
    // 将用户选择的配置与偏好保存到本地
    const savedPreference = {
      purpose: this.data.userPreference.purpose,
      budget: this.data.userPreference.budget,
      priority: this.data.userPreference.priority,
      selectedConfig: config,
      timestamp: Date.now()
    };
    
    // 保存到本地
    wx.setStorageSync('lastAcceptedRecommendation', savedPreference);
  },
  
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    // 分享当前推荐方案
    const config = this.data.recommendConfig;
    let title = '我的电脑配置方案';
    
    if (config && config.totalPrice) {
      title = `¥${config.totalPrice}的${this.generateConfigName(config.preference)}`;
    }
    
    return {
      title: title,
      path: '/pages/recommendation/index'
    };
  }
}) 