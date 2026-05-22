// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'your-cloud-env-id' // 使用正确的云环境ID
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { config } = event
  
  if (!config) {
    return {
      success: false,
      error: '未提供配置数据'
    }
  }
  
  try {
    // 添加创建信息
    config._openid = wxContext.OPENID
    config.createTime = db.serverDate()
    config.updateTime = db.serverDate()
    config.shareCount = 0
    
    console.log('准备保存配置:', config);
    
    // 插入配置数据
    const result = await db.collection('pcConfigs').add({
      data: config
    })
    
    console.log('配置保存成功，ID:', result._id);
    
    return {
      success: true,
      configId: result._id
    }
  } catch (err) {
    console.error('保存配置失败:', err)
    return {
      success: false,
      error: err
    }
  }
} 