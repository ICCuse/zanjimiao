Page({
  data: {
    apiUrl: '',
    loading: false,
    error: ''
  },

  onLoad: function() {
    // 页面加载时自动获取URL
    this.getApiUrl();
  },

  getApiUrl: function() {
    const that = this;
    
    // 显示加载状态
    that.setData({
      loading: true,
      error: '',
      apiUrl: ''
    });
    
    // 调用云函数获取HTTP触发器URL
    wx.cloud.callFunction({
      name: 'adminApi',
      data: {
        action: 'getHttpUrl'
      },
      success: function(res) {
        console.log('获取URL成功', res);
        if (res.result && res.result.url) {
          that.setData({
            apiUrl: res.result.url,
            loading: false
          });
        } else {
          that.setData({
            error: '返回数据中未找到URL',
            loading: false
          });
        }
      },
      fail: function(err) {
        console.error('获取URL失败', err);
        that.setData({
          error: '获取URL失败: ' + (err.errMsg || JSON.stringify(err)),
          loading: false
        });
      }
    });
  },
  
  copyUrl: function() {
    const that = this;
    wx.setClipboardData({
      data: that.data.apiUrl,
      success: function() {
        wx.showToast({
          title: 'URL已复制',
          icon: 'success'
        });
      }
    });
  }
}); 