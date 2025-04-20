Component({
  properties: {
    
  },
  
  data: {
    selected: 0,
    color: "#8a8a8a",
    selectedColor: "#ff8c00",
    backgroundColor: "#1a1a1a",
    borderStyle: "white",
    list: [
      {
        pagePath: "/pages/home/home",
        text: "首页",
        iconPath: "/static/images/tab-home.png",
        selectedIconPath: "/static/images/tab-home-active.png"
      },
      {
        pagePath: "/pages/config/config",
        text: "配置",
        iconPath: "/static/images/tab-config.png",
        selectedIconPath: "/static/images/tab-config-active.png"
      },
      {
        pagePath: "/pages/profile/profile",
        text: "我的",
        iconPath: "/static/images/tab-profile.png",
        selectedIconPath: "/static/images/tab-profile-active.png"
      }
    ]
  },
  
  methods: {
    switchTab(e) {
      const data = e.currentTarget.dataset
      const url = data.path
      
      wx.switchTab({
        url
      })
      
      this.setData({
        selected: data.index
      })
    }
  }
}) 