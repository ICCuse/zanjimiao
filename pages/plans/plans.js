const app = getApp()

Page({
  data: {
    loading: true,
    planList: [],
    showSort: false,
    isShowFilter: false,
    selectedSort: 'newest',
    currentSortName: '最新发布',
    selectedCategory: 'all',
    sortOptions: [
      { id: 'newest', name: '最新发布' },
      { id: 'price-asc', name: '价格从低到高' },
      { id: 'price-desc', name: '价格从高到低' },
      { id: 'views', name: '浏览量优先' },
      { id: 'performance', name: '性能优先' }
    ],
    categoryOptions: [
      { id: 'all', name: '全部分类' },
      { id: 'gaming', name: '游戏主机' },
      { id: 'work', name: '工作站' },
      { id: 'office', name: '办公电脑' },
      { id: 'budget', name: '预算主机' }
    ]
  },

  onLoad(options) {
    // 如果有参数，设置分类
    if (options.category) {
      this.setData({
        selectedCategory: options.category
      })
    }
    
    // 获取配置方案列表
    this.getPlanList()
    
    // 更新当前排序名称
    this.updateSortName()
  },

  onShow() {
    // 从本地存储中获取参数
    const plansParams = wx.getStorageSync('plans_params');
    if (plansParams) {
      console.log('从本地存储获取参数:', plansParams);
      
      // 如果有分类参数，设置分类并刷新数据
      if (plansParams.category && plansParams.category !== this.data.selectedCategory) {
        this.setData({
          selectedCategory: plansParams.category
        });
        this.getPlanList();
      }
      
      // 清除参数，避免下次进入页面时重复使用
      wx.removeStorageSync('plans_params');
    }
  },
  
  // 更新当前排序名称
  updateSortName() {
    const { sortOptions, selectedSort } = this.data
    const sortOption = sortOptions.find(item => item.id === selectedSort)
    
    this.setData({
      currentSortName: sortOption ? sortOption.name : '最新发布'
    })
  },

  // 查找索引
  findIndex: function(array, id) {
    return array.findIndex(item => item.id === id);
  },

  // 获取CPU标签
  getCpuLabel: function(config) {
    if (!config || !config.components || !config.components.cpu) return 'CPU';
    
    const cpuName = config.components.cpu.name.toLowerCase();
    
    if (cpuName.includes('i9') || cpuName.includes('ryzen 9')) {
      return 'i9/R9';
    } else if (cpuName.includes('i7') || cpuName.includes('ryzen 7')) {
      return 'i7/R7';
    } else if (cpuName.includes('i5') || cpuName.includes('ryzen 5')) {
      return 'i5/R5';
    } else {
      return 'CPU';
    }
  },

  // 获取GPU标签
  getGpuLabel: function(config) {
    if (!config || !config.components || !config.components.gpu) return 'GPU';
    
    const gpuName = config.components.gpu.name.toLowerCase();
    
    if (gpuName.includes('rtx 4090')) {
      return 'RTX4090';
    } else if (gpuName.includes('rtx 4080')) {
      return 'RTX4080';
    } else if (gpuName.includes('rtx 4070')) {
      return 'RTX4070';
    } else if (gpuName.includes('rtx 4060')) {
      return 'RTX4060';
    } else if (gpuName.includes('rx 7800')) {
      return 'RX7800';
    } else if (gpuName.includes('rx 7600')) {
      return 'RX7600';
    } else {
      return 'GPU';
    }
  },

  // 获取内存标签
  getRamLabel: function(config) {
    if (!config || !config.components || !config.components.ram) return '8GB';
    
    const ramName = config.components.ram.name.toLowerCase();
    let ramSize = 8; // 默认8GB
    
    // 提取内存大小
    const ramMatch = ramName.match(/(\d+)gb/i);
    if (ramMatch) {
      ramSize = parseInt(ramMatch[1]);
    }
    
    // 如果有数量，乘以数量
    if (config.components.ram.quantity > 1) {
      ramSize *= config.components.ram.quantity;
    }
    
    return `${ramSize}GB`;
  },

  // 切换排序下拉菜单
  toggleSort() {
    this.setData({
      showSort: !this.data.showSort
    })
  },

  // 选择排序方式
  selectSort(e) {
    const { sort } = e.currentTarget.dataset
    this.setData({
      selectedSort: sort,
      showSort: false
    })
    
    // 更新当前排序名称
    this.updateSortName()
    
    this.getPlanList()
  },

  // 切换筛选面板
  toggleFilter() {
    this.setData({
      isShowFilter: !this.data.isShowFilter
    })
  },

  // 关闭筛选面板
  closeFilter() {
    this.setData({
      isShowFilter: false
    })
  },

  // 选择分类
  selectCategory(e) {
    const { category } = e.currentTarget.dataset
    this.setData({
      selectedCategory: category,
      isShowFilter: false
    })
    this.getPlanList()
  },

  // 获取配置方案列表
  getPlanList() {
    this.setData({ loading: true })
    
    // 从全局获取数据
    let allPlans = []
    
    // 获取预设配置方案
    const presetPlans = app.globalData.presetPlans || []
    console.log('预设方案数量:', presetPlans.length);
    
    // 获取用户配置方案
    this.loadUserConfigs()
    
    // 合并所有方案
    allPlans = [...presetPlans, ...this.data.userConfigs]
    console.log('合并后总方案数量:', allPlans.length);
    
    // 应用筛选逻辑
    let planList = allPlans
    
    if (this.data.selectedCategory !== 'all') {
      planList = planList.filter(plan => {
        // 如果没有purpose字段，默认归类为custom
        const purpose = plan.purpose || 'custom';
        return purpose === this.data.selectedCategory;
      });
    }
    
    // 应用排序逻辑
    switch (this.data.selectedSort) {
      case 'price-asc':
        planList.sort((a, b) => a.totalPrice - b.totalPrice)
        break
      case 'price-desc':
        planList.sort((a, b) => b.totalPrice - a.totalPrice)
        break
      case 'views':
        planList.sort((a, b) => (b.views || 0) - (a.views || 0))
        break
      case 'performance':
        planList.sort((a, b) => {
          const perfA = a.performance ? a.performance.overall : 0
          const perfB = b.performance ? b.performance.overall : 0
          return perfB - perfA
        })
        break
      case 'newest':
      default:
        // 按创建时间排序（最新发布）
        planList.sort((a, b) => (b.createTime || 0) - (a.createTime || 0))
        break
    }
    
    // 最终处理，确保每个方案都有必要的字段
    planList = planList.map(plan => {
      // 确保有性能数据
      if (!plan.performance) {
        plan.performance = app.evaluatePerformance(plan) || { 
          overall: 75, 
          gaming: 75, 
          work: 75, 
          office: 75 
        };
      }
      
      // 确保有描述
      if (!plan.desc) {
        plan.desc = '配置方案';
      }
      
      // 标记是否为预设方案
      if (!('isPreset' in plan)) {
        plan.isPreset = plan.id.startsWith('preset_');
      }
      
      return plan;
    });
    
    console.log('最终显示方案数量:', planList.length);
    
    this.setData({
      planList,
      loading: false
    })
  },

  // 跳转到详情页
  navToDetail(e) {
    const { id } = e.currentTarget.dataset
    if (!id) {
      console.error('配置ID无效');
      return;
    }
    
    // 确保配置数据存在
    const configData = app.getConfigById(id);
    if (!configData) {
      console.error('找不到配置数据:', id);
      wx.showToast({
        title: '未找到配置数据',
        icon: 'none'
      });
      return;
    }
    
    console.log('正在跳转到详情页，ID:', id);
    
    // 添加到浏览历史
    app.addToViewHistory(id)
    
    wx.navigateTo({
      url: `/packageDetail/pages/detail/detail?id=${id}`,
      fail: function(err) {
        console.error('跳转到详情页失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    })
  },

  // 跳转到配置生成页
  navToConfig() {
    console.log('正在跳转到配置页面...');
    
    // 如果需要传递参数，使用本地存储保存
    const configParams = {
      from: 'plans',
      timestamp: Date.now()
    };
    wx.setStorageSync('config_params', configParams);
    
    wx.switchTab({  // 改用switchTab因为配置页面是一个Tab页面
      url: '/pages/config/config',
      fail: function(err) {
        console.error('跳转到配置页面失败:', err);
        // 显示错误提示
        wx.showToast({
          title: '无法跳转到配置页面',
          icon: 'none'
        });
      }
    });
  },

  // 阻止事件冒泡
  stopPropagation(e) {
    e.stopPropagation()
  },

  /**
   * 加载用户配置
   */
  loadUserConfigs: function() {
    wx.showLoading({
      title: '加载中',
      mask: true
    });
    
    app.getUserConfigs()
      .then(userConfigs => {
        console.log('获取用户配置:', userConfigs.length);
        
        this.setData({
          userConfigs: userConfigs || [],
          loadingUserConfigs: false
        });
        
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取用户配置失败:', err);
        
        this.setData({
          userConfigs: [],
          loadingUserConfigs: false
        });
        
        wx.hideLoading();
        
        wx.showToast({
          title: '加载失败',
          icon: 'none'
        });
      });
  },
}) 