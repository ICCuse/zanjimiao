const app = getApp()

Page({
  data: {
    components: [],
    loading: false,
    currentPage: 1,
    totalPages: 1,
    pageSize: 10,
    selectedCategory: 'all',
    // 数据导入相关
    collectionName: 'components',
    jsonData: '',
    // 批量SKU关联相关
    skuMapping: ''
    // JD API配置相关 - 已删除
  },

  onLoad: function (options) {
    this.loadComponents()
  },

  onPullDownRefresh: function () {
    this.setData({
      currentPage: 1
    })
    this.loadComponents(() => {
      wx.stopPullDownRefresh()
    })
  },

  // 加载组件列表
  loadComponents: function (callback) {
    this.setData({ loading: true })
    
    const db = wx.cloud.database()
    const componentsRef = db.collection('components')
    
    // 获取总数
    componentsRef.count().then(res => {
      const total = res.total
      const totalPages = Math.ceil(total / this.data.pageSize)
      
      this.setData({ totalPages })
      
      // 查询当前页数据
      let query = componentsRef
      
      if (this.data.selectedCategory !== 'all') {
        query = query.where({
          category: this.data.selectedCategory
        })
      }
      
      return query.skip((this.data.currentPage - 1) * this.data.pageSize)
        .limit(this.data.pageSize)
        .get()
    }).then(res => {
      this.setData({
        components: res.data,
        loading: false
      })
      
      if (callback) callback()
    }).catch(err => {
      console.error('获取组件列表失败:', err)
      this.setData({ loading: false })
      wx.showToast({
        title: '获取数据失败',
        icon: 'none'
      })
      
      if (callback) callback()
    })
  },

  // 改变分类
  changeCategory: function (e) {
    const category = e.currentTarget.dataset.category
    this.setData({
      selectedCategory: category,
      currentPage: 1
    })
    this.loadComponents()
  },

  // 关联京东SKU
  associateJDSku: function (e) {
    const componentId = e.currentTarget.dataset.id
    const componentName = e.currentTarget.dataset.name
    
    wx.showModal({
      title: '关联京东商品',
      content: `为 ${componentName} 输入京东商品ID(SKU)`,
      editable: true,
      placeholderText: '例如: 100016034372',
      success: (res) => {
        if (res.confirm && res.content) {
          const skuId = res.content.trim()
          
          wx.showLoading({ title: '关联中' })
          
          wx.cloud.callFunction({
            name: 'adminTools',
            data: {
              action: 'updateSkuId',
              componentId: componentId,
              data: { skuId }
            },
            success: (res) => {
              wx.hideLoading()
              
              if (res.result.success) {
                wx.showToast({
                  title: '关联成功',
                  icon: 'success'
                })
                
                // 刷新组件列表
                this.loadComponents()
              } else {
                wx.showToast({
                  title: '关联失败',
                  icon: 'error'
                })
                console.error('关联失败:', res.result.error)
              }
            },
            fail: (err) => {
              wx.hideLoading()
              wx.showToast({
                title: '操作失败',
                icon: 'error'
              })
              console.error('调用云函数失败:', err)
            }
          })
        }
      }
    })
  },

  // 手动触发价格更新
  triggerPriceUpdate: function () {
    wx.showModal({
      title: '价格更新',
      content: '确定要开始更新所有组件的价格吗？这可能需要一些时间。',
      success: (res) => {
        if (res.confirm) {
          wx.showLoading({
            title: '正在更新价格',
            mask: true
          })
          
          wx.cloud.callFunction({
            name: 'adminTools',
            data: {
              action: 'triggerPriceUpdate'
            },
            success: (res) => {
              wx.hideLoading()
              
              if (res.result.success) {
                const updatedCount = res.result.result.updatedCount || 0
                
                wx.showModal({
                  title: '更新完成',
                  content: `成功更新了 ${updatedCount} 个组件的价格数据`,
                  showCancel: false
                })
                
                // 刷新组件列表
                this.loadComponents()
              } else {
                wx.showToast({
                  title: '更新失败',
                  icon: 'error'
                })
                console.error('更新失败:', res.result.error)
              }
            },
            fail: (err) => {
              wx.hideLoading()
              wx.showToast({
                title: '操作失败',
                icon: 'error'
              })
              console.error('调用云函数失败:', err)
            }
          })
        }
      }
    })
  },

  // 上一页
  prevPage: function () {
    if (this.data.currentPage > 1) {
      this.setData({
        currentPage: this.data.currentPage - 1
      })
      this.loadComponents()
    }
  },

  // 下一页
  nextPage: function () {
    if (this.data.currentPage < this.data.totalPages) {
      this.setData({
        currentPage: this.data.currentPage + 1
      })
      this.loadComponents()
    }
  },

  // 格式化时间
  formatDate: function (timestamp) {
    if (!timestamp) return '未更新'
    
    const date = new Date(timestamp)
    return `${date.getMonth()+1}/${date.getDate()} ${date.getHours()}:${String(date.getMinutes()).padStart(2, '0')}`
  },

  // 数据导入相关函数
  // 收集集合名称
  onCollectionNameInput: function(e) {
    this.setData({
      collectionName: e.detail.value
    })
  },

  // 收集JSON数据
  onJsonDataInput: function(e) {
    this.setData({
      jsonData: e.detail.value
    })
  },

  // 导入数据
  importData: function() {
    if (!this.data.collectionName) {
      wx.showToast({
        title: '请输入集合名称',
        icon: 'none'
      })
      return
    }
    
    if (!this.data.jsonData) {
      wx.showToast({
        title: '请输入JSON数据',
        icon: 'none'
      })
      return
    }
    
    // 尝试解析JSON
    let parsedData
    try {
      parsedData = JSON.parse(this.data.jsonData)
      
      if (!Array.isArray(parsedData)) {
        wx.showToast({
          title: 'JSON必须是数组格式',
          icon: 'none'
        })
        return
      }
    } catch (e) {
      wx.showToast({
        title: 'JSON格式错误',
        icon: 'none'
      })
      console.error('JSON解析错误:', e)
      return
    }
    
    // 显示确认对话框
    wx.showModal({
      title: '确认导入',
      content: `将导入${parsedData.length}条数据到${this.data.collectionName}集合，确定继续吗？`,
      success: (res) => {
        if (res.confirm) {
          this.executeImport(parsedData)
        }
      }
    })
  },

  // 执行数据导入
  executeImport: function(data) {
    wx.showLoading({
      title: '导入中...',
      mask: true
    })
    
    wx.cloud.callFunction({
      name: 'importComponents',
      data: {
        collection: this.data.collectionName,
        data: data
      },
      success: (res) => {
        wx.hideLoading()
        
        if (res.result.success) {
          wx.showModal({
            title: '导入成功',
            content: `总共${res.result.total}条数据，成功导入${res.result.imported}条`,
            showCancel: false
          })
          
          // 清空输入区域
          this.setData({
            jsonData: ''
          })
          
          // 刷新组件列表
          this.loadComponents()
        } else {
          wx.showModal({
            title: '导入失败',
            content: res.result.error || '未知错误',
            showCancel: false
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showModal({
          title: '调用云函数失败',
          content: err.message || '未知错误',
          showCancel: false
        })
      }
    })
  },

  // 收集SKU映射输入
  onSkuMappingInput: function(e) {
    this.setData({
      skuMapping: e.detail.value
    })
  },
  
  // 批量关联SKU
  batchAssociateSKU: function() {
    if (!this.data.skuMapping) {
      wx.showToast({
        title: '请输入SKU映射数据',
        icon: 'none'
      })
      return
    }
    
    // 尝试解析JSON
    let skuData
    try {
      skuData = JSON.parse(this.data.skuMapping)
      
      if (!Array.isArray(skuData)) {
        wx.showToast({
          title: 'JSON必须是数组格式',
          icon: 'none'
        })
        return
      }
      
      // 验证数据格式
      for (const item of skuData) {
        if (!item.name || !item.skuId) {
          wx.showToast({
            title: '每个映射必须包含name和skuId字段',
            icon: 'none'
          })
          return
        }
      }
    } catch (e) {
      wx.showToast({
        title: 'JSON格式错误',
        icon: 'none'
      })
      console.error('JSON解析错误:', e)
      return
    }
    
    // 显示确认对话框
    wx.showModal({
      title: '确认批量关联',
      content: `将为${skuData.length}个组件关联SKU，确定继续吗？`,
      success: (res) => {
        if (res.confirm) {
          this.executeBatchSKUAssociation(skuData)
        }
      }
    })
  },
  
  // 执行批量SKU关联
  executeBatchSKUAssociation: function(skuData) {
    wx.showLoading({
      title: '关联中...',
      mask: true
    })
    
    wx.cloud.callFunction({
      name: 'adminTools',
      data: {
        action: 'batchUpdateSkuIds',
        skuData: skuData
      },
      success: (res) => {
        wx.hideLoading()
        
        if (res.result.success) {
          wx.showModal({
            title: '关联成功',
            content: `成功关联了${res.result.updatedCount}个组件的SKU`,
            showCancel: false
          })
          
          // 清空输入区域
          this.setData({
            skuMapping: ''
          })
          
          // 刷新组件列表
          this.loadComponents()
        } else {
          wx.showModal({
            title: '关联失败',
            content: res.result.error || '未知错误',
            showCancel: false
          })
        }
      },
      fail: (err) => {
        wx.hideLoading()
        wx.showModal({
          title: '调用云函数失败',
          content: err.message || '未知错误',
          showCancel: false
        })
      }
    })
  },

  // 已删除JD API配置相关函数
}) 