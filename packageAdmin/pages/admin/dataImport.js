Page({
  data: {
    jsonData: '',
    importStatus: '',
    clearFirst: true,
    loading: false
  },

  onLoad: function (options) {
    // 页面加载逻辑
  },

  // 切换是否清空原有数据
  toggleClearFirst: function() {
    this.setData({
      clearFirst: !this.data.clearFirst
    })
  },

  // 监听文本输入
  onJsonDataInput: function(e) {
    this.setData({
      jsonData: e.detail.value
    })
  },

  // 执行导入
  importData: function() {
    if (!this.data.jsonData) {
      wx.showToast({
        title: '请输入JSON数据',
        icon: 'none'
      })
      return
    }

    // 尝试解析JSON
    try {
      JSON.parse(this.data.jsonData)
    } catch (e) {
      wx.showToast({
        title: 'JSON格式错误',
        icon: 'none'
      })
      console.error('JSON解析错误:', e)
      return
    }

    wx.showModal({
      title: '确认导入',
      content: `${this.data.clearFirst ? '将清空原有数据，并' : ''}导入新数据，确定吗？`,
      success: (res) => {
        if (res.confirm) {
          this.executeImport()
        }
      }
    })
  },

  // 执行导入
  executeImport: function() {
    this.setData({
      loading: true,
      importStatus: '导入中...'
    })

    wx.cloud.callFunction({
      name: 'importFromJson',
      data: {
        jsonData: this.data.jsonData,
        clearFirst: this.data.clearFirst
      }
    }).then(res => {
      this.setData({ loading: false })

      if (res.result.success) {
        this.setData({
          importStatus: `导入成功：共处理${res.result.totalCount}条数据，成功导入${res.result.importedCount}条`
        })
        
        wx.showModal({
          title: '导入成功',
          content: `成功导入${res.result.importedCount}条数据`,
          showCancel: false
        })
      } else {
        this.setData({
          importStatus: `导入失败：${res.result.error}`
        })
        
        wx.showModal({
          title: '导入失败',
          content: res.result.error,
          showCancel: false
        })
      }
    }).catch(err => {
      console.error('调用云函数失败:', err)
      this.setData({
        loading: false,
        importStatus: `调用失败：${err.message || '未知错误'}`
      })
      
      wx.showModal({
        title: '导入失败',
        content: err.message || '调用云函数失败',
        showCancel: false
      })
    })
  },

  // 从文件导入
  importFromFile: function() {
    wx.showToast({
      title: '请直接在云开发控制台导入文件',
      icon: 'none'
    })
  }
}) 