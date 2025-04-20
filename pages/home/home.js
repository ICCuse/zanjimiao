const app = getApp()

Page({
  data: {
    bannerList: [
      { id: 1, img: '/packageImage/static/images/banners/banner1.jpg' },
      { id: 2, img: '/packageImage/static/images/banners/banner2.jpg' },
      { id: 3, img: '/packageImage/static/images/banners/banner3.jpg' }
    ],
    recommendList: [
      {
        id: 'preset_gaming_high',
        name: '高端游戏主机',
        desc: '适合3A游戏体验 | 高端性能',
        price: 13999,
        brand: 'intel'
      },
      {
        id: 'preset_work_high',
        name: '创作者工作站',
        desc: '视频渲染和3D建模 | 专业性能',
        price: 19999,
        brand: 'amd'
      },
      {
        id: 'preset_gaming_mid',
        name: '中端游戏主机',
        desc: '1440p游戏体验 | 中端性能',
        price: 7999,
        brand: 'nvidia'
      }
    ],
    cpuList: [
      {
        id: 'cpu1',
        name: 'Intel Core i7-13700K',
        brand: 'intel',
        spec: '16核24线程 | 5.4GHz',
        price: 2899
      },
      {
        id: 'cpu2',
        name: 'AMD Ryzen 7 7800X3D',
        brand: 'amd',
        spec: '8核16线程 | 5.0GHz | 3D V-Cache',
        price: 2799
      }
    ],
    recommendPlans: [],
    categoryList: [
      { id: 'gaming', name: '游戏主机', icon: '/packageImage/static/images/categories/icon-gaming.png' },
      { id: 'work', name: '工作站', icon: '/packageImage/static/images/categories/icon-work.png' },
      { id: 'office', name: '办公电脑', icon: '/packageImage/static/images/categories/icon-office.png' },
      { id: 'budget', name: '预算主机', icon: '/packageImage/static/images/categories/icon-budget.png' }
    ]
  },

  onLoad() {
    // 获取推荐配置方案
    this.getRecommendPlans()
    
    // 获取云存储中的banner图片
    this.getCloudBanners()
  },

  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 0
      })
    }
  },

  // 获取推荐配置方案
  getRecommendPlans() {
    // 从全局数据中获取预设方案列表
    const plans = app.globalData.presetPlans || []
    
    if (plans.length === 0) {
      console.error('没有获取到预设方案数据');
      // 使用备用方案数据
      this.setData({
        recommendPlans: [
          {
            id: 'preset_gaming_high',
            name: '高端游戏主机',
            desc: '适合3A游戏体验 | 高端性能',
            price: 13999,
            views: 2145
          },
          {
            id: 'preset_work_high',
            name: '创作者工作站',
            desc: '视频渲染和3D建模 | 专业性能',
            price: 19999,
            views: 1326
          },
          {
            id: 'preset_gaming_mid',
            name: '中端游戏主机',
            desc: '1440p游戏体验 | 中端性能',
            price: 7999,
            views: 3562
          }
        ]
      });
      return;
    }
    
    // 获取前3个方案作为推荐
    const recommendPlans = plans.slice(0, 3).map(plan => {
      return {
        id: plan.id,
        name: plan.name,
        desc: plan.desc,
        price: plan.totalPrice,
        views: plan.views || 0
      }
    })
    
    console.log('加载的推荐配置:', recommendPlans);
    
    this.setData({
      recommendPlans
    })
  },

  // 从云存储获取banner图片
  getCloudBanners() {
    // 先使用本地默认图片
    const defaultBanners = [
      { id: 1, img: '/packageImage/static/images/banners/banner1.jpg' },
      { id: 2, img: '/packageImage/static/images/banners/banner2.jpg' },
      { id: 3, img: '/packageImage/static/images/banners/banner3.jpg' }
    ];
    
    // 尝试从云存储获取banner图片
    wx.cloud.getTempFileURL({
      fileList: [
        'cloud://prod-env.xxxx/banners/banner1.jpg',
        'cloud://prod-env.xxxx/banners/banner2.jpg',
        'cloud://prod-env.xxxx/banners/banner3.jpg'
      ],
      success: res => {
        console.log('获取云存储图片成功', res.fileList);
        if (res.fileList && res.fileList.length > 0) {
          const cloudBanners = res.fileList.map((file, index) => {
            return {
              id: index + 1,
              img: file.tempFileURL
            };
          });
          
          // 更新banner列表
          this.setData({
            bannerList: cloudBanners
          });
        }
      },
      fail: err => {
        console.error('获取云存储图片失败', err);
        // 失败时使用默认图片
        this.setData({
          bannerList: defaultBanners
        });
      }
    });
  },

  // 跳转到配置生成页
  navToConfig() {
    console.log('正在跳转到配置页面...');
    
    // 如果需要传递参数，使用本地存储保存
    const configParams = {
      from: 'home',
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

  // 跳转到方案详情页
  navToDetail(e) {
    const { id } = e.currentTarget.dataset;
    if (!id) {
      console.error('配置ID无效');
      return;
    }
    
    console.log('正在跳转到详情页，ID:', id);
    
    // 确保所有预设方案都被正确标记为预设
    const configData = app.getConfigById(id);
    if (!configData) {
      console.error('找不到配置数据:', id);
      wx.showToast({
        title: '未找到配置数据',
        icon: 'none'
      });
      return;
    }
    
    // 添加到浏览历史
    app.addToViewHistory(id);
    
    // 跳转到详情页
    wx.navigateTo({
      url: `/packageDetail/pages/detail/detail?id=${id}`,
      fail: function(err) {
        console.error('跳转到详情页失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到方案列表页
  navToPlans(e) {
    console.log('正在跳转到方案列表页...');
    
    // 准备需要传递的参数
    const plansParams = {
      from: 'home',
      timestamp: Date.now(),
      activeTab: 'configs' // 指定需要激活的标签
    };
    
    // 如果有类别参数，添加到传递数据中
    const { category } = e.currentTarget.dataset;
    if (category) {
      plansParams.category = category;
    }
    
    // 使用本地存储保存参数
    wx.setStorageSync('profile_params', plansParams);
    
    wx.switchTab({  // 改用switchTab跳转到我的页面
      url: '/pages/profile/profile',
      fail: function(err) {
        console.error('跳转到我的页面失败:', err);
        // 显示错误提示
        wx.showToast({
          title: '无法跳转到我的页面',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到配置对比页面
  navToComparison() {
    console.log('正在跳转到配置对比页面...');
    wx.showToast({
      title: '配置对比功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // 跳转到智能推荐页面
  navToPreference() {
    console.log('正在跳转到智能推荐页面...');
    wx.showToast({
      title: '智能推荐功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // 跳转到搜索页面
  navToSearch() {
    console.log('正在跳转到搜索页面...');
    wx.showToast({
      title: '搜索功能开发中',
      icon: 'none',
      duration: 2000
    });
  },

  // 格式化价格显示
  formatPrice: function(price) {
    return '¥' + price.toLocaleString('zh-CN');
  }
}) 