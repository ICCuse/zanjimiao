const fs = require('fs');
const path = require('path');

// 输入和输出文件路径
const csvFilePath = path.join(__dirname, '主板.CSV');
const outputFilePath = path.join(__dirname, 'motherboard_data_fixed.jsonl');
const outputJsonPath = path.join(__dirname, 'motherboard_data_final.json');

// 品牌名称映射
const brandMapping = {
  '华硕': 'ASUS',
  '华擎': 'ASRock',
  '技嘉': 'GIGABYTE',
  '微星': 'MSI',
  '七彩虹': 'Colorful',
  '映泰': 'BIOSTAR',
  '铭瑄': 'MAXSUN',
  '昂达': 'ONDA',
  '梅捷': 'SOYO',
  '华擎幻影': 'ASRock Phantom'
};

// 检查文件是否存在
if (!fs.existsSync(csvFilePath)) {
  console.error(`错误: 找不到CSV文件: ${csvFilePath}`);
  process.exit(1);
}

try {
  // 读取CSV文件并使用utf-8编码
  let csvData = fs.readFileSync(csvFilePath, { encoding: 'utf-8' });
  
  // 替换掉CSV中的\r字符
  csvData = csvData.replace(/\r/g, '');
  
  // 按行分割
  const lines = csvData.split('\n');
  
  // 处理并转换数据
  const motherboards = [];
  
  // 设置进度计数器
  let processedCount = 0;
  let skippedCount = 0;
  
  // 从第2行开始处理数据（跳过标题行）
  for (let i = 1; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) {
      skippedCount++;
      continue; // 跳过空行
    }
    
    // 分割CSV行
    const fields = line.split(',');
    if (fields.length < 9) {
      skippedCount++;
      continue; // 确保有足够的字段
    }
    
    // 提取字段
    let [brand, chipset, name, socket, memorySlots, formFactor, sata, m2, price] = fields;
    
    // 清理和格式化数据
    brand = brand ? brand.trim() : '';
    chipset = chipset ? chipset.trim() : '';
    name = name ? name.trim() : '';
    socket = socket ? socket.trim() : '';
    
    // 跳过完全空的记录行
    if (!brand && !chipset && !name && !socket) {
      skippedCount++;
      continue;
    }
    
    // 转换品牌名称
    if (brandMapping[brand]) {
      brand = brandMapping[brand];
    }
    
    // 修复品牌名称（如果名字中包含品牌）
    for (const [chineseBrand, englishBrand] of Object.entries(brandMapping)) {
      if (name && name.includes(chineseBrand)) {
        brand = englishBrand;
        // 从名称中移除品牌名称，防止重复
        name = name.replace(chineseBrand, '').trim();
        break;
      }
    }
    
    // 提取内存插槽信息 (例如 "4*D5" -> 4, "D5")
    let memoryType = '';
    if (memorySlots) {
      const memMatch = memorySlots.match(/(\d+)\s*[\*×xX]\s*([DdRr]\d+)/);
      if (memMatch) {
        memorySlots = parseInt(memMatch[1], 10);
        memoryType = memMatch[2].toUpperCase(); // 标准化内存类型为大写 (D5, D4等)
      } else {
        // 如果无法解析，设置默认值
        memorySlots = 0;
      }
    } else {
      memorySlots = 0;
    }
    
    // 清理尺寸格式 (例如 "ATX (30.5*24.4cm)" -> "ATX (30.5×24.4cm)")
    if (formFactor) {
      // 修复格式化问题：替换特殊字符和添加单位
      formFactor = formFactor
        .replace(/◆◆/g, '×')
        .replace(/\*/g, '×')
        .replace(/x/g, '×')
        .replace(/X/g, '×');
      
      // 处理缺少单位的情况
      if (formFactor.includes('(') && !formFactor.includes('cm')) {
        formFactor = formFactor.replace(/\)$/, 'cm)');
      }
    } else {
      formFactor = '';
    }
    
    // 解析数字字段
    sata = sata ? parseInt(sata, 10) || 0 : 0;
    m2 = m2 ? parseInt(m2, 10) || 0 : 0;
    
    // 处理价格：删除非数字字符并转换为数字
    if (price) {
      // 去除任何非数字字符（除小数点外）
      price = price.replace(/[^\d.]/g, '');
      price = parseFloat(price) || 0;
    } else {
      price = 0;
    }
    
    // 创建主板对象
    const motherboard = {
      brand,
      chipset,
      name,
      socket,
      memorySlots,
      memoryType,
      formFactor,
      sata,
      m2,
      price
    };
    
    motherboards.push(motherboard);
    processedCount++;
  }
  
  // 将每个主板对象写入JSONL文件（每行一个JSON对象）
  fs.writeFileSync(outputFilePath, motherboards.map(m => JSON.stringify(m)).join('\n'), 'utf8');
  
  // 同时创建一个标准JSON数组格式的文件，方便查看和验证
  fs.writeFileSync(outputJsonPath, JSON.stringify(motherboards, null, 2), 'utf8');
  
  console.log(`成功处理 ${processedCount} 个主板记录，跳过 ${skippedCount} 行`);
  console.log(`JSONL数据已保存到: ${outputFilePath}`);
  console.log(`JSON数据已保存到: ${outputJsonPath}`);
} catch (error) {
  console.error(`处理文件时发生错误: ${error.message}`);
  console.error(error.stack);
} 