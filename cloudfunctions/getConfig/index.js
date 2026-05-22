// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'your-cloud-env-id' // 使用正确的云环境ID
})

const db = cloud.database()

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const { configId } = event
  
  if (!configId) {
    return {
      success: false,
      error: '未提供配置ID'
    }
  }
  
  try {
    // 获取配置数据
    const result = await db.collection('pcConfigs').doc(configId).get()
    
    if (!result.data) {
      return {
        success: false,
        error: '配置不存在'
      }
    }
    
    // 更新分享次数
    await db.collection('pcConfigs').doc(configId).update({
      data: {
        shareCount: db.command.inc(1),
        lastViewTime: db.serverDate()
      }
    })
    
    // 确保返回数据格式一致
    console.log('获取到配置数据:', result.data);
    
    return {
      success: true,
      data: result.data
    }
  } catch (err) {
    console.error(err)
    return {
      success: false,
      error: err
    }
  }
} 