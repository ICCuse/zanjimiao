// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'your-cloud-env-id' // 使用正确的云环境ID
})

const db = cloud.database()
const userConfigsCollection = db.collection('user_configs')

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取请求参数
  const { configId } = event
  
  if (!configId) {
    return {
      success: false,
      error: '未提供配置ID'
    }
  }
  
  try {
    // 首先查询该配置是否存在且属于当前用户
    const queryResult = await userConfigsCollection.where({
      id: configId,
      _openid: openid
    }).get()
    
    if (!queryResult.data || queryResult.data.length === 0) {
      return {
        success: false,
        error: '未找到该配置或无权限删除'
      }
    }
    
    // 获取数据库记录的_id
    const docId = queryResult.data[0]._id
    
    // 执行删除操作
    const deleteResult = await userConfigsCollection.doc(docId).remove()
    
    if (deleteResult.stats.removed > 0) {
    return {
      success: true,
        message: '配置删除成功'
      }
    } else {
      return {
        success: false,
        error: '删除操作未能完成'
      }
    }
  } catch (err) {
    console.error('删除配置失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
} 