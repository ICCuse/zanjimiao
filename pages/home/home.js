const app = getApp()

Page({
  data: {
    bannerList: [
      { id: 1, img: '/packageImage/static/images/banners/banner1.jpg' },
      { id: 2, img: '/packageImage/static/images/banners/banner2.jpg' },
      { id: 3, img: '/packageImage/static/images/banners/banner3.jpg' }
    ]
  },

  onLoad() {
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
        'cloud://your-cloud-env-id.7063-your-cloud-env-id-1349103669/static/images/banners/Banner1.png',
        'cloud://your-cloud-env-id.7063-your-cloud-env-id-1349103669/static/images/banners/Banner2.png',
        'cloud://your-cloud-env-id.7063-your-cloud-env-id-1349103669/static/images/banners/Banner3.png'
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
    console.log('正在跳转到配置生成页面...');
    
    wx.navigateTo({
      url: '/pages/recommendation/index',
      fail: function(err) {
        console.error('跳转到配置生成页面失败:', err);
        wx.showToast({
          title: '跳转失败，请稍后再试',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到方案列表页
  navToPlans() {
    console.log('正在跳转到方案列表页...');
    
    // 准备需要传递的参数
    const plansParams = {
      from: 'home',
      timestamp: Date.now(),
      activeTab: 'configs' // 指定需要激活的标签
    };
    
    // 使用本地存储保存参数
    wx.setStorageSync('profile_params', plansParams);
    
    wx.switchTab({  // 改用switchTab跳转到我的页面
      url: '/pages/profile/profile',
      fail: function(err) {
        console.error('跳转到我的页面失败:', err);
        // 显示错误提示
        wx.showToast({
          title: '无法跳转到我的页面',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 跳转到对比页面
  navToComparison() {
    wx.navigateTo({
      url: '/pages/compare/compare',
      fail: function(err) {
        console.error('跳转到对比页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到偏好设置页
  navToPreference() {
    wx.navigateTo({
      url: '/pages/preference/index',
      fail: function(err) {
        console.error('跳转到偏好设置页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  },

  // 跳转到搜索页
  navToSearch() {
    wx.navigateTo({
      url: '/packageSearch/pages/search/search',
      fail: function(err) {
        console.error('跳转到搜索页面失败:', err);
        wx.showToast({
          title: '跳转失败',
          icon: 'none'
        });
      }
    });
  }
}); 