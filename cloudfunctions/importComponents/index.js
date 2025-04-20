const cloud = require('wx-server-sdk')
cloud.init({ env: 'pcconfig-7grn6s1naf2b91d9' })
const db = cloud.database()

exports.main = async (event, context) => {
  const { collection, data } = event
  
  if (!collection || !data || !Array.isArray(data)) {
    return { 
      success: false, 
      error: '无效的数据格式' 
    }
  }
  
  try {
    console.log(`开始导入${data.length}条数据到${collection}集合`)
    
    // 由于云数据库一次最多添加100条记录，需要分批导入
    const batchSize = 100
    const batchTimes = Math.ceil(data.length / batchSize)
    let successCount = 0
    
    for (let i = 0; i < batchTimes; i++) {
      // 计算当前批次的数据
      const start = i * batchSize
      const end = Math.min(start + batchSize, data.length)
      const batchData = data.slice(start, end)
      console.log(`导入第${i+1}批数据，共${batchData.length}条`)
      
      try {
        // 批量添加数据
        const result = await db.collection(collection).add({
          data: batchData
        })
        successCount += batchData.length
        console.log(`第${i+1}批导入成功，ID:`, result)
      } catch (err) {
        console.error(`第${i+1}批导入失败:`, err)
      }
    }
    
    return {
      success: true,
      total: data.length,
      imported: successCount
    }
  } catch (error) {
    console.error('导入数据失败:', error)
    return {
      success: false,
      error: error.message
    }
  }
} 