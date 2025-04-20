Page({
  data: {
    cpuList: [],
    isLoading: true,
    hasError: false,
    errorMsg: ''
  },

  onLoad: function() {
    this.loadCPUData();
  },
  
  // 加载CPU数据
  loadCPUData: function() {
    wx.showLoading({
      title: '加载中...',
    });
    
    this.setData({ isLoading: true, hasError: false });
    
    wx.cloud.callFunction({
      name: 'getComponentsData',
      data: {
        componentType: 'cpu'
      }
    }).then(res => {
      console.log('CPU数据获取成功', res);
      
      if (res.result && res.result.code === 0) {
        this.setData({
          cpuList: res.result.data,
          isLoading: false
        });
      } else {
        this.setData({
          isLoading: false,
          hasError: true,
          errorMsg: res.result.message || '获取数据失败'
        });
      }
      
      wx.hideLoading();
    }).catch(err => {
      console.error('调用云函数失败', err);
      
      this.setData({
        isLoading: false,
        hasError: true,
        errorMsg: '网络错误，请稍后重试'
      });
      
      wx.hideLoading();
      
      wx.showToast({
        title: '加载失败',
        icon: 'none'
      });
    });
  },
  
  // 重试加载
  retryLoad: function() {
    this.loadCPUData();
  }
}); 