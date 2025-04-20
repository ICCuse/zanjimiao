const app = getApp()

Page({
  data: {
    userInfo: {},
    hasUserInfo: false,
    canIUseGetUserProfile: false,
    favoriteCount: 0,
    historyCount: 0,
    tabs: [
      { id: 'favorite', name: '我的收藏' },
      { id: 'history', name: '浏览历史' },
      { id: 'configs', name: '我的配置' }
    ],
    activeTab: 'favorite',
    favoriteList: [],
    historyList: [],
    userConfigs: [],
    aboutClickCount: 0,
    lastClickTime: 0
  },

  onLoad() {
    if (wx.getUserProfile) {
      this.setData({
        canIUseGetUserProfile: true
      })
    }
    
    // 检查是否有从其他页面传递的参数
    const profileParams = wx.getStorageSync('profile_params')
    if (profileParams) {
      // 如果有指定的activeTab，则切换到对应标签
      if (profileParams.activeTab) {
        this.setData({
          activeTab: profileParams.activeTab
        })
      }
      
      // 使用完参数后清除存储
      wx.removeStorageSync('profile_params')
    }
  },
  
  onShow() {
    if (typeof this.getTabBar === 'function' && this.getTabBar()) {
      this.getTabBar().setData({
        selected: 2
      })
    }
    
    // 每次显示页面时重新加载数据
    this.loadUserData()
  },

  // 获取用户信息
  getUserProfile() {
    wx.getUserProfile({
      desc: '用于完善会员资料',
      success: (res) => {
        app.globalData.userInfo = res.userInfo
        app.globalData.hasLogin = true
        
        this.setData({
          userInfo: res.userInfo,
          hasUserInfo: true
        })
        
        // 保存用户信息到本地
        wx.setStorageSync('userInfo', res.userInfo)
      }
    })
  },

  // 加载用户数据
  loadUserData() {
    // 显示加载中提示
    wx.showLoading({
      title: '加载中',
      mask: true
    })
    
    // 从全局获取用户信息
    const userInfo = app.globalData.userInfo
    if (userInfo) {
      this.setData({
        userInfo,
        hasUserInfo: true
      })
    }
    
    // 获取收藏列表
    const favorites = app.globalData.favorites || []
    let favoriteList = []
    
    // 获取历史记录
    const viewHistory = app.globalData.viewHistory || []
    let historyList = []
    
    // 获取收藏的配置详情
    favorites.forEach(id => {
      const config = app.getConfigById(id)
      if (config) {
        favoriteList.push({
          id: config.id,
          name: config.name,
          desc: config.desc,
          totalPrice: config.totalPrice,
          date: config.createTime || Date.now(),
          performance: config.performance
        })
      }
    })
    
    // 获取历史记录的配置详情
    viewHistory.forEach(id => {
      const config = app.getConfigById(id)
      if (config) {
        historyList.push({
          id: config.id,
          name: config.name,
          desc: config.desc,
          totalPrice: config.totalPrice,
          date: config.createTime || Date.now(),
          performance: config.performance
        })
      }
    })
    
    // 更新收藏和历史记录
    this.setData({
      favoriteList,
      historyList,
      favoriteCount: favoriteList.length,
      historyCount: historyList.length
    })
    
    // 使用Promise方式异步获取用户配置
    app.getUserConfigs()
      .then(userConfigs => {
        console.log('获取到的用户配置:', userConfigs);
        
        // 格式化用户配置
        const formattedUserConfigs = userConfigs.map(config => {
          return {
            id: config.id,
            name: config.name,
            desc: config.desc || '自定义配置',
            totalPrice: config.totalPrice,
            date: config.createTime || Date.now(),
            performance: config.performance || app.evaluatePerformance(config)
          }
        });
        
        // 更新用户配置数据
        this.setData({
          userConfigs: formattedUserConfigs
        });
        
        wx.hideLoading();
      })
      .catch(err => {
        console.error('获取用户配置失败:', err);
        
        // 出错时设置空数组
        this.setData({
          userConfigs: []
        });
        
        wx.hideLoading();
      });
  },

  // 切换标签页
  switchTab(e) {
    const { tab } = e.currentTarget.dataset
    this.setData({
      activeTab: tab
    })
  },

  // 跳转到详情页
  navToDetail(e) {
    const { id } = e.currentTarget.dataset
    wx.navigateTo({
      url: `/packageDetail/pages/detail/detail?id=${id}`
    })
  },

  // 移除收藏
  removeFavorite(e) {
    const { id } = e.currentTarget.dataset
    
    // 使用app方法移除收藏
    app.removeFromFavorites(id)
    
    // 重新加载数据
    this.loadUserData()
    
    wx.showToast({
      title: '已移除收藏',
      icon: 'success'
    })
  },

  // 清空历史记录
  clearHistory() {
    wx.showModal({
      title: '提示',
      content: '确定要清空浏览历史吗？',
      success: (res) => {
        if (res.confirm) {
          // 清空全局的浏览历史
          app.globalData.viewHistory = []
          wx.setStorageSync('view_history', [])
          
          // 更新页面数据
          this.setData({
            historyList: [],
            historyCount: 0
          })
          
          wx.showToast({
            title: '已清空',
            icon: 'success'
          })
        }
      }
    })
  },
  
  /**
   * 删除配置方案
   */
  deleteConfig: function(e) {
    const configId = e.currentTarget.dataset.id
    
    if (!configId) return
    
    wx.showModal({
      title: '确认删除',
      content: '确定要删除此配置方案吗？',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '删除中',
            mask: true
          })
          
          // 调用云函数删除配置
          app.deleteUserConfig(configId)
            .then(() => {
              wx.hideLoading()
              
              wx.showToast({
                title: '删除成功',
                icon: 'success'
              })
              
              // 重新加载数据
              this.loadUserData()
            })
            .catch(err => {
              wx.hideLoading()
              
              wx.showToast({
                title: '删除失败',
                icon: 'none'
              })
              
              console.error('删除配置失败:', err)
            })
        }
      }
    })
  },
  
  // 跳转到配置页面编辑
  editConfig(e) {
    const { id } = e.currentTarget.dataset
    
    // 获取要编辑的配置
    const config = app.getConfigById(id)
    
    if (config) {
      // 保存到本地存储
      wx.setStorageSync('edit_config', config)
      
      // 跳转到配置页面
      wx.switchTab({
        url: '/pages/config/config'
      })
    }
  },
  
  // 创建新配置
  createNewConfig() {
    // 跳转到配置页面
    wx.switchTab({
      url: '/pages/config/config'
    })
  },
  
  // 格式化时间
  formatDate(timestamp) {
    if (!timestamp) return ''
    
    const date = new Date(timestamp)
    const year = date.getFullYear()
    const month = (date.getMonth() + 1).toString().padStart(2, '0')
    const day = date.getDate().toString().padStart(2, '0')
    
    return `${year}-${month}-${day}`
  },
  
  // 联系客服
  contactService() {
    // 实际应用中可以跳转到客服会话
    wx.showToast({
      title: '即将接入客服',
      icon: 'none'
    })
  },
  
  // 跳转到关于页面
  navToAbout() {
    // 添加彩蛋计数器
    if (!this.data.aboutClickCount) {
      this.setData({
        aboutClickCount: 1,
        lastClickTime: Date.now()
      });
    } else {
      // 检查是否在短时间内点击（3秒内）
      const now = Date.now();
      if (now - this.data.lastClickTime < 3000) {
        // 增加计数
        const newCount = this.data.aboutClickCount + 1;
        this.setData({
          aboutClickCount: newCount,
          lastClickTime: now
        });
        
        // 如果点击了9次，跳转到管理员页面
        if (newCount >= 9) {
          this.setData({ aboutClickCount: 0 }); // 重置计数
          wx.navigateTo({
            url: '/packageAdmin/pages/admin/admin'
          });
          return;
        }
      } else {
        // 超时，重置计数
        this.setData({
          aboutClickCount: 1,
          lastClickTime: now
        });
      }
    }
    
    // 正常跳转到关于页面
    wx.navigateTo({
      url: '/pages/about/about'
    });
  },
  
  // 调用云函数初始化组件数据
  initComponentsData() {
    wx.showModal({
      title: '初始化组件数据',
      content: '确定要初始化组件数据吗？这将导入所有硬件组件数据到云数据库。',
      cancelText: '取消',
      confirmText: '确定',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '初始化中...',
            mask: true
          });
          
          // 调用云函数
          wx.cloud.callFunction({
            name: 'initComponentsData',
            data: {
              clearFirst: true  // 先清空现有数据
            },
            success: res => {
              wx.hideLoading();
              console.log('数据初始化成功', res.result);
              
              // 查询各类型组件数量
              const db = wx.cloud.database();
              const $ = db.command.aggregate;
              db.collection('components').aggregate()
                .group({
                  _id: '$type',
                  count: $.sum(1)
                })
                .end()
                .then(res => {
                  console.log('组件类型统计:', res.list);
                  let statsText = '初始化成功\n\n组件类型统计:\n';
                  res.list.forEach(item => {
                    statsText += `${item._id}: ${item.count}个\n`;
                  });
                  
                  wx.showModal({
                    title: '数据初始化结果',
                    content: statsText,
                    showCancel: false
                  });
                })
                .catch(err => {
                  console.error('统计组件类型失败', err);
                  wx.showToast({
                    title: '初始化成功',
                    icon: 'success'
                  });
                });
            },
            fail: err => {
              wx.hideLoading();
              console.error('数据初始化失败', err);
              wx.showToast({
                title: '初始化失败',
                icon: 'none'
              });
            }
          });
        }
      }
    });
  }
}) 