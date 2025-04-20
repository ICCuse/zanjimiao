// 云函数入口文件
const cloud = require('wx-server-sdk')

cloud.init({
  env: 'pcconfig-7grn6s1naf2b91d9' // 使用正确的云环境ID
})

const db = cloud.database()
const userConfigsCollection = db.collection('user_configs')
const MAX_LIMIT = 100 // 单次最大获取数量

// 云函数入口函数
exports.main = async (event, context) => {
  const wxContext = cloud.getWXContext()
  const openid = wxContext.OPENID
  
  // 获取请求参数
  const { configId } = event
  
  try {
    // 如果提供了特定configId，则获取单个配置
    if (configId) {
      const result = await userConfigsCollection.where({
        id: configId,
        _openid: openid
      }).get()
      
      if (result.data && result.data.length > 0) {
        return {
          success: true,
          data: result.data[0]
        }
      } else {
        return {
          success: false,
          error: '未找到配置'
        }
      }
    }
    
    // 获取用户的所有配置数量
    const countResult = await userConfigsCollection.where({
      _openid: openid
    }).count()
    
    const total = countResult.total
    
    // 如果没有配置，直接返回空数组
    if (total === 0) {
      return {
        success: true,
        data: []
      }
    }
    
    // 计算需要分几次获取
    const batchTimes = Math.ceil(total / MAX_LIMIT)
    
    // 承载所有读操作的 promise 的数组
    const tasks = []
    
    for (let i = 0; i < batchTimes; i++) {
      const promise = userConfigsCollection.where({
        _openid: openid
      })
      .skip(i * MAX_LIMIT)
      .limit(MAX_LIMIT)
      .orderBy('updateTime', 'desc') // 按更新时间降序排列
      .get()
      
      tasks.push(promise)
    }
    
    // 等待所有数据获取完成
    const configsList = (await Promise.all(tasks)).reduce((acc, cur) => {
      return {
        data: acc.data.concat(cur.data),
        errMsg: acc.errMsg
      }
    })
    
    return {
      success: true,
      data: configsList.data
    }
  } catch (err) {
    console.error('获取配置失败:', err)
    return {
      success: false,
      error: err.message
    }
  }
} 