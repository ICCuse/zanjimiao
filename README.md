# 微信小程序电脑配置助手开发文档

## 项目概述
这是一个微信小程序项目，用于帮助用户配置电脑硬件。用户可以根据预算和用途选择不同的硬件组件，系统会显示兼容的组件并计算总价格。

## 数据结构说明
项目使用微信云开发，主要集合包括：
- `cpu_data`: CPU数据
- `motherboard_data`: 主板数据
- `memory_data`: 内存数据
- `gpu_data`: 显卡数据
- `disk_data`: 硬盘数据
- `power_data`: 电源数据
- `case_data`: 机箱数据
- `cooler_data`: 散热器数据
- `user_configs`: 用户保存的配置

### 数据库集合字段详情

#### CPU数据集合 (cpu_data)
```
{
  _id: "云数据库自动生成ID",
  名称: "10代酷睿i5-10400（盒装）",
  品牌: "intel",
  价格: 720,
  接口: "LGA1200",
  核心: "4核8线",
  频率: 3.3,
  功率: "65W"
}
```

#### 主板数据集合 (motherboard_data)
```
{
  _id: "云数据库自动生成ID",
  名称: "ROG MAXIMUS Z690 EXTREME",
  品牌: "华硕",
  价格: 8749,
  接口: "LGA1851",
  芯片组: "Z890",
  内存插槽: "4*D5",
  M2接口: 6,
  SATA: 4,
  尺寸(CM): "E-ATX (30.5*27.7cm)"
}
```

#### 内存数据集合 (memory_data)
```
{
  _id: "云数据库自动生成ID",
  名称: "普条",
  品牌: "三星(SAMSUNG)",
  价格: 140,
  容量: "8G",
  接口类型: "D4",
  主频: ""
}
```

#### 显卡数据集合 (gpu_data)
```
{
  _id: "云数据库自动生成ID",
  名称: "TUF-RTX5090D-032G-GAMING",
  品牌: "华硕",
  价格: 29349,
  显存容量: "32GB GDDR7",
  Boost频率: "2550MHz",
  功耗: "485W",
  尺寸: "348.2*160*72.6 mm",
  系列: "RTX5090",
  位宽: "512bit"
}
```

#### 存储设备数据集合 (disk_data)
```
{
  _id: "云数据库自动生成ID",
  型号: "MZ-77E256B",
  品牌: "三星(SAMSUNG)",
  价格: 235,
  容量: "256G",
  接口: "M.2",
  系列: "870 EVO",
  速率(读/写)MB/S: ""
}
```

#### 电源数据集合 (power_data)
```
{
  _id: "云数据库自动生成ID",
  名称: "巨龙GM-EPS2600DA",
  品牌: "长城",
  价格: 1799,
  功率: "2600W",
  系列: "服务器 CQC三级能效认证",
  能认证: "80Plus金牌组"
}
```

#### 机箱数据集合 (case_data)
```
{
  _id: "云数据库自动生成ID",
  名称: "枫叶S3 白色",
  品牌: "长城机箱",
  价格: 159,
  产品尺寸mm: "435*218*456",
  CPU散热器限高mm: "168mm",
  显卡限长mm: "410mm",
  硬盘仓数量: 3,
  系列: "枫叶",
  风扇位: 10
}
```

#### 散热器数据集合 (cooler_data)
```
{
  _id: "云数据库自动生成ID",
  名称: "终极幽灵HV360 ARGB",
  品牌: "利民(ThermalRight)",
  价格: 710,
  尺寸: "403*120*27mm",
  平台兼容: "Intel LGA1851/1700/1200/115X/2011/2066 AMD AM5/AM4",
  散热形式: "水冷",
  功耗推荐: "250W"
}
```

#### 用户配置数据集合 (user_configs)
```
{
  _id: "云数据库自动生成ID",
  id: "config_1622548796123",
  name: "我的游戏主机配置",
  components: {
    cpu: {...CPU数据对象},
    motherboard: {...主板数据对象},
    ram: {...内存数据对象},
    gpu: {...显卡数据对象},
    storage: {...存储数据对象},
    psu: {...电源数据对象},
    case: {...机箱数据对象},
    cooling: {...散热器数据对象}
  },
  totalPrice: 12345,
  createTime: "2023-06-01T12:34:56.789Z",
  userId: "oM5jK5XDx6AaBbCcDdEeFf"
}
```

## 品牌处理框架

### 主要问题
项目中存在品牌处理不一致的问题：
1. 不同组件类型使用不同的字段名（有的用"品牌"，有的用"brand"）
2. 品牌名称格式不统一（有的带括号，如"三星(SAMSUNG)"）
3. 某些组件没有明确的品牌字段，需要从名称中提取

### 解决方案
已实现一个模块化的品牌处理框架 `componentBrandUtils`，包含以下功能：

1. **组件品牌处理框架**：
   - 为每种组件类型（CPU、主板、内存、显卡、存储、电源、机箱、散热器）创建专门的处理模块
   - 每个模块包含两个核心函数：
     - `extractBrand`: 提取并标准化品牌信息
     - `matchBrand`: 匹配品牌（用于筛选）

2. **组件特定处理**：
   - CPU：处理"Intel"、"AMD"等特殊品牌，从名称字段中识别
   - 主板：使用英文"brand"字段，同时处理常见品牌如华硕、微星等
   - 内存和其他组件：处理带括号的品牌名，处理从名称中提取品牌的逻辑

3. **品牌选项生成**：
   - 使用专门的提取器获取品牌
   - 统计并去重品牌名
   - 避免重复添加"全部"选项

## 代码结构
主要功能在 `pages/config/config.js` 中实现：

1. **数据加载**：
   - `loadComponentData()`: 从云数据库加载组件数据
   - `formatComponentData()`: 格式化组件数据，确保字段名一致

2. **筛选逻辑**：
   - `filterComponents()`: 按品牌和价格筛选组件
   - `generateBrandOptions()`: 动态生成品牌选项
   - 组件类型切换、品牌筛选和价格筛选

3. **配置管理**：
   - `selectComponent()`: 选择组件
   - `calculateTotalPrice()`: 计算总价
   - `generateFinalConfig()`: 生成最终配置
   - `saveConfig()`: 保存配置到云数据库

## 开发注意事项

1. **微信小程序开发规范**:
   - 使用.wxml而非.html，使用.wxss而非.css
   - 只使用微信小程序提供的组件（如view、text，不使用div、span等）
   - 页面必须包含.js、.json、.wxml和.wxss四个文件

2. **数据绑定与事件处理**:
   - 使用{{变量名}}进行数据绑定，不使用其他框架的绑定语法
   - 事件绑定使用bind前缀（如bindtap="函数名"）或catch前缀
   - 不使用onclick等传统DOM事件

3. **API规范**:
   - 只使用微信官方API
   - 网络请求：仅使用wx.request，不使用fetch或axios
   - 存储：仅使用wx.setStorageSync/wx.getStorageSync，不使用localStorage
   - 导航：仅使用wx.navigateTo、wx.redirectTo、wx.switchTab等

4. **云开发特有API**:
   - 初始化：wx.cloud.init()
   - 数据库操作：wx.cloud.database()，collection.get()，collection.where()等
   - 云函数调用：wx.cloud.callFunction()
   - 云存储：wx.cloud.uploadFile()，wx.cloud.downloadFile()

5. **重要配置信息**:
   - 云环境ID: `pcconfig-7grn6s1naf2b91d9`
   - 确保所有云函数使用相同的环境ID

## 待优化项目

1. **品牌处理**:
   - 进一步优化各组件的品牌提取逻辑
   - 考虑添加更多品牌别名匹配

2. **组件兼容性**:
   - 增强组件兼容性检查
   - 优化组件匹配算法

3. **用户体验**:
   - 改进组件选择界面
   - 添加配置推荐功能
   - 优化加载速度和错误处理

## 关键代码模式
遵循微信小程序代码规范，使用符合微信小程序的模式处理品牌：

```javascript
// 提取品牌示例（以CPU为例）
extractBrand: function(cpuItem) {
  // 首先尝试使用品牌字段
  let brand = cpuItem.品牌 || '';
  
  // 如果品牌为空，尝试从名称中提取
  if (!brand && cpuItem.名称) {
    if (cpuItem.名称.includes('英特尔') || cpuItem.名称.includes('Intel')) {
      brand = '英特尔';
    } else if (cpuItem.名称.includes('AMD') || cpuItem.名称.includes('锐龙')) {
      brand = 'AMD';
    }
  }
  
  return brand;
}

// 品牌匹配示例
matchBrand: function(cpuItem, targetBrand) {
  // 如果目标是"全部"，匹配所有
  if (targetBrand === '全部' || targetBrand === 'all') return true;
  
  // 提取当前CPU的品牌
  const itemBrand = this.extractBrand(cpuItem);
  
  // 直接比较（不区分大小写）
  return itemBrand.toLowerCase() === targetBrand.toLowerCase();
}
``` 