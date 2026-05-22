Page({
  /**
   * 页面的初始数据
   */
  data: {
    currentSlide: 1,
    totalSlides: 4
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 检查是否首次使用
    const hasShownGuide = wx.getStorageSync('hasShownGuide');
    if (hasShownGuide) {
      // 如果已经显示过引导页，直接跳转到首页
      this.enterApp();
    }
  },

  /**
   * 下一页按钮点击事件
   */
  nextSlide: function() {
    if (this.data.currentSlide < this.data.totalSlides) {
      this.setData({
        currentSlide: this.data.currentSlide + 1
      });
    } else {
      // 最后一页，进入小程序
      this.enterApp();
    }
  },

  /**
   * 跳过按钮点击事件
   */
  skipGuide: function() {
    this.enterApp();
  },

  /**
   * 指示器点击事件
   */
  goToSlide: function(e) {
    const slideNum = e.currentTarget.dataset.slide;
    this.setData({
      currentSlide: slideNum
    });
  },

  /**
   * 进入小程序
   */
  enterApp: function() {
    // 记录已经显示过引导页
    wx.setStorageSync('hasShownGuide', true);
    
    // 跳转到首页
    wx.switchTab({
      url: '/pages/home/home'
    });
  }
}) 