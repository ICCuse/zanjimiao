// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'pcconfig-7grn6s1naf2b91d9' // 使用正确的云环境ID
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
    // 确保有用户ID
    config.userId = wxContext.OPENID
    config.createTime = db.serverDate()
    
    // 写入到user_configs集合
    const result = await db.collection('user_configs').add({
      data: config
    })
    
    return {
      success: true,
      configId: result._id
    }
  } catch (error) {
    console.error('保存配置失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 