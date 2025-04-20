// 登录页模板
const loginTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>电脑配置助手管理后台</title>
  <style>
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background-color: #f5f7fa;
      margin: 0;
      padding: 0;
      display: flex;
      justify-content: center;
      align-items: center;
      height: 100vh;
    }
    .login-container {
      background-color: white;
      padding: 30px;
      border-radius: 10px;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.1);
      width: 320px;
    }
    h1 {
      color: #07c160;
      text-align: center;
      margin-bottom: 30px;
      font-size: 24px;
    }
    .form-group {
      margin-bottom: 20px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-size: 14px;
    }
    input {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      box-sizing: border-box;
      font-size: 14px;
    }
    button {
      background-color: #07c160;
      color: white;
      border: none;
      padding: 12px;
      width: 100%;
      border-radius: 6px;
      cursor: pointer;
      font-size: 16px;
      transition: background-color 0.3s;
    }
    button:hover {
      background-color: #06ad56;
    }
    .error {
      color: #e64340;
      text-align: center;
      margin-top: 10px;
      font-size: 14px;
    }
  </style>
</head>
<body>
  <div class="login-container">
    <h1>电脑配置助手管理后台</h1>
    <form id="login-form" method="post" action="?action=login">
      <div class="form-group">
        <label for="username">用户名</label>
        <input type="text" id="username" name="username" required>
      </div>
      <div class="form-group">
        <label for="password">密码</label>
        <input type="password" id="password" name="password" required>
      </div>
      <button type="submit">登录</button>
      <div id="error-message" class="error">{errorMessage}</div>
    </form>
  </div>
</body>
</html>
`;

// 管理界面模板
const adminTemplate = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>电脑配置助手管理后台</title>
  <style>
    body {
      font-family: 'PingFang SC', 'Microsoft YaHei', sans-serif;
      background-color: #f5f7fa;
      margin: 0;
      padding: 0;
    }
    .container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 20px;
    }
    header {
      background-color: white;
      padding: 15px 20px;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      margin-bottom: 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
    }
    h1 {
      color: #07c160;
      margin: 0;
      font-size: 20px;
    }
    .logout {
      color: #e64340;
      text-decoration: none;
      font-size: 14px;
    }
    .panel {
      background-color: white;
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
      padding: 20px;
      margin-bottom: 20px;
    }
    h2 {
      color: #333;
      margin-top: 0;
      margin-bottom: 15px;
      font-size: 18px;
      border-bottom: 1px solid #eee;
      padding-bottom: 10px;
    }
    label {
      display: block;
      margin-bottom: 8px;
      color: #333;
      font-size: 14px;
    }
    select, textarea, input[type="text"] {
      width: 100%;
      padding: 10px;
      border: 1px solid #ddd;
      border-radius: 6px;
      margin-bottom: 15px;
      box-sizing: border-box;
      font-size: 14px;
    }
    textarea {
      height: 200px;
      font-family: monospace;
    }
    button {
      background-color: #07c160;
      color: white;
      border: none;
      padding: 10px 15px;
      border-radius: 6px;
      cursor: pointer;
      font-size: 14px;
      transition: background-color 0.3s;
    }
    button:hover {
      background-color: #06ad56;
    }
    .message {
      padding: 10px;
      border-radius: 6px;
      margin-top: 15px;
      font-size: 14px;
    }
    .success {
      background-color: #f0f9eb;
      color: #67c23a;
      border: 1px solid #e1f3d8;
    }
    .error {
      background-color: #fef0f0;
      color: #f56c6c;
      border: 1px solid #fde2e2;
    }
    .tab-nav {
      display: flex;
      margin-bottom: 20px;
      background-color: white;
      border-radius: 8px;
      overflow: hidden;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.1);
    }
    .tab {
      padding: 12px 20px;
      cursor: pointer;
      flex: 1;
      text-align: center;
      transition: all 0.3s;
      font-size: 14px;
    }
    .tab.active {
      background-color: #07c160;
      color: white;
    }
    .tab-content {
      display: none;
    }
    .tab-content.active {
      display: block;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 15px;
    }
    th, td {
      padding: 10px;
      text-align: left;
      border-bottom: 1px solid #eee;
      font-size: 14px;
    }
    th {
      background-color: #f5f7fa;
      font-weight: bold;
    }
    .action-btn {
      background-color: #409eff;
      color: white;
      border: none;
      padding: 6px 10px;
      border-radius: 4px;
      cursor: pointer;
      font-size: 12px;
      margin-right: 5px;
    }
    .delete-btn {
      background-color: #f56c6c;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>电脑配置助手管理后台</h1>
      <a href="?action=logout" class="logout">退出登录</a>
    </header>
    
    <div class="tab-nav">
      <div class="tab active" data-tab="import">数据导入</div>
      <div class="tab" data-tab="components">组件管理</div>
      <div class="tab" data-tab="jd">京东API</div>
      <div class="tab" data-tab="settings">系统设置</div>
    </div>
    
    <div id="import" class="tab-content active panel">
      <h2>批量导入组件数据</h2>
      <form id="import-form" method="post" action="?action=import">
        <label for="component-type">组件类型</label>
        <select id="component-type" name="componentType" required>
          <option value="">请选择组件类型</option>
          <option value="cpu">CPU</option>
          <option value="gpu">显卡</option>
          <option value="ram">内存</option>
          <option value="storage">存储</option>
          <option value="motherboard">主板</option>
          <option value="case">机箱</option>
          <option value="cooling">散热器</option>
          <option value="psu">电源</option>
        </select>
        
        <label for="json-data">JSON数据 (数组格式)</label>
        <textarea id="json-data" name="jsonData" placeholder='[
  {
    "name": "组件名称",
    "brand": "品牌",
    "price": 1000,
    ...
  }
]' required></textarea>
        
        <button type="submit">导入数据</button>
        
        <div id="import-message" class="message {messageClass}">{importMessage}</div>
      </form>
    </div>
    
    <div id="components" class="tab-content panel">
      <h2>组件列表</h2>
      <select id="component-type-filter">
        <option value="">全部组件</option>
        <option value="cpu">CPU</option>
        <option value="gpu">显卡</option>
        <option value="ram">内存</option>
        <option value="storage">存储</option>
        <option value="motherboard">主板</option>
        <option value="case">机箱</option>
        <option value="cooling">散热器</option>
        <option value="psu">电源</option>
      </select>
      <div id="components-list">
        <table>
          <thead>
            <tr>
              <th>名称</th>
              <th>品牌</th>
              <th>价格</th>
              <th>操作</th>
            </tr>
          </thead>
          <tbody>
            {componentsRows}
          </tbody>
        </table>
      </div>
    </div>
    
    <div id="jd" class="tab-content panel">
      <h2>京东API设置</h2>
      <form id="jd-form" method="post" action="?action=saveJDConfig">
        <label for="app-key">AppKey</label>
        <input type="text" id="app-key" name="appKey" value="{appKey}" required>
        
        <label for="app-secret">AppSecret</label>
        <input type="text" id="app-secret" name="appSecret" value="{appSecret}" required>
        
        <button type="submit">保存设置</button>
        
        <div id="jd-message" class="message {jdMessageClass}">{jdMessage}</div>
      </form>
      
      <h2>价格更新</h2>
      <button id="update-prices">更新所有组件价格</button>
      <div id="update-message"></div>
    </div>
    
    <div id="settings" class="tab-content panel">
      <h2>管理员账号设置</h2>
      <form id="admin-form" method="post" action="?action=saveAdminConfig">
        <label for="admin-username">用户名</label>
        <input type="text" id="admin-username" name="adminUsername" value="{adminUsername}" required>
        
        <label for="admin-password">密码</label>
        <input type="password" id="admin-password" name="adminPassword" placeholder="不修改请留空">
        
        <button type="submit">更新账号</button>
        
        <div id="admin-message" class="message {adminMessageClass}">{adminMessage}</div>
      </form>
    </div>
  </div>
  
  <script>
    // 标签页切换
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => {
        // 移除所有active类
        document.querySelectorAll('.tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
        
        // 添加active类到当前标签和内容
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab).classList.add('active');
      });
    });
    
    // 组件筛选
    document.getElementById('component-type-filter').addEventListener('change', function() {
      fetch('?action=getComponents&type=' + this.value)
        .then(response => response.json())
        .then(data => {
          if (data.success) {
            let html = '';
            data.components.forEach(comp => {
              html += '<tr>' +
                '<td>' + comp.name + '</td>' +
                '<td>' + comp.brand + '</td>' +
                '<td>¥' + comp.price + '</td>' +
                '<td>' +
                  '<button class="action-btn" onclick="editComponent(\'' + comp._id + '\')">编辑</button>' +
                  '<button class="action-btn delete-btn" onclick="deleteComponent(\'' + comp._id + '\')">删除</button>' +
                '</td>' +
              '</tr>';
            });
            document.querySelector('#components-list tbody').innerHTML = html;
          }
        });
    });
    
    // 更新价格
    document.getElementById('update-prices').addEventListener('click', function() {
      this.disabled = true;
      this.innerText = '更新中...';
      const messageEl = document.getElementById('update-message');
      messageEl.className = 'message';
      messageEl.innerText = '正在更新价格，这可能需要几分钟时间...';
      
      fetch('?action=updatePrices')
        .then(response => response.json())
        .then(data => {
          this.disabled = false;
          this.innerText = '更新所有组件价格';
          
          if (data.success) {
            messageEl.className = 'message success';
            messageEl.innerText = '成功更新了 ' + data.updatedCount + ' 个组件的价格！';
          } else {
            messageEl.className = 'message error';
            messageEl.innerText = '更新失败: ' + data.error;
          }
        });
    });
    
    function editComponent(id) {
      // 实现编辑功能
      alert('编辑功能待实现');
    }
    
    function deleteComponent(id) {
      if (confirm('确定要删除这个组件吗？此操作无法撤销。')) {
        fetch('?action=deleteComponent&id=' + id)
          .then(response => response.json())
          .then(data => {
            if (data.success) {
              document.getElementById('component-type-filter').dispatchEvent(new Event('change'));
            } else {
              alert('删除失败: ' + data.error);
            }
          });
      }
    }
  </script>
</body>
</html>
`;

module.exports = {
  loginTemplate,
  adminTemplate
}; 