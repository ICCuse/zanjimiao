// app.js
App({
  onLaunch() {
    // 初始化云环境
    if (wx.cloud) {
      wx.cloud.init({
        env: 'your-cloud-env-id',
        traceUser: true
      });
      this.debugLog('云环境初始化成功');
    } else {
      console.error('请使用2.2.3以上的基础库以使用云能力');
    }
    
    // 处理资源加载失败的问题
    wx.onError((error) => {
      console.error('全局错误捕获:', error);
      if (error.includes('no such file or directory') || error.includes('Failed to load local image')) {
        console.warn('资源文件加载失败，可能是本地资源不存在');
      }
    });
    
    // 初始化全局数据
    this.initGlobalData()
    
    // 检查用户信息和登录状态
    this.checkUserInfo()
  },

  onShow: function () {
    // 需要在应用启动时执行的逻辑
  },

  // 调试日志函数
  debugLog: function(...args) {
    if (this.globalData && this.globalData.debugMode && this.globalData.debugMode.appLog) {
      console.log(...args);
    }
  },

  // 初始化全局数据
  initGlobalData: function() {
    // 首次启动时将默认预设方案写入存储
    const hasInitialized = wx.getStorageSync('app_initialized');
    if (!hasInitialized) {
      this.debugLog('首次初始化应用，写入预设方案数据');
      wx.setStorageSync('preset_plans', this.defaultPresetPlans);
      wx.setStorageSync('app_initialized', true);
    }
    
    // 从本地存储中获取各类数据
    let presetPlans = wx.getStorageSync('preset_plans');
    if (!presetPlans || presetPlans.length === 0) {
      this.debugLog('未找到预设方案数据，使用默认数据');
      presetPlans = this.defaultPresetPlans;
      wx.setStorageSync('preset_plans', presetPlans);
    }
    
    const userConfigs = wx.getStorageSync('user_configs') || [];
    const favorites = wx.getStorageSync('user_favorites') || [];
    const viewHistory = wx.getStorageSync('view_history') || [];
    const configDraft = wx.getStorageSync('config_draft') || null;
    
    this.debugLog('已加载预设方案数量:', presetPlans.length);
    
    // 设置全局数据
    this.globalData = {
      presetPlans: presetPlans, // 预设方案列表
      userConfigs: userConfigs, // 用户保存的方案列表
      favorites: favorites,     // 用户收藏的方案
      viewHistory: viewHistory, // 浏览历史
      configDraft: configDraft, // 配置草稿
      userInfo: null,           // 用户信息
      systemInfo: null,         // 系统信息
      hasLogin: false,          // 登录状态
      sharedConfig: null,       // 共享配置数据，用于本地分享
      // 添加日志控制变量
      debugMode: wx.getStorageSync('debug_mode') || {
        compatibilityLog: false, // 兼容性检查日志开关
        networkLog: false,       // 网络请求日志开关
        performanceLog: false,   // 性能测试日志开关
        appLog: true,            // 应用日志开关
        coolingDebug: false      // 散热组件筛选日志开关
      }
    };
    
    // 获取系统信息
    this.getSystemInfo();
  },
  
  // 获取系统信息
  getSystemInfo: function() {
    try {
      const systemInfo = wx.getSystemInfoSync()
      this.globalData.systemInfo = systemInfo
    } catch (e) {
      console.error('获取系统信息失败:', e)
    }
  },
  
  // 检查用户信息和登录状态
  checkUserInfo: function() {
    const userInfo = wx.getStorageSync('userInfo')
    if (userInfo) {
      this.globalData.userInfo = userInfo
      this.globalData.hasLogin = true
    }
  },
  
  // 统一的登录方法
  login: function(successCallback, failCallback) {
    // 检查是否已登录
    if (this.globalData.hasLogin) {
      this.debugLog('用户已登录，直接返回成功');
      if (typeof successCallback === 'function') {
        successCallback();
      }
      return;
    }
    
    // 引导用户前往个人中心登录
    wx.showModal({
      title: '需要登录',
      content: '请前往个人中心登录',
      confirmText: '去登录',
      success: (res) => {
        if (res.confirm) {
          // 保存当前页面路径，登录后可返回
          const pages = getCurrentPages();
          const currentPage = pages[pages.length - 1];
          const currentPath = currentPage ? currentPage.route : '';
          
          // 将当前路径保存到缓存
          if (currentPath) {
            wx.setStorageSync('login_redirect', currentPath);
          }
          
          // 跳转到个人中心
          wx.switchTab({
            url: '/pages/profile/profile',
            success: () => {
              // 用户点击去登录，我们认为操作成功了
              if (typeof successCallback === 'function') {
                successCallback();
              }
            },
            fail: (err) => {
              console.error('跳转到个人中心失败:', err);
              if (typeof failCallback === 'function') {
                failCallback(err);
              }
            }
          });
        } else {
          // 用户取消登录
          if (typeof failCallback === 'function') {
            failCallback(new Error('用户取消登录'));
          }
        }
      },
      fail: (err) => {
        console.error('显示登录提示失败:', err);
        if (typeof failCallback === 'function') {
          failCallback(err);
        }
      }
    });
  },
  
  // 保存用户配置方案
  saveUserConfig: function(config) {
    if (!config || !config.id) {
      console.error('配置方案无效')
      return false
    }
    
    return new Promise((resolve, reject) => {
      // 调用云函数保存配置
      wx.cloud.callFunction({
        name: 'saveUserConfig',
        data: {
          config: config
        }
      })
      .then(res => {
        this.debugLog('保存配置到云数据库成功:', res)
        
        // 保存成功后，更新本地缓存
        this.updateLocalUserConfigs(config)
        
        resolve(true)
      })
      .catch(err => {
        console.error('保存配置到云数据库失败:', err)
        reject(err)
      })
    })
  },
  
  // 更新本地用户配置缓存
  updateLocalUserConfigs: function(config) {
    // 获取当前用户配置列表
    let userConfigs = this.globalData.userConfigs || []
    
    // 检查是否已存在相同ID的配置
    const existIndex = userConfigs.findIndex(item => item.id === config.id)
    
    if (existIndex >= 0) {
      // 更新已有配置
      userConfigs[existIndex] = {...config, updateTime: Date.now()}
    } else {
      // 添加新配置
      userConfigs.push({
        ...config,
        createTime: Date.now(),
        updateTime: Date.now()
      })
    }
    
    // 更新全局数据和本地存储
    this.globalData.userConfigs = userConfigs
    wx.setStorageSync('user_configs', userConfigs)
  },
  
  // 获取用户保存的配置方案
  getUserConfigs: function() {
    return new Promise((resolve, reject) => {
      // 调用云函数获取配置
      wx.cloud.callFunction({
        name: 'getUserConfigs'
      })
      .then(res => {
        this.debugLog('从云数据库获取配置成功:', res);
        
        if (res.result && res.result.success) {
          // 更新本地缓存
          let configs = res.result.data || [];
          
          // 过滤掉没有有效ID的配置
          configs = configs.filter(config => config && config.id);
          
          // 处理日期格式，确保日期是JavaScript日期对象
          configs.forEach(config => {
            if (config.createTime && typeof config.createTime === 'string') {
              config.createTime = new Date(config.createTime);
            }
            if (config.updateTime && typeof config.updateTime === 'string') {
              config.updateTime = new Date(config.updateTime);
            }
          });
          
          this.debugLog('格式化后的配置数量:', configs.length);
          
          // 更新全局数据和本地存储
          this.globalData.userConfigs = configs;
          wx.setStorageSync('user_configs', configs);
          
          resolve(configs);
        } else {
          console.warn('云函数返回错误:', res.result);
          // 如果云函数返回错误，尝试使用本地缓存
          let storedConfigs = wx.getStorageSync('user_configs') || [];
          
          // 过滤本地缓存中无效ID的配置
          storedConfigs = storedConfigs.filter(config => config && config.id);
          
          this.globalData.userConfigs = storedConfigs;
          
          resolve(storedConfigs);
        }
      })
      .catch(err => {
        console.error('从云数据库获取配置失败:', err);
        
        // 如果云函数调用失败，尝试使用本地缓存
        let storedConfigs = wx.getStorageSync('user_configs') || [];
        
        // 过滤本地缓存中无效ID的配置
        storedConfigs = storedConfigs.filter(config => config && config.id);
        
        this.globalData.userConfigs = storedConfigs;
        
        resolve(storedConfigs);
      });
    });
  },
  
  // 获取某个配置方案（包括预设和用户自定义的）
  getConfigById: function(id) {
    if (!id) return null
    
    // 先从用户配置中查找
    const userConfig = this.globalData.userConfigs.find(item => item.id === id)
    if (userConfig) return userConfig
    
    // 再从预设方案中查找
    const presetConfig = this.globalData.presetPlans.find(item => item.id === id)
    if (presetConfig) {
      // 标记为预设方案
      return { ...presetConfig, isPreset: true }
    }
    
    return null
  },
  
  // 添加到收藏夹
  addToFavorites: function(configId) {
    if (!configId) return false
    
    let favorites = this.globalData.favorites || []
    
    // 如果不在收藏列表中，则添加
    if (favorites.indexOf(configId) === -1) {
      favorites.push(configId)
      this.globalData.favorites = favorites
      wx.setStorageSync('user_favorites', favorites)
      return true
    }
    
    return false
  },
  
  // 从收藏夹移除
  removeFromFavorites: function(configId) {
    if (!configId) return false
    
    let favorites = this.globalData.favorites || []
    const index = favorites.indexOf(configId)
    
    // 如果在收藏列表中，则移除
    if (index !== -1) {
      favorites.splice(index, 1)
      this.globalData.favorites = favorites
      wx.setStorageSync('user_favorites', favorites)
      return true
    }
    
    return false
  },
  
  // 检查是否在收藏夹中
  isInFavorites: function(configId) {
    const favorites = this.globalData.favorites || []
    return favorites.indexOf(configId) !== -1
  },
  
  // 添加浏览历史
  addToViewHistory: function(configId) {
    if (!configId) return
    
    let viewHistory = this.globalData.viewHistory || []
    
    // 如果已存在，先移除
    const index = viewHistory.indexOf(configId)
    if (index !== -1) {
      viewHistory.splice(index, 1)
    }
    
    // 添加到最前面
    viewHistory.unshift(configId)
    
    // 限制历史记录数量，最多保留20条
    if (viewHistory.length > 20) {
      viewHistory = viewHistory.slice(0, 20)
    }
    
    this.globalData.viewHistory = viewHistory
    wx.setStorageSync('view_history', viewHistory)
  },
  
  // 性能评估方法
  evaluatePerformance: function(config) {
    if (!config || !config.components) return null
    
    // 基础得分
    let gamingScore = 0
    let workScore = 0
    let officeScore = 0
    
    // CPU评分
    if (config.components.cpu) {
      const cpuName = config.components.cpu.name.toLowerCase()
      if (cpuName.includes('i9') || cpuName.includes('ryzen 9')) {
        gamingScore += 35
        workScore += 40
        officeScore += 25
      } else if (cpuName.includes('i7') || cpuName.includes('ryzen 7')) {
        gamingScore += 30
        workScore += 35
        officeScore += 25
      } else if (cpuName.includes('i5') || cpuName.includes('ryzen 5')) {
        gamingScore += 25
        workScore += 25
        officeScore += 25
      } else {
        gamingScore += 15
        workScore += 15
        officeScore += 20
      }
    }
    
    // GPU评分
    if (config.components.gpu) {
      const gpuName = config.components.gpu.name.toLowerCase()
      if (gpuName.includes('rtx 40') || gpuName.includes('rx 7')) {
        gamingScore += 45
        workScore += 35
        officeScore += 15
      } else if (gpuName.includes('rtx 30') || gpuName.includes('rx 6')) {
        gamingScore += 40
        workScore += 30
        officeScore += 15
      } else if (gpuName.includes('gtx 16') || gpuName.includes('rx 5')) {
        gamingScore += 25
        workScore += 20
        officeScore += 15
      } else {
        gamingScore += 15
        workScore += 15
        officeScore += 10
      }
    }
    
    // 内存评分
    if (config.components.ram) {
      const ramName = config.components.ram.name.toLowerCase()
      let ramSize = 8 // 默认值
      
      // 提取内存大小
      const ramMatch = ramName.match(/(\d+)gb/i)
      if (ramMatch) {
        ramSize = parseInt(ramMatch[1])
      }
      
      if (config.components.ram.quantity > 1) {
        ramSize *= config.components.ram.quantity
      }
      
      if (ramSize >= 32) {
        gamingScore += 15
        workScore += 20
        officeScore += 5
      } else if (ramSize >= 16) {
        gamingScore += 15
        workScore += 15
        officeScore += 5
      } else {
        gamingScore += 10
        workScore += 10
        officeScore += 5
      }
    }
    
    // 计算整体得分
    let overall = Math.round((gamingScore + workScore + officeScore) / 3)
    
    // 确保得分在合理范围内
    gamingScore = Math.min(Math.max(gamingScore, 30), 99)
    workScore = Math.min(Math.max(workScore, 30), 99)
    officeScore = Math.min(Math.max(officeScore, 50), 99)
    overall = Math.min(Math.max(overall, 30), 99)
    
    return {
      overall,
      gaming: gamingScore,
      work: workScore,
      office: officeScore
    }
  },
  
  // 默认预设配置方案
  defaultPresetPlans: [
    {
      id: 'preset_gaming_high',
      name: '高端游戏主机',
      desc: '适合3A游戏体验 | 高端性能',
      purpose: 'gaming',
      totalPrice: 13999,
      views: 2145,
      createTime: Date.now() - 86400000, // 1天前
      components: {
        cpu: {
          id: 'cpu001',
          name: 'Intel Core i7-13700K',
          price: 2799
        },
        gpu: {
          id: 'gpu001',
          name: 'NVIDIA RTX 4070 12GB',
          price: 4999
        },
        ram: {
          id: 'ram001',
          name: '芝奇 DDR5 6000MHz 16GB',
          price: 549,
          quantity: 2
        },
        motherboard: {
          id: 'mb001',
          name: '华硕 Z790 主板',
          price: 1999
        },
        storage: {
          id: 'st001',
          name: '三星 980 Pro 2TB SSD',
          price: 1299
        },
        cooler: {
          id: 'cool001',
          name: '乔思伯 360水冷',
          price: 599
        },
        psu: {
          id: 'psu001',
          name: '海韵 850W 金牌全模组',
          price: 899
        },
        case: {
          id: 'case001',
          name: 'NZXT H5 Flow',
          price: 599
        }
      },
        performance: {
        overall: 92,
        gaming: 95,
        work: 88,
        office: 99
      }
    },
    {
      id: 'preset_work_high',
      name: '创作者工作站',
      desc: '视频渲染和3D建模 | 专业性能',
      purpose: 'work',
      totalPrice: 19999,
      views: 1326,
      createTime: Date.now() - 172800000, // 2天前
      components: {
        cpu: {
          id: 'cpu002',
          name: 'AMD Ryzen 9 7950X',
          price: 3999
        },
        gpu: {
          id: 'gpu002',
          name: 'NVIDIA RTX 4080 16GB',
          price: 7999
        },
        ram: {
          id: 'ram002',
          name: '金士顿 DDR5 6000MHz 32GB',
          price: 999,
          quantity: 2
        },
        motherboard: {
          id: 'mb002',
          name: '华硕 X670E 主板',
          price: 2699
        },
        storage: {
          id: 'st002',
          name: '西数 Black SN850X 2TB',
          price: 1199,
          quantity: 2
        },
        cooler: {
          id: 'cool002',
          name: '酷冷至尊 360水冷',
          price: 899
        },
        psu: {
          id: 'psu002',
          name: '振华 1000W 钛金全模组',
          price: 1399
        },
        case: {
          id: 'case002',
          name: 'Fractal Design Meshify 2',
          price: 999
        }
      },
      performance: {
        overall: 96,
        gaming: 94,
        work: 98,
        office: 99
      }
    },
    {
      id: 'preset_gaming_mid',
      name: '中端游戏主机',
      desc: '1440p游戏体验 | 中端性能',
      purpose: 'gaming',
      totalPrice: 7999,
      views: 3562,
      createTime: Date.now() - 259200000, // 3天前
      components: {
        cpu: {
          id: 'cpu003',
          name: 'Intel Core i5-13600K',
          price: 1999
        },
        gpu: {
          id: 'gpu003',
          name: 'NVIDIA RTX 4060 Ti 8GB',
          price: 2799
        },
        ram: {
          id: 'ram003',
          name: '英睿达 DDR5 5600MHz 16GB',
          price: 399,
          quantity: 2
        },
        motherboard: {
          id: 'mb003',
          name: '微星 B760M 主板',
          price: 999
        },
        storage: {
          id: 'st003',
          name: '致钛 1TB SSD',
          price: 499
        },
        cooler: {
          id: 'cool003',
          name: '利民 PA120 SE 双塔风冷',
          price: 199
        },
        psu: {
          id: 'psu003',
          name: '长城 650W 金牌半模组',
          price: 399
        },
        case: {
          id: 'case003',
          name: '爱国者 T3',
          price: 249
        }
      },
      performance: {
        overall: 84,
        gaming: 86,
        work: 80,
        office: 95
      }
    },
    {
      id: 'preset_office_budget',
      name: '经济办公电脑',
      desc: '日常办公应用 | 入门性能',
      purpose: 'office',
      totalPrice: 3999,
      views: 5214,
      createTime: Date.now() - 345600000, // 4天前
      components: {
        cpu: {
          id: 'cpu004',
          name: 'Intel Core i3-13100',
          price: 899
        },
        gpu: {
          id: 'gpu004',
          name: '集成显卡 Intel UHD 730',
          price: 0
        },
        ram: {
          id: 'ram004',
          name: '威刚 DDR4 3200MHz 8GB',
          price: 199,
          quantity: 2
        },
        motherboard: {
          id: 'mb004',
          name: '华硕 H610M 主板',
          price: 599
        },
        storage: {
          id: 'st004',
          name: '西数 Blue 500GB SSD',
          price: 299
        },
        cooler: {
          id: 'cool004',
          name: '酷冷至尊原装散热器',
          price: 99
        },
        psu: {
          id: 'psu004',
          name: '长城 450W 铜牌',
          price: 249
        },
        case: {
          id: 'case004',
          name: '先马 机箱',
          price: 149
        }
      },
      performance: {
        overall: 62,
        gaming: 40,
        work: 58,
        office: 85
      }
    },
    {
      id: 'preset_gaming_budget',
      name: '入门游戏主机',
      desc: '1080p游戏体验 | 入门性能',
      purpose: 'budget',
      totalPrice: 5999,
      views: 4721,
      createTime: Date.now() - 432000000, // 5天前
      components: {
        cpu: {
          id: 'cpu005',
          name: 'AMD Ryzen 5 5600',
          price: 999
        },
        gpu: {
          id: 'gpu005',
          name: 'NVIDIA GTX 1660 Super 6GB',
          price: 1499
        },
        ram: {
          id: 'ram005',
          name: '海盗船 DDR4 3600MHz 16GB',
          price: 399
        },
        motherboard: {
          id: 'mb005',
          name: '微星 B550M 主板',
          price: 799
        },
        storage: {
          id: 'st005',
          name: '阿斯加特 512GB SSD',
          price: 299
        },
        cooler: {
          id: 'cool005',
          name: '九州风神 风冷散热器',
          price: 129
        },
        psu: {
          id: 'psu005',
          name: '航嘉 500W 铜牌',
          price: 249
        },
        case: {
          id: 'case005',
          name: '鑫谷 机箱',
          price: 199
        }
      },
      performance: {
        overall: 72,
        gaming: 75,
        work: 68,
        office: 90
      }
    }
  ],
  
  globalData: {
    userInfo: null
  },
  
  // 保存配置草稿
  saveConfigDraft: function(configDraft) {
    if (!configDraft) {
      console.error('草稿数据无效')
      return false
    }
    
    // 添加或更新时间戳
    configDraft.lastEditTime = Date.now()
    
    // 如果没有ID，生成一个临时ID
    if (!configDraft.id) {
      configDraft.id = 'draft_' + Date.now()
    }
    
    // 更新全局数据和本地存储
    this.globalData.configDraft = configDraft
    wx.setStorageSync('config_draft', configDraft)
    
    return true
  },
  
  // 获取配置草稿
  getConfigDraft: function() {
    return this.globalData.configDraft
  },
  
  // 清除配置草稿
  clearConfigDraft: function() {
    this.globalData.configDraft = null
    wx.removeStorageSync('config_draft')
    return true
  },
  
  // 删除用户配置
  deleteUserConfig: function(configId) {
    if (!configId) {
      console.error('配置ID无效')
      return Promise.reject(new Error('配置ID无效'))
    }
    
    return new Promise((resolve, reject) => {
      // 调用云函数删除配置
      wx.cloud.callFunction({
        name: 'deleteUserConfig',
        data: {
          configId: configId
        }
      })
      .then(res => {
        console.log('云函数调用结果:', res)
        
        // 检查云函数返回结果
        if (res.result && res.result.success) {
          // 删除成功，更新本地缓存
          this.removeLocalUserConfig(configId)
          resolve(res.result)
        } else if (res.result && res.result.error && res.result.error.includes('未找到该配置')) {
          // 云端找不到但有本地记录，也删除本地缓存
          console.log('云端未找到配置，尝试删除本地缓存')
          this.removeLocalUserConfig(configId)
          resolve({success: true, message: '本地配置已删除'})
        } else {
          // 其他错误
          reject(new Error(res.result?.error || '删除失败'))
        }
      })
      .catch(err => {
        console.error('从云数据库删除配置失败:', err)
        
        // 尝试清理本地缓存
        console.log('尝试清理本地缓存')
        const removed = this.removeLocalUserConfig(configId)
        
        if (removed) {
          // 如果本地缓存删除成功，就算成功
          resolve({success: true, message: '本地配置已删除，但云端操作失败'})
        } else {
          reject(err)
        }
      })
    })
  },
  
  // 从本地缓存删除配置
  removeLocalUserConfig: function(configId, forceClean = false) {
    // 获取当前用户配置列表
    let userConfigs = this.globalData.userConfigs || []
    
    if (forceClean && (!configId || configId === '')) {
      // 强制清理模式：删除所有无效ID的配置
      const validConfigs = userConfigs.filter(item => item.id && item.id !== '')
      
      // 如果有无效配置被移除
      if (validConfigs.length < userConfigs.length) {
        console.log('已清理无效ID的配置数量:', userConfigs.length - validConfigs.length)
        
        // 更新全局数据和本地存储
        this.globalData.userConfigs = validConfigs
        wx.setStorageSync('user_configs', validConfigs)
        
        return true
      }
      
      return false
    }
    
    // 查找配置索引
    const index = userConfigs.findIndex(item => item.id === configId)
    
    if (index >= 0) {
      // 删除配置
      userConfigs.splice(index, 1)
      
      // 更新全局数据和本地存储
      this.globalData.userConfigs = userConfigs
      wx.setStorageSync('user_configs', userConfigs)
      
      return true
    }
    
    return false
  },
  
  // 从浏览历史中删除
  removeFromViewHistory: function(configId) {
    if (!configId) return false
    
    let viewHistory = this.globalData.viewHistory || []
    const index = viewHistory.indexOf(configId)
    
    if (index !== -1) {
      viewHistory.splice(index, 1)
      this.globalData.viewHistory = viewHistory
      wx.setStorageSync('view_history', viewHistory)
      return true
    }
    
    return false
  },
  
  // 获取日志开关状态
  getDebugMode: function(type) {
    if (type) {
      return this.globalData.debugMode[type] || false;
    }
    return this.globalData.debugMode;
  },
  
  // 设置日志开关状态
  setDebugMode: function(type, value) {
    if (this.globalData.debugMode) {
      this.globalData.debugMode[type] = value;
      // 保存到本地存储
      wx.setStorageSync('debug_mode', this.globalData.debugMode);
      
      this.debugLog(`调试模式 ${type} 已${value ? '开启' : '关闭'}`);
    }
  },
  
  // 分享配置(简化版)
  generateShareImage: function() {
    // 检查必要的数据
    if (!this.globalData.currentConfigId) {
      console.log('未找到配置ID，无法生成分享');
      wx.showToast({
        title: '未找到配置数据',
        icon: 'none'
      });
      return;
    }
    
    // 跳转到分享页面
    wx.navigateTo({
      url: `/pages/shared/shared?id=${this.globalData.currentConfigId}`
    });
  },
  
  // 清除用户配置缓存
  clearUserConfigsCache: function() {
    // 首先尝试清理无效配置
    this.removeLocalUserConfig('', true)
    
    // 清空全局数据
    this.globalData.userConfigs = []
    
    // 清空本地存储
    wx.setStorageSync('user_configs', [])
    
    return true
  }
}) 