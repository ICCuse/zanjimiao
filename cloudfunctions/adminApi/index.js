const cloud = require('wx-server-sdk')
const crypto = require('crypto')
const templates = require('./template')

cloud.init({ env: 'pcconfig-7grn6s1naf2b91d9' })
const db = cloud.database()
const _ = db.command
const DEFAULT_ADMIN = {
  username: 'admin',
  // 默认密码: admin123
  passwordHash: '240be518fabd2724ddb6f04eeb1da5967448d7e831c08c8fa822809f74c720a9'
}

// 生成密码哈希
function hashPassword(password) {
  return crypto.createHash('sha256').update(password).digest('hex')
}

// 验证用户身份
async function authenticate(cookies) {
  try {
    if (!cookies || !cookies.adminToken) {
      return false
    }
    
    // 从数据库检查token
    const settingsCollection = db.collection('admin_settings')
    const tokenData = await settingsCollection.where({
      token: cookies.adminToken,
      tokenExpiry: _.gt(Date.now())
    }).get()
    
    return tokenData.data.length > 0
  } catch (error) {
    console.error('认证错误:', error)
    return false
  }
}

// 解析HTTP请求中的Cookie
function parseCookies(cookieHeader) {
  const cookies = {}
  if (!cookieHeader) return cookies
  
  cookieHeader.split(';').forEach(cookie => {
    const parts = cookie.split('=')
    const name = parts[0].trim()
    const value = parts[1] ? parts[1].trim() : ''
    cookies[name] = value
  })
  
  return cookies
}

// 解析请求body
function parseBody(body, contentType) {
  if (!body) return {}
  
  if (contentType && contentType.includes('application/json')) {
    try {
      return JSON.parse(body)
    } catch (e) {
      return {}
    }
  } else if (contentType && contentType.includes('application/x-www-form-urlencoded')) {
    const params = {}
    const pairs = body.split('&')
    
    for (const pair of pairs) {
      const [key, value] = pair.split('=')
      params[decodeURIComponent(key)] = decodeURIComponent(value || '')
    }
    
    return params
  }
  
  return {}
}

// 解析URL查询参数
function parseQuery(url) {
  const query = {}
  if (!url.includes('?')) return query
  
  const queryString = url.split('?')[1]
  const pairs = queryString.split('&')
  
  for (const pair of pairs) {
    const [key, value] = pair.split('=')
    query[key] = value ? decodeURIComponent(value) : ''
  }
  
  return query
}

// 确保系统设置集合存在
async function ensureSettings() {
  try {
    // 检查settings表是否存在
    const settingsCollection = db.collection('admin_settings')
    const countResult = await settingsCollection.count()
    
    if (countResult.total === 0) {
      // 初始化系统设置
      await settingsCollection.add({
        data: {
          adminUsername: DEFAULT_ADMIN.username,
          passwordHash: DEFAULT_ADMIN.passwordHash,
          appKey: '',
          appSecret: '',
          createdAt: Date.now()
        }
      })
    }
  } catch (error) {
    console.error('确保系统设置时出错:', error)
  }
}

// 导入组件数据
async function importComponents(componentType, jsonData) {
  try {
    const components = JSON.parse(jsonData)
    if (!Array.isArray(components)) {
      return { success: false, error: '数据格式错误，必须是JSON数组' }
    }
    
    // 验证必要字段
    const requiredFields = ['name', 'brand', 'price']
    for (const comp of components) {
      for (const field of requiredFields) {
        if (!comp[field]) {
          return { success: false, error: `组件缺少必要字段: ${field}` }
        }
      }
    }
    
    // 获取集合名
    const collectionName = `components_${componentType}`
    const collection = db.collection(collectionName)
    
    // 添加时间戳和类型
    const dataToInsert = components.map(comp => ({
      ...comp,
      type: componentType,
      createdAt: Date.now(),
      updatedAt: Date.now()
    }))
    
    // 批量添加数据
    const MAX_BATCH_SIZE = 20 // 云函数单次最多添加20条记录
    let successCount = 0
    
    for (let i = 0; i < dataToInsert.length; i += MAX_BATCH_SIZE) {
      const batch = dataToInsert.slice(i, i + MAX_BATCH_SIZE)
      const result = await collection.add({ data: batch })
      successCount += result.ids.length
    }
    
    return { 
      success: true, 
      message: `成功导入 ${successCount} 个${componentType}组件`
    }
  } catch (error) {
    console.error('导入组件时出错:', error)
    return { success: false, error: `导入失败: ${error.message}` }
  }
}

// 获取组件列表
async function getComponents(type) {
  try {
    let query = {}
    const collections = []
    
    if (type) {
      // 特定类型的组件
      collections.push(`components_${type}`)
    } else {
      // 所有类型的组件
      const componentTypes = ['cpu', 'gpu', 'ram', 'motherboard', 'storage', 'case', 'cooling', 'psu']
      componentTypes.forEach(t => collections.push(`components_${t}`))
    }
    
    // 从每个集合中获取数据
    const results = []
    const LIMIT = 10 // 每个类型只返回10条数据，避免数据过多
    
    for (const collectionName of collections) {
      try {
        const collection = db.collection(collectionName)
        const res = await collection.limit(LIMIT).get()
        results.push(...res.data)
      } catch (e) {
        console.error(`获取${collectionName}数据失败:`, e)
        // 继续处理其他集合
      }
    }
    
    return { success: true, components: results }
  } catch (error) {
    console.error('获取组件列表时出错:', error)
    return { success: false, error: error.message }
  }
}

// 删除组件
async function deleteComponent(id) {
  try {
    if (!id) {
      return { success: false, error: '缺少组件ID' }
    }
    
    // 需要找到组件所在的集合
    const componentTypes = ['cpu', 'gpu', 'ram', 'motherboard', 'storage', 'case', 'cooling', 'psu']
    let deleted = false
    
    for (const type of componentTypes) {
      try {
        const collection = db.collection(`components_${type}`)
        const res = await collection.doc(id).remove()
        
        if (res.stats.removed > 0) {
          deleted = true
          break
        }
      } catch (e) {
        // 如果是"数据库操作失败:文档不存在"错误，则继续查找其他集合
        if (!e.message.includes('文档不存在')) {
          throw e
        }
      }
    }
    
    if (deleted) {
      return { success: true, message: '组件已删除' }
    } else {
      return { success: false, error: '未找到要删除的组件' }
    }
  } catch (error) {
    console.error('删除组件时出错:', error)
    return { success: false, error: error.message }
  }
}

// 保存京东API配置
async function saveJDConfig(appKey, appSecret) {
  try {
    const settingsCollection = db.collection('admin_settings')
    const settings = await settingsCollection.limit(1).get()
    
    if (settings.data.length > 0) {
      await settingsCollection.doc(settings.data[0]._id).update({
        data: {
          appKey,
          appSecret,
          updatedAt: Date.now()
        }
      })
    } else {
      await ensureSettings()
      return saveJDConfig(appKey, appSecret)
    }
    
    return { success: true, message: '京东API配置已保存' }
  } catch (error) {
    console.error('保存京东API配置时出错:', error)
    return { success: false, error: error.message }
  }
}

// 保存管理员配置
async function saveAdminConfig(adminUsername, adminPassword) {
  try {
    const settingsCollection = db.collection('admin_settings')
    const settings = await settingsCollection.limit(1).get()
    
    const updateData = {
      adminUsername,
      updatedAt: Date.now()
    }
    
    // 如果提供了新密码，则更新密码哈希
    if (adminPassword) {
      updateData.passwordHash = hashPassword(adminPassword)
    }
    
    if (settings.data.length > 0) {
      await settingsCollection.doc(settings.data[0]._id).update({
        data: updateData
      })
    } else {
      await ensureSettings()
      return saveAdminConfig(adminUsername, adminPassword)
    }
    
    return { success: true, message: '管理员配置已保存' }
  } catch (error) {
    console.error('保存管理员配置时出错:', error)
    return { success: false, error: error.message }
  }
}

// 更新所有组件价格
async function updateComponentPrices() {
  try {
    // 调用价格更新云函数
    const result = await cloud.callFunction({
      name: 'updateComponentsPrice'
    })
    
    return result.result
  } catch (error) {
    console.error('更新组件价格时出错:', error)
    return { 
      success: false, 
      error: '价格更新失败: ' + (error.message || '未知错误'),
      detail: error 
    }
  }
}

// 处理HTTP请求
async function processRequest(event) {
  // 初始化响应头
  const headers = {
    'Content-Type': 'text/html; charset=utf-8'
  }
  
  try {
    // 确保系统设置存在
    await ensureSettings()
    
    // 解析请求信息
    const url = event.path || ''
    const method = event.httpMethod || 'GET'
    const query = parseQuery(url)
    const action = query.action || ''
    const cookies = parseCookies(event.headers['cookie'] || '')
    const contentType = event.headers['content-type'] || ''
    const body = parseBody(event.body, contentType)
    
    // 检查用户认证状态
    const isAuthenticated = await authenticate(cookies)
    
    // 处理登录请求
    if (action === 'login' && method === 'POST') {
      const { username, password } = body
      const settingsCollection = db.collection('admin_settings')
      const settings = await settingsCollection.limit(1).get()
      
      if (settings.data.length > 0) {
        const adminSettings = settings.data[0]
        
        if (
          username === adminSettings.adminUsername && 
          hashPassword(password) === adminSettings.passwordHash
        ) {
          // 生成新token
          const token = crypto.randomBytes(32).toString('hex')
          const tokenExpiry = Date.now() + 24 * 60 * 60 * 1000 // 24小时后过期
          
          // 保存token到数据库
          await settingsCollection.doc(adminSettings._id).update({
            data: {
              token,
              tokenExpiry
            }
          })
          
          // 设置cookie
          headers['Set-Cookie'] = `adminToken=${token}; HttpOnly; Path=/; Max-Age=86400`
          
          // 重定向到管理页面
          headers['Location'] = '?'
          return {
            statusCode: 302,
            headers,
            body: '登录成功，正在跳转...'
          }
        }
      }
      
      // 登录失败
      return {
        statusCode: 200,
        headers,
        body: templates.loginTemplate.replace('{errorMessage}', '用户名或密码错误')
      }
    }
    
    // 处理登出请求
    if (action === 'logout') {
      // 清除cookie
      headers['Set-Cookie'] = 'adminToken=; HttpOnly; Path=/; Max-Age=0'
      
      // 重定向到登录页
      headers['Location'] = '?'
      return {
        statusCode: 302,
        headers,
        body: '已登出，正在跳转...'
      }
    }
    
    // 如果未认证且不是登录请求，显示登录页面
    if (!isAuthenticated) {
      return {
        statusCode: 200,
        headers,
        body: templates.loginTemplate.replace('{errorMessage}', '')
      }
    }
    
    // 处理API请求
    if (action) {
      // JSON响应的请求
      headers['Content-Type'] = 'application/json; charset=utf-8'
      
      switch (action) {
        case 'import':
          if (method === 'POST') {
            const { componentType, jsonData } = body
            if (!componentType || !jsonData) {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '缺少必要参数' })
              }
            }
            
            const result = await importComponents(componentType, jsonData)
            return {
              statusCode: result.success ? 200 : 400,
              headers,
              body: JSON.stringify(result)
            }
          }
          break
          
        case 'getComponents':
          if (method === 'GET') {
            const type = query.type || ''
            const result = await getComponents(type)
            return {
              statusCode: result.success ? 200 : 400,
              headers,
              body: JSON.stringify(result)
            }
          }
          break
          
        case 'deleteComponent':
          if (method === 'GET') {
            const id = query.id || ''
            const result = await deleteComponent(id)
            return {
              statusCode: result.success ? 200 : 400,
              headers,
              body: JSON.stringify(result)
            }
          }
          break
          
        case 'saveJDConfig':
          if (method === 'POST') {
            const { appKey, appSecret } = body
            if (!appKey || !appSecret) {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '缺少必要参数' })
              }
            }
            
            const result = await saveJDConfig(appKey, appSecret)
            return {
              statusCode: result.success ? 200 : 400,
              headers,
              body: JSON.stringify(result)
            }
          }
          break
          
        case 'saveAdminConfig':
          if (method === 'POST') {
            const { adminUsername, adminPassword } = body
            if (!adminUsername) {
              return {
                statusCode: 400,
                headers,
                body: JSON.stringify({ success: false, error: '用户名不能为空' })
              }
            }
            
            const result = await saveAdminConfig(adminUsername, adminPassword)
            return {
              statusCode: result.success ? 200 : 400,
              headers,
              body: JSON.stringify(result)
            }
          }
          break
          
        case 'updatePrices':
          if (method === 'GET') {
            const result = await updateComponentPrices()
            return {
              statusCode: result.success ? 200 : 400,
              headers,
              body: JSON.stringify(result)
            }
          }
          break
      }
    }
    
    // 获取系统设置
    const settingsCollection = db.collection('admin_settings')
    const settings = await settingsCollection.limit(1).get()
    const adminSettings = settings.data[0] || {}
    
    // 渲染管理页面
    let adminPage = templates.adminTemplate
    
    // 替换JD API设置
    adminPage = adminPage.replace('{appKey}', adminSettings.appKey || '')
    adminPage = adminPage.replace('{appSecret}', adminSettings.appSecret || '')
    adminPage = adminPage.replace('{jdMessage}', '')
    adminPage = adminPage.replace('{jdMessageClass}', '')
    
    // 替换管理员账号设置
    adminPage = adminPage.replace('{adminUsername}', adminSettings.adminUsername || '')
    adminPage = adminPage.replace('{adminMessage}', '')
    adminPage = adminPage.replace('{adminMessageClass}', '')
    
    // 替换导入信息
    adminPage = adminPage.replace('{importMessage}', '')
    adminPage = adminPage.replace('{messageClass}', '')
    
    // 替换组件列表
    adminPage = adminPage.replace('{componentsRows}', '')
    
    return {
      statusCode: 200,
      headers,
      body: adminPage
    }
  } catch (error) {
    console.error('处理HTTP请求时出错:', error)
    
    return {
      statusCode: 500,
      headers: {
        'Content-Type': 'text/plain; charset=utf-8'
      },
      body: `服务器内部错误: ${error.message}`
    }
  }
}

// 云函数入口
exports.main = async (event, context) => {
  // 处理HTTP请求
  if (event.httpMethod) {
    return await processRequest(event)
  }
  
  // 非HTTP请求（直接调用云函数）
  if (event.action === 'getHttpUrl') {
    // 获取当前环境ID
    const envId = cloud.DYNAMIC_CURRENT_ENV || context.environment
    // 构建HTTP触发器URL
    const url = `https://${envId}.service.tcloudbase.com/adminApi`
    return {
      url: url,
      success: true
    }
  }
  
  return {
    message: '此云函数只接受HTTP请求或指定的action'
  }
} 