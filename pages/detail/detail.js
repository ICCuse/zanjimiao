const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    configId: '',
    configData: null,
    isFavorite: false,
    performance: {
      gaming: 0,
      work: 0,
      office: 0,
      overall: 0
    },
    performanceLabels: {
      gaming: '游戏性能',
      work: '工作性能',
      office: '办公性能',
      overall: '综合性能'
    },
    totalPrice: 0,
    
    // 分享信息
    shareVisible: false,
    shareOptions: [
      { id: 'wechat', name: '微信', icon: '/static/images/share/wechat.png' },
      { id: 'moments', name: '朋友圈', icon: '/static/images/share/moments.png' },
      { id: 'copy', name: '复制链接', icon: '/static/images/share/copy.png' }
    ]
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 获取配置ID
    const configId = options.id || ''
    if (!configId) {
      this.showError('配置ID无效')
      return
    }
    
    this.setData({ configId })
    
    // 加载配置详情
    this.loadConfigData(configId)
    
    // 添加到浏览历史
    app.addToViewHistory(configId)
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    // 检查收藏状态
    this.checkFavoriteStatus()
  },

  /**
   * 加载配置数据
   */
  loadConfigData: function (configId) {
    // 显示加载中
    wx.showLoading({
      title: '加载中...',
      mask: true
    })
    
    console.log('开始加载配置数据，ID:', configId);
    
    try {
      let configData;
      
      // 检查是否是临时预览配置
      if (configId.startsWith('temp_')) {
        console.log('加载临时预览配置');
        configData = app.globalData.tempConfig;
        
        if (!configData) {
          console.error('临时预览配置不存在');
          this.showError('临时配置已失效，请返回重新预览');
          wx.hideLoading();
          
          // 自动返回上一页
          setTimeout(() => {
            wx.navigateBack({
              delta: 1
            });
          }, 2000);
          return;
        }
        
        console.log('成功加载临时预览配置:', configData);
        this.processConfigData(configData);
      } else {
        // 从云数据库获取配置
        if (configId.startsWith('user_')) {
          // 用户配置从云函数获取
          wx.cloud.callFunction({
            name: 'getUserConfigs',
            data: {
              configId: configId
            }
          })
          .then(res => {
            wx.hideLoading();
            
            if (res.result && res.result.success) {
              configData = res.result.data;
              console.log('从云数据库获取配置成功:', configData);
              this.processConfigData(configData);
            } else {
              // 如果云函数获取失败，尝试从本地缓存获取
              console.log('从云数据库获取配置失败，尝试从本地获取');
              configData = app.getConfigById(configId);
              
              if (configData) {
                console.log('从本地缓存获取配置成功:', configData);
                this.processConfigData(configData);
              } else {
                this.showError('未找到配置方案');
              }
            }
          })
          .catch(err => {
            wx.hideLoading();
            console.error('调用获取配置云函数失败:', err);
            
            // 尝试从本地缓存获取
            configData = app.getConfigById(configId);
            
            if (configData) {
              console.log('从本地缓存获取配置成功:', configData);
              this.processConfigData(configData);
            } else {
              this.showError('未找到配置方案');
            }
          });
        } else {
          // 预设配置从本地获取
          configData = app.getConfigById(configId);
          
          if (configData) {
            console.log('获取预设配置成功:', configData);
            this.processConfigData(configData);
          } else {
            wx.hideLoading();
            this.showError('未找到配置方案');
          }
        }
      }
    } catch (error) {
      console.error('加载配置数据出错:', error);
      this.showError('加载配置出错');
      wx.hideLoading();
    }
  },

  /**
   * 处理配置数据
   */
  processConfigData: function(configData) {
    if (!configData) {
      this.showError('配置数据不存在');
      wx.hideLoading();
      return;
    }
    
    // 计算总价
    let totalPrice = 0;
    const components = configData.components || {};
    
    // 遍历所有组件计算总价
    Object.keys(components).forEach(key => {
      const component = components[key];
      if (component && component.price) {
        // 如果有数量属性，乘以数量
        const quantity = component.quantity || 1;
        totalPrice += component.price * quantity;
      }
    });
    
    // 如果没有总价或总价计算为0，则使用已有的总价
    if (totalPrice === 0 && configData.totalPrice) {
      totalPrice = configData.totalPrice;
    }
    
    // 确保有性能数据
    const performance = configData.performance || app.evaluatePerformance(configData) || {
      gaming: 0,
      work: 0,
      office: 0,
      overall: 0
    };
    
    this.setData({
      configData,
      performance,
      totalPrice,
      performanceLabels: {
        gaming: '游戏性能',
        work: '工作性能',
        office: '办公性能'
      }
    });
    
    // 检查收藏状态
    this.checkFavoriteStatus();
    
    console.log('配置数据加载成功');
    
    // 隐藏加载中
    wx.hideLoading();
  },

  /**
   * 检查收藏状态
   */
  checkFavoriteStatus: function () {
    const { configId } = this.data
    // 使用App实例的方法检查收藏状态
    const isFavorite = app.isInFavorites(configId)
    this.setData({ isFavorite })
  },

  /**
   * 切换收藏状态
   */
  toggleFavorite: function () {
    const { configId, isFavorite } = this.data
    
    if (isFavorite) {
      // 从收藏中移除
      app.removeFromFavorites(configId)
      wx.showToast({
        title: '已取消收藏',
        icon: 'success'
      })
    } else {
      // 添加到收藏
      app.addToFavorites(configId)
      wx.showToast({
        title: '已加入收藏',
        icon: 'success'
      })
    }
    
    // 更新状态
    this.setData({
      isFavorite: !isFavorite
    })
  },

  /**
   * 编辑配置
   */
  editConfig: function () {
    const { configData } = this.data
    
    if (!configData) {
      wx.showToast({
        title: '配置数据不存在',
        icon: 'none'
      })
      return
    }
    
    // 将当前配置数据存入本地存储，供配置页面使用
    wx.setStorageSync('edit_config', configData)
    
    // 跳转到配置页
    wx.switchTab({
      url: '/pages/config/config',
      success: () => {
        // 通知配置页面编辑现有配置
        const configParams = {
          from: 'detail',
          mode: 'edit',
          id: configData.id,
          timestamp: Date.now()
        }
        wx.setStorageSync('config_params', configParams)
      }
    })
  },

  /**
   * 显示分享面板
   */
  showSharePanel: function () {
    this.setData({
      shareVisible: true
    })
  },

  /**
   * 隐藏分享面板
   */
  hideSharePanel: function () {
    this.setData({
      shareVisible: false
    })
  },

  /**
   * 处理分享选项
   */
  handleShareOption: function (e) {
    const { id } = e.currentTarget.dataset
    
    this.hideSharePanel()
    
    // 根据选项ID执行不同的分享操作
    switch (id) {
      case 'wechat':
        this.shareToWechat()
        break
      case 'moments':
        this.shareToMoments()
        break
      case 'copy':
        this.copyShareLink()
        break
      default:
        break
    }
  },

  /**
   * 分享到微信
   */
  shareToWechat: function () {
    // 调用小程序的分享接口
    wx.showToast({
      title: '请点击右上角分享',
      icon: 'none'
    })
  },

  /**
   * 分享到朋友圈
   */
  shareToMoments: function () {
    // 分享到朋友圈需要客户端支持
    wx.showToast({
      title: '请点击右上角分享到朋友圈',
      icon: 'none'
    })
  },

  /**
   * 复制分享链接
   */
  copyShareLink: function () {
    const { configData } = this.data
    if (!configData) return
    
    // 在实际小程序中，这里可以是一个可以在微信内打开的小程序页面链接
    // 由于小程序内不能直接复制链接，这里模拟复制分享文本
    const shareText = `【DIY电脑配置神器】推荐配置方案：${configData.name}，总价格：¥${this.data.totalPrice}。打开小程序查看详情！`
    
    wx.setClipboardData({
      data: shareText,
      success: () => {
        wx.showToast({
          title: '分享文本已复制',
          icon: 'success'
        })
      }
    })
  },

  /**
   * 显示错误信息
   */
  showError: function (message) {
    wx.showToast({
      title: message || '出错了',
      icon: 'none',
      duration: 2000
    })
  },
  
  /**
   * 返回首页
   */
  navToHome: function () {
    wx.switchTab({
      url: '/pages/home/home'
    })
  },
  
  /**
   * 阻止事件冒泡
   */
  stopPropagation: function (e) {
    e.stopPropagation()
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    const { configData, totalPrice } = this.data
    if (!configData) return {}
    
    return {
      title: `【DIY配置】${configData.name} - ¥${totalPrice}`,
      path: `/pages/detail/detail?id=${configData.id}`,
      imageUrl: '/static/images/share_image.png' // 分享封面图，建议尺寸为5:4
    }
  },
  
  /**
   * 分享到朋友圈
   */
  onShareTimeline: function () {
    const { configData, totalPrice } = this.data
    if (!configData) return {}
    
    return {
      title: `【DIY电脑配置】${configData.name} - ¥${totalPrice}`,
      query: `id=${configData.id}`,
      imageUrl: '/static/images/share_timeline.png' // 分享到朋友圈的图片
    }
  },

  /**
   * 跳转到编辑页
   */
  goToEdit: function () {
    const { configId, configData } = this.data
    
    if (!configData) {
      wx.showToast({
        title: '配置数据不存在',
        icon: 'none'
      })
      return
    }
    
    // 将当前配置数据存入本地存储，供配置页面使用
    wx.setStorageSync('edit_config', configData)
    
    // 跳转到配置页，使用switchTab而不是navigateTo，因为config是tabBar页面
    wx.switchTab({
      url: '/pages/config/config',
      success: () => {
        // 通知配置页面加载此配置方案
        const configParams = {
          from: 'detail',
          mode: 'edit',
          id: configData.id,
          timestamp: Date.now()
        }
        wx.setStorageSync('config_params', configParams)
      }
    })
  },
  
  /**
   * 删除配置
   */
  deleteConfig: function () {
    const { configId, configData } = this.data
    
    // 只能删除用户自己的配置，不能删除预设方案
    if (!configData || configData.isPreset) {
      wx.showToast({
        title: '预设方案不可删除',
        icon: 'none'
      })
      return
    }
    
    wx.showModal({
      title: '删除确认',
      content: '确定要删除此配置方案吗？删除后无法恢复。',
      confirmText: '删除',
      confirmColor: '#e64340',
      success: res => {
        if (res.confirm) {
          const result = app.deleteUserConfig(configId)
          
          if (result) {
            wx.showToast({
              title: '已删除',
              icon: 'success'
            })
            
            // 返回上一页
            setTimeout(() => {
              wx.navigateBack()
            }, 1000)
          } else {
            wx.showToast({
              title: '删除失败',
              icon: 'error'
            })
          }
        }
      }
    })
  },

  /**
   * 分享相关功能
   */
  showSharePanel: function() {
    this.setData({
      shareVisible: true
    });
  },
  
  hideSharePanel: function() {
    this.setData({
      shareVisible: false
    });
  },
  
  preventBubble: function(e) {
    // 阻止事件冒泡
  },
  
  handleShare: function(e) {
    const shareType = e.currentTarget.dataset.type;
    const configData = this.data.configData;
    
    if (!configData) {
      wx.showToast({
        title: '配置数据不存在',
        icon: 'none'
      });
      return;
    }
    
    // 生成分享内容
    const shareTitle = `我的电脑配置方案: ${configData.name}`;
    const shareDesc = `总价: ¥${this.data.totalPrice}`;
    const sharePath = `/pages/detail/detail?id=${configData.id}&shared=true`;
    
    switch (shareType) {
      case 'wechat':
        // 在微信小程序中，实际分享功能是通过 onShareAppMessage 实现的
        // 这里只是提示用户如何分享
        wx.showToast({
          title: '点击右上角菜单分享给好友',
          icon: 'none',
          duration: 2000
        });
        break;
      case 'moments':
        // 分享到朋友圈需要使用开放能力
        wx.showToast({
          title: '生成分享图片...',
          icon: 'loading',
          duration: 1000
        });
        
        // 延时模拟生成图片过程
        setTimeout(() => {
          // 实际应用中，这里应该是生成分享图片的代码
          this.generateShareImage();
        }, 1000);
        break;
      case 'copy':
        // 复制分享链接（在小程序中不直接适用，这里只是示例）
        const shareLink = `电脑配置方案「${configData.name}」，总价${this.data.totalPrice}元。进入小程序查看详情！`;
        wx.setClipboardData({
          data: shareLink,
          success: () => {
            wx.showToast({
              title: '链接已复制，可粘贴发送给好友',
              icon: 'none'
            });
          }
        });
        break;
    }
    
    // 隐藏分享面板
    this.hideSharePanel();
  },
  
  /**
   * 生成分享图片
   */
  generateShareImage: function() {
    const configData = this.data.configData;
    
    if (!configData) return;
    
    // 创建canvas上下文
    const ctx = wx.createCanvasContext('shareCanvas');
    
    // 实际应用中这里应该有绘制分享图片的详细代码
    // 这里只是简单的示例
    
    // 完成后展示并保存图片
    wx.showToast({
      title: '图片已保存到相册',
      icon: 'success'
    });
  },
  
  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function() {
    const configData = this.data.configData;
    
    if (!configData) {
      return {
        title: '电脑配置方案分享',
        path: '/pages/index/index'
      };
    }
    
    return {
      title: `电脑配置方案「${configData.name}」，总价${this.data.totalPrice}元`,
      path: `/pages/detail/detail?id=${configData.id}&shared=true`,
      imageUrl: '/static/images/share-cover.png' // 分享封面
    };
  },
  
  /**
   * 用户点击右上角分享到朋友圈
   */
  onShareTimeline: function() {
    const configData = this.data.configData;
    
    if (!configData) {
      return {
        title: '电脑配置方案分享',
        query: ''
      };
    }
    
    return {
      title: `电脑配置方案「${configData.name}」，总价${this.data.totalPrice}元`,
      query: `id=${configData.id}&shared=true`,
      imageUrl: '/static/images/share-cover.png'
    };
  },
  
  // 编辑此配置 - 这与原来的editConfig函数相同，但名称与WXML保持一致
  goToEdit: function() {
    this.editConfig();
  }
}) 