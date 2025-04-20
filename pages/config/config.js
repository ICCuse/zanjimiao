// pages/config/config.js
const app = getApp()
// 删除本地数据引用

Page({
  data: {
    // 步骤和选项数据
    steps: ['选择用途', '选择组件', '查看结果'],
    currentStep: 0,
    userPurpose: '', // 用户选择的用途：gaming, work, office, customize
    budget: 'medium', // 预算：low, medium, high, unlimited
    
    // 组件相关数据
    currentComponent: 'cpu', // 当前查看的组件类型
    currentBrand: 'all',    // 当前筛选的品牌
    currentPrice: 'all',    // 当前筛选的价格范围
    components: {},         // 所有组件数据
    filteredComponents: [], // 筛选后的组件
    filteredComponentsCount: 0,
    
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
          console.log(`通用提取品牌 (${type}):`, item);
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
            console.log(`通用品牌匹配: 项目=${JSON.stringify(item)}, 提取品牌=${itemBrand}, 目标品牌=${targetBrand}`);
            
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
          console.log(`CPU提取品牌, 原始项目:`, item);
          
          // 尝试多种可能的字段名
          let brand = item.品牌 || item.brand || '';
          
          // 调试日志
          console.log(`CPU初始品牌提取: ${brand}`);
          
          // 处理拼写错误的品牌 - 特别是"inter"应该是"intel"
          if (brand.toLowerCase() === 'inter') {
            brand = 'intel';
            console.log(`修正品牌拼写: inter -> intel`);
          }
          
          // 如果没有品牌字段，尝试从名称中提取
          if ((!brand || brand.trim() === '') && (item.名称 || item.name)) {
            const name = (item.名称 || item.name || '').toLowerCase();
            console.log(`CPU名称: ${name}`);
            
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
              console.log(`通过增强规则识别到AMD处理器: ${item.名称 || item.name}`);
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
              console.log(`标准化为AMD品牌: ${brand}, 原始值: ${item.品牌 || item.brand}`);
            }
          }
          
          console.log(`CPU最终提取品牌: ${brand}`);
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
            
            console.log(`[CPU匹配] 匹配项目: ${cpuName}, 品牌: ${cpuBrand}, 目标品牌: ${targetBrand}`);
            
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
                console.log(`[CPU匹配] 匹配成功-品牌字段: ${cpuName}`);
                return true;
              }
              
              // 名称中包含AMD或锐龙相关关键词
              if (lowerCpuName.includes('amd') || 
                  lowerCpuName.includes('ryzen') || 
                  lowerCpuName.includes('锐龙') ||
                  lowerCpuName.includes('threadripper') ||
                  lowerCpuName.includes('athlon') ||
                  /\br\d\b/i.test(lowerCpuName)) { // R3, R5, R7, R9等
                console.log(`[CPU匹配] 匹配成功-名称关键词: ${cpuName}`);
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
          
          console.log(`提取主板品牌: ${brand}, 名称: ${mbItem.name || ''}`);
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
          
          console.log(`提取内存品牌: ${brand}, 名称: ${ramItem.名称 || ''}`);
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
          
          console.log(`提取显卡品牌: ${brand}, 名称: ${gpuItem.名称 || ''}`);
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
          
          console.log(`提取存储品牌: ${brand}, 名称: ${storageItem.型号 || storageItem.名称 || ''}`);
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
          
          console.log(`提取电源品牌: ${brand}, 名称: ${psuItem.名称 || ''}`);
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
          
          console.log(`提取机箱品牌: ${brand}, 名称: ${caseItem.名称 || ''}`);
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
          
          console.log(`提取散热器品牌: ${brand}, 名称: ${coolingItem.名称 || ''}`);
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
  },

  /**
   * 页面加载时执行
   */
  onLoad: function() {
    console.log('[页面加载] 开始初始化页面');
    
    // 获取屏幕高度，用于设置滚动区域的高度
    try {
      const systemInfo = wx.getSystemInfoSync();
              this.setData({
        screenHeight: systemInfo.windowHeight
      });
      console.log(`[页面加载] 屏幕高度: ${systemInfo.windowHeight}px`);
    } catch (e) {
      console.error('[页面加载] 获取系统信息失败:', e);
    }
    
    // 初始化数据
    this.loadComponentData();
    
    // 初始化品牌折叠状态和显示数量
    this.setData({
      brandFolded: true,
      showAllBrands: false,
      initialBrandsCount: 6  // 默认显示的品牌数量
    });
    
    // 确保CPU品牌选项至少包含英特尔和AMD
    this.ensureCpuBrands();
    
    console.log('[页面加载] 页面初始化完成');
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
      console.log('初始化CPU品牌选项为默认值');
      
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
  loadComponentData: function() {
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
      env: 'pcconfig-7grn6s1naf2b91d9',  // 使用正确的云环境ID
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
      console.log(`正在加载${type}品牌统计数据...`);
      
      // 调用云函数获取品牌统计
      return wx.cloud.callFunction({
        name: 'getComponentsData',
        data: {
          componentType: type,
          mode: 'brandStats'
        }
      })
      .then(res => {
        console.log(`获取${type}品牌统计成功:`, res.result);
        
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
            
            console.log(`CPU品牌列表: ${brandOptions[type].join(', ')}`);
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
        console.log('所有组件品牌统计加载完成');
        
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
            console.log('自动补充CPU基本品牌选项');
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
  loadComponentsByType: function(componentType, brand = 'all') {
    console.log(`[数据加载] 开始从云端加载 ${componentType} 类型的 ${brand} 品牌数据`);
    
    // 返回Promise以便链式处理
    return new Promise((resolve, reject) => {
      // 检查是否该品牌的组件已经被标记为无数据
      const noDataKey = `${componentType}_${brand}_noData`;
      if (this.data[noDataKey]) {
        console.log(`[数据加载] ${componentType}的${brand}品牌已被标记为无数据，跳过请求`);
        wx.showToast({
          title: `暂无${brand === 'all' ? '' : brand}品牌的${componentType}数据`,
          icon: 'none',
          duration: 2000
        });
        resolve([]);
        return;
      }
      
      // 显示加载中提示
    wx.showLoading({
        title: '加载数据中...',
      mask: true
    });
    
      // 构建完整的请求参数
      const requestData = {
        componentType: componentType,
        brand: brand, // 传递品牌参数到云函数
        limit: 50,    // 限制返回的数据量，防止请求过大
        fetchAll: brand === 'all' // 如果是获取所有品牌，设置fetchAll标志
      };
      
      console.log(`[数据加载] 发送请求参数:`, requestData);
      
      // 调用云函数获取组件数据
      wx.cloud.callFunction({
        name: 'getComponentsData',
        data: requestData,
        success: res => {
          console.log(`[数据加载] 获取${componentType}数据成功，状态码:`, res.result?.code);
          
          if (res.result && res.result.data && Array.isArray(res.result.data)) {
            // 在控制台详细输出数据内容进行调试
            console.log(`[数据加载] 云函数返回的数据条数: ${res.result.data.length}`);
            
            // 检查是否返回了空数据
            if (res.result.data.length === 0) {
              console.warn(`[数据加载] 云函数返回了空数组，没有${componentType}的${brand}品牌数据`);
              
              // 标记该品牌的组件没有数据，避免重复请求
              const updateObj = {};
              updateObj[noDataKey] = true;
              this.setData(updateObj);
              
              // 显示提示
              wx.hideLoading();
              wx.showToast({
                title: `暂无${brand === 'all' ? '' : brand}品牌的${componentType}数据`,
                icon: 'none',
                duration: 2000
              });
              
              // 如果没有数据，尝试切换到其他品牌
              if (brand !== 'all') {
                // 选择其他可用品牌
                const brandOptions = this.data.brandOptions[componentType] || [];
                const otherBrands = brandOptions.filter(b => b !== brand);
                
                if (otherBrands.length > 0) {
                  const newBrand = otherBrands[0];
                  console.log(`[数据加载] 自动切换到${newBrand}品牌`);
                  this.setData({ currentBrand: newBrand });
                  
                  // 检查是否已加载过该品牌的数据
                  if (this.data.components[componentType] && this.data.components[componentType].some(item => item.brand === newBrand)) {
                    this.filterComponents();
                  } else {
                    this.loadComponentsByType(componentType, newBrand);
                  }
                }
              }
              
              resolve([]);
      return;
    }
    
            if (res.result.data.length > 0) {
              console.log(`[数据加载] 第一条数据样本:`, res.result.data[0]);
              
              // 特别处理CPU品牌分布统计
              if (componentType === 'cpu') {
                const brandCount = {};
                res.result.data.forEach(item => {
                  const cpuBrand = (item.brand || item.品牌 || '').toLowerCase();
                  brandCount[cpuBrand] = (brandCount[cpuBrand] || 0) + 1;
                });
                console.log(`[数据加载] CPU品牌分布:`, brandCount);
              }
            }
            
            // 格式化数据，确保符合前端期望的格式
            const formattedData = this.formatComponentData(componentType, res.result.data);
            console.log(`[数据加载] 格式化后的数据条数: ${formattedData.length}`);
            
            if (formattedData.length > 0) {
              // 记录品牌信息
              const brands = new Set();
              formattedData.forEach(item => {
                if (item.brand) brands.add(item.brand);
              });
              console.log(`[数据加载] 检测到的品牌: ${Array.from(brands).join(', ')}`);
            }
            
            // 更新数据集
            const componentsData = this.data.components;
            componentsData[componentType] = formattedData;
            
            // 确保有品牌选项
            let brandsList = res.result.brands || this.data.brandOptions[componentType] || [];
            
            // 确保CPU类型总是包含英特尔和AMD
            if (componentType === 'cpu' && brandsList.length > 0) {
              if (!brandsList.includes('英特尔')) brandsList.push('英特尔');
              if (!brandsList.includes('AMD')) brandsList.push('AMD');
            }
            
            this.setData({
              components: componentsData,
              [`brandOptions.${componentType}`]: brandsList
            });
            
            // 根据新数据筛选组件
            this.filterComponents();
            
            // 隐藏加载中提示
            wx.hideLoading();
            
            // 如果数据为空，显示提示
            if (formattedData.length === 0) {
        wx.showToast({
                title: `未找到${brand === 'all' ? '' : brand}品牌的${componentType}数据`,
          icon: 'none',
                duration: 2000
        });
            }
            
            // 返回结果数据
            resolve(formattedData);
      } else {
            console.error(`[数据加载] ${componentType}数据结构异常:`, res.result);
            wx.hideLoading();
        wx.showToast({
              title: '数据格式异常',
          icon: 'none'
        });
            reject(new Error('数据结构异常'));
          }
        },
        fail: err => {
          console.error(`[数据加载] 获取${componentType}数据失败:`, err);
          wx.hideLoading();
        wx.showToast({
            title: '数据加载失败',
          icon: 'none'
        });
          reject(err);
        }
      });
    });
  },
  
  /**
   * 格式化从数据库获取的组件数据，确保字段名一致
   */
  formatComponentData: function(type, data) {
    // 检查数据是否为空
    if (!data || !Array.isArray(data) || data.length === 0) {
      console.warn(`[配置] 格式化${type}组件时数据为空`);
      return [];
    }
    
    // 如果数据已经被云函数格式化，直接返回
    if (data[0].specs && Array.isArray(data[0].specs)) {
      console.log(`[配置] ${type}数据已由云函数格式化，直接使用`);
      
      // 如果是GPU组件，排序规格
      if (type === 'gpu') {
        return data.map(item => {
          if (item.specs && Array.isArray(item.specs)) {
            item.specs = this.sortGpuSpecs(item.specs);
          }
          return item;
        });
      }
      
      return data;
    }
    
    console.log(`开始格式化${type}数据，共${data.length}条`);
    
    try {
      // 检查数据是否已经被云函数标准化处理过
      if (data[0] && data[0].specs && Array.isArray(data[0].specs) && data[0].rawData) {
        console.log(`[格式化] ${type}数据已在云函数中格式化，保持原格式`);
        // 只确保每个组件有唯一ID和类型字段
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
              console.log(`CPU原始数据示例:`, item);
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
   * 筛选组件
   */
  filterComponents: function() {
    let { components, currentComponent, currentBrand, currentPrice } = this.data;
    
    console.log(`[筛选] 开始筛选组件 (类型: ${currentComponent}, 品牌: ${currentBrand}, 价格: ${currentPrice})`);
    
    // 首先检查该品牌是否被标记为无数据
    const noDataKey = `${currentComponent}_${currentBrand}_noData`;
    if (this.data[noDataKey]) {
      console.warn(`[筛选] ${currentComponent}的${currentBrand}品牌已被标记为无数据`);
      
      // 尝试自动切换到其他品牌
      const brandOptions = this.data.brandOptions[currentComponent] || [];
      const otherBrands = brandOptions.filter(b => b !== currentBrand);
      
      if (otherBrands.length > 0) {
        const newBrand = otherBrands[0];
        console.log(`[筛选] 由于无数据，自动切换到${newBrand}品牌`);
        
        this.setData({
          currentBrand: newBrand,
          filteredComponents: [],
          filteredComponentsCount: 0
        });
        
        // 检查是否已加载过该品牌的数据
        const hasData = components[currentComponent] && 
                       Array.isArray(components[currentComponent]) && 
                       components[currentComponent].some(item => item.brand === newBrand);
        
        if (hasData) {
          // 重新筛选
          setTimeout(() => this.filterComponents(), 0);
    } else {
          // 加载新品牌数据
          this.loadComponentsByType(currentComponent, newBrand);
        }
      } else {
        // 没有其他品牌可选，显示空结果
    this.setData({
          filteredComponents: [],
          filteredComponentsCount: 0
        });
        
      wx.showToast({
          title: `没有找到${currentComponent}数据`,
          icon: 'none',
          duration: 2000
      });
      }
      return;
    }
    
    // 检查组件数据是否存在
    if (!components[currentComponent] || !Array.isArray(components[currentComponent]) || components[currentComponent].length === 0) {
      console.warn(`[筛选] 没有${currentComponent}数据可筛选，尝试加载数据`);
        this.setData({
        filteredComponents: [],
        filteredComponentsCount: 0
      });
      
      // 如果没有数据，尝试加载默认品牌的数据
      if (currentBrand !== 'all') {
        console.log(`[筛选] 尝试加载${currentComponent}的${currentBrand}品牌数据`);
        this.loadComponentsByType(currentComponent, currentBrand);
      } else {
        // 如果仍然使用'all'，则尝试选择一个默认品牌
        let defaultBrand = currentComponent === 'cpu' ? '英特尔' : 
                          (this.data.brandOptions[currentComponent] && 
                           this.data.brandOptions[currentComponent].length > 0 ? 
                           this.data.brandOptions[currentComponent][0] : null);
        
        if (defaultBrand) {
          console.log(`[筛选] 自动选择默认品牌: ${defaultBrand}`);
          this.setData({ currentBrand: defaultBrand });
          this.loadComponentsByType(currentComponent, defaultBrand);
    } else {
          console.warn(`[筛选] 无法确定默认品牌，尝试加载所有数据`);
          this.loadComponentsByType(currentComponent, 'all');
        }
      }
      return;
    }
    
    // 显示初始数据情况
    const originalData = components[currentComponent];
    console.log(`[筛选] 筛选前 ${currentComponent} 总数量: ${originalData.length}`);
    
    if (originalData.length > 0) {
      // 输出一些样本数据进行调试
      console.log('[筛选] 数据样本:', originalData.slice(0, 2));
    } else {
      console.warn(`[筛选] ${currentComponent}数据为空数组，无法筛选`);
      return;
    }
    
    // 如果是CPU，额外显示品牌分布
    if (currentComponent === 'cpu') {
      // 统计主要品牌
          const brandStats = {};
      originalData.forEach(item => {
        const brand = (item.brand || '').toLowerCase();
            brandStats[brand] = (brandStats[brand] || 0) + 1;
          });
      
      console.log(`[筛选] CPU品牌统计:`, brandStats);
      
      // 检查是否有AMD和Intel的数据
      const amdCount = originalData.filter(item => 
        (item.brand || '').toLowerCase() === 'amd' || 
        ((item.name || '').toLowerCase().includes('amd') || 
         (item.name || '').toLowerCase().includes('ryzen'))
      ).length;
      
      const intelCount = originalData.filter(item => 
        (item.brand || '').toLowerCase() === 'intel' || 
        (item.brand || '') === '英特尔' ||
        ((item.name || '').toLowerCase().includes('intel') || 
         (item.name || '').toLowerCase().includes('酷睿'))
      ).length;
      
      console.log(`[筛选] 检测到 AMD CPU: ${amdCount}个, Intel CPU: ${intelCount}个`);
    }
    
    let filtered = [...(components[currentComponent] || [])];
    
    // 输出筛选前的数量
    console.log(`[筛选] 筛选前 ${currentComponent} 数量: ${filtered.length}`);
    
    // 品牌筛选 - 只有当品牌不是"all"时才需要筛选
    if (currentBrand !== 'all') {
      console.log(`[筛选] 按品牌筛选: ${currentBrand}`);
      
      // 使用适当的匹配函数进行品牌筛选
      const beforeFilterCount = filtered.length;
      filtered = filtered.filter(item => {
        let match = false;
        
        if (currentComponent === 'cpu') {
          // 使用专门的CPU品牌匹配函数
          match = this.data.componentBrandUtils.cpu.matchBrand(item, currentBrand);
    } else {
          // 使用通用品牌匹配逻辑
          const brandUtil = this.data.componentBrandUtils[currentComponent] || this.data.componentBrandUtils.common;
          match = brandUtil.matchBrand(item, currentBrand);
        }
        
        // 对于难以匹配的项目，尝试直接比较品牌名称（不区分大小写）
        if (!match && item.brand && currentBrand) {
          match = item.brand.toLowerCase() === currentBrand.toLowerCase() ||
                 item.brand.toLowerCase().includes(currentBrand.toLowerCase()) ||
                 currentBrand.toLowerCase().includes(item.brand.toLowerCase());
        }
        
        return match;
      });
      
      console.log(`[筛选] 品牌筛选后数量: ${filtered.length}/${beforeFilterCount}`);
      
      // 如果品牌筛选后数量为0，尝试更宽松的匹配
      if (filtered.length === 0 && components[currentComponent].length > 0) {
        console.log(`[筛选] 品牌筛选结果为空，尝试使用更宽松的匹配方式`);
        
        // 对CPU进行特殊处理
        if (currentComponent === 'cpu') {
          if (currentBrand === '英特尔' || currentBrand.toLowerCase() === 'intel') {
            filtered = components[currentComponent].filter(item => 
              (item.name && (
                item.name.toLowerCase().includes('intel') ||
                item.name.toLowerCase().includes('i3') ||
                item.name.toLowerCase().includes('i5') ||
                item.name.toLowerCase().includes('i7') ||
                item.name.toLowerCase().includes('i9') ||
                item.name.toLowerCase().includes('酷睿') ||
                item.name.toLowerCase().includes('奔腾') ||
                item.name.toLowerCase().includes('赛扬')
              )) || 
              (item.brand && (
                item.brand.toLowerCase().includes('intel') ||
                item.brand.toLowerCase() === '英特尔'
              ))
            );
          } else if (currentBrand === 'AMD') {
            filtered = components[currentComponent].filter(item => 
              (item.name && (
                item.name.toLowerCase().includes('amd') ||
                item.name.toLowerCase().includes('ryzen') ||
                item.name.toLowerCase().includes('锐龙') ||
                item.name.toLowerCase().includes('r3') ||
                item.name.toLowerCase().includes('r5') ||
                item.name.toLowerCase().includes('r7') ||
                item.name.toLowerCase().includes('r9')
              )) || 
              (item.brand && (
                item.brand.toLowerCase().includes('amd')
              ))
            );
          }
        }
        
        console.log(`[筛选] 宽松匹配后数量: ${filtered.length}`);
      }
    }
    
    // 按价格筛选
    if (currentPrice !== 'all') {
      const [minPrice, maxPrice] = this.getPriceRange(currentPrice);
      const beforePriceFilter = filtered.length;
      filtered = filtered.filter(item => 
        item.price >= minPrice && (maxPrice === 0 || item.price <= maxPrice)
      );
      console.log(`[筛选] 价格筛选后数量: ${filtered.length}/${beforePriceFilter}`);
    }
    
    console.log(`[筛选] 最终筛选后的${currentComponent}数量: ${filtered.length}`);
    
    // 如果筛选后没有数据，尝试切换到另一个品牌
    if (filtered.length === 0 && currentBrand !== 'all') {
      console.log(`[筛选] ${currentBrand}品牌没有${currentComponent}数据，尝试其他品牌`);
      
      // 显示没有数据的提示
      wx.showToast({
        title: `未找到${currentBrand}品牌的${currentComponent}`,
        icon: 'none',
        duration: 2000
      });
      
      // 如果是CPU且当前品牌是英特尔，尝试切换到AMD
      if (currentComponent === 'cpu' && (currentBrand === '英特尔' || currentBrand.toLowerCase() === 'intel')) {
        console.log(`[筛选] 尝试切换到AMD品牌`);
        this.setData({ currentBrand: 'AMD' });
        this.loadComponentsByType(currentComponent, 'AMD');
        return;
      }
      
      // 如果是CPU且当前品牌是AMD，尝试切换到英特尔
      if (currentComponent === 'cpu' && currentBrand === 'AMD') {
        console.log(`[筛选] 尝试切换到英特尔品牌`);
        this.setData({ currentBrand: '英特尔' });
        this.loadComponentsByType(currentComponent, '英特尔');
        return;
      }
      
      // 尝试其他可能的品牌
      const availableBrands = this.data.brandOptions[currentComponent] || [];
      
      if (availableBrands.length > 0) {
        // 找到当前品牌以外的其他品牌
        const otherBrands = availableBrands.filter(brand => brand !== currentBrand);
        
        if (otherBrands.length > 0) {
          const newBrand = otherBrands[0]; // 选择第一个其他品牌
          console.log(`[筛选] 切换到${newBrand}品牌`);
          
          this.setData({ currentBrand: newBrand });
          this.loadComponentsByType(currentComponent, newBrand);
          return;
        }
      }
      
      // 实在没有其他选择，尝试获取所有品牌数据
      console.log(`[筛选] 尝试获取所有品牌数据`);
      this.setData({ currentBrand: 'all' });
      this.loadComponentsByType(currentComponent, 'all');
      return;
    }
    
    // 更新筛选后的组件列表
    this.setData({
      filteredComponents: filtered,
      filteredComponentsCount: filtered.length
    });
  },

  /**
   * 获取价格范围
   */
  getPriceRange: function(priceOption) {
    switch (priceOption) {
      case 'low':
        return [0, 1000];
      case 'mid':
        return [1000, 2000];
      case 'high':
        return [2000, 4000];
      case 'premium':
        return [4000, 0]; // 0表示无上限
      default:
        return [0, 0]; // 全部价格范围
    }
  },

  /**
   * 切换组件类型
   */
  switchComponent: function(e) {
    const componentType = e.currentTarget.dataset.component || e.currentTarget.dataset.type;
    
    if (!componentType) return;
    
    console.log('[组件切换] 切换到组件类型:', componentType);
    
    // 自动选择一个默认品牌
    let defaultBrand = 'all';
    
    // 根据组件类型选择适当的默认品牌
    if (componentType === 'cpu') {
      // CPU默认显示英特尔产品
      defaultBrand = '英特尔';
    } else if (componentType === 'gpu') {
      // GPU默认显示英伟达产品
      defaultBrand = '英伟达';
    } else if (this.data.brandOptions[componentType] && 
              this.data.brandOptions[componentType].length > 0) {
      // 对于其他组件类型，如果有品牌数据，选择第一个品牌
      defaultBrand = this.data.brandOptions[componentType][0];
    }
    
    console.log(`[组件切换] 选择默认品牌: ${defaultBrand} 用于 ${componentType}`);
        
        this.setData({
      currentComponent: componentType,
      currentBrand: defaultBrand,
      currentPrice: 'all'
    });
    
    // 检查该组件类型的数据是否已加载
    if (!this.data.components[componentType] || 
        !Array.isArray(this.data.components[componentType]) || 
        this.data.components[componentType].length === 0) {
      // 如果数据未加载，则加载该类型的数据，并指定默认品牌
      console.log(`[组件切换] 组件${componentType}数据未加载，开始加载`);
      this.loadComponentsByType(componentType, defaultBrand);
    } else {
      // 使用现有数据进行筛选
      console.log(`[组件切换] 组件${componentType}已有数据，开始筛选`);
      this.filterComponents();
    }
  },

  /**
   * 按品牌筛选组件
   */
  filterByBrand: function(e) {
    const brand = e.currentTarget.dataset.brand;
    const type = this.data.currentComponent;
    
    console.log(`筛选${type}组件，品牌: ${brand}`);
    
    // 如果选择了相同的品牌，不重复加载
    if (this.data.currentBrand === brand) {
      console.log('已经是当前选中的品牌，不重复加载');
      return;
    }
    
    // 显示加载提示
    wx.showLoading({
      title: '加载数据中...',
      mask: true
    });
    
    // 超时保护，10秒后如果还未加载完成，自动关闭加载提示
    const loadingTimeout = setTimeout(() => {
        wx.hideLoading();
          wx.showToast({
        title: '数据加载超时，请重试',
          icon: 'none'
        });
    }, 10000);
    
    // 更新当前选中的品牌
    this.setData({
      currentBrand: brand
    });
    
    // 从云端加载指定品牌的数据
    this.loadComponentsByType(type, brand)
      .then(data => {
        // 清除超时保护
        clearTimeout(loadingTimeout);
        
        // 隐藏加载提示
        wx.hideLoading();
        
        // 显示加载结果
        console.log(`成功加载 ${data.length} 个 ${brand} 品牌的 ${type} 数据`);
        
        if (data.length === 0) {
          wx.showToast({
            title: `未找到${brand}品牌的${type}数据`,
            icon: 'none'
          });
        } else {
          wx.showToast({
            title: `已加载${data.length}条数据`,
            icon: 'success'
          });
          
          // 直接进行筛选，应用当前品牌和价格筛选
          this.filterComponents();
        }
      })
      .catch(err => {
        // 清除超时保护
        clearTimeout(loadingTimeout);
        
        // 隐藏加载提示
        wx.hideLoading();
        
        console.error('品牌筛选数据加载失败:', err);
        wx.showToast({
          title: '加载失败，请重试',
          icon: 'none'
        });
        
        // 出错时恢复到"全部"品牌
        this.setData({
          currentBrand: 'all'
        });
    });
  },

  /**
   * 按价格筛选组件
   */
  filterByPrice: function(e) {
    const price = e.currentTarget.dataset.price;
      this.setData({
      currentPrice: price
    });
        this.filterComponents();
  },

  /**
   * 计算总价
   */
  calculateTotalPrice: function() {
    const { selectedItems } = this.data;
    let totalPrice = 0;
    
    if (selectedItems) {
    Object.values(selectedItems).forEach(item => {
        if (item && typeof item.price === 'number') {
          totalPrice += item.price;
      }
    });
    }
    
    this.setData({ totalPrice });
    return totalPrice;
  },

  /**
   * 选择组件
   */
  selectComponent: function(e) {
    const id = e.currentTarget.dataset.id;
    const { currentComponent, filteredComponents, selectedItems } = this.data;
      
      // 查找选中的组件
    const selectedComponent = filteredComponents.find(item => item.id === id);
    
    if (selectedComponent) {
      // 更新已选组件
      const newSelectedItems = { ...selectedItems };
      newSelectedItems[currentComponent] = selectedComponent;
      
    this.setData({
        selectedItems: newSelectedItems
      });
      
      console.log(`已选择${currentComponent}: ${selectedComponent.name}`);
      
      // 重新计算总价
      this.calculateTotalPrice();
      
      // 如果启用了自动切换，切换到下一个组件
      if (this.data.autoSwitchToNext) {
        this.switchToNextComponent();
      }
    }
  },
  
  /**
   * 切换到下一个组件
   */
  switchToNextComponent: function() {
    const componentOrder = ['cpu', 'motherboard', 'ram', 'gpu', 'storage', 'psu', 'case', 'cooling', 'monitor'];
    const currentIndex = componentOrder.indexOf(this.data.currentComponent);
    
    if (currentIndex >= 0 && currentIndex < componentOrder.length - 1) {
      const nextComponent = componentOrder[currentIndex + 1];
        this.setData({
        currentComponent: nextComponent,
          currentBrand: 'all',
          currentPrice: 'all'
        });
      
      // 应用筛选
        this.filterComponents();
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
      userId: wx.cloud.inited ? wx.cloud.getOpenId() : null
    };
    
    this.setData({ finalConfig });
    
    return finalConfig;
  },
  
  /**
   * 保存配置
   */
  saveConfig: function() {
    // 生成最终配置
    const config = this.generateFinalConfig();
    
    console.log('保存配置:', config);
    
    // 显示加载提示
    wx.showLoading({
      title: '保存中',
      mask: true
    });
    
    // 调用云函数保存配置
    wx.cloud.callFunction({
      name: 'saveConfig',
      data: {
        config: config
      },
      success: res => {
        wx.hideLoading();
          wx.showToast({
          title: '配置已保存',
            icon: 'success'
          });
        
        // 可以在这里添加跳转到配置列表页面的逻辑
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
    console.log("组件对象键名:", Object.keys(components));
    
    // 遍历每种组件类型
    Object.keys(components).forEach(type => {
      // 安全检查，确保组件数据存在且是数组
      if (!components[type] || !Array.isArray(components[type])) {
        console.warn(`组件类型 ${type} 的数据不存在或不是数组，跳过处理`);
        brandOptions[type] = []; // 创建空数组避免后续引用错误
        return; // 跳过此类型处理
      }
      
      console.log(`处理 ${type} 组件品牌，数据量: ${components[type].length}`);
      
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
              console.log(`使用备选品牌: ${fallbackBrand} 用于 ${type}`);
            }
          }
        });
        
        // 从映射中提取唯一品牌
        const uniqueBrands = Object.keys(brandMap);
        
        // 按字母顺序排序
        uniqueBrands.sort();
        
        // 输出品牌统计信息
        console.log(`${type}品牌统计:`, brandMap);
        
        // 设置该组件类型的品牌选项
        brandOptions[type] = uniqueBrands;
        
        console.log(`${type}组件品牌列表 (共${uniqueBrands.length}个):`, uniqueBrands);
        
        // 特别处理CPU类型，确保至少有英特尔和AMD两个选项
        if (type === 'cpu' && uniqueBrands.length < 2) {
          console.warn('CPU品牌列表不完整，添加默认品牌');
          const defaultCpuBrands = ['英特尔', 'AMD'];
          defaultCpuBrands.forEach(brand => {
            if (!brandOptions[type].includes(brand)) {
              brandOptions[type].push(brand);
            }
          });
          console.log(`添加默认品牌后的CPU品牌列表:`, brandOptions[type]);
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
          console.log('CPU品牌处理出错，使用默认品牌列表');
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
    console.log('===== CPU数据调试信息 =====');
    
    const allCpus = this.data.components?.cpu || [];
    console.log(`总共加载了 ${allCpus.length} 个CPU`);
    
    if (allCpus.length === 0) {
      console.error('没有加载到任何CPU数据，请检查数据库连接和查询');
      return;
    }
    
    // 展示前5条原始数据以便调试
    console.log('前5条CPU原始数据:', allCpus.slice(0, 5).map(cpu => ({
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
    
    console.log('品牌分布:', brandCount);
    console.log(`检测到的AMD CPU数量: ${amdCpus.length}`);
    console.log(`检测到的Intel CPU数量: ${intelCpus.length}`);
    console.log(`未识别品牌CPU数量: ${otherCpus.length}`);
    
    // 样本展示
    if (amdCpus.length > 0) {
      console.log('AMD CPU样本:', amdCpus.slice(0, 3).map(cpu => ({
        id: cpu.id,
        name: cpu.name,
        brand: cpu.brand
      })));
    } else {
      console.warn('未检测到AMD CPU! 请检查数据库或品牌字段设置');
      
      // 检查是否有名称中含AMD却没有正确品牌的CPU
      const potentialAmd = allCpus.filter(cpu => 
        (cpu.name || '').toLowerCase().includes('amd') || 
        (cpu.name || '').toLowerCase().includes('ryzen') ||
        (cpu.name || '').toLowerCase().includes('锐龙')
      );
      
      if (potentialAmd.length > 0) {
        console.warn('发现可能的AMD CPU，但品牌字段不是AMD:', potentialAmd.slice(0, 3));
      }
    }
    
    if (intelCpus.length > 0) {
      console.log('Intel CPU样本:', intelCpus.slice(0, 3).map(cpu => ({
        id: cpu.id,
        name: cpu.name,
        brand: cpu.brand
      })));
    }
    
    if (otherCpus.length > 0) {
      console.log('其他CPU样本:', otherCpus.slice(0, 3).map(cpu => ({
        id: cpu.id,
        name: cpu.name,
        brand: cpu.brand
      })));
    }
    
    // 测试品牌选项生成
    console.log('===== 品牌选项测试 =====');
    console.log('CPU品牌选项:', this.data.brandOptions?.cpu || []);
    
    // 测试筛选
    if (amdCpus.length > 0) {
      console.log('AMD筛选应该可以正常工作');
    } else {
      console.warn('警告: 没有AMD数据，筛选可能会显示空结果');
    }
    
    console.log('===== CPU调试结束 =====');
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
   * 排序GPU规格，将重要参数排在前面
   * @param {Array} specs - 规格数组
   * @return {Array} - 排序后的规格数组
   */
  sortGpuSpecs: function(specs) {
    if (!specs || !Array.isArray(specs)) return specs;
    
    // 重要规格的权重映射
    const priorityMap = {
      '显存': 100,
      '显存大小': 100,
      'VRAM': 100,
      '显存类型': 90,
      '核心频率': 80,
      '频率': 80,
      '显存频率': 75,
      '功耗': 70,
      'TDP': 70,
      '接口': 60,
      'PCIe': 60,
      '散热': 50,
      '长度': 40
    };
    
    // 排序规格
    return specs.sort((a, b) => {
      const labelA = a.label || '';
      const labelB = b.label || '';
      
      // 获取优先级，如果不在映射表中，返回-1
      const getPriority = (label) => {
        // 精确匹配
        if (priorityMap[label] !== undefined) {
          return priorityMap[label];
        }
        
        // 模糊匹配 (如果标签包含关键词)
        for (const [key, value] of Object.entries(priorityMap)) {
          if (label.indexOf(key) >= 0) {
            return value - 5; // 略微降低优先级
          }
        }
        
        return -1;
      };
      
      const priorityA = getPriority(labelA);
      const priorityB = getPriority(labelB);
      
      // 如果两者都有优先级，按优先级排序
      if (priorityA >= 0 && priorityB >= 0) {
        return priorityB - priorityA;
      }
      
      // 如果只有一个有优先级，有优先级的排前面
      if (priorityA >= 0) return -1;
      if (priorityB >= 0) return 1;
      
      // 如果都没优先级，按原顺序
      return 0;
    });
  },
}); 