/**
 * 工具函数主入口
 */
const performance = require('./performance');
const compatibility = require('./compatibility');

module.exports = {
  ...performance,
  ...compatibility,
}; 