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
    ],
    // 新增的分页相关参数
    pageSize: 10,
    currentPage: 1,
    hasMoreData: true,
    loadingMore: false,
    allPlans: [], // 存储所有筛选后但未分页的数据
    userConfigs: [] // 保存用户配置
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
      app.debugLog('从本地存储获取参数:', plansParams);
      
      // 如果有分类参数，设置分类并刷新数据
      if (plansParams.category && plansParams.category !== this.data.selectedCategory) {
        this.setData({
          selectedCategory: plansParams.category,
          currentPage: 1, // 重置页码
          planList: [] // 清空当前列表
        });
        this.getPlanList();
      }
      
      // 清除参数，避免下次进入页面时重复使用
      wx.removeStorageSync('plans_params');
    }
  },

  // 监听页面滚动到底部事件
  onReachBottom() {
    if (this.data.hasMoreData && !this.data.loadingMore) {
      this.loadMoreData();
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
      showSort: false,
      currentPage: 1, // 重置页码
      planList: [] // 清空当前列表
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
      isShowFilter: false,
      currentPage: 1, // 重置页码
      planList: [] // 清空当前列表
    })
    this.getPlanList()
  },

  // 获取配置方案列表（现在只处理数据筛选和排序，实际加载由loadCurrentPageData完成）
  getPlanList() {
    this.setData({
      loading: true
    })
    
    // 将所有预设方案和用户配置合并处理
    const presetPlans = app.globalData.presetPlans || []
    app.debugLog('预设方案数量:', presetPlans.length);
    
    // 从global数据获取用户配置
    const userConfigs = app.globalData.userConfigs || []
    
    // 合并预设方案和用户配置
    let allPlans = [...presetPlans]
    
    // 根据选择的分类进行过滤
    const { selectedCategory } = this.data
    if (selectedCategory !== 'all') {
      allPlans = allPlans.filter(plan => plan.category === selectedCategory)
    }
    
    // 根据选择的排序方式进行排序
    this.sortPlans(allPlans)
    
    app.debugLog('合并后总方案数量:', allPlans.length);
    
    // 保存所有筛选后的数据，用于分页加载
    this.setData({
      allPlans: allPlans,
      currentPage: 1,
      hasMoreData: allPlans.length > this.data.pageSize,
      loading: false,
      userConfigs: userConfigs
    }, () => {
      // 加载第一页数据
      this.loadCurrentPageData()
    })
  },

  // 加载当前页数据
  loadCurrentPageData() {
    const { allPlans, currentPage, pageSize, planList } = this.data;
    
    if (allPlans.length === 0) {
      this.setData({
        loadingMore: false,
        hasMoreData: false
      });
      return;
    }
    
    // 计算当前页的数据
    const start = (currentPage - 1) * pageSize;
    const end = start + pageSize;
    const currentPageData = allPlans.slice(start, end);
    
    // 如果没有更多数据了
    if (currentPageData.length === 0) {
      this.setData({
        loadingMore: false,
        hasMoreData: false
      });
      return;
    }
    
    // 最终处理，确保每个方案都有必要的字段
    const processedData = currentPageData.map(plan => {
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
    
    // 添加到当前列表
    const newPlanList = [...planList, ...processedData];
    
    this.setData({
      planList: newPlanList,
      loadingMore: false,
      hasMoreData: end < allPlans.length
    });
    
    app.debugLog(`加载第${currentPage}页数据，本页${processedData.length}条，总共${newPlanList.length}条`);
  },
  
  // 加载更多数据
  loadMoreData() {
    if (!this.data.hasMoreData || this.data.loadingMore) return;
    
    // 标记加载状态
    this.setData({
      loadingMore: true
    });
    
    // 计算下一页
    const nextPage = this.data.currentPage + 1;
    const pageSize = this.data.pageSize;
    const start = (nextPage - 1) * pageSize;
    const end = start + pageSize;
    
    // 从全部数据中提取当前页
    const processedData = this.data.allPlans.slice(start, end);
    
    // 判断是否还有更多数据
    const hasMore = end < this.data.allPlans.length;
    
    // 合并数据
    const newPlanList = [...this.data.planList, ...processedData];
    
    app.debugLog(`加载第${nextPage}页数据，本页${processedData.length}条，总共${newPlanList.length}条`);
    
    // 更新状态
    this.setData({
      planList: newPlanList,
      currentPage: nextPage,
      hasMoreData: hasMore,
      loadingMore: false
    });
  },

  // 跳转到详情页
  navToDetail(e) {
    try {
      const { id } = e.currentTarget.dataset;
      app.debugLog('正在跳转到详情页，ID:', id);
      
      wx.navigateTo({
        url: '/packageDetail/pages/detail/detail?id=' + id,
        fail: err => {
          console.error('跳转详情页失败:', err);
          
          // 尝试直接跳转
          wx.navigateTo({
            url: '/pages/detail/detail?id=' + id,
            fail: err2 => {
              console.error('第二次跳转详情页失败:', err2);
              wx.showToast({
                title: '页面跳转失败',
                icon: 'none'
              });
            }
          });
        }
      });
    } catch (err) {
      console.error('跳转详情页异常:', err);
    }
  },

  // 跳转到配置页
  navToConfig() {
    app.debugLog('正在跳转到配置页面...');
    
    wx.navigateTo({
      url: '/pages/config/config',
      fail: err => {
        console.error('跳转配置页失败:', err);
        wx.showToast({
          title: '页面跳转失败',
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
  loadUserConfigs() {
    return new Promise((resolve, reject) => {
      app.getUserConfigs().then(configs => {
        app.debugLog('获取用户配置:', configs.length);
        this.setData({
          userConfigs: configs
        });
        resolve(configs);
      }).catch(err => {
        console.error('获取用户配置失败:', err);
        reject(err);
      });
    });
  },
}) 