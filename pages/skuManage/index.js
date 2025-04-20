// pages/skuManage/index.js
Page({
  data: {
    goodsList: [],
    loading: false,
    editingIndex: -1,    // 当前正在编辑的商品索引
    editMode: '',        // 编辑模式: 'sku'或'supplier'
    skuInput: '',        // SKU输入值
    supplierPriceInput: '', // 供应商价格输入值
    priceStrategy: 'jdApi' // 价格更新策略: 'jdApi'或'supplier'
  },

  onLoad: function() {
    // 加载商品列表
    this.loadGoodsList();
  },
  
  // 选择价格更新策略
  selectStrategy: function(e) {
    const strategy = e.currentTarget.dataset.strategy;
    this.setData({
      priceStrategy: strategy
    });
  },

  // 更新价格按钮点击事件
  updatePrice: function() {
    const that = this;
    const { priceStrategy, goodsList } = this.data;
    
    // 根据不同的价格更新策略设置提示信息
    let content = '';
    let itemsToUpdate = [];
    
    if (priceStrategy === 'jdApi') {
      // 筛选已关联SKU的商品
      itemsToUpdate = goodsList.filter(item => item.skuId && item.skuId !== '' && !item.notLinked);
      content = `将使用京东API更新${itemsToUpdate.length}个已关联SKU的商品价格，是否继续？`;
    } else if (priceStrategy === 'supplier') {
      // 筛选已设置供应商价格的商品
      itemsToUpdate = goodsList.filter(item => item.supplierPrice && !isNaN(parseFloat(item.supplierPrice)));
      content = `将根据供应商价格计算${itemsToUpdate.length}个商品的零售价，是否继续？`;
    }
    
    if (itemsToUpdate.length === 0) {
      let missingMessage = priceStrategy === 'jdApi' ? 
        '没有找到已关联SKU的商品' : 
        '没有找到已设置供应商价格的商品';
        
      wx.showToast({
        title: missingMessage,
        icon: 'none',
        duration: 2000
      });
      return;
    }

    // 显示确认对话框
    wx.showModal({
      title: '确认更新价格',
      content: content,
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '更新中...',
            mask: true  // 防止用户多次点击
          });
          
          console.log(`开始调用云函数更新价格，使用${priceStrategy}模式...`);
          
          // 调用云函数
          wx.cloud.callFunction({
            name: 'adminTools',
            data: {
              action: 'triggerPriceUpdate',
              priceSource: priceStrategy // 传递价格来源参数
            },
            success: function(res) {
              wx.hideLoading();
              console.log('云函数调用成功，返回结果:', res);
              
              if (res.result && res.result.success) {
                // 即使触发成功，也要检查更新结果
                if (res.result.result && res.result.result.success) {
                  // 价格更新真正成功
                  const updatedCount = res.result.result.updatedCount || 0;
                  
                  if (updatedCount > 0) {
                    wx.showToast({
                      title: `成功更新${updatedCount}个商品价格`,
                      icon: 'success',
                      duration: 2000
                    });
                  } else {
                    // 虽然API调用成功，但没有更新任何记录
                    wx.showModal({
                      title: '未更新任何价格',
                      content: '云函数执行成功，但未能更新任何商品价格。',
                      showCancel: false
                    });
                  }
                } else {
                  // 触发成功但更新失败
                  const errorMsg = (res.result.result && res.result.result.error) || '未知错误';
                  wx.showModal({
                    title: '更新失败',
                    content: `触发成功但更新过程中出错: ${errorMsg}`,
                    showCancel: false
                  });
                }
                
                // 刷新商品列表
                that.loadGoodsList();
              } else {
                // 云函数调用失败
                const errorMsg = res.result ? (res.result.error || '未知错误') : '返回结果为空';
                wx.showModal({
                  title: '更新失败',
                  content: `错误信息: ${errorMsg}`,
                  showCancel: false
                });
                
                console.error('更新价格失败:', res.result);
              }
            },
            fail: function(err) {
              wx.hideLoading();
              console.error('调用云函数失败:', err);
              
              wx.showModal({
                title: '网络错误',
                content: `调用云函数时发生错误: ${err.errMsg || err.message || '未知错误'}`,
                showCancel: false
              });
            }
          });
        }
      }
    });
  },

  // 关联SKU功能 - 打开编辑界面
  linkSku: function(e) {
    const index = e.currentTarget.dataset.index;
    const goodsList = this.data.goodsList;
    const goods = goodsList[index];
    
    // 设置当前编辑商品和SKU输入值
    this.setData({
      editingIndex: index,
      editMode: 'sku',
      skuInput: goods.skuId || ''
    });
  },
  
  // 设置供应商价格 - 打开编辑界面
  editSupplierPrice: function(e) {
    const index = e.currentTarget.dataset.index;
    const goodsList = this.data.goodsList;
    const goods = goodsList[index];
    
    this.setData({
      editingIndex: index,
      editMode: 'supplier',
      supplierPriceInput: goods.supplierPrice ? goods.supplierPrice.toString() : ''
    });
  },
  
  // 取消编辑
  cancelEdit: function() {
    this.setData({
      editingIndex: -1,
      editMode: '',
      skuInput: '',
      supplierPriceInput: ''
    });
  },
  
  // 输入SKU值
  onSkuInput: function(e) {
    this.setData({
      skuInput: e.detail.value
    });
  },
  
  // 输入供应商价格
  onSupplierPriceInput: function(e) {
    this.setData({
      supplierPriceInput: e.detail.value
    });
  },
  
  // 保存SKU关联
  saveSku: function() {
    const that = this;
    const { editingIndex, skuInput, goodsList } = this.data;
    
    if (editingIndex < 0 || !goodsList[editingIndex]) {
      return;
    }
    
    const goods = goodsList[editingIndex];
    
    // 显示加载提示
    wx.showLoading({
      title: '保存中...'
    });
    
    // 调用云函数更新SKU
    wx.cloud.callFunction({
      name: 'adminTools',
      data: {
        action: 'updateSkuId',
        componentId: goods._id,
        data: {
          skuId: skuInput
        }
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          // 更新本地数据
          const updatedGoods = [...goodsList];
          updatedGoods[editingIndex].skuId = skuInput;
          updatedGoods[editingIndex].notLinked = !skuInput;
          
          that.setData({
            goodsList: updatedGoods,
            editingIndex: -1,
            editMode: '',
            skuInput: ''
          });
          
          wx.showToast({
            title: 'SKU关联成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '关联失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('关联SKU失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },
  
  // 保存供应商价格
  saveSupplierPrice: function() {
    const that = this;
    const { editingIndex, supplierPriceInput, goodsList } = this.data;
    
    if (editingIndex < 0 || !goodsList[editingIndex]) {
      return;
    }
    
    const goods = goodsList[editingIndex];
    
    // 验证输入是数字
    const supplierPrice = parseFloat(supplierPriceInput);
    if (isNaN(supplierPrice) || supplierPrice <= 0) {
      wx.showToast({
        title: '请输入有效价格',
        icon: 'none'
      });
      return;
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '保存中...'
    });
    
    // 设置供应商默认利润率
    const profitRate = 0.12; // 默认12%利润率
    
    // 调用云函数更新供应商价格
    wx.cloud.callFunction({
      name: 'adminTools',
      data: {
        action: 'updateComponent',
        componentId: goods._id,
        data: {
          supplierPrice: supplierPrice,
          profitRate: profitRate,
          marketFactor: 1.0 // 默认市场因子
        }
      },
      success: function(res) {
        wx.hideLoading();
        
        if (res.result && res.result.success) {
          // 更新本地数据
          const updatedGoods = [...goodsList];
          updatedGoods[editingIndex].supplierPrice = supplierPrice;
          
          that.setData({
            goodsList: updatedGoods,
            editingIndex: -1,
            editMode: '',
            supplierPriceInput: ''
          });
          
          wx.showToast({
            title: '供应价设置成功',
            icon: 'success'
          });
        } else {
          wx.showToast({
            title: '设置失败，请重试',
            icon: 'none'
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('设置供应商价格失败:', err);
        wx.showToast({
          title: '网络错误，请重试',
          icon: 'none'
        });
      }
    });
  },

  // 页面数据加载
  loadGoodsList: function() {
    const that = this;
    wx.showLoading({
      title: '加载中...',
    });
    
    // 使用云函数获取商品列表
    wx.cloud.callFunction({
      name: 'adminTools',
      data: {
        action: 'getComponents',
        type: 'all'
      },
      success: function(res) {
        wx.hideLoading();
        if (res.result && res.result.success) {
          // 处理商品数据，标记未关联的SKU
          const goodsList = (res.result.components || []).map(item => {
            return {
              ...item,
              notLinked: !item.skuId || item.skuId === ''
            };
          });
          that.setData({
            goodsList: goodsList
          });
        } else {
          wx.showToast({
            title: '加载失败',
            icon: 'none',
            duration: 2000
          });
        }
      },
      fail: function(err) {
        wx.hideLoading();
        console.error('获取商品列表失败:', err);
        wx.showToast({
          title: '网络错误',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },

  // 创建测试数据
  createTestData: function() {
    const that = this;
    wx.showModal({
      title: '创建测试数据',
      content: '确定要创建测试组件数据吗？这将添加几个样例组件。',
      success: function(res) {
        if (res.confirm) {
          wx.showLoading({
            title: '创建中...'
          });
          
          wx.cloud.callFunction({
            name: 'adminTools',
            data: {
              action: 'createTestComponents'
            },
            success: function(res) {
              wx.hideLoading();
              
              if (res.result && res.result.success) {
                wx.showToast({
                  title: res.result.message,
                  icon: 'success'
                });
                
                // 刷新商品列表
                that.loadGoodsList();
              } else {
                wx.showToast({
                  title: '创建失败',
                  icon: 'none'
                });
                console.error('创建测试数据失败:', res.result);
              }
            },
            fail: function(err) {
              wx.hideLoading();
              wx.showToast({
                title: '网络错误，请重试',
                icon: 'none'
              });
              console.error('调用云函数失败:', err);
            }
          });
        }
      }
    });
  },

  // 测试云环境
  testCloudEnv: function() {
    wx.showLoading({
      title: '测试中...',
      mask: true
    });
    
    // 检查云函数环境
    const that = this;
    
    // 尝试列出集合
    wx.cloud.database().listCollections({
      success: function(res) {
        const collections = res.data.map(col => col.name).join(', ');
        
        // 检查云函数
        wx.cloud.callFunction({
          name: 'adminTools',
          data: {
            action: 'getJDConfig'
          },
          success: function(res) {
            wx.hideLoading();
            
            const envId = wx.cloud.DYNAMIC_CURRENT_ENV || '未获取';
            const hasAppKey = res.result && res.result.appKey;
            const hasAppSecret = res.result && res.result.appSecret;
            
            wx.showModal({
              title: '云环境测试结果',
              content: 
                `云环境ID: ${envId}\n` +
                `发现集合: ${collections}\n` +
                `京东API配置: ${hasAppKey && hasAppSecret ? '已配置' : '未配置'}`,
              showCancel: false
            });
          },
          fail: function(err) {
            wx.hideLoading();
            
            wx.showModal({
              title: '云函数调用失败',
              content: `无法调用adminTools云函数: ${err.errMsg || '未知错误'}`,
              showCancel: false
            });
          }
        });
      },
      fail: function(err) {
        wx.hideLoading();
        
        wx.showModal({
          title: '云环境测试失败',
          content: `无法获取云数据库集合列表: ${err.errMsg || '未知错误'}`,
          showCancel: false
        });
      }
    });
  },
}); 