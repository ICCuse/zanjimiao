// 引入推荐服务
const recommendService = require('./recommendation-service');

const app = getApp()

Page({
  /**
   * 页面的初始数据
   */
  data: {
    // 用户选择的需求数据
    userPreference: {
      purpose: 'gaming', // 默认用途：游戏
      budget: 8000,      // 默认预算：8000元
      priority: 'performance' // 默认优先级：性能优先
    },
    
    // 用途选项
    purposeOptions: [
      { value: 'gaming', label: '游戏', icon: 'game-fill' },
      { value: 'work', label: '工作', icon: 'computer-fill' },
      { value: 'office', label: '办公', icon: 'briefcase-fill' },
      { value: 'other', label: '其他', icon: 'star-fill' }
    ],
    
    // 预算范围
    budgetRanges: [
      { value: 3000, label: '入门', desc: '3000元' },
      { value: 5000, label: '普通', desc: '5000元' },
      { value: 8000, label: '中高', desc: '8000元' },
      { value: 12000, label: '高端', desc: '12000元' },
      { value: 20000, label: '旗舰', desc: '20000元' }
    ],
    
    // 优先级选项
    priorityOptions: [
      { value: 'performance', label: '性能优先', desc: '追求极致体验' },
      { value: 'value', label: '性价比优先', desc: '均衡的选择' },
      { value: 'quiet', label: '静音优先', desc: '低噪音运行' }
    ],
    
    // 当前选中的选项索引
    selectedPurposeIndex: 0,
    selectedBudgetIndex: 1,
    selectedPriorityIndex: 1,
    
    // 加载状态
    isLoading: false
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    // 设置页面标题
    wx.setNavigationBarTitle({
      title: '配置生成'
    });
    
    // 检查是否从全局数据中获取初始偏好设置
    const app = getApp();
    if (app.globalData && app.globalData.initialPreference) {
      const initialPref = app.globalData.initialPreference;
      
      // 根据初始偏好设置更新UI
      this.updatePreferenceUI(initialPref);
      
      // 清除全局数据中的初始偏好，避免重复使用
      app.globalData.initialPreference = null;
    }
  },
  
  /**
   * 根据偏好更新UI状态
   */
  updatePreferenceUI: function(preference) {
    if (!preference) return;
    
    let purposeIndex = 0;
    let budgetIndex = 1;
    let priorityIndex = 1;
    
    // 找到匹配的用途索引
    if (preference.purpose) {
      const purposeIdx = this.data.purposeOptions.findIndex(opt => opt.value === preference.purpose);
      if (purposeIdx >= 0) purposeIndex = purposeIdx;
    }
    
    // 找到匹配或最接近的预算索引
    if (preference.budget) {
      // 找到最接近的预算选项
      let minDiff = Infinity;
      this.data.budgetRanges.forEach((range, idx) => {
        const diff = Math.abs(range.value - preference.budget);
        if (diff < minDiff) {
          minDiff = diff;
          budgetIndex = idx;
        }
      });
    }
    
    // 找到匹配的优先级索引
    if (preference.priority) {
      const priorityIdx = this.data.priorityOptions.findIndex(opt => opt.value === preference.priority);
      if (priorityIdx >= 0) priorityIndex = priorityIdx;
    }
    
    // 更新UI和偏好数据
    this.setData({
      selectedPurposeIndex: purposeIndex,
      selectedBudgetIndex: budgetIndex,
      selectedPriorityIndex: priorityIndex,
      userPreference: {
        purpose: this.data.purposeOptions[purposeIndex].value,
        budget: preference.budget || this.data.budgetRanges[budgetIndex].value,
        priority: this.data.priorityOptions[priorityIndex].value
      }
    });
  },

  /**
   * 选择用途
   */
  selectPurpose: function(e) {
    const index = e.currentTarget.dataset.index;
    const purpose = this.data.purposeOptions[index].value;
    
    this.setData({
      selectedPurposeIndex: index,
      'userPreference.purpose': purpose
    });
  },
  
  /**
   * 选择预算
   */
  selectBudget: function(e) {
    const index = e.currentTarget.dataset.index;
    const budget = this.data.budgetRanges[index].value;
    
    this.setData({
      selectedBudgetIndex: index,
      'userPreference.budget': budget
    });
  },
  
  /**
   * 预算滑块变化
   */
  budgetSliderChange: function(e) {
    const budget = e.detail.value;
    
    // 更新预算值
    this.setData({
      'userPreference.budget': budget
    });
    
    // 根据滑块值更新预选预算索引（如果有匹配的话）
    const budgetIndex = this.data.budgetRanges.findIndex(range => range.value === budget);
    if (budgetIndex >= 0) {
      this.setData({
        selectedBudgetIndex: budgetIndex
      });
    } else {
      // 如果没有精确匹配，则取消预算选项的选中状态
      this.setData({
        selectedBudgetIndex: -1
      });
    }
  },
  
  /**
   * 选择优先级
   */
  selectPriority: function(e) {
    const index = e.currentTarget.dataset.index;
    const priority = this.data.priorityOptions[index].value;
    
    this.setData({
      selectedPriorityIndex: index,
      'userPreference.priority': priority
    });
  },
  
  /**
   * 获取推荐方案
   */
  getRecommendation: function() {
    // 开始加载
    this.setData({
      isLoading: true
    });
    
    // 获取用户偏好
    const userPreference = this.data.userPreference;
    
    // 调用推荐服务
    recommendService.generateRecommendation(userPreference)
      .then(recommendation => {
        console.log('推荐结果:', recommendation);
        
        // 将推荐结果存入全局数据，以便结果页面获取
        const app = getApp();
        app.globalData = app.globalData || {};
        app.globalData.recommendResult = recommendation;
        
        // 跳转到结果页面
        wx.navigateTo({
          url: '/pages/recommendation/result',
          success: () => {
            // 导航成功后重置加载状态
            this.setData({
              isLoading: false
            });
          },
          fail: (err) => {
            console.error('导航到结果页面失败:', err);
            this.setData({
              isLoading: false
            });
            
            // 显示错误提示
            wx.showToast({
              title: '生成方案失败，请重试',
              icon: 'none'
            });
          }
        });
      })
      .catch(error => {
        console.error('获取推荐方案失败:', error);
        
        // 停止加载
        this.setData({
          isLoading: false
        });
        
        // 显示错误提示
        wx.showToast({
          title: '生成方案失败，请重试',
          icon: 'none'
        });
      });
  },
  
  /**
   * 生命周期函数--监听页面初次渲染完成
   */
  onReady: function () {
    
  },

  /**
   * 生命周期函数--监听页面显示
   */
  onShow: function () {
    
  },

  /**
   * 生命周期函数--监听页面隐藏
   */
  onHide: function () {
    
  },

  /**
   * 生命周期函数--监听页面卸载
   */
  onUnload: function () {
    
  },

  /**
   * 页面相关事件处理函数--监听用户下拉动作
   */
  onPullDownRefresh: function () {
    
  },

  /**
   * 页面上拉触底事件的处理函数
   */
  onReachBottom: function () {
    
  },

  /**
   * 用户点击右上角分享
   */
  onShareAppMessage: function () {
    return {
      title: '电脑配置生成',
      path: '/pages/recommendation/index'
    };
  }
}) 