// pages/config/config.js
const app = getApp()
// 删除本地数据引用

// 顶部添加compatibility.js的引用
const compatibility = require('../../utils/compatibility.js');

// 添加调试日志函数
const debugLog = function(...args) {
  if (app && app.getDebugMode && app.getDebugMode('compatibilityLog')) {
    console.log(...args);
  }
};

// 添加散热组件筛选专用的日志函数
const coolingLog = function(...args) {
  if (app && app.getDebugMode && app.getDebugMode('coolingDebug')) {
    console.log('[散热组件]', ...args);
  }
};

Page({
  data: {
    // 步骤和选项数据
    steps: ['选择用途', '选择组件', '查看结果'],
    currentStep: 0,
    userPurpose: '', // 用户选择的用途：gaming, work, office, customize
    budget: 'medium', // 预算：low, medium, high, unlimited
    
    // 添加分享相关数据
    showShareModal: false, // 控制分享弹窗显示
    configId: '', // 配置的唯一ID
    
    // 组件相关数据
    currentComponent: 'cpu', // 当前查看的组件类型
    currentBrand: 'all',    // 当前筛选的品牌
    currentPrice: 'all',    // 当前筛选的价格范围
    currentPriceSort: 'asc', // 当前的价格排序方式: asc(升序), desc(降序)
    currentCoolingType: 'all', // 当前散热类型筛选: all(全部), 风冷, 水冷, 机箱风扇
    
    components: {},         // 所有组件数据
    filteredComponents: [], // 筛选后的组件
    allFilteredComponents: [], // 存储完整的筛选结果
    displayedCount: 20,     // 一次显示的数量
    hasMoreComponents: false, // 是否还有更多组件可显示
    
    // 兼容性过滤开关
    onlyShowCompatible: true, // 默认开启兼容性过滤
    
    // 品牌折叠相关
    brandFolded: true,      // 默认品牌列表折叠
    showAllBrands: false,   // 是否显示所有品牌
    initialBrandsCount: 3,  // 默认显示品牌数量，根据界面宽度调整
    
    // 组件类型映射到数据库集合名
    componentCollections: {
      cpu: 'cpu_data',
      motherboard: 'motherboard_data',
      ram: 'memory_data',
      gpu: 'gpu_data',
      storage: 'disk_data',
      psu: 'power_data',
      case: 'case_data',
      cooling: 'cooler_data',
      caseFan: 'cooler_data',      // 新增:机箱散热，共用散热器集合
      // monitor没有对应集合，需要处理这种情况
      monitor: 'monitor_data'
    },
    
    // 动态生成的品牌选项
    brandOptions: {},
    
    // 标准化的品牌名称映射（英文到中文）
    brandNameMap: {
      'intel': '英特尔',
      'amd': 'AMD',
      'asus': '华硕',
      'gigabyte': '技嘉',
      'msi': '微星'
      // 可以根据需要添加更多
    },
    
    // 价格选项
    priceOptions: [
      { value: 'all', label: '所有价格' },
      { value: 'low', label: '低价位' },
      { value: 'mid', label: '中价位' },
      { value: 'high', label: '高价位' },
      { value: 'premium', label: '高端' }
    ],
    
    // 已选组件和总价
    selectedItems: {},
    totalPrice: 0,
    configName: '',
    finalConfig: null,
    
    // 其他设置
    autoSwitchToNext: true, // 选择组件后自动切换到下一个组件
    showDebugInfo: false,   // 是否显示调试信息
    
    /**
     * 组件品牌处理框架 - 为每种组件提供专门的品牌提取和匹配函数
     */
    componentBrandUtils: {
      common: {
        // 通用品牌提取函数
        extractBrand: function(item, type) {
          debugLog(`通用提取品牌 (${type}):`, item);
          // 根据组件类型选择不同的字段
          if (type === 'motherboard') {
            return item.brand || '';
      } else {
            // 先尝试获取品牌字段，如果不存在，尝试从名称中提取
            let brand = item.品牌 || item.brand || '';
            
            // 如果没有品牌字段，尝试从名称中提取
            if (!brand && (item.名称 || item.name)) {
              const name = item.名称 || item.name || '';
              // 提取名称中的第一个单词或字符作为品牌
              brand = name.split(' ')[0];
            }
            
            return brand;
          }
        },
        
        // 通用品牌匹配函数
        matchBrand: function(item, targetBrand) {
          if (targetBrand === 'all') return true;
          if (!item) return false;
          
          try {
            // 获取项目的品牌
            const itemBrand = this.extractBrand(item);
            debugLog(`通用品牌匹配: 项目=${JSON.stringify(item)}, 提取品牌=${itemBrand}, 目标品牌=${targetBrand}`);
            
            // 如果品牌为空，返回false
            if (!itemBrand) return false;
            
            // 转换为小写进行比较
            return itemBrand.toLowerCase().includes(targetBrand.toLowerCase());
          } catch (err) {
            console.error('通用品牌匹配出错:', err);
            return false;
          }
        }
      },
      
      cpu: {
        // CPU特定的品牌提取
        extractBrand: function(item) {
          debugLog(`CPU提取品牌, 原始项目:`, item);
          
          // 尝试多种可能的字段名
          let brand = item.品牌 || item.brand || '';
          
          // 调试日志
          debugLog(`CPU初始品牌提取: ${brand}`);
          
          // 处理拼写错误的品牌 - 特别是"inter"应该是"intel"
          if (brand.toLowerCase() === 'inter') {
            brand = 'intel';
            debugLog(`修正品牌拼写: inter -> intel`);
          }
          
          // 如果没有品牌字段，尝试从名称中提取
          if ((!brand || brand.trim() === '') && (item.名称 || item.name)) {
            const name = (item.名称 || item.name || '').toLowerCase();
            debugLog(`CPU名称: ${name}`);
            
            // AMD特殊关键词识别增强
            if (name.includes('intel') || name.includes('酷睿') || 
                name.includes('奔腾') || name.includes('赛扬') ||
                name.includes('inter')) { // 处理拼写错误
              brand = 'intel';
            } else if (name.includes('amd') || name.includes('锐龙') || 
                      name.includes('ryzen') || 
                      // 增强对AMD处理器的识别 - 识别常见型号
                      /\br\d\b/i.test(name) || // 匹配R3, R5, R7, R9等
                      name.includes('threadripper') ||
                      name.includes('athlon') ||
                      name.includes('fx-')) {
              brand = 'amd';
              debugLog(`通过增强规则识别到AMD处理器: ${item.名称 || item.name}`);
          } else {
              // 提取名称中的第一个单词作为品牌
              brand = name.split(' ')[0];
            }
          }
          
          // 标准化处理
          if (brand) {
            // 英特尔标准化 - 添加对拼写错误的处理
            if (brand.toLowerCase().includes('intel') || 
                brand.toLowerCase().includes('英特尔') ||
                brand.toLowerCase().includes('酷睿') || 
                brand.toLowerCase().includes('奔腾') || 
                brand.toLowerCase().includes('赛扬') ||
                brand.toLowerCase() === 'inter') {
              brand = 'intel';
            }
            // AMD标准化 - 增强检测
            else if (brand.toLowerCase().includes('amd') || 
                     brand.toLowerCase().includes('锐龙') || 
                     brand.toLowerCase().includes('ryzen') ||
                     brand.toLowerCase().includes('athlon') ||
                     brand.toLowerCase().includes('threadripper') ||
                     /\br\d\b/i.test(brand.toLowerCase())) {
              brand = 'AMD';
              debugLog(`标准化为AMD品牌: ${brand}, 原始值: ${item.品牌 || item.brand}`);
            }
          }
          
          debugLog(`CPU最终提取品牌: ${brand}`);
          return brand;
        },
        
        // CPU特定的品牌匹配
        matchBrand: function(item, targetBrand) {
          if (targetBrand === 'all') return true;
          if (!item) return false;
          
          try {
            // 获取CPU品牌和名称
            const cpuBrand = item.brand || '';
            const cpuName = item.name || '';
            
            debugLog(`[CPU匹配] 匹配项目: ${cpuName}, 品牌: ${cpuBrand}, 目标品牌: ${targetBrand}`);
            
            // 如果品牌为空，检查名称
            if (!cpuBrand && !cpuName) return false;
            
            // 转小写进行比较
            const lowerCpuBrand = cpuBrand.toLowerCase();
            const lowerCpuName = cpuName.toLowerCase();
            const lowerTargetBrand = targetBrand.toLowerCase();
            
            // AMD特殊处理
            if (lowerTargetBrand === 'amd' || lowerTargetBrand === '锐龙') {
              // 品牌字段中包含AMD
              if (lowerCpuBrand === 'amd' || lowerCpuBrand.includes('amd')) {
                debugLog(`[CPU匹配] 匹配成功-品牌字段: ${cpuName}`);
                return true;
              }
              
              // 名称中包含AMD或锐龙相关关键词
              if (lowerCpuName.includes('amd') || 
                  lowerCpuName.includes('ryzen') || 
                  lowerCpuName.includes('锐龙') ||
                  lowerCpuName.includes('threadripper') ||
                  lowerCpuName.includes('athlon') ||
                  /\br\d\b/i.test(lowerCpuName)) { // R3, R5, R7, R9等
                debugLog(`[CPU匹配] 匹配成功-名称关键词: ${cpuName}`);
                return true;
              }
              
              // 返回false表示不匹配AMD
              return false;
            }
            
            // 英特尔特殊处理
            if (lowerTargetBrand === 'intel' || lowerTargetBrand === '英特尔' || lowerTargetBrand === 'inter') {
              // 品牌字段匹配
              if (lowerCpuBrand === 'intel' || 
                  lowerCpuBrand === 'inter' || 
                  lowerCpuBrand.includes('intel') || 
                  lowerCpuBrand.includes('英特尔')) {
                return true;
              }
              
              // 名称匹配
              if (lowerCpuName.includes('intel') || 
                  lowerCpuName.includes('英特尔') ||
                  lowerCpuName.includes('酷睿') || 
                  lowerCpuName.includes('奔腾') || 
                  lowerCpuName.includes('赛扬')) {
                return true;
              }
              
              // 不匹配Intel
              return false;
            }
            
            // 其他品牌直接比较
            return lowerCpuBrand === lowerTargetBrand || 
                   lowerCpuBrand.includes(lowerTargetBrand) || 
                   lowerCpuName.includes(lowerTargetBrand);
          } catch (err) {
            console.error('[CPU匹配]错误:', err);
            return false;
          }
        }
      },
      
      // 主板品牌处理
      motherboard: {
        // 提取主板品牌
        extractBrand: function(mbItem) {
          // 主板使用英文brand字段
          let brand = mbItem.brand || '';
          
          // 如果品牌为空，尝试从名称中提取
          if (!brand && mbItem.name) {
            // 常见主板品牌关键词
            if (mbItem.name.includes('华硕') || 
                mbItem.name.includes('ASUS') || 
                mbItem.name.includes('ROG') ||
                mbItem.name.includes('TUF')) {
              brand = '华硕';
            } else if (mbItem.name.includes('微星') || 
                      mbItem.name.includes('MSI')) {
              brand = '微星';
            } else if (mbItem.name.includes('技嘉') || 
                      mbItem.name.includes('GIGABYTE') ||
                      mbItem.name.includes('AORUS')) {
              brand = '技嘉';
            } else if (mbItem.name.includes('华擎') || 
                      mbItem.name.includes('ASRock')) {
              brand = '华擎';
            }
          }
          
          debugLog(`提取主板品牌: ${brand}, 名称: ${mbItem.name || ''}`);
          return brand;
        },
        
        // 匹配主板品牌
        matchBrand: function(mbItem, targetBrand) {
          // 如果目标是"全部"，匹配所有
          if (targetBrand === '全部' || targetBrand === 'all') return true;
          
          // 提取当前主板的品牌
          const itemBrand = this.extractBrand(mbItem);
          
          // 直接比较
          return itemBrand === targetBrand;
        }
      },
      
      // 内存品牌处理
      ram: {
        // 提取内存品牌
        extractBrand: function(ramItem) {
          // 内存使用中文品牌字段
          let brand = ramItem.品牌 || '';
          
          // 如果品牌包含括号，只保留括号前的部分
          if (brand.includes('(')) {
            brand = brand.split('(')[0].trim();
          }
          
          // 如果品牌为空，尝试从名称中提取
          if (!brand && ramItem.名称) {
            if (ramItem.名称.includes('海盗船') || ramItem.名称.includes('Corsair')) {
              brand = '海盗船';
            } else if (ramItem.名称.includes('金士顿') || ramItem.名称.includes('Kingston')) {
              brand = '金士顿';
            } else if (ramItem.名称.includes('芝奇') || ramItem.名称.includes('G.Skill')) {
              brand = '芝奇';
            } else if (ramItem.名称.includes('英睿达') || ramItem.名称.includes('Crucial')) {
              brand = '英睿达';
            } else if (ramItem.名称.includes('三星') || ramItem.名称.includes('Samsung')) {
              brand = '三星';
            }
          }
          
          debugLog(`提取内存品牌: ${brand}, 名称: ${ramItem.名称 || ''}`);
          return brand;
        },
        
        // 匹配内存品牌
        matchBrand: function(ramItem, targetBrand) {
          // 如果目标是"全部"，匹配所有
          if (targetBrand === '全部' || targetBrand === 'all') return true;
          
          // 提取当前内存的品牌
          const itemBrand = this.extractBrand(ramItem);
          
          // 直接比较
          return itemBrand === targetBrand;
        }
      },
      
      // 显卡品牌处理
      gpu: {
        // 提取显卡品牌
        extractBrand: function(gpuItem) {
          // 显卡使用中文品牌字段
          let brand = gpuItem.品牌 || '';
          
          // 如果品牌包含括号，只保留括号前的部分
          if (brand.includes('(')) {
            brand = brand.split('(')[0].trim();
          }
          
          // 如果品牌为空，尝试从名称中提取
          if (!brand && gpuItem.名称) {
            if (gpuItem.名称.includes('华硕') || 
                gpuItem.名称.includes('ASUS') || 
                gpuItem.名称.includes('ROG') ||
                gpuItem.名称.includes('TUF')) {
              brand = '华硕';
            } else if (gpuItem.名称.includes('微星') || 
                      gpuItem.名称.includes('MSI')) {
              brand = '微星';
            } else if (gpuItem.名称.includes('技嘉') || 
                      gpuItem.名称.includes('GIGABYTE') ||
                      gpuItem.名称.includes('AORUS')) {
              brand = '技嘉';
            } else if (gpuItem.名称.includes('英伟达') || 
                      gpuItem.名称.includes('NVIDIA') ||
                      gpuItem.名称.includes('RTX') ||
                      gpuItem.名称.includes('GTX')) {
              brand = '英伟达';
            } else if (gpuItem.名称.includes('AMD') || 
                      gpuItem.名称.includes('Radeon') ||
                      gpuItem.名称.includes('RX')) {
              brand = 'AMD';
            }
          }
          
          debugLog(`提取显卡品牌: ${brand}, 名称: ${gpuItem.名称 || ''}`);
          return brand;
        },
        
        // 匹配显卡品牌
        matchBrand: function(gpuItem, targetBrand) {
          // 如果目标是"全部"，匹配所有
          if (targetBrand === '全部' || targetBrand === 'all') return true;
          
          // 提取当前显卡的品牌
          const itemBrand = this.extractBrand(gpuItem);
          
          // 直接比较
          return itemBrand === targetBrand;
        }
      },
      
      // 存储设备品牌处理
      storage: {
        // 提取存储品牌
        extractBrand: function(storageItem) {
          // 存储使用中文品牌字段
          let brand = storageItem.品牌 || '';
          
          // 如果品牌包含括号，只保留括号前的部分
          if (brand.includes('(')) {
            brand = brand.split('(')[0].trim();
          }
          
          // 如果品牌为空，尝试从名称中提取
          if (!brand && (storageItem.名称 || storageItem.型号)) {
            const name = storageItem.名称 || storageItem.型号 || '';
            if (name.includes('三星') || name.includes('Samsung')) {
              brand = '三星';
            } else if (name.includes('西部数据') || name.includes('Western Digital') || name.includes('WD')) {
              brand = '西数';
            } else if (name.includes('希捷') || name.includes('Seagate')) {
              brand = '希捷';
            } else if (name.includes('英特尔') || name.includes('Intel')) {
              brand = '英特尔';
            } else if (name.includes('金士顿') || name.includes('Kingston')) {
              brand = '金士顿';
            }
          }
          
          debugLog(`提取存储品牌: ${brand}, 名称: ${storageItem.型号 || storageItem.名称 || ''}`);
          return brand;
        },
        
        // 匹配存储品牌
        matchBrand: function(storageItem, targetBrand) {
          // 如果目标是"全部"，匹配所有
          if (targetBrand === '全部' || targetBrand === 'all') return true;
          
          // 提取当前存储的品牌
          const itemBrand = this.extractBrand(storageItem);
          
          // 直接比较
          return itemBrand === targetBrand;
        }
      },
      
      // 电源品牌处理
      psu: {
        // 提取电源品牌
        extractBrand: function(psuItem) {
          // 电源使用中文品牌字段
          let brand = psuItem.品牌 || '';
          
          // 如果品牌包含括号，只保留括号前的部分
          if (brand.includes('(')) {
            brand = brand.split('(')[0].trim();
          }
          
          // 如果品牌为空，尝试从名称中提取
          if (!brand && psuItem.名称) {
            if (psuItem.名称.includes('海盗船') || psuItem.名称.includes('Corsair')) {
              brand = '海盗船';
            } else if (psuItem.名称.includes('安钛克') || psuItem.名称.includes('Antec')) {
              brand = '安钛克';
            } else if (psuItem.名称.includes('振华') || psuItem.名称.includes('Super Flower')) {
              brand = '振华';
            } else if (psuItem.名称.includes('EVGA')) {
              brand = 'EVGA';
            } else if (psuItem.名称.includes('长城') || psuItem.名称.includes('Great Wall')) {
              brand = '长城';
            } else if (psuItem.名称.includes('技嘉') || psuItem.名称.includes('GIGABYTE')) {
              brand = '技嘉';
            }
          }
          
          debugLog(`提取电源品牌: ${brand}, 名称: ${psuItem.名称 || ''}`);
          return brand;
        },
        
        // 匹配电源品牌
        matchBrand: function(psuItem, targetBrand) {
          // 如果目标是"全部"，匹配所有
          if (targetBrand === '全部' || targetBrand === 'all') return true;
          
          // 提取当前电源的品牌
          const itemBrand = this.extractBrand(psuItem);
          
          // 直接比较
          return itemBrand === targetBrand;
        }
      },
      
      // 机箱品牌处理
      case: {
        // 提取机箱品牌
        extractBrand: function(caseItem) {
          // 机箱使用中文品牌字段
          let brand = caseItem.品牌 || '';
          
          // 如果品牌包含括号，只保留括号前的部分
          if (brand.includes('(')) {
            brand = brand.split('(')[0].trim();
          }
          
          // 如果品牌为空，尝试从名称中提取
          if (!brand && caseItem.名称) {
            if (caseItem.名称.includes('NZXT')) {
              brand = 'NZXT';
            } else if (caseItem.名称.includes('追风者') || caseItem.名称.includes('Phanteks')) {
              brand = '追风者';
            } else if (caseItem.名称.includes('安钛克') || caseItem.名称.includes('Antec')) {
              brand = '安钛克';
            } else if (caseItem.名称.includes('酷冷至尊') || caseItem.名称.includes('Cooler Master')) {
              brand = '酷冷至尊';
            } else if (caseItem.名称.includes('长城') || caseItem.名称.includes('Great Wall')) {
              brand = '长城';
            }
          }
          
          debugLog(`提取机箱品牌: ${brand}, 名称: ${caseItem.名称 || ''}`);
          return brand;
        },
        
        // 匹配机箱品牌
        matchBrand: function(caseItem, targetBrand) {
          // 如果目标是"全部"，匹配所有
          if (targetBrand === '全部' || targetBrand === 'all') return true;
          
          // 提取当前机箱的品牌
          const itemBrand = this.extractBrand(caseItem);
          
          // 直接比较
          return itemBrand === targetBrand;
        }
      },
      
      // 散热器品牌处理
      cooling: {
        // 提取散热器品牌
        extractBrand: function(coolingItem) {
          // 散热器使用中文品牌字段
          let brand = coolingItem.品牌 || '';
          
          // 如果品牌包含括号，只保留括号前的部分
          if (brand.includes('(')) {
            brand = brand.split('(')[0].trim();
          }
          
          // 如果品牌为空，尝试从名称中提取
          if (!brand && coolingItem.名称) {
            if (coolingItem.名称.includes('海盗船') || coolingItem.名称.includes('Corsair')) {
              brand = '海盗船';
            } else if (coolingItem.名称.includes('NZXT')) {
              brand = 'NZXT';
            } else if (coolingItem.名称.includes('酷冷至尊') || coolingItem.名称.includes('Cooler Master')) {
              brand = '酷冷至尊';
            } else if (coolingItem.名称.includes('九州风神') || coolingItem.名称.includes('DeepCool')) {
              brand = '九州风神';
            } else if (coolingItem.名称.includes('利民') || coolingItem.名称.includes('Thermalright')) {
              brand = '利民';
            }
          }
          
          debugLog(`提取散热器品牌: ${brand}, 名称: ${coolingItem.名称 || ''}`);
          return brand;
        },
        
        // 匹配散热器品牌
        matchBrand: function(coolingItem, targetBrand) {
          // 如果目标是"全部"，匹配所有
          if (targetBrand === '全部' || targetBrand === 'all') return true;
          
          // 提取当前散热器的品牌
          const itemBrand = this.extractBrand(coolingItem);
          
          // 直接比较
          return itemBrand === targetBrand;
        }
      }
    },
    
    // 搜索相关
    searchKeyword: '', // 搜索关键词
    searchPlaceholder: '搜索CPU', // 搜索框占位符，默认为CPU
    
    // 筛选相关
    currentBrand: 'all', // 当前筛选的品牌
    currentPrice: 'all', // 当前筛选的价格范围
    currentCoolingType: 'all', // 当前散热类型筛选
  },

  /**
   * 生命周期函数--监听页面加载
   */
  onLoad: function (options) {
    debugLog('[页面生命周期] 页面加载 onLoad');

    // 设置搜索框占位符
    this.setData({
      searchPlaceholder: this.getSearchPlaceholder('cpu')
    });
    
    // 初始化品牌选项
    this.ensureCpuBrands();
    
    // 如果有传入参数，初始化配置状态
    if (options && options.initialComponent) {
      debugLog('初始化为指定组件类型:', options.initialComponent);
      this.setData({
        currentComponent: options.initialComponent
      });
    }
    
    // 获取用户信息
    wx.getSetting({
      success: res => {
        if (res.authSetting['scope.userInfo']) {
          wx.getUserInfo({
            success: res => {
              this.setData({
                userInfo: res.userInfo,
                hasUserInfo: true
              });
            }
          });
        }
      }
    });
    
    // 初始化兼容性过滤状态
    this.setData({
      onlyShowCompatible: true
    });
    
    // 加载第一个组件类型数据
    this.loadComponentsByType(this.data.currentComponent);
  },

  /**
   * 页面显示时执行
   */
  onShow: function() {
    // 检查是否是从配置页返回
    const pages = getCurrentPages();
    const prevPage = pages.length > 1 ? pages[pages.length - 2] : null;
    if (prevPage && prevPage.route && (prevPage.route.includes('configPreview') || prevPage.route.includes('detail'))) {
      // 从预览页或详情页返回，不重新加载数据
      debugLog('[页面显示] 从预览页或详情页返回，不重新加载数据');
      
      // 如果当前没有配置数据，则强制重新加载
      if (!this.data.components || !this.data.filteredComponents || this.data.filteredComponents.length === 0) {
        debugLog('[页面显示] 当前无配置数据，强制重新加载');
        if (this.data.currentComponent) {
          this.loadComponentsByType(this.data.currentComponent);
        } else {
          this.loadComponentData();
        }
      }
    } else {
      // 检查全局数据中是否有从智能推荐传递过来的配置
      const app = getApp();
      if (app.globalData && app.globalData.selectedItems && Object.keys(app.globalData.selectedItems).length > 0) {
        debugLog('[页面显示] 发现智能推荐配置:', app.globalData.selectedItems);
        
        try {
          // 使用统一的数据标准化方法处理配置
          const standardizedComponents = this.standardizeComponents(app.globalData.selectedItems);
          
          // 设置推荐的组件和总价
          this.setData({
            selectedItems: standardizedComponents,
            configName: app.globalData.configName || '推荐配置'
          });
          
          // 重新计算总价格
          this.calculateTotalPrice();
          
          // 确保品牌选项初始化
          this.ensureAllBrandOptions();
          
          // 清除全局数据，防止重复加载
          app.globalData.selectedItems = {};
          
          // 提示用户
          wx.showToast({
            title: '已加载推荐配置',
            icon: 'success',
            duration: 1500
          });
          
          // 延迟初始化组件显示，确保数据加载完毕
          setTimeout(() => {
            this.initializeComponentDisplay();
          }, 200);
        } catch (error) {
          console.error('[页面显示] 加载推荐配置失败:', error);
          
          wx.showToast({
            title: '加载推荐配置失败',
            icon: 'none',
            duration: 2000
          });
        }
      } else {
        // 检查本地存储中是否有要编辑的配置
        const editConfig = wx.getStorageSync('edit_config');
        if (editConfig && Object.keys(editConfig).length > 0) {
          debugLog('[页面显示] 发现要编辑的配置:', editConfig);
          
          try {
            // 提取组件数据
            const componentsToEdit = editConfig.components || {};
            
            // 如果配置直接包含组件信息（旧格式）
            const componentTypes = ['cpu', 'motherboard', 'ram', 'memory', 'gpu', 'storage', 'ssd', 'hdd', 'psu', 'powerSupply', 'case', 'cooling', 'caseFan', 'monitor'];
            const extractedComponents = {};
            
            // 检查组件是否在components字段中或直接在配置中
            if (Object.keys(componentsToEdit).length > 0) {
              // 如果有components字段，使用它
              Object.keys(componentsToEdit).forEach(type => {
                if (componentsToEdit[type]) {
                  // 处理字段名称映射
                  const mappedType = this.mapComponentType(type);
                  extractedComponents[mappedType] = componentsToEdit[type];
                }
              });
            } else {
              // 如果没有components字段，检查直接在配置中的组件
              componentTypes.forEach(type => {
                if (editConfig[type]) {
                  // 处理字段名称映射
                  const mappedType = this.mapComponentType(type);
                  extractedComponents[mappedType] = editConfig[type];
                }
              });
            }
            
            // 使用统一的数据标准化方法处理配置
            const standardizedComponents = this.standardizeComponents(extractedComponents);
            
            // 设置要编辑的组件和配置名称
            this.setData({
              selectedItems: standardizedComponents,
              configName: editConfig.name || editConfig.title || '编辑的配置'
            });
            
            // 重新计算总价格
            this.calculateTotalPrice();
            
            // 确保品牌选项初始化
            this.ensureAllBrandOptions();
            
            // 清除本地存储，防止重复加载
            wx.removeStorageSync('edit_config');
            
            // 提示用户
            wx.showToast({
              title: '已加载编辑配置',
              icon: 'success',
              duration: 1500
            });
            
            // 延迟初始化组件显示，确保数据加载完毕
            setTimeout(() => {
              this.initializeComponentDisplay();
            }, 200);
          } catch (error) {
            console.error('[页面显示] 加载编辑配置失败:', error);
            
            wx.showToast({
              title: '加载编辑配置失败',
              icon: 'none',
              duration: 2000
            });
            
            // 清除本地存储，防止影响后续操作
            wx.removeStorageSync('edit_config');
          }
        }
      }
    }
  },

  /**
   * 标准化组件数据 - 确保所有组件数据格式一致
   * @param {Object} components 组件数据对象
   * @return {Object} 标准化后的组件数据对象
   */
  standardizeComponents: function(components) {
    debugLog('[数据处理] 开始标准化组件数据');
    const standardized = {};
    
    // 处理每种组件类型
    Object.keys(components).forEach(type => {
      const component = components[type];
      if (!component) return;
      
      // 基本信息标准化
      standardized[type] = {
        id: component.id || `${type}_${Date.now()}`,
        type: type,
        name: component.name || component['名称'] || '',
        price: component.price || component['价格'] || 0,
        brand: component.brand || component['品牌'] || '',
        // 确保specs是数组
        specs: Array.isArray(component.specs) ? [...component.specs] : [],
        // 复制其他所有字段
        ...component
      };
      
      // 确保关键字段存在
      if (!standardized[type].specsText && component.specs && component.specs.length > 0) {
        // 从specs中构建specsText
        const mainSpecs = component.specs.slice(0, 3).map(spec => spec.value).join(' ');
        standardized[type].specsText = mainSpecs;
      }
      
      // 特殊组件类型处理
      if (type === 'cpu') {
        standardized[type].socket = standardized[type].socket || standardized[type]['接口'] || 'LGA1700';
      } else if (type === 'motherboard') {
        standardized[type].socket = standardized[type].socket || standardized[type]['接口'] || 'LGA1700';
        // 如果CPU存在，确保接口兼容
        if (components.cpu) {
          standardized[type].socket = components.cpu.socket || components.cpu['接口'] || standardized[type].socket;
        }
      }
      
      debugLog(`[数据处理] 组件 ${type} 标准化完成:`, standardized[type]);
    });
    
    return standardized;
  },
  
  /**
   * 确保所有组件类型的品牌选项都初始化
   */
  ensureAllBrandOptions: function() {
    debugLog('[品牌初始化] 确保所有组件品牌选项');
    
    // 确保brandOptions初始化
    if (!this.data.brandOptions) {
      this.setData({
        brandOptions: {}
      });
    }
    
    const brandOptions = {...this.data.brandOptions};
    
    // 确保CPU品牌包含基本选项
    if (!brandOptions.cpu || !Array.isArray(brandOptions.cpu) || brandOptions.cpu.length < 2) {
      brandOptions.cpu = ['英特尔', 'AMD'];
      debugLog('[品牌初始化] 初始化CPU品牌选项');
    }
    
    // 确保其他组件类型也有基本品牌选项
    const defaultBrands = {
      motherboard: ['华硕', '微星', '技嘉', '华擎'],
      ram: ['英睿达', '海盗船', '金士顿', '芝奇'],
      gpu: ['英伟达', 'AMD', '华硕', '微星'],
      storage: ['三星', '西数', '希捷', '英特尔'],
      psu: ['海韵', '华硕', '微星', '酷冷至尊'],
      case: ['恩杰', '联力', '酷冷至尊', '安钛克'],
      cooling: ['九州风神', '华硕', '微星', '酷冷至尊']
    };
    
    // 为每种组件类型设置默认品牌选项（如果不存在）
    Object.keys(defaultBrands).forEach(type => {
      if (!brandOptions[type] || !Array.isArray(brandOptions[type]) || brandOptions[type].length === 0) {
        brandOptions[type] = defaultBrands[type];
        debugLog(`[品牌初始化] 初始化${type}品牌选项:`, brandOptions[type]);
      }
    });
    
    // 更新品牌选项
    this.setData({ brandOptions });
  },
  
  /**
   * 初始化组件显示 - 确保组件显示正确
   */
  initializeComponentDisplay: function() {
    debugLog('[组件显示] 初始化组件显示');
    
    // 确保当前组件类型有效
    const componentType = this.data.currentComponent || 'cpu';
    
    // 重新加载当前组件数据
    this.loadComponentsByType(componentType);
    
    // 确保品牌选项已初始化
    this.ensureAllBrandOptions();
    
    // 确保筛选条件重置
    this.setData({
      currentBrand: 'all',
      currentPrice: 'all',
      currentPriceSort: 'asc',
      currentCoolingType: 'all'
    });
    
    debugLog(`[组件显示] 初始化完成，当前组件类型: ${componentType}`);
  },

  /**
   * 确保CPU品牌选项包含基本的英特尔和AMD
   */
  ensureCpuBrands: function() {
    // 确保brandOptions初始化
    if (!this.data.brandOptions) {
    this.setData({
        brandOptions: {}
      });
    }
    
    // 确保CPU品牌选项包含基本的两个品牌，使用中文名称
    if (!this.data.brandOptions.cpu || !Array.isArray(this.data.brandOptions.cpu) || this.data.brandOptions.cpu.length < 2) {
      debugLog('初始化CPU品牌选项为默认值');
      
      // 使用setData创建或更新cpu品牌选项，使用中文名称
      const updatedBrandOptions = {...this.data.brandOptions};
      updatedBrandOptions.cpu = ['英特尔', 'AMD'];
      
    this.setData({
        brandOptions: updatedBrandOptions
    });
    }
  },

  /**
   * 加载组件数据 - 改为懒加载模式
   */
  loadComponentData: function(componentType) {
    // 如果没有传入组件类型，使用当前选择的组件类型
    componentType = componentType || this.data.currentComponent;
    
    debugLog(`[数据追踪] 加载组件数据: ${componentType}`);
    
    // 显示加载中提示
    wx.showLoading({
      title: '加载数据中',
      mask: true
    });
    
    // 设置加载超时保护
    const loadingTimeout = setTimeout(() => {
      // 如果30秒后仍在加载，强制关闭加载提示
      wx.hideLoading();
      wx.showToast({
        title: '加载超时，请重试',
        icon: 'none',
        duration: 2000
      });
    }, 30000); // 30秒超时
    
    // 初始化云环境
    wx.cloud.init({
      env: 'your-cloud-env-id',  // 使用正确的云环境ID
      traceUser: true
    });
    
    // 要获取品牌信息的组件类型
    const componentTypes = [
      'cpu', 'motherboard', 'ram', 'gpu', 
      'storage', 'psu', 'case', 'cooling'
    ];
    
    // 存储所有组件的品牌信息
    const brandData = {};
    const components = {};
    
    // 创建Promise数组来并行加载所有组件的品牌统计
    const loadPromises = componentTypes.map(type => {
      debugLog(`正在加载${type}品牌统计数据...`);
      
      // 调用云函数获取品牌统计
      return wx.cloud.callFunction({
        name: 'getComponentsData',
        data: {
          componentType: type,
          mode: 'brandStats'
        }
      })
      .then(res => {
        debugLog(`获取${type}品牌统计成功:`, res.result);
        
        if (res.result && res.result.code === 0 && res.result.data) {
          const brands = res.result.data.brands || [];
          brandData[type] = brands;
          
          // 转换品牌数据为前端使用的格式
          const brandOptions = {};
          brandOptions[type] = brands.map(brand => brand.displayName);
          
          // 确保CPU品牌包含英特尔和AMD
          if (type === 'cpu') {
            const hasIntel = brandOptions[type].includes('英特尔');
            const hasAMD = brandOptions[type].includes('AMD');
            
            if (!hasIntel) brandOptions[type].push('英特尔');
            if (!hasAMD) brandOptions[type].push('AMD');
            
            debugLog(`CPU品牌列表: ${brandOptions[type].join(', ')}`);
          }
          
          return { type, brandOptions: brandOptions[type] };
    } else {
          console.error(`获取${type}品牌统计失败:`, res.result);
          return { type, brandOptions: [] };
        }
      })
      .catch(err => {
        console.error(`加载${type}品牌统计失败:`, err);
        return { type, brandOptions: [] };
      });
    });
    
    // 等待所有Promise完成
    Promise.all(loadPromises)
      .then(results => {
        debugLog('所有组件品牌统计加载完成');
        
        // 清除超时保护
        clearTimeout(loadingTimeout);
        
        try {
          // 合并所有品牌选项
          const brandOptions = {};
          results.forEach(result => {
            brandOptions[result.type] = result.brandOptions;
          });
          
          // 确保CPU品牌选项包含英特尔和AMD
          if (!brandOptions.cpu || brandOptions.cpu.length < 2) {
            debugLog('自动补充CPU基本品牌选项');
            brandOptions.cpu = ['英特尔', 'AMD'];
          }
          
          this.setData({
            brandOptions: brandOptions
          });
          
          // 开始加载当前选中组件的数据
          this.loadComponentsByType(this.data.currentComponent);
          
        } catch (error) {
          console.error('处理品牌数据时出错:', error);
          wx.showToast({
            title: '数据处理失败',
            icon: 'none'
          });
          
          // 即使出错也进行品牌选项初始化
          this.ensureCpuBrands();
        } finally {
          // 确保无论如何都会关闭加载提示
          wx.hideLoading();
        }
      })
      .catch(err => {
        console.error('品牌数据加载过程中发生错误:', err);
        
        // 清除超时保护
        clearTimeout(loadingTimeout);
        
        // 确保无论如何都会关闭加载提示
        wx.hideLoading();
        wx.showToast({
          title: '品牌数据加载失败',
          icon: 'none'
        });
        
        // 即使出错也进行品牌选项初始化
        this.ensureCpuBrands();
      });
  },
  
  /**
   * 根据组件类型加载数据
   */
  loadComponentsByType: function(componentType) {
    debugLog(`[数据追踪] 加载组件类型: ${componentType}`);
    
    // 特殊处理caseFan类型 - 需要从cooling中获取数据
    if (componentType === 'caseFan') {
      // 如果机箱风扇数据已经加载，直接使用
      if (this.data.components.caseFan && this.data.components.caseFan.length > 0) {
        debugLog(`[数据追踪] 使用缓存的机箱风扇数据, 共${this.data.components.caseFan.length}个`);
        
        // 创建组件列表的副本
        let components = [...this.data.components.caseFan];
        
        this.setData({
          filteredComponents: components,
          filteredComponentsCount: components.length
        });
        
        // 应用筛选逻辑
        this.filterComponents();
        return;
      }
      
      // 如果cooling数据已经加载，从中提取caseFan数据
      if (this.data.components.cooling && this.data.components.cooling.length > 0) {
        debugLog(`[数据追踪] 从已加载的cooling数据中提取机箱风扇`);
        
        // 从散热器数据中筛选出机箱风扇
        const caseFans = this.data.components.cooling.filter(item => {
          const itemType = item['散热形式'] || item['类型'] || item.type || '';
          const itemName = item['名称'] || item.name || '';
          
          // 明确是机箱风扇的情况
          if (itemType === '机箱风扇' || itemName.includes('机箱风扇')) {
            return true;
          }
          
          // 排除明确不是机箱风扇的情况
          if (itemName.includes('水冷') || 
              itemName.includes('CPU') || 
              itemName.includes('散热器') || 
              itemName.includes('一体式') || 
              itemName.includes('AIO') ||
              // 排除水冷相关词汇
              itemName.includes('冰岩') || 
              itemName.includes('水泵') ||
              // 排除特定产品名
              itemName.includes('利民') && itemName.includes('FW') ||
              // 排除含"无风扇"但实际是水冷的产品
              itemName.includes('无风扇') && 
                (itemType === '水冷' || itemName.includes('雪冰岩'))) {
            return false;
          }
          
          // 其他含有"风扇"字样的产品视为机箱风扇
          return itemName.includes('风扇');
        });
        
        // 更新本地数据
        this.setData({
          'components.caseFan': caseFans,
          filteredComponents: caseFans,
          filteredComponentsCount: caseFans.length
        });
        
        debugLog(`[数据追踪] 已提取${caseFans.length}个机箱风扇`);
        
        // 应用筛选逻辑
        this.filterComponents();
        return;
      }
      
      // 如果cooling数据还没加载，先加载cooling数据
      debugLog(`[数据追踪] 需要先加载cooling数据`);
      
      // 显示加载提示
      wx.showLoading({
        title: '加载散热组件数据...',
        mask: true
      });
      
      // 调用云函数获取cooling组件数据
      wx.cloud.callFunction({
        name: 'getComponentsData',
        data: {
          componentType: 'cooler',  // cooling对应的云函数类型是cooler
          brand: 'all',
          limit: 10000,
          fetchAll: true
        }
      })
      .then(res => {
        wx.hideLoading();
        
        if (res.result && res.result.data) {
          const allCoolers = res.result.data;
          debugLog(`[数据追踪] 成功加载${allCoolers.length}个散热组件`);
          
          // 筛选出机箱风扇
          const caseFans = allCoolers.filter(item => {
            const itemType = item['散热形式'] || item['类型'] || item.type || '';
            const itemName = item['名称'] || item.name || '';
            
            // 明确是机箱风扇的情况
            if (itemType === '机箱风扇' || itemName.includes('机箱风扇')) {
              return true;
            }
            
            // 排除明确不是机箱风扇的情况
            if (itemName.includes('水冷') || 
                itemName.includes('CPU') || 
                itemName.includes('散热器') || 
                itemName.includes('一体式') || 
                itemName.includes('AIO') ||
                // 排除水冷相关词汇
                itemName.includes('冰岩') || 
                itemName.includes('水泵') ||
                // 排除特定产品名
                itemName.includes('利民') && itemName.includes('FW') ||
                // 排除含"无风扇"但实际是水冷的产品
                itemName.includes('无风扇') && 
                  (itemType === '水冷' || itemName.includes('雪冰岩'))) {
              return false;
            }
            
            // 其他含有"风扇"字样的产品视为机箱风扇
            return itemName.includes('风扇');
          });
          
          debugLog(`[数据追踪] 从中提取出${caseFans.length}个机箱风扇`);
          
          // 保存数据
          this.setData({
            'components.cooling': allCoolers,
            'components.caseFan': caseFans,
            filteredComponents: caseFans,
            filteredComponentsCount: caseFans.length
          });
          
          // 提取品牌列表
          this.extractBrands('cooling', allCoolers);
          this.extractBrands('caseFan', caseFans);
          
          // 应用筛选逻辑
          this.filterComponents();
        } else {
          console.error('[数据追踪] 获取散热器数据失败:', res);
          
          // 初始化为空数组，避免后续错误
          this.setData({
            'components.caseFan': [],
            filteredComponents: [],
            filteredComponentsCount: 0
          });
          
          wx.showToast({
            title: '加载散热器数据失败',
            icon: 'none',
            duration: 2000
          });
        }
      })
      .catch(err => {
        wx.hideLoading();
        console.error('[数据追踪] 获取散热器数据异常:', err);
        
        // 初始化为空数组，避免后续错误
        this.setData({
          'components.caseFan': [],
          filteredComponents: [],
          filteredComponentsCount: 0
        });
        
        wx.showToast({
          title: '加载散热器数据出错',
          icon: 'none',
          duration: 2000
        });
      });
      
      return;
    }
    
    // 以下是常规组件的处理逻辑（非caseFan）
    // 如果已经加载了该类型的组件数据，直接使用缓存
    if (this.data.components[componentType] && this.data.components[componentType].length > 0) {
      debugLog(`[数据追踪] 使用缓存数据, 共${this.data.components[componentType].length}个`);
      
      // 创建组件列表的副本，避免直接修改原始数据
      let components = [...this.data.components[componentType]];
      
      // 检查是否有已选择的当前类型组件，如果有，将其排在最前面
      const selectedItem = this.data.selectedItems[componentType];
      if (selectedItem) {
        debugLog(`[数据追踪] 发现已选择的${componentType}组件，将其排在列表最前面`);
        
        // 从组件列表中移除已选择的组件（如果存在）
        const selectedItemIndex = components.findIndex(item => item.id === selectedItem.id);
        if (selectedItemIndex >= 0) {
          const selectedItemInList = components.splice(selectedItemIndex, 1)[0];
          
          // 将已选择的组件添加到列表最前面
          components.unshift(selectedItemInList);
          
          debugLog(`[数据追踪] 已将选择的组件移到列表第一位`);
        } else {
          debugLog(`[数据追踪] 已选择的组件不在当前组件列表中`);
        }
      }
      
      this.setData({
        filteredComponents: components,
        filteredComponentsCount: components.length
      });
      
      // 应用筛选逻辑 - filterComponents会根据是否有已选组件自动选择合适的筛选方式
      this.filterComponents();
      return;
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '加载组件数据...',
      mask: true
    });
    
    // 将前端组件类型转换为云函数期望的类型
    let cloudComponentType = componentType;
    if (cloudComponentType === 'ram') cloudComponentType = 'memory';
    if (cloudComponentType === 'cooling') cloudComponentType = 'cooler';
    if (cloudComponentType === 'storage') cloudComponentType = 'disk';
    if (cloudComponentType === 'psu') cloudComponentType = 'power';
    
    // 将数据限制修改为非常大的值，确保获取全部数据
    let dataLimit = 10000; // 将默认限制改为10000条
    
    debugLog(`[数据追踪] 调用云函数参数: componentType=${cloudComponentType}, limit=${dataLimit}`);
    
    // 调用云函数获取组件数据
    wx.cloud.callFunction({
      name: 'getComponentsData',
      data: {
        componentType: cloudComponentType,
        brand: 'all',  // 在云函数端不做品牌过滤，返回所有数据
        limit: dataLimit, // 设置非常大的数据限制
        fetchAll: true    // 尝试获取所有数据
      }
    })
    .then(res => {
      wx.hideLoading();
      
      debugLog(`[数据追踪] 云函数返回${componentType}数据: ${res.result.data.length}条`);
      
      if (res.result && res.result.data) {
        // 初始化组件数据
        if (!this.data.components) {
          this.setData({
            components: {}
          });
        }
        
        // 存储原始组件数据
        let componentsData = res.result.data;
        let componentsUpdate = {};
        componentsUpdate[`components.${componentType}`] = componentsData;
        
        // 获取已选组件ID（如果有）
        const selectedItem = this.data.selectedItems[componentType];
        const selectedId = selectedItem ? selectedItem.id : null;
        
        // 移除直接排序代码，只更新原始数据
        this.setData({
          ...componentsUpdate
        });
        
        // 提取品牌列表
        this.extractBrands(componentType, res.result.data);
        
        // 应用筛选逻辑 - filterComponents会根据是否有已选组件自动选择合适的筛选方式
        this.filterComponents();
      } else {
        console.error(`[数据追踪] 获取${componentType}数据失败:`, res);
        wx.showToast({
          title: '加载组件数据失败',
          icon: 'none',
          duration: 2000
        });
      }
    })
    .catch(err => {
      wx.hideLoading();
      console.error(`[数据追踪] 获取${componentType}数据异常:`, err);
      wx.showToast({
        title: '加载组件数据出错',
        icon: 'none',
        duration: 2000
      });
    });
  },

  /**
   * 格式化从数据库获取的组件数据，确保字段名一致
   * @param {Array} data - 组件数据数组
   * @param {string} type - 组件类型
   * @returns {Array} 格式化后的数据
   */
  formatComponentData: function(data, type) {
    // 检查数据是否为空
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(`[配置] 格式化${type}组件时数据为空`);
      return [];
    }
    
    // 如果数据已经被云函数格式化，直接返回
    if (data[0].specs && Array.isArray(data[0].specs)) {
      debugLog(`[配置] ${type}数据已由云函数格式化，直接使用`);
      
      // 如果是GPU组件，排序规格并确保showMoreSpecs属性存在
      if (type === 'gpu') {
        debugLog(`[配置] 应用GPU规格排序优化`);
        return data.map(item => {
          // 排序规格
          if (item.specs && Array.isArray(item.specs)) {
            item.specs = this.sortGpuSpecs(item.specs);
            debugLog(`[配置] GPU ${item.name} 规格排序后:`, item.specs.slice(0, 3).map(s => s.label));
          }
          
          // 确保showMoreSpecs属性存在
          if (typeof item.showMoreSpecs === 'undefined') {
            item.showMoreSpecs = false;
          }
          
          return item;
        });
      }
      
      return data;
    }
    
    debugLog(`开始格式化${type}数据，共${data.length}条`);
    
    try {
      // 检查数据是否已经被云函数标准化处理过
      if (data[0] && data[0].specs && Array.isArray(data[0].specs) && data[0].rawData) {
        debugLog(`[格式化] ${type}数据已在云函数中格式化，保持原格式`);
        // 对于GPU类型，我们需要确保应用排序
        if (type === 'gpu') {
          debugLog(`[格式化] 对GPU数据应用规格排序`);
          return data.map(item => {
            const result = {
              ...item,
              id: item.id || item._id || ('unknown_' + Math.random().toString(36).substr(2, 9)),
              type: type,
              showMoreSpecs: false
            };
            
            // 排序规格
            if (result.specs && Array.isArray(result.specs)) {
              result.specs = this.sortGpuSpecs(result.specs);
            }
            
            return result;
          });
        }
        
        // 对于非GPU类型，只确保每个组件有唯一ID和类型字段
        return data.map(item => ({
          ...item,
          id: item.id || item._id || ('unknown_' + Math.random().toString(36).substr(2, 9)),
          type: type
        }));
      }
      
      // 以下是原有的格式化代码...
      // 根据不同组件类型进行格式化
      switch(type) {
        case 'cpu':
          return data.map(item => {
            // 打印样本数据进行调试
            if (data.indexOf(item) < 3) {
              debugLog(`CPU原始数据示例:`, item);
            }
            
            try {
              // 尝试获取各种可能的ID字段
              const id = item.id || item._id || '';
              const name = item.name || item.名称 || '';
              // 优先使用标准化的brand字段
              let brand = item.brand || item.品牌 || '';
              // 确保价格是数字
              const price = typeof item.price === 'number' ? item.price : 
                            typeof item.价格 === 'number' ? item.价格 : 
                            parseFloat(item.price || item.价格 || '0') || 0;
              
              // CPU品牌标准化
              if (brand.toLowerCase() === 'intel') {
                brand = '英特尔';
              }
              
              return {
                id: id,
                name: name,
                brand: brand, 
                price: price,
                socket: item.socket || item.接口 || '',
                specs: [
                  { label: '核心数', value: item.core_count || item.核心 || '' },
                  { label: '频率', value: item.base_frequency || item.频率 || '' },
                  { label: '功耗', value: item.tdp || item.功率 || item.功耗 || '' }
                ],
                type: 'cpu',
                // 保存原始数据以便访问更多字段
                rawData: item,
                // 保留原始品牌字段用于调试
                原始品牌: item.品牌 || item.brand || ''
              };
            } catch (err) {
              console.error(`处理CPU项目时出错:`, err, item);
              // 返回一个最基本的对象以避免整个映射失败
              return {
                id: item.id || item._id || 'unknown',
                name: item.name || item.名称 || 'CPU数据处理错误',
                brand: item.brand || item.品牌 || '',
                price: 0,
                specs: [],
                type: 'cpu',
                rawData: item
              };
            }
          });
          
        case 'motherboard':
          return data.map(item => {
            try {
      return {
                id: item.id || item._id || '',
                name: item.name || item.名称 || '',
                brand: item.brand || item.品牌 || '', 
                price: typeof item.price === 'number' ? item.price : 
                      typeof item.价格 === 'number' ? item.价格 : 
                      parseFloat(item.price || item.价格 || '0') || 0,
                socket: item.socket || item.接口 || '',
                specs: [
                  { label: '芯片组', value: item.chipset || item.芯片组 || '' },
                  { label: '内存插槽', value: item.memory_slots || item.内存插槽 || '' },
                  { label: 'M.2', value: item.m2_slots || item.M2接口 || '0' + '个插槽' }
                ],
                type: 'motherboard',
                原始品牌: item.品牌 || item.brand || ''
              };
            } catch (err) {
              console.error(`处理主板项目时出错:`, err, item);
              return {
                id: item.id || item._id || 'unknown',
                name: item.name || item.名称 || '主板数据处理错误',
                brand: item.brand || item.品牌 || '',
                price: 0,
                specs: [],
                type: 'motherboard'
              };
            }
          });
        
        // 添加GPU特定处理
        case 'gpu':
          return data.map(item => {
            try {
              const result = {
                id: item.id || item._id || '',
                name: item.name || item.名称 || item.型号 || '',
                brand: item.brand || item.品牌 || '',
                price: typeof item.price === 'number' ? item.price : 
                      typeof item.价格 === 'number' ? item.价格 : 
                      parseFloat(item.price || item.价格 || '0') || 0,
                specs: [
                  { label: '显存', value: item.vram || item.显存 || item.memory || '' },
                  { label: '显存类型', value: item.vram_type || item.显存类型 || item.memory_type || '' },
                  { label: '核心频率', value: item.core_clock || item.核心频率 || '' },
                  { label: '功耗', value: item.tdp || item.功耗 || item.power || '' },
                  { label: '接口', value: item.interface || item.接口 || '' },
                  { label: '长度', value: item.length || item.长度 || item.size || '' }
                ].filter(spec => spec.value),
                type: 'gpu',
                rawData: item,
                showMoreSpecs: false
              };
              
              // 应用规格排序
              result.specs = this.sortGpuSpecs(result.specs);
              
              return result;
            } catch (err) {
              console.error(`处理GPU项目时出错:`, err, item);
              return {
                id: item.id || item._id || 'unknown',
                name: item.name || item.名称 || 'GPU数据处理错误',
                brand: item.brand || item.品牌 || '',
                price: 0,
                specs: [],
                type: 'gpu',
                rawData: item,
                showMoreSpecs: false
              };
            }
          });
        
        // 处理其他组件类型...
        default:
          // 通用处理方式，尝试提取基本字段
          return data.map(item => {
            try {
              return {
                id: item.id || item._id || '',
                name: item.name || item.名称 || item.型号 || '',
                brand: item.brand || item.品牌 || '',
                price: typeof item.price === 'number' ? item.price : 
                      typeof item.价格 === 'number' ? item.价格 : 
                      parseFloat(item.price || item.价格 || '0') || 0,
                specs: item.specs || [],
                type: type,
                rawData: item,
                原始品牌: item.品牌 || item.brand || ''
              };
            } catch (err) {
              console.error(`处理${type}项目时出错:`, err, item);
              return {
                id: item.id || item._id || 'unknown',
                name: item.name || item.名称 || `${type}数据处理错误`,
                brand: item.brand || item.品牌 || '',
                price: 0,
                specs: [],
                type: type,
                rawData: item
              };
        }
      });
    }
    } catch (error) {
      console.error(`格式化${type}组件数据时出错:`, error);
      // 发生错误时返回原始数据但确保至少有id字段
      return data.map(item => ({
        id: item.id || item._id || 'unknown',
        ...item,
        type: type,
        rawData: item
      }));
    }
  },
  
  /**
   * 筛选组件 - 根据品牌和价格范围
   */
  filterComponents: function(skipCompatibilityCheck) {
    // 防止在onLoad阶段还没有组件数据时调用
    if (!this.data.components || !this.data.components[this.data.currentComponent]) {
      debugLog('[筛选函数] 当前没有组件数据，跳过筛选');
      return;
    }
    
    debugLog(`[筛选函数] 开始筛选${this.data.currentComponent}组件`);
    debugLog(`[筛选函数] 品牌: ${this.data.currentBrand}, 价格: ${this.data.currentPrice}`);
    
    // 获取当前组件类型的所有组件
    const allComponents = this.data.components[this.data.currentComponent];
    coolingLog(`初始组件数量: ${allComponents.length}`);
    
    // 应用品牌筛选
    let filteredByBrand = allComponents;
    if (this.data.currentBrand !== 'all') {
      filteredByBrand = this.filterComponentsByBrand(allComponents, this.data.currentBrand);
      coolingLog(`品牌筛选后数量: ${filteredByBrand.length}`);
    }
    
    // 应用价格筛选
    let filteredByPrice = filteredByBrand;
    if (this.data.currentPrice !== 'all') {
      filteredByPrice = this.filterComponentsByPrice(filteredByBrand, this.data.currentPrice);
      coolingLog(`价格筛选后数量: ${filteredByPrice.length}`);
    }
    
    // 应用搜索关键词筛选
    let filteredBySearch = filteredByPrice;
    if (this.data.searchKeyword && this.data.searchKeyword.trim() !== '') {
      filteredBySearch = this.filterComponentsByKeyword(filteredByPrice, this.data.searchKeyword);
      debugLog(`[筛选函数] 关键词筛选后数量: ${filteredBySearch.length}`);
    }
    
    // 最终筛选结果，使用搜索关键词筛选后的结果
    let finalComponents = filteredBySearch;
    
    // 判断是否需要应用兼容性筛选
    if (this.data.onlyShowCompatible && !skipCompatibilityCheck && 
        this.data.selectedItems && Object.keys(this.data.selectedItems).length > 0) {
      debugLog('[筛选函数] 执行兼容性筛选');
      // 在兼容性筛选函数中传递filteredBySearch，使其基于搜索结果筛选
      this.applyCompatibilityFilter(filteredBySearch);
    } else {
      debugLog('[筛选函数] 跳过兼容性筛选');
      
      // 检查是否已有该类型选中的组件，有就置顶
      const currentType = this.data.currentComponent;
      const selectedItem = this.data.selectedItems[currentType];
      const selectedId = selectedItem ? selectedItem.id : null;
      
      // 应用价格排序
      let finalFiltered = this.sortComponentsByPrice(finalComponents, this.data.currentPriceSort, selectedId);
      debugLog(`[筛选函数] 应用价格${this.data.currentPriceSort === 'asc' ? '升序' : '降序'}排序`);
      
      // 保存完整的筛选结果
      const totalCount = finalFiltered.length;
      
      // 只显示前N条
      const displayItems = finalFiltered.slice(0, this.data.displayedCount);
      
      this.setData({
        allFilteredComponents: finalFiltered,
        filteredComponents: displayItems,
        filteredComponentsCount: totalCount,
        hasMoreComponents: totalCount > this.data.displayedCount
      });
      
      debugLog(`[筛选函数] 筛选完成，总共${totalCount}个组件，显示前${displayItems.length}个`);
    }
  },
  
  /**
   * 根据价格选项获取价格范围
   * @param {string} componentType - 组件类型
   * @param {string} priceOption - 价格选项: low, medium, high, premium
   * @returns {Object} 价格范围 {min, max}
   */
  getPriceRange: function(componentType, priceOption) {
    // 定义各种组件的价格范围
    const priceRanges = {
      cpu: {
        low: { min: 0, max: 1000 },
        medium: { min: 1000, max: 2000 },
        high: { min: 2000, max: 3500 },
        premium: { min: 3500, max: 0 }  // max为0表示无上限
      },
      gpu: {
        low: { min: 0, max: 2000 },
        medium: { min: 2000, max: 4000 },
        high: { min: 4000, max: 7000 },
        premium: { min: 7000, max: 0 }
      },
      motherboard: {
        low: { min: 0, max: 800 },
        medium: { min: 800, max: 1500 },
        high: { min: 1500, max: 2500 },
        premium: { min: 2500, max: 0 }
      },
      ram: {
        low: { min: 0, max: 300 },
        medium: { min: 300, max: 600 },
        high: { min: 600, max: 1000 },
        premium: { min: 1000, max: 0 }
      },
      storage: {
        low: { min: 0, max: 400 },
        medium: { min: 400, max: 800 },
        high: { min: 800, max: 1500 },
        premium: { min: 1500, max: 0 }
      },
      psu: {
        low: { min: 0, max: 500 },
        medium: { min: 500, max: 1000 },
        high: { min: 1000, max: 1500 },
        premium: { min: 1500, max: 0 }
      },
      case: {
        low: { min: 0, max: 300 },
        medium: { min: 300, max: 700 },
        high: { min: 700, max: 1500 },
        premium: { min: 1500, max: 0 }
      },
      cooling: {
        low: { min: 0, max: 200 },
        medium: { min: 200, max: 500 },
        high: { min: 500, max: 1000 },
        premium: { min: 1000, max: 0 }
      },
      monitor: {
        low: { min: 0, max: 1000 },
        medium: { min: 1000, max: 2000 },
        high: { min: 2000, max: 4000 },
        premium: { min: 4000, max: 0 }
      }
    };
    
    // 查找对应组件类型的价格范围
    const typeRanges = priceRanges[componentType] || {
      low: { min: 0, max: 500 },
      medium: { min: 500, max: 1000 },
      high: { min: 1000, max: 2000 },
      premium: { min: 2000, max: 0 }
    };
    
    // 返回对应价格选项的范围，如果没有找到则返回全范围
    return typeRanges[priceOption] || { min: 0, max: 0 };
  },
  
  /**
   * 切换组件类型
   */
  switchComponent: function(e) {
    const componentType = e.currentTarget.dataset.component || (e.currentTarget.dataset.type || 'cpu');
    
    // 如果已经是当前选择的组件类型，不需要切换
    if (componentType === this.data.currentComponent) {
      debugLog(`[switchComponent] 当前已经是${componentType}，无需切换`);
      return;
    }
    
    debugLog(`[switchComponent] 切换组件类型: ${componentType}`);
    
    // 更新组件类型
    this.setData({
      currentComponent: componentType,
      previousComponent: this.data.currentComponent,
      // 重置筛选相关状态
      currentBrand: 'all',
      currentPrice: 'all',
      currentCoolingType: 'all',
      searchKeyword: '',
      // 更新搜索框占位符
      searchPlaceholder: this.getSearchPlaceholder(componentType)
    });
    
    // 加载对应类型的组件数据
    this.loadComponentData(componentType);
  },
  
  /**
   * 获取搜索框占位符文本
   */
  getSearchPlaceholder: function(componentType) {
    // 根据组件类型返回对应的搜索占位符
    switch(componentType) {
      case 'cpu': return '搜索CPU';
      case 'motherboard': return '搜索主板';
      case 'ram': return '搜索内存';
      case 'gpu': return '搜索显卡';
      case 'storage': return '搜索存储';
      case 'psu': return '搜索电源';
      case 'case': return '搜索机箱';
      case 'cooling': return '搜索散热';
      case 'caseFan': return '搜索机箱散热';
      case 'monitor': return '搜索显示器';
      default: return '搜索组件';
    }
  },
  
  /**
   * 加载机箱风扇数据
   */
  loadCaseFanData: function() {
    // 先检查是否已经加载了散热器数据
    if (this.data.components.cooling && this.data.components.cooling.length > 0) {
      // 从散热器数据中筛选出机箱风扇
      const caseFans = this.data.components.cooling.filter(item => {
        const itemType = item['散热形式'] || item['类型'] || item.type || '';
        const itemName = item['名称'] || item.name || '';
        
        // 明确是机箱风扇的情况
        if (itemType === '机箱风扇' || itemName.includes('机箱风扇')) {
          return true;
        }
        
        // 排除明确不是机箱风扇的情况
        if (itemName.includes('水冷') || 
            itemName.includes('CPU') || 
            itemName.includes('散热器') || 
            itemName.includes('一体式') || 
            itemName.includes('AIO') ||
            // 排除水冷相关词汇
            itemName.includes('冰岩') || 
            itemName.includes('水泵') ||
            // 排除特定产品名
            itemName.includes('利民') && itemName.includes('FW') ||
            // 排除含"无风扇"但实际是水冷的产品
            itemName.includes('无风扇') && 
              (itemType === '水冷' || itemName.includes('雪冰岩'))) {
          return false;
        }
        
        // 其他含有"风扇"字样的产品视为机箱风扇
        return itemName.includes('风扇');
      });
      
      // 更新本地数据
      this.setData({
        'components.caseFan': caseFans
      });
      
      // 应用筛选
      this.filterComponents();
    } else {
      // 如果散热器数据还没加载，先加载散热器数据
      const collectionName = this.data.componentCollections.cooling;
      this.getComponentData(collectionName, {}).then(res => {
        if (res.success) {
          // 提取全部的散热器数据
          const allCoolers = res.data || [];
          
          // 筛选出机箱风扇
          const caseFans = allCoolers.filter(item => {
            const itemType = item['散热形式'] || item['类型'] || item.type || '';
            const itemName = item['名称'] || item.name || '';
            
            // 明确是机箱风扇的情况
            if (itemType === '机箱风扇' || itemName.includes('机箱风扇')) {
              return true;
            }
            
            // 排除明确不是机箱风扇的情况
            if (itemName.includes('水冷') || 
                itemName.includes('CPU') || 
                itemName.includes('散热器') || 
                itemName.includes('一体式') || 
                itemName.includes('AIO') ||
                // 排除水冷相关词汇
                itemName.includes('冰岩') || 
                itemName.includes('水泵') ||
                // 排除特定产品名
                itemName.includes('利民') && itemName.includes('FW') ||
                // 排除含"无风扇"但实际是水冷的产品
                itemName.includes('无风扇') && 
                  (itemType === '水冷' || itemName.includes('雪冰岩'))) {
              return false;
            }
            
            // 其他含有"风扇"字样的产品视为机箱风扇
            return itemName.includes('风扇');
          });
          
          // 保存数据并应用筛选
          this.setData({
            'components.cooling': allCoolers,
            'components.caseFan': caseFans
          });
          
          // 应用筛选
          this.filterComponents();
        } else {
          console.error('获取散热器数据失败:', res.error);
          wx.showToast({
            title: '加载数据失败',
            icon: 'none'
          });
        }
      }).catch(err => {
        console.error('加载散热器数据出错:', err);
      });
    }
  },

  /**
   * 按品牌筛选 - 简化版，直接请求云函数
   * @param {Object} e - 事件对象
   */
  filterByBrand: function(e) {
    const brand = e.currentTarget.dataset.brand;
    
    debugLog(`[数据追踪] 选择品牌: ${brand}`);
    
    // 如果已经选中了该品牌，不需要重新过滤
    if (brand === this.data.currentBrand) {
      debugLog(`[数据追踪] 已选择品牌 ${brand}, 不重复过滤`);
      return;
    }
    
    // 添加防抖处理，避免快速切换品牌导致卡死
    if (this.brandFilterTimer) {
      clearTimeout(this.brandFilterTimer);
    }
    
    // 显示加载中
    wx.showLoading({
      title: '切换品牌...',
      mask: true
    });
    
    // 更新当前品牌
    this.setData({
      currentBrand: brand
    });
    
    // 延迟执行筛选，给UI留出更新时间
    this.brandFilterTimer = setTimeout(() => {
      // 无论是否有已选组件，都应用当前筛选逻辑
      // 如果有已选组件，filterComponents会自动调用applyCompatibilityFilter
      this.filterComponents();
      wx.hideLoading();
    }, 50);
  },

  /**
   * 根据价格筛选
   */
  filterByPrice: function(e) {
    const price = e.currentTarget.dataset.price;
    
    // 如果已经选择了相同的价格，不需要重新筛选
    if (price === this.data.currentPrice) {
      return;
    }
    
    debugLog(`[数据追踪] 选择价格: ${price}`);
    
    // 如果没有组件数据，不执行筛选
    if (!this.data.components[this.data.currentComponent]) {
      debugLog(`[数据追踪] 没有${this.data.currentComponent}组件数据，无法筛选`);
      return;
    }
    
    // 更新当前价格选择
    this.setData({
      currentPrice: price
    });
    
    // 无论是否有已选组件，都应用当前筛选逻辑
    // 如果有已选组件，filterComponents会自动调用applyCompatibilityFilter
    this.filterComponents();
  },

  /**
   * 按散热类型筛选 - 由UI触发
   */
  filterByCoolingType: function(e) {
    const coolingType = e.currentTarget.dataset.type;
    
    // 添加详细日志
    coolingLog(`开始 - 用户选择了散热类型: ${coolingType}, 当前类型: ${this.data.currentCoolingType}`);
    
    // 如果已经选择了相同的散热类型，不需要重新筛选
    if (coolingType === this.data.currentCoolingType) {
      coolingLog(`已经是当前选择的散热类型, 不执行筛选`);
      return;
    }
    
    debugLog(`[数据追踪] 选择散热类型: ${coolingType}`);
    
    // 如果没有散热组件数据，不执行筛选
    if (!this.data.components['cooling']) {
      coolingLog(`错误 - 没有散热组件数据，无法筛选`);
      debugLog(`[数据追踪] 没有散热组件数据，无法筛选`);
      return;
    }
    
    // 输出当前散热组件数量
    coolingLog(`当前散热组件总数: ${this.data.components['cooling'].length}`);
    
    // 更新当前散热类型选择
    this.setData({
      currentCoolingType: coolingType
    });
    
    coolingLog(`已更新数据，即将执行组件筛选`);
    
    // 应用当前筛选逻辑
    this.filterComponents();
  },

  /**
   * 计算总价格
   */
  calculateTotalPrice: function() {
    let total = 0;
    
    // 遍历所有已选组件
    for (const type in this.data.selectedItems) {
      if (this.data.selectedItems.hasOwnProperty(type)) {
        // 所有组件都使用统一的处理方式
        if (this.data.selectedItems[type] && (this.data.selectedItems[type].价格 || this.data.selectedItems[type].price)) {
          const price = this.data.selectedItems[type].价格 || this.data.selectedItems[type].price || 0;
          const quantity = this.data.selectedItems[type].quantity || 1;
          total += price * quantity;
        }
      }
    }
    
    // 更新总价
    this.setData({
      totalPrice: Math.round(total)
    });
    
    debugLog(`[价格] 更新总价: ${total}元`);
    return total;
  },
  
  /**
   * 选择组件 - 添加到配置中
   */
  selectComponent: function(e) {
    debugLog(`[组件选择] 开始处理选择组件`);
    const item = e.currentTarget.dataset.item;
    const componentType = e.currentTarget.dataset.type;
    
    debugLog(`[组件选择] 组件类型: ${componentType}, 组件ID: ${item.id}`);
    
    // 检查是否已经选择了该组件
    const alreadySelected = this.data.selectedItems[componentType] && 
                          this.data.selectedItems[componentType].id === item.id;
    
    // 是否支持多选（如内存条、显卡、存储设备等）
    // 将caseFan添加到支持多选的组件中
    let supportsMultipleSelection = ['ram', 'gpu', 'storage', 'monitor', 'caseFan'].includes(componentType);
    
    // 特殊处理散热器类型：如果是cooling类型，需要区分不同散热类型
    if (componentType === 'cooling') {
      // 获取散热类型，判断是否是机箱风扇
      const coolingType = item.散热形式 || item.类型 || item.type || '';
      const itemName = item.名称 || item.name || '';
      const isCaseFan = coolingType === '机箱风扇' || itemName.includes('机箱风扇') || 
                        (itemName.includes('风扇') && !itemName.includes('CPU') && 
                         !itemName.includes('散热器') && !itemName.includes('水冷'));
      
      // 仅机箱风扇支持多选，其他散热类型不支持
      supportsMultipleSelection = isCaseFan;
      
      debugLog(`[组件选择] 散热组件: ${itemName}, 类型: ${coolingType}, 是否为机箱风扇: ${isCaseFan}, 支持多选: ${supportsMultipleSelection}`);
    }
    
    debugLog(`[组件选择] 是否已选择: ${alreadySelected}, 是否支持多选: ${supportsMultipleSelection}`);
    
    // 如果是已选择的组件且不支持多选，则取消选择
    if (alreadySelected && !supportsMultipleSelection) {
      debugLog(`[组件选择] 取消选择${componentType}组件`);
      
      // 创建一个新的selectedItems对象，删除对应类型
      const newSelectedItems = {...this.data.selectedItems};
      delete newSelectedItems[componentType];
      
      this.setData({
        selectedItems: newSelectedItems
      });
      
      // 重新计算总价
      this.calculateTotalPrice();
      
      // 显示取消选择提示
      wx.showToast({
        title: '已取消选择',
        icon: 'success',
        duration: 1000
      });
      
      // 应用筛选逻辑，根据是否还有已选组件自动选择合适的筛选方式
      this.filterComponents();
      
      return;
    }
    
    if (alreadySelected && supportsMultipleSelection) {
      // 如果已经选择过，且支持多选，增加数量
      debugLog(`[组件选择] 增加已选${componentType}组件数量`);
      this.increaseQuantity(e);
      return;
    }
    
    // 特殊处理: 如果是cooling类型但不支持多选（非机箱风扇），需要替换原选择
    if (componentType === 'cooling' && !supportsMultipleSelection && this.data.selectedItems[componentType]) {
      debugLog(`[组件选择] 替换单选散热组件`);
      
      // 提示用户
      wx.showToast({
        title: '已替换散热器',
        icon: 'success',
        duration: 1000
      });
    }
    
    // 移除特殊处理机箱风扇的代码，将其作为普通多选组件处理
    
    // 更新普通组件，保留原始字段
    item.quantity = 1; // 初始化数量为1
    
    this.setData({
      [`selectedItems.${componentType}`]: item
    });
    
    // 重新计算总价
    this.calculateTotalPrice();
    
    // 显示选择成功提示
    wx.showToast({
      title: '已选择',
      icon: 'success',
      duration: 1000
    });
    
    // 记录更新后的所有已选组件
    debugLog('[组件选择] 当前已选所有组件:', JSON.stringify(this.data.selectedItems));
    
    // 应用筛选逻辑 - 有已选组件，会自动触发兼容性筛选
    this.filterComponents();
    
    // 判断是否自动切换到下一个组件
    // 复数组件（内存、显卡、存储等）不自动跳转
    const multiSelectComponents = ['ram', 'gpu', 'storage', 'monitor', 'caseFan'];
    if (this.data.autoSwitchToNext && !multiSelectComponents.includes(componentType)) {
      // 获取下一个要选择的组件类型
      const componentOrder = ['cpu', 'motherboard', 'cooling', 'ram', 'storage', 'gpu', 'psu', 'case', 'caseFan', 'monitor'];
      const currentIndex = componentOrder.indexOf(componentType);
      
      // 如果当前不是最后一个组件，则切换到下一个
      if (currentIndex < componentOrder.length - 1) {
        const nextComponent = componentOrder[currentIndex + 1];
        debugLog(`[组件选择] 自动切换到下一个组件: ${nextComponent}`);
        this.switchToNextComponent();
      } else {
        debugLog('[组件选择] 已是最后一个组件，不自动切换');
      }
    }
  },

  /**
   * 预览配置
   * 显示当前配置的预览页面
   */
  previewConfig: function() {
    debugLog('[数据追踪] 调用预览配置功能');
    
    // 检查是否有已选组件
    const { selectedItems, totalPrice } = this.data;
    const selectedKeys = Object.keys(selectedItems);
    
    if (selectedKeys.length === 0) {
      // 没有选择任何组件，提示用户
      wx.showToast({
        title: '请先选择组件',
        icon: 'none',
        duration: 2000
      });
      return;
    }
    
    // 生成最终配置对象
    const finalConfig = this.generateFinalConfig();
    debugLog('[数据追踪] 预览配置信息:', finalConfig);
    
    // 将配置数据存储到全局数据
    getApp().globalData.tempConfig = finalConfig;
    
    // 跳转到预览页面
    wx.navigateTo({
      url: '/pages/configPreview/configPreview',
      fail: (err) => {
        console.error('[数据追踪] 跳转预览页面失败:', err);
        
        // 提示页面不存在
        wx.showToast({
          title: '预览功能正在开发中',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  /**
   * 重置配置
   * 清空所有已选组件
   */
  resetConfig: function() {
    debugLog('[数据追踪] 重置配置');
    
    // 弹窗确认
    wx.showModal({
      title: '确认重置',
      content: '确定要重置当前配置吗？这将清空所有已选组件。',
      success: (res) => {
        if (res.confirm) {
          // 用户点击确定，重置配置
          this.setData({
            selectedItems: {},
            totalPrice: 0,
            configName: '我的配置'
          });
          
          // 重置当前组件类型为第一个
          this.switchComponent({
            currentTarget: {
              dataset: {
                component: 'cpu'
              }
            }
          });
          
          // 重置品牌和价格筛选
          this.setData({
            currentBrand: 'all',
            currentPrice: 'all',
            currentCoolingType: 'all' // 重置散热类型筛选
          });
          
          // 重新加载当前组件数据，已经没有已选组件，会显示所有组件
          this.loadComponentsByType('cpu');
          
          wx.showToast({
            title: '配置已重置',
            icon: 'success',
            duration: 1500
          });
        }
      }
    });
  },

  /**
   * 增加组件数量
   */
  increaseQuantity: function(e) {
    // 获取传递的数据
    const item = e.currentTarget.dataset.item;
    const componentType = this.data.currentComponent;
    
    debugLog(`[数量增加] 开始处理, 组件:`, item);
    debugLog(`[数量增加] 组件ID: ${item.id}, 当前类型: ${componentType}`);
    
    // 获取当前已选择的组件
    const selectedItem = this.data.selectedItems[componentType];
    
    // 如果未找到已选组件，或者组件ID不匹配，则退出
    if (!selectedItem || selectedItem.id !== item.id) {
      debugLog(`[数量增加] 未找到匹配的已选组件`);
      return;
    }
    
    // 特殊处理散热器组件 - 如果不是机箱风扇，不允许增加
    if (componentType === 'cooling') {
      // 判断是否是机箱风扇
      const coolingType = selectedItem.散热形式 || selectedItem.类型 || selectedItem.type || '';
      const itemName = selectedItem.名称 || selectedItem.name || '';
      const isCaseFan = coolingType === '机箱风扇' || itemName.includes('机箱风扇') || 
                       (itemName.includes('风扇') && !itemName.includes('CPU') && 
                        !itemName.includes('散热器') && !itemName.includes('水冷'));
      
      // 如果不是机箱风扇，显示提示并返回
      if (!isCaseFan) {
        debugLog(`[数量增加] 风冷/水冷散热器不支持多选`);
        wx.showToast({
          title: '散热器不可多选',
          icon: 'none',
          duration: 1500
        });
        return;
      }
    }
    
    // 增加数量（默认从1开始）
    const quantity = (selectedItem.quantity || 1) + 1;
    
    // 设置数量上限，防止过度选择
    const maxQuantity = 16; // 默认最大数量16个
    
    if (quantity > maxQuantity) {
      debugLog(`[数量增加] 已达到最大数量 ${maxQuantity}`);
      wx.showToast({
        title: `最多选择${maxQuantity}个`,
        icon: 'none',
        duration: 1500
      });
      return;
    }
    
    debugLog(`[数量增加] 更新数量: ${quantity}`);
    
    // 更新组件数量
    this.setData({
      [`selectedItems.${componentType}.quantity`]: quantity
    });
    
    // 重新计算总价
    this.calculateTotalPrice();
    
    // 显示成功提示
    wx.showToast({
      title: `已选择${quantity}个`,
      icon: 'success',
      duration: 1000
    });
  },
  
  /**
   * 减少组件数量
   */
  decreaseQuantity: function(e) {
    // 获取传递的数据
    const item = e.currentTarget.dataset.item;
    const componentType = this.data.currentComponent;
    
    debugLog(`[数量减少] 开始处理, 组件:`, item);
    
    // 获取当前已选择的组件
    const selectedItem = this.data.selectedItems[componentType];
    
    // 如果未找到已选组件，或者组件ID不匹配，则退出
    if (!selectedItem || selectedItem.id !== item.id) {
      debugLog(`[数量减少] 未找到匹配的已选组件`);
      return;
    }
    
    // 获取当前数量
    const currentQuantity = selectedItem.quantity || 1;
    
    // 如果当前数量为1，则取消选择
    if (currentQuantity <= 1) {
      // 创建一个新的selectedItems对象，删除对应类型
      const newSelectedItems = {...this.data.selectedItems};
      delete newSelectedItems[componentType];
      
      this.setData({
        selectedItems: newSelectedItems
      });
      
      debugLog(`[数量减少] 数量为1，取消选择`);
      
      // 重新计算总价
      this.calculateTotalPrice();
      
      // 显示取消选择提示
      wx.showToast({
        title: '已取消选择',
        icon: 'success',
        duration: 1000
      });
      
      return;
    }
    
    // 减少数量
    const quantity = currentQuantity - 1;
    
    debugLog(`[数量减少] 更新数量: ${quantity}`);
    
    // 更新组件数量
    this.setData({
      [`selectedItems.${componentType}.quantity`]: quantity
    });
    
    // 重新计算总价
    this.calculateTotalPrice();
    
    // 显示成功提示
    wx.showToast({
      title: `已选择${quantity}个`,
      icon: 'success',
      duration: 1000
    });
  },

  /**
   * 自动切换到下一个组件
   */
  switchToNextComponent: function() {
    const componentTypes = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooling', 'caseFan', 'monitor'];
    const currentIndex = componentTypes.indexOf(this.data.currentComponent);
    
    if (currentIndex >= 0 && currentIndex < componentTypes.length - 1) {
      // 切换到下一个组件
      const nextComponent = componentTypes[currentIndex + 1];
      
      // 使用switchComponent函数切换
      this.switchComponent({
        currentTarget: {
          dataset: {
            component: nextComponent
          }
        }
      });
    }
  },

  /**
   * 设置配置名称
   */
  setConfigName: function(e) {
      this.setData({
      configName: e.detail.value
      });
  },
  
  /**
   * 生成最终配置
   */
  generateFinalConfig: function() {
    const { selectedItems, totalPrice, configName } = this.data;
    
    const finalConfig = {
      id: 'config_' + Date.now(),
      name: configName || '我的配置',
      components: selectedItems,
      totalPrice: totalPrice,
      createTime: new Date().toISOString(),
      // 移除这个字段，让云函数自动设置正确的OPENID
      // userId: wx.cloud.inited ? wx.cloud.getOpenId() : null
    };
    
    this.setData({ finalConfig });
    
    return finalConfig;
  },
  
  /**
   * 保存配置
   */
  saveConfig: function() {
    // 检查是否有选择组件
    const selectedItems = this.data.selectedItems;
    const hasSelectedComponents = Object.keys(selectedItems).some(key => {
      // 简化判断，所有组件统一用id判断
      return selectedItems[key] && (selectedItems[key].id || selectedItems[key]._id);
    });
    
    if (!hasSelectedComponents) {
      wx.showToast({
        title: '请先选择组件',
        icon: 'none'
      });
      return;
    }
    
    // 创建配置对象
    const config = {
      id: 'config_' + Date.now(),
      name: this.data.configName || '我的配置',
      components: this.data.selectedItems,
      totalPrice: this.data.totalPrice,
      createTime: new Date(),
      updateTime: new Date()
    };
    
    // 保存配置
    const app = getApp();
    app.saveUserConfig(config).then(success => {
      if (success) {
        wx.showToast({
          title: '保存成功',
          icon: 'success'
        });
        
        // 可以跳转到配置列表页
        setTimeout(() => {
          wx.navigateTo({
            url: '/pages/configList/configList'
          });
        }, 1500);
      } else {
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    }).catch(err => {
      console.error('保存配置失败:', err);
      wx.showToast({
        title: '保存失败',
        icon: 'none'
      });
    });
  },

  /**
   * 选择预算
   */
  selectBudget: function(e) {
    const budget = e.currentTarget.dataset.budget;
    this.setData({ budget });
  },

  /**
   * 选择用途
   */
  selectPurpose: function(e) {
    const purpose = e.currentTarget.dataset.purpose;
    this.setData({ userPurpose: purpose });
    
    // 进入下一步
    this.nextStep();
  },

  /**
   * 进入下一步
   */
  nextStep: function() {
    const { currentStep, steps } = this.data;
    if (currentStep < steps.length - 1) {
    this.setData({
        currentStep: currentStep + 1
      });
    }
  },

  /**
   * 返回上一步
   */
  prevStep: function() {
    const { currentStep } = this.data;
    if (currentStep > 0) {
          this.setData({
        currentStep: currentStep - 1
      });
    }
  },

  /**
   * 动态生成品牌选项
   */
  generateBrandOptions: function(components) {
    const brandOptions = {};
    
    // 调试日志，输出组件对象的键
    debugLog("组件对象键名:", Object.keys(components));
    
    // 遍历每种组件类型
    Object.keys(components).forEach(type => {
      // 安全检查，确保组件数据存在且是数组
      if (!components[type] || !Array.isArray(components[type])) {
        debugLog(`组件类型 ${type} 的数据不存在或不是数组，跳过处理`);
        brandOptions[type] = []; // 创建空数组避免后续引用错误
        return; // 跳过此类型处理
      }
      
      debugLog(`处理 ${type} 组件品牌，数据量: ${components[type].length}`);
      
      try {
        // 获取当前组件类型的品牌处理模块
        const brandModule = this.data.componentBrandUtils[type] || this.data.componentBrandUtils.common;
        
        // 品牌映射对象 - 用于统计和去重
        const brandMap = {};
        
        // 处理该类型的所有组件
        components[type].forEach(item => {
          try {
            // 直接调用模块的extractBrand方法，但要绑定正确的this上下文
            let brand;
            if (this.data.componentBrandUtils[type]) {
              brand = this.data.componentBrandUtils[type].extractBrand.call(
                this.data.componentBrandUtils[type], 
                item
              );
            } else {
              brand = this.data.componentBrandUtils.common.extractBrand.call(
                this.data.componentBrandUtils.common, 
                item, 
                type
              );
            }
            
            // CPU品牌标准化
            if (type === 'cpu') {
              if (brand && brand.toLowerCase() === 'intel') {
                brand = '英特尔';
              } else if (brand && brand.toLowerCase() === 'amd') {
                brand = 'AMD';
              }
            }
            
            // 跳过空品牌
            if (!brand || brand.trim() === '') return;
            
            // 记录品牌出现次数
            brandMap[brand] = (brandMap[brand] || 0) + 1;
          } catch (err) {
            console.error(`处理${type}组件品牌提取时出错:`, err, item);
            // 尝试直接获取品牌字段作为备选方案
            let fallbackBrand;
            if (type === 'motherboard') {
              fallbackBrand = item.brand || '';
            } else if (type === 'cpu') {
              fallbackBrand = item.品牌 || item.brand || '';
              // CPU特殊处理
              if ((!fallbackBrand || fallbackBrand.trim() === '') && (item.名称 || item.name)) {
                const name = item.名称 || item.name || '';
                if (name.toLowerCase().includes('intel')) fallbackBrand = '英特尔';
                else if (name.toLowerCase().includes('amd')) fallbackBrand = 'AMD';
              }
      } else {
              fallbackBrand = item.品牌 || '';
            }
            
            if (fallbackBrand && fallbackBrand.trim() !== '') {
              brandMap[fallbackBrand] = (brandMap[fallbackBrand] || 0) + 1;
              debugLog(`使用备选品牌: ${fallbackBrand} 用于 ${type}`);
            }
          }
        });
        
        // 从映射中提取唯一品牌
        const uniqueBrands = Object.keys(brandMap);
        
        // 按字母顺序排序
        uniqueBrands.sort();
        
        // 输出品牌统计信息
        debugLog(`${type}品牌统计:`, brandMap);
        
        // 设置该组件类型的品牌选项
        brandOptions[type] = uniqueBrands;
        
        debugLog(`${type}组件品牌列表 (共${uniqueBrands.length}个):`, uniqueBrands);
        
        // 特别处理CPU类型，确保至少有英特尔和AMD两个选项
        if (type === 'cpu' && uniqueBrands.length < 2) {
          debugLog('CPU品牌列表不完整，添加默认品牌');
          const defaultCpuBrands = ['英特尔', 'AMD'];
          defaultCpuBrands.forEach(brand => {
            if (!brandOptions[type].includes(brand)) {
              brandOptions[type].push(brand);
            }
          });
          debugLog(`添加默认品牌后的CPU品牌列表:`, brandOptions[type]);
        }
        
        // 如果是CPU，确保品牌列表包含英特尔和AMD（使用中文名称）
        if (type === 'cpu') {
          if (!brandOptions[type].includes('英特尔') && !brandOptions[type].includes('Intel')) {
            brandOptions[type].push('英特尔');
          }
          if (!brandOptions[type].includes('AMD')) {
            brandOptions[type].push('AMD');
          }
          
          // 标准化Intel为英特尔
          const intelIndex = brandOptions[type].findIndex(b => b.toLowerCase() === 'intel');
          if (intelIndex !== -1) {
            brandOptions[type][intelIndex] = '英特尔';
          }
        }
      } catch (error) {
        console.error(`处理${type}组件品牌列表时出错:`, error);
        brandOptions[type] = []; // 出错时设置为空数组
        
        // 特别处理CPU类型，即使出错也确保有基本品牌
        if (type === 'cpu') {
          brandOptions[type] = ['英特尔', 'AMD'];
          debugLog('CPU品牌处理出错，使用默认品牌列表');
        }
      }
    });
    
    return brandOptions;
  },

  // 匹配品牌的函数
  matchBrand: function(brand, targetBrand) {
    if (!brand || !targetBrand) return false;
    
    const normalizedBrand = String(brand).toLowerCase();
    const normalizedTarget = String(targetBrand).toLowerCase();
    
    // 品牌别名映射
    const brandAliases = {
      '微星': ['msi', 'micro-star'],
      '华硕': ['asus', 'asustek'],
      '技嘉': ['gigabyte', 'aorus'],
      '英特尔': ['intel'],
      'amd': ['超威', 'radeon'],
      '七彩虹': ['colorful'],
      '影驰': ['galax'],
      '华擎': ['asrock'],
      '英伟达': ['nvidia', 'geforce', 'rtx', 'gtx'],
      '美商海盗船': ['corsair'],
      '海盗船': ['corsair'],
      '宇瞻': ['apacer'],
      '威刚': ['adata'],
      '金士顿': ['kingston'],
      '三星': ['samsung'],
      '西数': ['western digital', 'wd'],
      '希捷': ['seagate'],
      '安钛克': ['antec'],
      '航嘉': ['huntkey'],
      '鑫谷': ['segotep'],
      '酷冷至尊': ['cooler master'],
      '九州风神': ['deepcool'],
      '爱国者': ['aigo'],
      '振华': ['super flower'],
    };
    
    // 直接相等
    if (normalizedBrand === normalizedTarget) return true;
    
    // 检查别名
    if (brandAliases[normalizedTarget] && 
        brandAliases[normalizedTarget].some(alias => normalizedBrand.includes(alias))) {
      return true;
    }
    
    // 检查包含关系
    if (normalizedBrand.includes(normalizedTarget) || normalizedTarget.includes(normalizedBrand)) {
      return true;
    }
    
    return false;
  },
  
  // 专门匹配CPU品牌的函数
  matchCpuBrand: function(cpuItem, targetBrand) {
    if (!cpuItem || !targetBrand) return false;
    
    // 从多个可能的字段中提取品牌信息
    const brand = (cpuItem.brand || '').toLowerCase();
    const name = (cpuItem.name || '').toLowerCase();
    const series = (cpuItem.series || '').toLowerCase();
    
    // 规范化目标品牌
    const normalizedTarget = String(targetBrand).toLowerCase();
    
    // AMD的特殊处理
    if (normalizedTarget === 'amd') {
      // 名称中包含AMD标识
      if (brand.includes('amd') || name.includes('amd') || 
          name.includes('ryzen') || name.includes('锐龙') || 
          series.includes('ryzen') || series.includes('锐龙') || 
          name.includes('athlon') || name.includes('速龙') ||
          name.includes('radeon') || name.includes('镭龙')) {
        return true;
      }
      
      // 型号特征识别
      if (/^(r3|r5|r7|r9)\s/.test(name) || 
          name.includes('3600') || name.includes('5600') || 
          name.includes('5800') || name.includes('5900') || 
          name.includes('5950') || name.includes('3900') || 
          name.includes('3950')) {
        return true;
      }
    }
    
    // 英特尔的特殊处理
    if (normalizedTarget === 'intel') {
      if (brand.includes('intel') || name.includes('intel') || 
          name.includes('酷睿') || name.includes('core') || 
          name.includes('奔腾') || name.includes('pentium') || 
          name.includes('赛扬') || name.includes('celeron') ||
          /i[3579]-\d{4,}/.test(name)) {
        return true;
      }
    }
    
    // 默认使用通用匹配方法
    return this.matchBrand(brand || name, targetBrand);
  },

  // 修改debugCpuData函数，使用新的匹配方法
  debugCpuData: function() {
    debugLog('===== CPU数据调试信息 =====');
    
    const allCpus = this.data.components?.cpu || [];
    debugLog(`总共加载了 ${allCpus.length} 个CPU`);
    
    if (allCpus.length === 0) {
      console.error('没有加载到任何CPU数据，请检查数据库连接和查询');
      return;
    }
    
    // 展示前5条原始数据以便调试
    debugLog('前5条CPU原始数据:', allCpus.slice(0, 5).map(cpu => ({
      id: cpu.id,
      name: cpu.name,
      brand: cpu.brand,
      原始品牌: cpu.原始品牌
    })));
    
    // 品牌统计
    const brandCount = {};
    const amdCpus = [];
    const intelCpus = [];
    const otherCpus = [];
    
    allCpus.forEach(cpu => {
      // 统计品牌出现次数
      const brand = (cpu.brand || '').toLowerCase();
      brandCount[brand] = (brandCount[brand] || 0) + 1;
      
      // 按品牌分类
      if (brand === 'amd' || brand.includes('amd')) {
        amdCpus.push(cpu);
      } else if (brand === 'intel' || brand.includes('intel') || brand === 'inter') {
        intelCpus.push(cpu);
        } else {
        otherCpus.push(cpu);
      }
    });
    
    debugLog('品牌分布:', brandCount);
    debugLog(`检测到的AMD CPU数量: ${amdCpus.length}`);
    debugLog(`检测到的Intel CPU数量: ${intelCpus.length}`);
    debugLog(`未识别品牌CPU数量: ${otherCpus.length}`);
    
    // 样本展示
    if (amdCpus.length > 0) {
      debugLog('AMD CPU样本:', amdCpus.slice(0, 3).map(cpu => ({
        id: cpu.id,
        name: cpu.name,
        brand: cpu.brand
      })));
    } else {
      debugLog('未检测到AMD CPU! 请检查数据库或品牌字段设置');
      
      // 检查是否有名称中含AMD却没有正确品牌的CPU
      const potentialAmd = allCpus.filter(cpu => 
        (cpu.name || '').toLowerCase().includes('amd') || 
        (cpu.name || '').toLowerCase().includes('ryzen') ||
        (cpu.name || '').toLowerCase().includes('锐龙')
      );
      
      if (potentialAmd.length > 0) {
        debugLog('发现可能的AMD CPU，但品牌字段不是AMD:', potentialAmd.slice(0, 3));
      }
    }
    
    if (intelCpus.length > 0) {
      debugLog('Intel CPU样本:', intelCpus.slice(0, 3).map(cpu => ({
        id: cpu.id,
        name: cpu.name,
        brand: cpu.brand
      })));
    }
    
    if (otherCpus.length > 0) {
      debugLog('其他CPU样本:', otherCpus.slice(0, 3).map(cpu => ({
        id: cpu.id,
        name: cpu.name,
        brand: cpu.brand
      })));
    }
    
    // 测试品牌选项生成
    debugLog('===== 品牌选项测试 =====');
    debugLog('CPU品牌选项:', this.data.brandOptions?.cpu || []);
    
    // 测试筛选
    if (amdCpus.length > 0) {
      debugLog('AMD筛选应该可以正常工作');
      } else {
      debugLog('警告: 没有AMD数据，筛选可能会显示空结果');
    }
    
    debugLog('===== CPU调试结束 =====');
  },
  
  /**
   * 切换品牌列表折叠状态
   */
  toggleBrandFold: function() {
    this.setData({
      brandFolded: !this.data.brandFolded,
      showAllBrands: false  // 重置展开全部
    });
  },

  /**
   * 切换显示所有品牌
   */
  toggleShowAllBrands: function() {
    this.setData({
      showAllBrands: !this.data.showAllBrands
      });
  },

  /**
   * 切换显示更多规格信息
   */
  toggleSpecDetail: function(e) {
    const id = e.currentTarget.dataset.id;
    debugLog(`[数据追踪] 切换参数显示: ${id}`);
    
    // 查找对应的组件索引
    const index = this.data.filteredComponents.findIndex(item => item.id === id);
    if (index < 0) {
      console.error(`[数据追踪] 未找到ID为${id}的组件`);
      return;
    }
    
    // 切换显示状态
    const newState = !this.data.filteredComponents[index].showMoreSpecs;
    
    // 更新组件数据
    this.setData({
      [`filteredComponents[${index}].showMoreSpecs`]: newState
    });
  },
  
  /**
   * 切换兼容性过滤开关
   */
  toggleCompatibilityFilter: function(e) {
    const isChecked = e.detail.value;
    debugLog(`[兼容性过滤] 切换状态: ${isChecked}`);
    
    // 确保UI状态更新
        this.setData({
      onlyShowCompatible: isChecked
    });
    
    // 根据开关状态应用不同的过滤方式
    if (isChecked) {
      this.applyCompatibilityFilter();
    } else {
      // 如果关闭了兼容性过滤，恢复原始过滤方式
          this.filterComponents();
        }
  },

  /**
   * 排序GPU规格，将重要参数排在前面
   * @param {Array} specs - 规格数组
   * @return {Array} - 排序后的规格数组
   */
  sortGpuSpecs: function(specs) {
    if (!specs || !Array.isArray(specs)) return specs;
    
    // 核心参数优先级映射（更全面的关键词列表）
    const priorityMap = {
      // 核心参数 (90-100)
      '显存': 100,
      '显存大小': 100,
      '显存容量': 100,
      'VRAM': 100,
      '内存': 100,
      'Memory': 100,
      'Memory Size': 100,
      
      '显存类型': 95,
      '显存颗粒': 95,
      'GDDR': 95,
      'HBM': 95,
      'Memory Type': 95,
      
      '核心频率': 90,
      '基础频率': 90,
      '频率': 90,
      'Clock': 90,
      'Core Clock': 90,
      
      // 重要技术参数 (70-89)
      '显存频率': 85,
      'Memory Clock': 85,
      '加速频率': 84,
      '超频频率': 84,
      '最大频率': 84,
      'Boost Clock': 84,
      
      '功耗': 80,
      '额定功率': 80,
      '温度': 80,
      'TDP': 80,
      'Power': 80,
      'Wattage': 80,
      '能耗': 80,
      
      '位宽': 78,
      '总线宽度': 78,
      'Bus Width': 78,
      'Memory Bus': 78,
      '内存位宽': 78,
      
      '流处理器': 75, 
      '流处理单元': 75,
      'CUDA核心': 75,
      'CUDA': 75,
      'CUDA Cores': 75,
      'Stream Processors': 75,
      
      // 物理和连接参数 (50-69)
      '接口': 65,
      '总线': 65,
      '插槽': 65,
      'Interface': 65,
      'PCIe': 65,
      'PCI Express': 65,
      
      '供电接口': 60,
      '电源接口': 60,
      '供电需求': 60,
      'Power Connector': 60,
      '供电': 60,
      
      '散热': 55,
      '散热方式': 55,
      '风扇': 55,
      'Cooling': 55,
      'Fan': 55,
      
      '长度': 50,
      '厚度': 50,
      '高度': 50,
      '尺寸': 50,
      'Length': 50,
      'Size': 50,
      'Dimensions': 50,
      
      // 其他参数 (10-49)
      '光追核心': 45,
      'RT Cores': 45,
      '光线追踪': 45,
      
      'AI核心': 44,
      'Tensor核心': 44,
      'AI计算': 44,
      
      '工艺': 40,
      '制程': 40,
      'Process': 40,
      'Technology': 40,
      
      '显示输出': 35,
      '接口数量': 35,
      'Outputs': 35,
      'Display Ports': 35,
      'HDMI': 35,
      
      '发布日期': 30,
      '上市时间': 30,
      'Release Date': 30,
      
      '架构': 25,
      '显卡架构': 25,
      'Architecture': 25
    };
    
    // 获取优先级的函数，支持多种匹配方式
    const getPriority = (label) => {
      // 标准化标签：转小写并去除空格
      const normalizedLabel = label.toLowerCase().trim();
      
      // 1. 精确匹配
      if (priorityMap[label] !== undefined) {
        return priorityMap[label];
      }
      
      // 2. 忽略大小写的精确匹配
      for (const [key, value] of Object.entries(priorityMap)) {
        if (key.toLowerCase() === normalizedLabel) {
          return value;
        }
      }
      
      // 3. 关键词包含匹配
      for (const [key, value] of Object.entries(priorityMap)) {
        // 标签包含关键词
        if (normalizedLabel.includes(key.toLowerCase())) {
          return value - 3; // 稍微降低优先级
        }
        
        // 关键词包含标签
        if (key.toLowerCase().includes(normalizedLabel)) {
          return value - 5; // 更低的优先级
        }
      }
      
      // 4. 某些特定类别的智能识别
      if (/显存|内存|memory|vram|gddr|ddr|g\d+d|hbm|gb\b/i.test(normalizedLabel)) {
        return 85; // 显存相关
      }
      
      if (/频率|clock|hz|mhz|ghz|性能|速度/i.test(normalizedLabel)) {
        return 80; // 频率相关
      }
      
      if (/功率|功耗|耗电量|power|watt|tdp|能耗|发热/i.test(normalizedLabel)) {
        return 75; // 功耗相关
      }
      
      if (/接口|interface|pcie|pci-e|pci|slot|插槽|总线/i.test(normalizedLabel)) {
        return 60; // 接口相关
      }
      
      if (/尺寸|大小|长度|宽度|厚度|height|width|length|size/i.test(normalizedLabel)) {
        return 45; // 尺寸相关
      }
      
      if (/电源|供电|pin|针|power supply|power connector/i.test(normalizedLabel)) {
        return 55; // 供电相关
      }
      
      // 未匹配到任何关键词，较低优先级
      return 0;
    };
    
    // 排序规格
    return [...specs].sort((a, b) => {
      const labelA = a.label || '';
      const labelB = b.label || '';
      
      const priorityA = getPriority(labelA);
      const priorityB = getPriority(labelB);
      
      // 主排序：优先级
      if (priorityA !== priorityB) {
        return priorityB - priorityA;
      }
      
      // 次排序：标签长度（相同优先级下，短标签优先）
      return labelA.length - labelB.length;
      });
  },
  
  /**
   * 将前端组件类型映射为云函数期望的类型
   * 确保前端与云函数在组件类型命名上保持一致
   */
  mapComponentType: function(type) {
    // 组件类型名称映射表
    const typeMapping = {
      'ram': 'memory',   // 内存在云函数中使用'memory'
      'case': 'case',    // 保持一致的映射
      'psu': 'power',    // 电源可能在云函数中为'power'
      'cooling': 'cooler', // 散热器可能在云函数中为'cooler'
      'storage': 'disk'   // 存储在云函数中可能为'disk'
    };
    
    // 如果有对应的映射，返回映射值，否则返回原值
    return typeMapping[type] || type;
  },
  
  /**
   * 调试兼容性过滤状态
   */
  debugCompatibilityFilter: function() {
    debugLog('====== 兼容性过滤调试信息 ======');
    debugLog(`当前组件类型: ${this.data.currentComponent}`);
    debugLog(`兼容性过滤状态: ${this.data.onlyShowCompatible ? '已开启' : '已关闭'}`);
    debugLog(`当前品牌: ${this.data.currentBrand}`);
    debugLog(`当前价格: ${this.data.currentPrice}`);
    debugLog(`已选组件数量: ${Object.keys(this.data.selectedItems).length}`);
    
    if (this.data.selectedItems && Object.keys(this.data.selectedItems).length > 0) {
      debugLog('已选组件列表:');
      Object.keys(this.data.selectedItems).forEach(type => {
        const item = this.data.selectedItems[type];
        if (item) {
          debugLog(`- ${type}: ${item.name} (ID: ${item.id})`);
        }
      });
    } else {
      debugLog('没有选择任何组件');
    }
    
    debugLog(`当前显示组件数量: ${this.data.filteredComponentsCount}`);
    debugLog('===============================');
    
    // 返回状态供调用者使用
    return {
      componentType: this.data.currentComponent,
      isCompatibilityFilterOn: this.data.onlyShowCompatible,
      brand: this.data.currentBrand,
      price: this.data.currentPrice,
      selectedItemsCount: Object.keys(this.data.selectedItems).length,
      filteredComponentsCount: this.data.filteredComponentsCount
    };
  },

  /**
   * 提取组件品牌列表
   * @param {string} componentType - 组件类型
   * @param {Array} componentsData - 组件数据
   */
  extractBrands: function(componentType, componentsData) {
    debugLog(`[数据追踪] 提取${componentType}品牌列表`);
    
    if (!componentsData || componentsData.length === 0) {
      debugLog(`[数据追踪] 组件数据为空，无法提取品牌`);
      this.setData({
        [`brandOptions.${componentType}`]: []
      });
      return;
    }
    
    // 提取所有可能的品牌
    const brands = componentsData
      .map(item => item.brand || '')
      .filter(brand => brand && brand.trim() !== '')  // 过滤掉空品牌
      .map(brand => brand.trim());                    // 清理空格
    
    // 统计每个品牌的出现次数
    const brandCount = {};
    brands.forEach(brand => {
      const lowerBrand = brand.toLowerCase();
      brandCount[lowerBrand] = (brandCount[lowerBrand] || 0) + 1;
    });
    
    // 获取唯一品牌列表，并按出现频率排序
    const uniqueBrands = [...new Set(brands)]
      .sort((a, b) => {
        const countA = brandCount[a.toLowerCase()] || 0;
        const countB = brandCount[b.toLowerCase()] || 0;
        return countB - countA;  // 降序排列
      });
    
    debugLog(`[数据追踪] 发现${uniqueBrands.length}个品牌`);
    
    // 更新品牌选项
    this.setData({
      [`brandOptions.${componentType}`]: uniqueBrands
    });
  },

  /**
   * 应用兼容性过滤
   */
  applyCompatibilityFilter: function() {
    // 如果没有选择任何组件，即使开启了兼容性过滤，也返回所有组件
    if (!this.data.selectedItems || Object.keys(this.data.selectedItems).length === 0) {
      debugLog('[兼容性过滤] 没有选择任何组件，显示所有组件');
      this.filterComponents(true); // 使用普通过滤，传入true跳过兼容性检查
      return;
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '筛选兼容组件...',
      mask: true
    });
    
    // 设置超时保护，防止长时间卡死
    const timeoutId = setTimeout(() => {
      debugLog('[兼容性过滤:前端] 筛选超时，显示所有结果');
      wx.hideLoading();
      wx.showToast({
        title: '筛选超时，显示所有结果',
        icon: 'none',
        duration: 2000
      });
      // 取消兼容性过滤，显示所有组件，传入true避免循环调用
      this.filterComponents(true);
    }, 3000); // 3秒超时
    
    debugLog('[兼容性过滤:前端] 开始前端兼容性筛选');
    
    try {
      // 获取当前组件类型
      const componentType = this.data.currentComponent;
      
      // 获取当前组件类型的所有组件（考虑已经应用的品牌和价格筛选）
      let components = this.data.components[componentType] || [];
      
      // 首先应用品牌和价格筛选（保持这部分逻辑不变）
      if (this.data.currentBrand !== 'all') {
        components = this.filterComponentsByBrand(components, this.data.currentBrand);
      }
      
      if (this.data.currentPrice !== 'all') {
        components = this.filterComponentsByPrice(components, this.data.currentPrice);
      }
      
      // 应用散热类型筛选
      if (this.data.currentComponent === 'cooling' && this.data.currentCoolingType !== 'all') {
        components = this.filterComponentsByCoolingType(components, this.data.currentCoolingType);
      }
      
      debugLog(`[兼容性过滤:前端] 应用品牌、价格和类型筛选后，剩余${components.length}个组件`);
      
      // 改用异步处理以防止UI卡死
      // 将筛选操作放到下一个事件循环中
      setTimeout(() => {
        try {
          // 清除超时计时器
          clearTimeout(timeoutId);
          
          // 使用已选组件进行兼容性筛选
          const selectedItems = this.data.selectedItems;
          
          // 性能优化：将处理的组件数量上限改为非常大的值
          const MAX_COMPONENTS_TO_PROCESS = 10000;
          if (components.length > MAX_COMPONENTS_TO_PROCESS) {
            debugLog(`[兼容性过滤:前端] 组件数量(${components.length})超过限制，只处理前${MAX_COMPONENTS_TO_PROCESS}个`);
            components = components.slice(0, MAX_COMPONENTS_TO_PROCESS);
          }
          
          // 简化的兼容性检查，直接比较关键字段
          const compatibleComponents = components.filter(component => {
            // CPU与主板兼容性检查
            if (componentType === 'motherboard' && selectedItems.cpu) {
              // 同时检查socket和接口字段，确保不会漏掉有效值
              const cpuSocket = selectedItems.cpu.接口 || selectedItems.cpu.socket || '';
              const mbSocket = component.接口 || component.socket || '';
              
              // 规范化接口字符串（去除空格，转换为大写），确保格式一致
              const normCpuSocket = cpuSocket.replace(/\s+/g, '').toUpperCase();
              const normMbSocket = mbSocket.replace(/\s+/g, '').toUpperCase();
              
              debugLog(`[CPU-主板兼容性检查] CPU: ${selectedItems.cpu.名称 || selectedItems.cpu.name}, 接口: ${cpuSocket} [标准化:${normCpuSocket}], 主板: ${component.名称 || component.name}, 接口: ${mbSocket} [标准化:${normMbSocket}]`);
              
              if (normCpuSocket && normMbSocket && normCpuSocket !== normMbSocket) {
                debugLog(`[CPU-主板兼容性检查] 不兼容: ${normCpuSocket} !== ${normMbSocket}`);
                return false;
              } else if (!normCpuSocket || !normMbSocket) {
                debugLog(`[CPU-主板兼容性检查] 缺少必要信息，跳过兼容性检查: cpuSocket=${normCpuSocket}, mbSocket=${normMbSocket}`);
              } else {
                debugLog(`[CPU-主板兼容性检查] 兼容: ${normCpuSocket} === ${normMbSocket}`);
              }
            }
            
            // 反向检查：主板与CPU兼容性
            if (componentType === 'cpu' && selectedItems.motherboard) {
              // 同时检查socket和接口字段，确保不会漏掉有效值
              const cpuSocket = component.接口 || component.socket || '';
              const mbSocket = selectedItems.motherboard.接口 || selectedItems.motherboard.socket || '';
              
              // 规范化接口字符串（去除空格，转换为大写），确保格式一致
              const normCpuSocket = cpuSocket.replace(/\s+/g, '').toUpperCase();
              const normMbSocket = mbSocket.replace(/\s+/g, '').toUpperCase();
              
              debugLog(`[主板-CPU兼容性检查] CPU: ${component.名称 || component.name}, 接口: ${cpuSocket} [标准化:${normCpuSocket}], 主板: ${selectedItems.motherboard.名称 || selectedItems.motherboard.name}, 接口: ${mbSocket} [标准化:${normMbSocket}]`);
              
              if (normCpuSocket && normMbSocket && normCpuSocket !== normMbSocket) {
                debugLog(`[主板-CPU兼容性检查] 不兼容: ${normCpuSocket} !== ${normMbSocket}`);
                return false;
              } else if (!normCpuSocket || !normMbSocket) {
                debugLog(`[主板-CPU兼容性检查] 缺少必要信息，跳过兼容性检查: cpuSocket=${normCpuSocket}, mbSocket=${normMbSocket}`);
              } else {
                debugLog(`[主板-CPU兼容性检查] 兼容: ${normCpuSocket} === ${normMbSocket}`);
              }
            }
            
            // 内存与主板兼容性检查
            if ((componentType === 'ram' || componentType === 'memory') && selectedItems.motherboard) {
              // 直接获取内存接口类型
              const ramType = component.接口类型 || '';
              
              // 从主板的内存插槽字段中提取内存类型部分
              let mbMemoryType = '';
              if (selectedItems.motherboard.内存插槽) {
                // 使用更灵活的正则表达式匹配各种格式："4*D5", "4×D5", "4 x D5"等
                const memSlotMatch = selectedItems.motherboard.内存插槽.match(/\d+\s*[\*×xX]\s*([DdRr]\d+)/);
                if (memSlotMatch) {
                  mbMemoryType = memSlotMatch[1].toUpperCase();
                }
              }
              
              // 输出详细调试信息
              debugLog(`[内存兼容性检查-详细] 内存数据:`, {
                名称: component.名称 || component.name,
                接口类型: ramType,
                完整对象: JSON.stringify(component).substring(0, 100) + '...'
              });
              
              debugLog(`[内存兼容性检查-详细] 主板数据:`, {
                名称: selectedItems.motherboard.名称 || selectedItems.motherboard.name,
                内存插槽: selectedItems.motherboard.内存插槽,
                提取类型: mbMemoryType,
                完整对象: JSON.stringify(selectedItems.motherboard).substring(0, 100) + '...'
              });
              
              // 如果没有提取到主板内存类型，尝试其他可能的字段
              if (!mbMemoryType) {
                debugLog(`[内存兼容性检查-警告] 无法从内存插槽"${selectedItems.motherboard.内存插槽}"提取内存类型，尝试其他可能的字段`);
                
                // 直接尝试memoryType字段（如果存在）
                if (selectedItems.motherboard.memoryType) {
                  mbMemoryType = selectedItems.motherboard.memoryType.toUpperCase();
                  debugLog(`[内存兼容性检查] 使用memoryType字段: ${mbMemoryType}`);
                }
              }
              
              debugLog(`[内存兼容性检查] 最终比较: 内存接口类型(${ramType}) vs 主板内存类型(${mbMemoryType})`);
              
              // 只有当两者都有值且不相等时，才判定为不兼容
              if (ramType && mbMemoryType && ramType !== mbMemoryType) {
                debugLog(`[内存兼容性检查] 不兼容: ${ramType} !== ${mbMemoryType}`);
                return false;
              } else if (!ramType || !mbMemoryType) {
                debugLog(`[内存兼容性检查-警告] 缺少必要信息，跳过兼容性检查: ramType=${ramType}, mbMemoryType=${mbMemoryType}`);
              } else {
                debugLog(`[内存兼容性检查] 兼容: ${ramType} === ${mbMemoryType}`);
              }
            }
            
            // 所有兼容性检查通过
            return true;
          });
          
          debugLog(`[兼容性过滤:前端] 兼容性筛选后，剩余${compatibleComponents.length}个组件`);
          
          // 确保已选择的当前类型组件（如果有）排在列表最前面
          const currentType = this.data.currentComponent;
          const selectedItem = this.data.selectedItems[currentType];
          
          if (selectedItem) {
            debugLog(`[兼容性过滤:前端] 发现已选择的${currentType}组件，将其排在列表最前面`);
            
            // 从兼容性筛选结果中移除已选择的组件（如果存在于筛选结果中）
            const selectedItemIndex = compatibleComponents.findIndex(item => item.id === selectedItem.id);
            if (selectedItemIndex >= 0) {
              const selectedItemInList = compatibleComponents.splice(selectedItemIndex, 1)[0];
              
              // 将已选择的组件添加到列表最前面
              compatibleComponents.unshift(selectedItemInList);
              
              debugLog(`[兼容性过滤:前端] 已将选择的组件移到列表第一位`);
            } else {
              debugLog(`[兼容性过滤:前端] 已选择的组件不在兼容性筛选结果中`);
            }
          }
          
          // 更新显示的组件列表 - 同时更新allFilteredComponents
          this.setData({
            filteredComponents: compatibleComponents,
            allFilteredComponents: compatibleComponents, // 添加这行，确保价格排序使用相同的数据
            filteredComponentsCount: compatibleComponents.length,
            hasMoreComponents: compatibleComponents.length > this.data.displayedCount
          });
          
          wx.hideLoading();
          
          // 显示过滤结果
          if (compatibleComponents.length === 0) {
            wx.showToast({
              title: '没有找到兼容组件',
              icon: 'none',
              duration: 2000
            });
          } else {
            wx.showToast({
              title: `找到${compatibleComponents.length}个兼容组件`,
              icon: 'success',
              duration: 1500
            });
          }
        } catch (err) {
          clearTimeout(timeoutId);
          wx.hideLoading();
          console.error('[兼容性过滤:前端] 前端兼容性筛选出错:', err);
          console.error('[兼容性过滤:前端] 错误堆栈:', err.stack);
          
          wx.showToast({
            title: '兼容性筛选出错',
            icon: 'none',
            duration: 2000
          });
          
          // 出错时回退到普通筛选，传入true避免循环调用
          this.filterComponents(true);
        }
      }, 0); // 放到下一个事件循环中执行
    } catch (err) {
      clearTimeout(timeoutId);
      wx.hideLoading();
      console.error('[兼容性过滤:前端] 前端兼容性筛选出错:', err);
      console.error('[兼容性过滤:前端] 错误堆栈:', err.stack);
      
      wx.showToast({
        title: '兼容性筛选出错',
        icon: 'none',
        duration: 2000
      });
      
      // 出错时回退到普通筛选，传入true避免循环调用
      this.filterComponents(true);
    }
  },

  /**
   * 按品牌筛选组件（辅助函数）
   */
  filterComponentsByBrand: function(components, brand) {
    if (brand === 'all' || brand === '全部') return components;
    
    debugLog(`[品牌筛选] 开始筛选，目标品牌: ${brand}, 组件数量: ${components.length}`);
    
    // 使用简单直接的品牌匹配
    const result = components.filter(item => {
      // 从多个可能的字段中获取品牌
      const itemBrand = item.品牌 || item.brand || '';
      
      // 简单的精确匹配，不做复杂转换
      const match = itemBrand === brand;
      
      if (match && this.data.currentComponent === 'cpu') {
        debugLog(`[品牌筛选] 匹配到CPU: ${item.名称 || item.name}, 品牌: ${itemBrand}`);
      }
      
      return match;
    });
    
    debugLog(`[品牌筛选] 结果数量: ${result.length}`);
    return result;
  },
  
  /**
   * 按价格筛选组件（辅助函数）
   */
  filterComponentsByPrice: function(components, priceRange) {
    if (priceRange === 'all') return components;
    
    // 根据组件类型确定价格范围
    const priceRanges = {
      'cpu': { low: [0, 1500], medium: [1500, 3000], high: [3000, Infinity] },
      'motherboard': { low: [0, 1000], medium: [1000, 2000], high: [2000, Infinity] },
      'ram': { low: [0, 500], medium: [500, 1000], high: [1000, Infinity] },
      'gpu': { low: [0, 2000], medium: [2000, 4000], high: [4000, Infinity] },
      'storage': { low: [0, 500], medium: [500, 1000], high: [1000, Infinity] },
      'psu': { low: [0, 500], medium: [500, 1000], high: [1000, Infinity] },
      'case': { low: [0, 300], medium: [300, 800], high: [800, Infinity] },
      'cooling': { low: [0, 200], medium: [200, 500], high: [500, Infinity] },
      'monitor': { low: [0, 1000], medium: [1000, 2500], high: [2500, Infinity] }
    };
    
    const componentType = this.data.currentComponent;
    const ranges = priceRanges[componentType] || { low: [0, 1000], medium: [1000, 2000], high: [2000, Infinity] };
    const range = ranges[priceRange];
    
    if (!range) return components;
    
    return components.filter(item => {
      const price = parseFloat(item.price || item['价格'] || 0);
      return price >= range[0] && price < range[1];
    });
  },

  /**
   * 按价格排序组件（辅助函数）
   * @param {Array} components 要排序的组件数组
   * @param {String} order 排序顺序：'asc'升序(从低到高)，'desc'降序(从高到低)
   * @param {String} selectedId 已选中组件的ID（可选，如果提供则将其置顶）
   * @returns {Array} 排序后的组件数组
   */
  sortComponentsByPrice: function(components, order = 'asc', selectedId = null) {
    debugLog(`[价格排序] 开始排序，组件数量: ${components.length}, 顺序: ${order}, 选中ID: ${selectedId || '无'}`);
    
    if (!components || components.length === 0) return [];
    
    // 如果有选中的组件，先将其分离出来
    let selectedComponent = null;
    let otherComponents = components;
    
    if (selectedId) {
      const selectedIndex = components.findIndex(item => item.id === selectedId);
      if (selectedIndex >= 0) {
        selectedComponent = components[selectedIndex];
        otherComponents = components.filter(item => item.id !== selectedId);
        debugLog(`[价格排序] 已分离选中组件: ${selectedComponent.名称 || selectedComponent.name}`);
      }
    }
    
    // 对其他组件按价格排序
    const sortedComponents = [...otherComponents].sort((a, b) => {
      // 获取价格，优先使用中文字段名
      const priceA = parseFloat(a.价格 || a.price || 0);
      const priceB = parseFloat(b.价格 || b.price || 0);
      
      // 根据排序顺序返回比较结果
      return order === 'asc' ? priceA - priceB : priceB - priceA;
    });
    
    debugLog(`[价格排序] 排序完成`);
    
    // 如果有选中组件，将其放在最前面
    if (selectedComponent) {
      return [selectedComponent, ...sortedComponents];
    }
    
    return sortedComponents;
  },

  /**
   * 应用价格排序
   * @param {Object} e 事件对象
   */
  applyPriceSort: function(e) {
    const order = e.currentTarget.dataset.order || 'asc';
    
    debugLog(`[价格排序] 应用价格排序，顺序: ${order}`);
    
    // 记录当前的排序顺序
    this.setData({
      currentPriceSort: order
    });
    
    // 获取当前筛选后的组件列表
    const components = this.data.allFilteredComponents || [];
    
    // 获取已选组件ID（如果有）
    const selectedItem = this.data.selectedItems[this.data.currentComponent];
    const selectedId = selectedItem ? selectedItem.id : null;
    
    // 进行排序
    const sortedComponents = this.sortComponentsByPrice(components, order, selectedId);
    
    // 保存完整的排序结果
    const totalCount = sortedComponents.length;
    
    // 只显示前N条
    const displayItems = sortedComponents.slice(0, this.data.displayedCount);
    
    // 更新UI
    this.setData({
      allFilteredComponents: sortedComponents,
      filteredComponents: displayItems,
      filteredComponentsCount: totalCount,
      hasMoreComponents: totalCount > this.data.displayedCount
    });
    
    wx.showToast({
      title: order === 'asc' ? '已按价格从低到高排序' : '已按价格从高到低排序',
      icon: 'none',
      duration: 1500
    });
  },

  /**
   * 取消选择组件
   * @param {Object} e 事件对象
   */
  cancelSelection: function(e) {
    const componentType = e.currentTarget.dataset.type;
    const itemId = e.currentTarget.dataset.id;
    
    debugLog(`[组件选择] 取消选择${componentType}组件，ID: ${itemId}`);
    
    // 检查是否已经选择了该组件
    const selectedItem = this.data.selectedItems[componentType];
    if (!selectedItem || selectedItem.id !== itemId) {
      debugLog('[组件选择] 未找到要取消的组件，可能已被取消');
      return;
    }
    
    // 创建一个新的selectedItems对象，删除对应类型
    const newSelectedItems = {...this.data.selectedItems};
    delete newSelectedItems[componentType];
    
    this.setData({
      selectedItems: newSelectedItems
    });
    
    // 重新计算总价
    this.calculateTotalPrice();
    
    // 显示取消选择提示
    wx.showToast({
      title: '已取消选择',
      icon: 'success',
      duration: 1000
    });
    
    // 应用筛选逻辑，根据是否还有已选组件自动选择合适的筛选方式
    this.filterComponents();
  },

  // 分享配置按钮点击事件
  shareConfig: function() {
    // 跳转到配置预览页面
    const tempConfig = {
      components: this.data.selectedItems,
      totalPrice: this.data.totalPrice,
      name: this.data.configName || '我的电脑配置'
    };
    
    // 保存到全局变量
    app.globalData.tempConfig = tempConfig;
    
    // 跳转到预览页面
    wx.navigateTo({
      url: '/pages/configPreview/configPreview',
      fail: (err) => {
        console.error('[数据追踪] 跳转预览页面失败:', err);
        
        // 提示页面不存在
        wx.showToast({
          title: '预览功能正在开发中',
          icon: 'none',
          duration: 2000
        });
      }
    });
  },
  
  // 保存配置到云数据库 - 仅限内部调用
  saveToCloud: function(callback) {
    wx.showLoading({
      title: '准备分享...',
    });
    
    // 字段映射处理 - 确保本地与云端使用相同的字段名
    const fieldMapping = {
      // 本地字段名: 云端字段名
      'ram': 'memory',
      'psu': 'powerSupply',
      'storage': 'ssd', // 默认存储视为SSD
    };
    
    // 准备要保存的配置数据
    const selectedItems = this.data.selectedItems;
    const configComponents = {};
    
    // 处理每个选中的组件，转换字段名并处理数量和价格
    Object.keys(selectedItems).forEach(componentType => {
      const component = selectedItems[componentType];
      if (!component) return;
      
      // 跳过空组件
      if (!component.id && !component._id) return;
      
      // 获取云端对应的字段名
      const cloudFieldName = fieldMapping[componentType] || componentType;
      
      // 复制组件数据
      const componentData = {...component};
      
      // 确保价格字段存在
      if (!componentData.price && componentData['价格']) {
        componentData.price = componentData['价格'];
      }
      
      // 处理组件数量和价格
      if (componentData.quantity && componentData.quantity > 1) {
        // 如果有数量字段，记录单价和总价
        componentData.unitPrice = componentData.price;
        componentData.totalPrice = parseFloat(componentData.price) * componentData.quantity;
      }
      
      // 保存到正确的字段
      configComponents[cloudFieldName] = componentData;
    });
    
    // 特殊处理存储设备 - 如果storage是HDD类型，则将其保存为hdd而非ssd
    if (selectedItems.storage && selectedItems.storage.type === 'hdd') {
      configComponents.hdd = configComponents.ssd;
      delete configComponents.ssd;
    }
    
    // 确保caseFan正确保存 - 特别关注机箱散热组件
    if (selectedItems.caseFan) {
      console.log('保存机箱散热组件:', selectedItems.caseFan);
      configComponents.caseFan = selectedItems.caseFan;
    }
    
    console.log('准备保存的组件:', configComponents);
    
    // 要保存的完整配置
    const configToSave = {
      // 统一格式：将组件放在components对象下
      components: configComponents,
      // 添加配置信息
      title: this.data.configName || '我的电脑配置',
      totalPrice: this.data.totalPrice,
      createdAt: new Date(),
      updateTime: new Date()
    };
    
    console.log('最终保存的配置数据:', configToSave);
    
    // 调用云函数保存配置
    wx.cloud.callFunction({
      name: 'saveConfig',
      data: {
        config: configToSave
      },
      success: res => {
        wx.hideLoading();
        console.log('保存配置结果:', res);
        if (res.result && res.result.success) {
          this.setData({
            configId: res.result.configId
          });
          
          if (callback) callback();
        } else {
          wx.showToast({
            title: '保存配置失败',
            icon: 'none'
          });
        }
      },
      fail: err => {
        console.error('保存配置失败:', err);
        wx.hideLoading();
        wx.showToast({
          title: '保存失败',
          icon: 'none'
        });
      }
    });
  },
  
  // 关闭分享弹窗
  closeShareModal: function() {
    this.setData({
      showShareModal: false
    });
  },
  
  // 分享给微信好友 - 改为跳转到配置预览页面
  shareToFriend: function() {
    this.shareConfig();
  },
  
  // 生成分享图片 - 改为跳转到配置预览页面
  generateShareImage: function() {
    this.shareConfig();
  },
  
  // 微信小程序分享接口
  onShareAppMessage: function() {
    // 保存当前配置到全局变量
    const tempConfig = {
      components: this.data.selectedItems,
      totalPrice: this.data.totalPrice,
      name: this.data.configName || '我的电脑配置'
    };
    
    // 保存到全局变量
    app.globalData.tempConfig = tempConfig;
    
    return {
      title: `我的电脑配置方案：¥${this.data.totalPrice}`,
      path: '/pages/configPreview/configPreview',
      imageUrl: '/images/share-bg.jpg'
    }
  },

  /**
   * 根据散热类型筛选组件
   */
  filterComponentsByCoolingType: function(components, coolingType) {
    if (coolingType === 'all') {
      coolingLog(`选择全部类型，不进行筛选，返回所有 ${components.length} 个组件`);
      return components;
    }
    
    coolingLog(`开始筛选，目标类型: ${coolingType}, 组件数量: ${components.length}`);
    
    // 记录组件的类型分布情况
    const typeCounts = { '风冷': 0, '水冷': 0, '其他': 0 };
    
    // 使用直接的类型匹配，不做复杂转换
    const result = components.filter(item => {
      // 从多个可能的字段中获取散热类型 - 添加对"散热形式"字段的支持
      const itemType = item.散热形式 || item.类型 || item.type || '';
      const itemName = item.名称 || item.name || '';
      
      coolingLog(`检查组件: ${itemName}, 散热形式: ${itemType}`);
      
      // 记录组件类型分布
      if (itemType === '风冷' || itemName.includes('风冷') || (itemName.includes('散热器') && !itemName.includes('水冷') && !itemName.includes('风扇'))) {
        typeCounts['风冷']++;
      } else if (itemType === '水冷' || itemName.includes('水冷') || itemName.includes('一体式') || itemName.includes('AIO')) {
        typeCounts['水冷']++;
      } else {
        typeCounts['其他']++;
      }
      
      // 风冷筛选
      if (coolingType === '风冷') {
        const matched = itemType === '风冷' || 
               itemName.includes('风冷') || 
               (itemName.includes('散热器') && !itemName.includes('水冷') && !itemName.includes('风扇'));
        
        if (matched) {
          coolingLog(`匹配风冷: ${itemName}, 类型: ${itemType}`);
        }
        return matched;
      } 
      // 水冷筛选
      else if (coolingType === '水冷') {
        const matched = itemType === '水冷' || 
               itemName.includes('水冷') || 
               itemName.includes('一体式') || 
               itemName.includes('AIO');
        
        if (matched) {
          coolingLog(`匹配水冷: ${itemName}, 类型: ${itemType}`);
        }
        return matched;
      }
      
      return false;
    });
    
    coolingLog(`组件类型分布: `, typeCounts);
    coolingLog(`筛选结果数量: ${result.length}/${components.length}`);
    
    debugLog(`[散热类型筛选] 结果数量: ${result.length}`);
    return result;
  },

  /**
   * 处理搜索输入
   */
  handleSearch: function(e) {
    // 更新搜索关键词
    const searchKeyword = e.detail.value;
    this.setData({ 
      searchKeyword: searchKeyword 
    });
    
    // 使用防抖，避免频繁搜索
    if (this.searchTimer) {
      clearTimeout(this.searchTimer);
    }
    
    this.searchTimer = setTimeout(() => {
      debugLog(`[搜索函数] 执行搜索, 关键词: ${searchKeyword}`);
      
      // 已经有对应的筛选功能，直接调用即可
      this.filterComponents();
    }, 300); // 300ms防抖
  },

  /**
   * 清除搜索内容
   */
  clearSearch: function() {
    this.setData({
      searchKeyword: ''
    });
    
    // 更新搜索结果（恢复原始筛选结果）
    this.filterComponents();
  },

  /**
   * 按关键词筛选组件（辅助函数）
   */
  filterComponentsByKeyword: function(components, keyword) {
    if (!keyword || keyword.trim() === '') return components;
    
    // 统一转小写并去除首尾空格，方便不区分大小写匹配
    const trimmedKeyword = keyword.trim().toLowerCase();
    debugLog(`[关键词筛选] 开始筛选，关键词: ${trimmedKeyword}, 组件数量: ${components.length}`);
    
    // 将关键词分割成多个部分，支持空格分隔的多关键词搜索
    const keywordParts = trimmedKeyword.split(/\s+/).filter(part => part.length > 0);
    
    // 如果没有有效关键词，返回原组件列表
    if (keywordParts.length === 0) return components;
    
    // 根据组件类型调整匹配逻辑
    const componentType = this.data.currentComponent;
    
    const result = components.filter(item => {
      // 所有关键词部分都必须匹配才返回true（AND逻辑）
      return keywordParts.every(keywordPart => {
        // 尝试从多个字段中匹配关键词
        
        // 1. 名称匹配
        const itemName = (item['名称'] || item.name || '').toLowerCase();
        if (itemName.includes(keywordPart)) return true;
        
        // 2. 品牌匹配
        const itemBrand = (item['品牌'] || item.brand || '').toLowerCase();
        if (itemBrand.includes(keywordPart)) return true;
        
        // 3. 型号匹配
        const itemModel = (item['型号'] || item.model || '').toLowerCase();
        if (itemModel.includes(keywordPart)) return true;
        
        // 4. 接口匹配（主要针对CPU、主板）
        const itemSocket = (item['接口'] || item.socket || '').toLowerCase();
        if (itemSocket.includes(keywordPart)) return true;
        
        // 5. 在规格列表中搜索
        if (item.specs && Array.isArray(item.specs)) {
          // 遍历所有规格项
          for (let i = 0; i < item.specs.length; i++) {
            const spec = item.specs[i];
            // 规格标签匹配
            if (spec.label && spec.label.toLowerCase().includes(keywordPart)) return true;
            // 规格值匹配
            if (spec.value && spec.value.toString().toLowerCase().includes(keywordPart)) return true;
          }
        }
        
        // 6. 组件特有字段匹配
        if (componentType === 'cpu') {
          // CPU特有字段
          const coreParts = [
            item['核心数'] || item.core_count || '',
            item['线程数'] || item.thread_count || '',
            item['频率'] || item.frequency || item.base_frequency || '',
            item['睿频'] || item.boost_frequency || '',
            item['缓存'] || item.cache || '',
            item['架构'] || item.architecture || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (coreParts.some(part => part.includes(keywordPart))) return true;
        }
        else if (componentType === 'motherboard') {
          // 主板特有字段
          const mbParts = [
            item['芯片组'] || item.chipset || '',
            item['板型'] || item.form_factor || item['尺寸(CM)'] || '',
            item['内存插槽'] || item.memory_slots || '',
            item['PCIe插槽'] || item['PCIe'] || item.pcie_slots || '',
            item['SATA接口'] || item['SATA'] || item.sata_ports || '',
            item['M.2接口'] || item['M2接口'] || item.m2_slots || '',
            item['USB接口'] || item.usb_ports || '',
            item['RGB'] || item.rgb_support || '',
            item['WiFi'] || item.wifi_support || '',
            item['蓝牙'] || item.bluetooth_support || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (mbParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理主板相关的关键词搜索
          // 检查关键词是否是常见主板芯片组名称
          const chipsetKeywords = ['z790', 'z690', 'z590', 'b760', 'b660', 'b550', 'x570'];
          if (chipsetKeywords.includes(keywordPart)) {
            // 查找芯片组名称中是否包含这个关键词
            const chipset = (item['芯片组'] || item.chipset || '').toLowerCase();
            if (chipset.includes(keywordPart)) return true;
          }
          
          // 检查关键词是否是内存类型相关
          const memoryKeywords = ['ddr4', 'ddr5', 'ddr3', 'd4', 'd5'];
          if (memoryKeywords.includes(keywordPart)) {
            // 查找内存插槽中是否包含这个关键词
            const memorySlots = (item['内存插槽'] || item.memory_slots || '').toLowerCase();
            if (memorySlots.includes(keywordPart)) return true;
          }
          
          // 检查关键词是否是板型相关
          const formFactorKeywords = ['atx', 'matx', 'm-atx', 'itx', 'mini-itx', 'eatx', 'e-atx'];
          if (formFactorKeywords.some(ff => keywordPart.includes(ff))) {
            // 查找板型中是否包含这个关键词
            const formFactor = (item['板型'] || item.form_factor || item['尺寸(CM)'] || '').toLowerCase();
            if (formFactor.includes(keywordPart)) return true;
          }
        }
        else if (componentType === 'ram' || componentType === 'memory') {
          // 内存特有字段
          const ramParts = [
            item['容量'] || item.capacity || '',
            item['接口类型'] || item.type || '',
            item['主频'] || item.frequency || '',
            item['时序'] || item.timing || '',
            item['电压'] || item.voltage || '',
            item['RGB'] || item.rgb || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (ramParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理内存容量搜索（如"16g"、"32gb"）
          if (/^\d+g(b)?$/.test(keywordPart)) {
            const capacitySearch = keywordPart.replace(/gb$/i, 'g').toLowerCase();
            const capacity = (item['容量'] || item.capacity || '').toLowerCase();
            if (capacity === capacitySearch || capacity.replace(/\s+/g, '') === capacitySearch) return true;
          }
          
          // 特别处理内存类型搜索（如"ddr4"、"ddr5"）
          const memoryTypes = ['ddr3', 'ddr4', 'ddr5', 'd3', 'd4', 'd5'];
          if (memoryTypes.includes(keywordPart)) {
            const interfaceType = (item['接口类型'] || item.type || '').toLowerCase();
            if (interfaceType.includes(keywordPart)) return true;
          }
        }
        else if (componentType === 'gpu') {
          // 显卡特有字段
          const gpuParts = [
            item['显存容量'] || item.memory || '',
            item['显存类型'] || item.memory_type || '',
            item['Boost频率'] || item.boost_clock || item.core_clock || '',
            item['接口'] || item.interface || '',
            item['功耗'] || item.tdp || item.power_consumption || '',
            item['系列'] || item.series || '',
            item['位宽'] || item.bus_width || '',
            item['长度'] || item.length || '',
            item['散热类型'] || item.cooling_type || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (gpuParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理显卡系列搜索
          const gpuSeries = ['rtx', 'gtx', 'rx', 'arc'];
          if (gpuSeries.some(series => keywordPart.includes(series))) {
            const series = (item['系列'] || item.series || '').toLowerCase();
            if (series.includes(keywordPart)) return true;
            
            // 也在名称中搜索系列信息，因为有些显卡系列信息包含在名称中
            if (itemName.includes(keywordPart)) return true;
          }
          
          // 特别处理显存容量搜索（如"8g"、"16gb"）
          if (/^\d+g(b)?$/.test(keywordPart)) {
            const memorySearch = keywordPart.replace(/gb$/i, 'g').toLowerCase();
            const memory = (item['显存容量'] || item.memory || '').toLowerCase();
            if (memory.includes(memorySearch)) return true;
          }
        }
        else if (componentType === 'storage') {
          // 存储设备特有字段
          const storageParts = [
            item['容量'] || item.capacity || '',
            item['接口'] || item.interface || '',
            item['类型'] || item.type || '',
            item['速率(读/写)MB/S'] || item.speed || '',
            item['缓存'] || item.cache || '',
            item['系列'] || item.series || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (storageParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理存储容量搜索
          if (/^\d+(g|t)(b)?$/.test(keywordPart)) {
            const capacitySearch = keywordPart.replace(/[gt]b$/i, match => match.charAt(0).toLowerCase()).toLowerCase();
            const capacity = (item['容量'] || item.capacity || '').toLowerCase();
            if (capacity.includes(capacitySearch)) return true;
          }
          
          // 特别处理存储接口类型搜索
          const interfaceTypes = ['sata', 'nvme', 'm.2', 'pcie', 'usb'];
          if (interfaceTypes.some(type => keywordPart.includes(type))) {
            const interfaceType = (item['接口'] || item.interface || '').toLowerCase();
            if (interfaceType.includes(keywordPart)) return true;
          }
          
          // 特别处理SSD/HDD类型搜索
          if (keywordPart === 'ssd' || keywordPart === 'hdd') {
            const type = (item['类型'] || item.type || '').toLowerCase();
            if (type.includes(keywordPart)) return true;
            // 也在名称中检查，因为有些存储设备在名称中标明类型
            if (itemName.includes(keywordPart)) return true;
          }
        }
        else if (componentType === 'psu') {
          // 电源特有字段
          const psuParts = [
            item['功率'] || item.wattage || item.power || '',
            item['80PLUS认证'] || item.certification || '',
            item['模组化'] || item.modularity || '',
            item['风扇尺寸'] || item.fan_size || '',
            item['保修'] || item.warranty || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (psuParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理电源功率搜索
          if (/^\d+w$/.test(keywordPart)) {
            const wattage = (item['功率'] || item.wattage || item.power || '').toLowerCase();
            if (wattage.includes(keywordPart)) return true;
          }
          
          // 特别处理电源认证搜索
          const certifications = ['白牌', '铜牌', '银牌', '金牌', '白金', '钛金', '80plus', 'bronze', 'silver', 'gold', 'platinum', 'titanium'];
          if (certifications.some(cert => keywordPart.includes(cert))) {
            const certification = (item['80PLUS认证'] || item.certification || '').toLowerCase();
            if (certification.includes(keywordPart)) return true;
          }
          
          // 特别处理模组化搜索
          if (keywordPart.includes('全模组') || keywordPart.includes('semi') || keywordPart.includes('非模组')) {
            const modularity = (item['模组化'] || item.modularity || '').toLowerCase();
            if (modularity.includes(keywordPart)) return true;
          }
        }
        else if (componentType === 'case') {
          // 机箱特有字段
          const caseParts = [
            item['板型'] || item.form_factor || '',
            item['尺寸'] || item.dimensions || '',
            item['风扇位'] || item.fan_slots || '',
            item['RGB'] || item.rgb || '',
            item['侧透'] || item.side_panel || '',
            item['前置IO'] || item.front_io || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (caseParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理机箱大小/板型搜索
          const formFactors = ['atx', 'matx', 'mitx', 'itx', 'eatx'];
          if (formFactors.some(ff => keywordPart.includes(ff))) {
            const formFactor = (item['板型'] || item.form_factor || '').toLowerCase();
            if (formFactor.includes(keywordPart)) return true;
          }
          
          // 特别处理侧透搜索
          if (keywordPart.includes('侧透') || keywordPart.includes('玻璃') || keywordPart.includes('glass')) {
            const sidePanel = (item['侧透'] || item.side_panel || '').toLowerCase();
            if (sidePanel.includes('透') || sidePanel.includes('玻璃') || sidePanel.includes('glass')) return true;
          }
        }
        else if (componentType === 'cooling' || componentType === 'caseFan') {
          // 散热器/风扇特有字段
          const coolingParts = [
            item['散热形式'] || item.type || '',
            item['风扇尺寸'] || item.fan_size || '',
            item['风扇数量'] || item.fan_count || '',
            item['转速'] || item.fan_speed || '',
            item['噪音'] || item.noise_level || '',
            item['RGB'] || item.rgb || '',
            item['散热片高度'] || item.height || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (coolingParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理散热器类型搜索
          if (keywordPart.includes('风冷') || keywordPart.includes('水冷') || keywordPart.includes('机箱风扇')) {
            const coolingType = (item['散热形式'] || item.type || '').toLowerCase();
            if (coolingType.includes(keywordPart)) return true;
            // 在名称中也检查
            if (itemName.includes(keywordPart)) return true;
          }
          
          // 特别处理风扇尺寸搜索
          if (/^\d+mm$/.test(keywordPart) || /^\d+厘米$/.test(keywordPart) || /^\d+cm$/.test(keywordPart)) {
            const fanSize = (item['风扇尺寸'] || item.fan_size || '').toLowerCase();
            if (fanSize.includes(keywordPart)) return true;
          }
          
          // 特别处理RGB搜索
          if (keywordPart.includes('rgb') || keywordPart.includes('灯')) {
            const rgb = (item['RGB'] || item.rgb || '').toLowerCase();
            if (rgb.includes('rgb') || rgb.includes('灯')) return true;
            // 在名称中也检查
            if (itemName.includes('rgb') || itemName.includes('灯')) return true;
          }
        }
        else if (componentType === 'monitor') {
          // 显示器特有字段
          const monitorParts = [
            item['面板类型'] || item.panel_type || '',
            item['分辨率'] || item.resolution || '',
            item['刷新率'] || item.refresh_rate || '',
            item['响应时间'] || item.response_time || '',
            item['屏幕尺寸'] || item.size || '',
            item['高动态范围'] || item.hdr || '',
            item['接口'] || item.ports || ''
          ].map(String).map(s => s.toLowerCase());
          
          // 任何一个字段匹配即可
          if (monitorParts.some(part => part.includes(keywordPart))) return true;
          
          // 特别处理显示器尺寸搜索
          if (/^\d+(\.\d+)?寸$/.test(keywordPart) || /^\d+(\.\d+)?英寸$/.test(keywordPart) || /^\d+(\.\d+)?inch$/.test(keywordPart)) {
            const size = (item['屏幕尺寸'] || item.size || '').toLowerCase();
            if (size.includes(keywordPart.replace(/inch/i, '英寸'))) return true;
          }
          
          // 特别处理分辨率搜索
          if (keywordPart.includes('1080p') || keywordPart.includes('2k') || keywordPart.includes('4k') || keywordPart.includes('1440p')) {
            const resolution = (item['分辨率'] || item.resolution || '').toLowerCase();
            if (resolution.includes(keywordPart)) return true;
            // 特别处理分辨率别名
            if (keywordPart === '1080p' && resolution.includes('1920x1080')) return true;
            if (keywordPart === '2k' && (resolution.includes('2560x1440') || resolution.includes('1440p'))) return true;
            if (keywordPart === '4k' && (resolution.includes('3840x2160') || resolution.includes('4k'))) return true;
          }
          
          // 特别处理面板类型搜索
          const panelTypes = ['ips', 'tn', 'va', 'oled', '曲面'];
          if (panelTypes.includes(keywordPart) || keywordPart.includes('曲面')) {
            const panelType = (item['面板类型'] || item.panel_type || '').toLowerCase();
            if (panelType.includes(keywordPart)) return true;
          }
          
          // 特别处理刷新率搜索
          if (/^\d+hz$/.test(keywordPart)) {
            const refreshRate = (item['刷新率'] || item.refresh_rate || '').toLowerCase();
            if (refreshRate.includes(keywordPart)) return true;
          }
        }
        
        // 未找到匹配项
        return false;
      });
    });
    
    debugLog(`[关键词筛选] 结果数量: ${result.length}`);
    return result;
  },

  /**
   * 应用兼容性筛选 - 前端
   */
  applyCompatibilityFilter: function(filteredComponents) {
    debugLog('[兼容性过滤:前端] 开始执行前端兼容性筛选');
    
    // 显示加载提示
    // wx.showLoading({ title: '正在筛选兼容组件...', mask: true });
    
    // 设置超时保护
    const timeoutId = setTimeout(() => {
      debugLog('[兼容性过滤:前端] 兼容性筛选超时');
      wx.hideLoading();
      wx.showToast({
        title: '兼容性筛选超时',
        icon: 'none',
        duration: 2000
      });
      // 超时时回退到普通筛选
      this.filterComponents(true);
    }, 10000); // 10秒超时
    
    try {
      // 获取当前组件类型
      const componentType = this.data.currentComponent;
      
      // 获取当前组件类型的所有组件（考虑已经应用的品牌和价格筛选）
      let components = filteredComponents || this.data.components[componentType] || [];
      
      // 如果没有传入已筛选的组件列表，则应用品牌和价格筛选
      if (!filteredComponents) {
        // 首先应用品牌和价格筛选（保持这部分逻辑不变）
        if (this.data.currentBrand !== 'all') {
          components = this.filterComponentsByBrand(components, this.data.currentBrand);
        }
        
        if (this.data.currentPrice !== 'all') {
          components = this.filterComponentsByPrice(components, this.data.currentPrice);
        }
        
        // 应用散热类型筛选
        if (this.data.currentComponent === 'cooling' && this.data.currentCoolingType !== 'all') {
          components = this.filterComponentsByCoolingType(components, this.data.currentCoolingType);
        }
      }
      
      debugLog(`[兼容性过滤:前端] 应用品牌、价格和类型筛选后，剩余${components.length}个组件`);
      
      // 改用异步处理以防止UI卡死
      // 将筛选操作放到下一个事件循环中
      setTimeout(() => {
        try {
          // 清除超时计时器
          clearTimeout(timeoutId);
          
          // 使用已选组件进行兼容性筛选
          const selectedItems = this.data.selectedItems;
          
          // 性能优化：将处理的组件数量上限改为非常大的值
          const MAX_COMPONENTS_TO_PROCESS = 10000;
          if (components.length > MAX_COMPONENTS_TO_PROCESS) {
            debugLog(`[兼容性过滤:前端] 组件数量(${components.length})超过限制，只处理前${MAX_COMPONENTS_TO_PROCESS}个`);
            components = components.slice(0, MAX_COMPONENTS_TO_PROCESS);
          }
          
          // 简化的兼容性检查，直接比较关键字段
          const compatibleComponents = components.filter(component => {
            // CPU与主板兼容性检查
            if (componentType === 'motherboard' && selectedItems.cpu) {
              // 同时检查socket和接口字段，确保不会漏掉有效值
              const cpuSocket = selectedItems.cpu.接口 || selectedItems.cpu.socket || '';
              const mbSocket = component.接口 || component.socket || '';
              
              // 规范化接口字符串（去除空格，转换为大写），确保格式一致
              const normCpuSocket = cpuSocket.replace(/\s+/g, '').toUpperCase();
              const normMbSocket = mbSocket.replace(/\s+/g, '').toUpperCase();
              
              debugLog(`[CPU-主板兼容性检查] CPU: ${selectedItems.cpu.名称 || selectedItems.cpu.name}, 接口: ${cpuSocket} [标准化:${normCpuSocket}], 主板: ${component.名称 || component.name}, 接口: ${mbSocket} [标准化:${normMbSocket}]`);
              
              if (normCpuSocket && normMbSocket && normCpuSocket !== normMbSocket) {
                debugLog(`[CPU-主板兼容性检查] 不兼容: ${normCpuSocket} !== ${normMbSocket}`);
                return false;
              } else if (!normCpuSocket || !normMbSocket) {
                debugLog(`[CPU-主板兼容性检查] 缺少必要信息，跳过兼容性检查: cpuSocket=${normCpuSocket}, mbSocket=${normMbSocket}`);
              } else {
                debugLog(`[CPU-主板兼容性检查] 兼容: ${normCpuSocket} === ${normMbSocket}`);
              }
            }
            
            // 反向检查：主板与CPU兼容性
            if (componentType === 'cpu' && selectedItems.motherboard) {
              // 同时检查socket和接口字段，确保不会漏掉有效值
              const cpuSocket = component.接口 || component.socket || '';
              const mbSocket = selectedItems.motherboard.接口 || selectedItems.motherboard.socket || '';
              
              // 规范化接口字符串（去除空格，转换为大写），确保格式一致
              const normCpuSocket = cpuSocket.replace(/\s+/g, '').toUpperCase();
              const normMbSocket = mbSocket.replace(/\s+/g, '').toUpperCase();
              
              debugLog(`[主板-CPU兼容性检查] CPU: ${component.名称 || component.name}, 接口: ${cpuSocket} [标准化:${normCpuSocket}], 主板: ${selectedItems.motherboard.名称 || selectedItems.motherboard.name}, 接口: ${mbSocket} [标准化:${normMbSocket}]`);
              
              if (normCpuSocket && normMbSocket && normCpuSocket !== normMbSocket) {
                debugLog(`[主板-CPU兼容性检查] 不兼容: ${normCpuSocket} !== ${normMbSocket}`);
                return false;
              } else if (!normCpuSocket || !normMbSocket) {
                debugLog(`[主板-CPU兼容性检查] 缺少必要信息，跳过兼容性检查: cpuSocket=${normCpuSocket}, mbSocket=${normMbSocket}`);
              } else {
                debugLog(`[主板-CPU兼容性检查] 兼容: ${normCpuSocket} === ${normMbSocket}`);
              }
            }
            
            // 内存与主板兼容性检查
            if ((componentType === 'ram' || componentType === 'memory') && selectedItems.motherboard) {
              // 直接获取内存接口类型
              const ramType = component.接口类型 || '';
              
              // 从主板的内存插槽字段中提取内存类型部分
              let mbMemoryType = '';
              if (selectedItems.motherboard.内存插槽) {
                // 使用更灵活的正则表达式匹配各种格式："4*D5", "4×D5", "4 x D5"等
                const memSlotMatch = selectedItems.motherboard.内存插槽.match(/\d+\s*[\*×xX]\s*([DdRr]\d+)/);
                if (memSlotMatch) {
                  mbMemoryType = memSlotMatch[1].toUpperCase();
                }
              }
              
              // 输出详细调试信息
              debugLog(`[内存兼容性检查-详细] 内存数据:`, {
                名称: component.名称 || component.name,
                接口类型: ramType,
                完整对象: JSON.stringify(component).substring(0, 100) + '...'
              });
              
              debugLog(`[内存兼容性检查-详细] 主板数据:`, {
                名称: selectedItems.motherboard.名称 || selectedItems.motherboard.name,
                内存插槽: selectedItems.motherboard.内存插槽,
                提取类型: mbMemoryType,
                完整对象: JSON.stringify(selectedItems.motherboard).substring(0, 100) + '...'
              });
              
              // 如果没有提取到主板内存类型，尝试其他可能的字段
              if (!mbMemoryType) {
                debugLog(`[内存兼容性检查-警告] 无法从内存插槽"${selectedItems.motherboard.内存插槽}"提取内存类型，尝试其他可能的字段`);
                
                // 直接尝试memoryType字段（如果存在）
                if (selectedItems.motherboard.memoryType) {
                  mbMemoryType = selectedItems.motherboard.memoryType.toUpperCase();
                  debugLog(`[内存兼容性检查] 使用memoryType字段: ${mbMemoryType}`);
                }
              }
              
              debugLog(`[内存兼容性检查] 最终比较: 内存接口类型(${ramType}) vs 主板内存类型(${mbMemoryType})`);
              
              // 只有当两者都有值且不相等时，才判定为不兼容
              if (ramType && mbMemoryType && ramType !== mbMemoryType) {
                debugLog(`[内存兼容性检查] 不兼容: ${ramType} !== ${mbMemoryType}`);
                return false;
              } else if (!ramType || !mbMemoryType) {
                debugLog(`[内存兼容性检查-警告] 缺少必要信息，跳过兼容性检查: ramType=${ramType}, mbMemoryType=${mbMemoryType}`);
              } else {
                debugLog(`[内存兼容性检查] 兼容: ${ramType} === ${mbMemoryType}`);
              }
            }
            
            // 所有兼容性检查通过
            return true;
          });
          
          debugLog(`[兼容性过滤:前端] 兼容性筛选后，剩余${compatibleComponents.length}个组件`);
          
          // 确保已选择的当前类型组件（如果有）排在列表最前面
          const currentType = this.data.currentComponent;
          const selectedItem = this.data.selectedItems[currentType];
          
          if (selectedItem) {
            debugLog(`[兼容性过滤:前端] 发现已选择的${currentType}组件，将其排在列表最前面`);
            
            // 从兼容性筛选结果中移除已选择的组件（如果存在于筛选结果中）
            const selectedItemIndex = compatibleComponents.findIndex(item => item.id === selectedItem.id);
            if (selectedItemIndex >= 0) {
              const selectedItemInList = compatibleComponents.splice(selectedItemIndex, 1)[0];
              
              // 将已选择的组件添加到列表最前面
              compatibleComponents.unshift(selectedItemInList);
              
              debugLog(`[兼容性过滤:前端] 已将选择的组件移到列表第一位`);
            } else {
              debugLog(`[兼容性过滤:前端] 已选择的组件不在兼容性筛选结果中`);
            }
          }
          
          // 更新显示的组件列表 - 同时更新allFilteredComponents
          this.setData({
            filteredComponents: compatibleComponents,
            allFilteredComponents: compatibleComponents, // 添加这行，确保价格排序使用相同的数据
            filteredComponentsCount: compatibleComponents.length,
            hasMoreComponents: compatibleComponents.length > this.data.displayedCount
          });
          
          wx.hideLoading();
          
          // 显示过滤结果
          if (compatibleComponents.length === 0) {
            wx.showToast({
              title: '没有找到兼容组件',
              icon: 'none',
              duration: 2000
            });
          } else {
            wx.showToast({
              title: `找到${compatibleComponents.length}个兼容组件`,
              icon: 'success',
              duration: 1500
            });
          }
        } catch (err) {
          clearTimeout(timeoutId);
          wx.hideLoading();
          console.error('[兼容性过滤:前端] 前端兼容性筛选出错:', err);
          console.error('[兼容性过滤:前端] 错误堆栈:', err.stack);
          
          wx.showToast({
            title: '兼容性筛选出错',
            icon: 'none',
            duration: 2000
          });
          
          // 出错时回退到普通筛选，传入true避免循环调用
          this.filterComponents(true);
        }
      }, 0); // 放到下一个事件循环中执行
    } catch (err) {
      clearTimeout(timeoutId);
      wx.hideLoading();
      console.error('[兼容性过滤:前端] 前端兼容性筛选出错:', err);
      console.error('[兼容性过滤:前端] 错误堆栈:', err.stack);
      
      wx.showToast({
        title: '兼容性筛选出错',
        icon: 'none',
        duration: 2000
      });
      
      // 出错时回退到普通筛选，传入true避免循环调用
      this.filterComponents(true);
    }
  },

  /**
   * 映射组件类型名称
   * @param {string} type 原始组件类型
   * @return {string} 映射后的组件类型
   */
  mapComponentType: function(type) {
    const mapping = {
      'memory': 'ram',
      'ram': 'ram',
      'powerSupply': 'psu',
      'psu': 'psu',
      'ssd': 'storage',
      'hdd': 'storage'
    };
    
    return mapping[type] || type;
  }
}); 